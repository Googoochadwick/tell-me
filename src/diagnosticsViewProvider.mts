import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import * as path from "path";

const ai = new GoogleGenAI({apiKey: "AIzaSyAKh12fGLGKYPxqemZNatD3e-HU41ZuVHw"});

export class DiagnosticsViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'diagnosticsView';

    private _view?: vscode.WebviewView;
    private geminiOutput = "Click the button to compile and run.";

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "runCompiler") {
                await this.runAnalysis();
            }
        });

        this.update();
    }

    private update() {
        if (this._view) {
            this._view.webview.html = this.getHtml();
        }
    }

    private async runAnalysis() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            this.geminiOutput = "No active editor.";
            this.update();
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const fileName = path.basename(filePath);

        const result = await this.compileAndRun(filePath);
        // Atharva and Pradeepto stuff
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `You are an educational programming tutor, not a code generator.

Your goal is to help the user understand compiler errors, runtime behavior,
and programming concepts WITHOUT providing full solutions or complete code.

Rules you must follow:
- Do NOT write full corrected programs.
- Do NOT provide copy-paste-ready solutions.
- Do NOT invent errors or behavior not shown in the output.
- Base all explanations strictly on the given program output.
- If the program fails to compile or run, explain WHY, not HOW to fully fix it.
- You may suggest small, local hints (e.g. "check the condition", "verify types"),
  but never provide full rewritten code.

Context:
The following output comes from compiling and running this file:
File name: ${fileName}

What you should do:
1. Identify whether the issue is a compile-time error, runtime error, or logical issue.
2. Explain what the compiler or runtime is complaining about in simple terms.
3. Point out the underlying concept the user should understand.
4. Give 1–3 concise hints that guide the user toward fixing the issue themselves.

If there are NO errors:
- Briefly explain why the program works.
- Mention one concept the user demonstrated correctly.
- Optionally suggest a small improvement or next learning step.

Program output (verbatim, do not reinterpret):
${result}
                `.trim()
            });

            this.geminiOutput = response.text ?? "No response from Gemini.";
        } catch (err: any) {
            this.geminiOutput = "Gemini error: " + (err?.message ?? String(err));
        }

        this.update();
    }

    private compileAndRun(filePath: string): Promise<string> {
        return new Promise((resolve) => {
            const ext = path.extname(filePath).toLowerCase();

            let compiler: string | null = null;

            if (ext === ".c") compiler = "gcc";
            if ([".cpp", ".cc", ".cxx"].includes(ext)) compiler = "g++";

            if (!compiler) {
                resolve(`Unsupported file type (${ext}).`);
                return;
            }

            const outputBinary =
                process.platform === "win32" ? "a.exe" : "./a.out";

            const compile = spawn(compiler, [filePath, "-o", outputBinary]);

            let compileErrors = "";

            compile.stderr.on("data", (d) => {
                compileErrors += d.toString();
            });

            compile.on("close", () => {
                if (compileErrors.trim()) {
                    resolve("Compilation failed:\n" + compileErrors);
                    return;
                }

                const run = spawn(outputBinary, [], { shell: true });

                let runtimeOutput = "";

                run.stdout.on("data", (d) => {
                    runtimeOutput += d.toString();
                });

                run.stderr.on("data", (d) => {
                    runtimeOutput += d.toString();
                });

                run.on("close", (code) => {
                    resolve(
                        runtimeOutput.trim()
                            ? runtimeOutput
                            : `Program exited with code ${code} and no output.`
                    );
                });

                run.on("error", (err) => {
                    resolve("Failed to execute program: " + err.message);
                });
            });

            compile.on("error", (err) => {
                resolve("Failed to start compiler: " + err.message);
            });
        });
    }
    //Shrestha Stuff 
    private getHtml(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
body {
    font-family: system-ui;
    padding: 12px;
    background: #1e1e1e;
    color: #ddd;
}

button {
    background: #3794ff;
    color: white;
    border: none;
    padding: 8px 12px;
    cursor: pointer;
    margin-bottom: 12px;
}

.output {
    background: #252526;
    padding: 12px;
    border-left: 4px solid #3794ff;
    min-height: 80px;
    white-space: pre-wrap;
    transition: opacity 0.2s ease;
}

/* Spinner styling */
.loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 3px solid #ddd;
    border-top: 3px solid #3794ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    vertical-align: middle;
    margin-right: 8px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.output pre {
    background: #1e1e1e;
    padding: 8px;
    overflow-x: auto;
}
</style>
</head>
<body>

<button id="run">Compile & Run</button>

<div class="output" id="output"></div>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<script>
const vscode = acquireVsCodeApi();
const output = document.getElementById("output");

// render initial content
const initialContent = ${JSON.stringify(this.geminiOutput)}; //Atharva and Pradeepto stuff
if (typeof marked !== "undefined") {
    output.innerHTML = marked.parse(initialContent);
} else {
    output.textContent = initialContent;
}

// handle button click
document.getElementById("run").addEventListener("click", () => {
    // show loading spinner immediately
    output.innerHTML = '<span class="loading"></span> Running...';
    vscode.postMessage({ command: "runCompiler" });
});
</script>

</body>
</html>
        `;
    }
}
