import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import * as dotenv from "dotenv";
import { pathToFileURL } from "url";



// 🔥 Node-side transformers (THIS is the key fix)
import { pipeline, env } from "@xenova/transformers";

// Hardcode your absolute model folder here (must contain config.json and tokenizer.json)
const MANUAL_MODEL_PATH = "C:/Users/palpr/Programming_Projects/Hackathon/VSCode-TheHelper/tell-me/media/model/";

export class DiagnosticsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "diagnosticsView";

    private _view?: vscode.WebviewView;
    private outputText = "Click the button to compile and run.";
    private generator: any = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Load local .env to pick up model dir overrides
        dotenv.config({ path: path.join(this.context.extensionPath, ".env") });
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === "runCompiler") {
                await this.runAnalysis();
            }
        });

        this.update();
    }

    private update() {
        if (!this._view) return;
        this._view.webview.html = this.getHtml();
    }

    // ================= AI (NODE SIDE) =================
    private async loadModel() {
        if (this.generator) return;

        const fs = await import("fs");
        const manualModel = MANUAL_MODEL_PATH.trim() || undefined;
        const modelPath = manualModel
            ? path.resolve(manualModel)
            : path.resolve(this.context.extensionPath, "media", "model");
        const modelUrl = pathToFileURL(modelPath).href;
        console.log("Loading model from:", modelPath);

        // Check if tokenizer.json exists
        const tokenizerPath = path.join(modelPath, "tokenizer.json");
        if (!fs.existsSync(tokenizerPath)) {
            throw new Error(
                `Local model error: tokenizer.json not found at ${tokenizerPath}`
            );
        }

        // Set the local model path to the directory containing the model
        // and pass the basename to the pipeline. This avoids the leading slash issue.
        const modelDir = path.dirname(modelPath);
        const modelName = path.basename(modelPath);

        env.localModelPath = modelDir;
        env.allowLocalModels = true;
        env.allowRemoteModels = false;

        console.log("Setting env.localModelPath to:", modelDir);
        console.log("Loading model:", modelName);

        try {
            this.generator = await pipeline("text2text-generation", modelName, {
                local_files_only: true, // enforce offline/local usage
            });
            console.log("Local model loaded successfully.");
        } catch (err: any) {
            console.error("Error loading local model:", err);
            throw err;
        }
    }

    private async analyzeWithModel(prompt: string): Promise<string> {
        try {
            await this.loadModel();

            const out = await this.generator(prompt, {
                max_new_tokens: 1024,
                repetition_penalty: 1.2,
                num_beams: 1, // Keep it simple for local speed, but could increase for quality
            });

            return out[0].generated_text;
        } catch (err: any) {
            console.error("Error during model inference:", err);
            throw new Error("Failed to run local model: " + err.message);
        }
    }


    // ================= ANALYSIS =================
    private async runAnalysis() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.outputText = "No active editor.";
            this.update();
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const fileName = path.basename(filePath);
        const result = await this.compileAndRun(filePath);

        const code = editor.document.getText();
        const prompt = `
[SYSTEM]
You are a simple programming tutor. 
Use the TEMPLATE below to explain the error in the CODE based on the OUTPUT.
Keep it simple for beginners. No jargon.

[CODE]
${code}

[OUTPUT]
${result}

[TEMPLATE]
✅ LLM Error Explanation (Universal)

🟥 Error Overview
Error Message: 
Language/Tool: ${path.extname(fileName).slice(1) || "Unknown"}

📍 Where the Error Occurs
File: ${fileName}
Line: 
Code Context: 

🧠 What the Error Means
(Explain simply)

❌ Problematic Code
(Copy the bad line)

✅ Corrected Code
(Provide fixed line)

📌 Rule to Remember
(One short rule)

Detailed Explanation:
`.trim();

        try {
            this.outputText = await this.analyzeWithModel(prompt);
        } catch (err: any) {
            this.outputText = "Local model error:\n" + err.message;
        }

        this.update();
    }

    // ================= COMPILER =================
    private compileAndRun(filePath: string): Promise<string> {
        return new Promise((resolve) => {
            const ext = path.extname(filePath).toLowerCase();
            let compiler: string | null = null;

            if (ext === ".c") compiler = "gcc";
            if ([".cpp", ".cc", ".cxx"].includes(ext)) compiler = "g++";

            if (!compiler) {
                resolve(`Unsupported file type: ${ext}`);
                return;
            }

            const outputBinary =
                process.platform === "win32" ? "a.exe" : "./a.out";

            const compile = spawn(compiler, [filePath, "-o", outputBinary]);
            let stderr = "";

            compile.stderr.on("data", (d) => (stderr += d.toString()));

            compile.on("close", () => {
                if (stderr.trim()) {
                    resolve("Compilation failed:\n" + stderr);
                    return;
                }

                const run = spawn(outputBinary, [], { shell: true });
                let output = "";

                run.stdout.on("data", (d) => (output += d.toString()));
                run.stderr.on("data", (d) => (output += d.toString()));

                run.on("close", (code) => {
                    resolve(output.trim() || `Program exited with code ${code}`);
                });
            });
        });
    }

    // ================= UI (UNCHANGED STYLE) =================
    private getHtml(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />

<style>
body {
    background: #0f1115;
    color: #e5e7eb;
    font-family: system-ui;
    padding: 12px;
}
button {
    width: 100%;
    padding: 10px;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    background: #3794ff;
    color: white;
}
pre {
    white-space: pre-wrap;
    background: #1b1f2a;
    padding: 12px;
    border-radius: 10px;
    margin-top: 12px;
}
</style>
</head>

<body>
<button id="run">Compile & Run</button>
<pre id="output">${this.outputText}</pre>

<script>
const vscode = acquireVsCodeApi();

document.getElementById("run").onclick = () => {
    document.getElementById("output").textContent = "Running...";
    vscode.postMessage({ command: "runCompiler" });
};
</script>

</body>
</html>
        `;
    }
}
