import * as fs from 'fs';
import * as path from "path";
import { fileURLToPath } from 'url';
import * as os from 'os';
import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import dotenv from 'dotenv';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root
try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
} catch (err) {
    console.warn('Could not load .env file; using process.env:', err);
}

const ai = new GoogleGenAI({apiKey: "AIzaSyAKh12fGLGKYPxqemZNatD3e-HU41ZuVHw"});

// Local Gemma model setup using Python
async function loadGemmaModel(prompt: string): Promise<string> {
    const modelPath = process.env.GEMMA_MODEL_DIR || path.join(__dirname, '..', 'functiongemma-270m-it');
    
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Model folder not found: ${modelPath}`);
    }

    // Find Python executable (venv or global)
    let pythonExe = 'python';
    const venvPath = process.env.PYTHON_VENV || path.join(__dirname, '..', '.venv');
    
    if (fs.existsSync(venvPath)) {
        // Use venv Python if it exists
        const venvPython = path.join(venvPath, 'Scripts', 'python.exe'); // Windows
        if (fs.existsSync(venvPython)) {
            pythonExe = venvPython;
            console.log('Using venv Python:', pythonExe);
        }
    }

    return new Promise((resolve, reject) => {
        // Write prompt to temp file to avoid escaping issues
        const tmpFile = path.join(os.tmpdir(), `prompt_${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, prompt, 'utf-8');

        const pythonScript = `
import sys
from transformers import pipeline

model_path = r'${modelPath.replace(/\\/g, '\\\\')}'
with open(r'${tmpFile.replace(/\\/g, '\\\\')}', 'r', encoding='utf-8') as f:
    prompt = f.read()

try:
    generator = pipeline('text-generation', model=model_path, device=-1)
    output = generator(prompt, max_new_tokens=512, temperature=0.7, do_sample=True)
    result = output[0]['generated_text']
    print(result)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
finally:
    import os
    try:
        os.remove(r'${tmpFile.replace(/\\/g, '\\\\')}')
    except:
        pass
`;

        const python = spawn(pythonExe, ['-c', pythonScript]);
        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', (code) => {
            // Clean up temp file if it still exists
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (e) {
                // Ignore cleanup errors
            }

            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Python error: ${stderr}`));
            }
        });

        python.on('error', (err) => {
            try {
                if (fs.existsSync(tmpFile)) {
                    fs.unlinkSync(tmpFile);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
            reject(new Error(`Failed to spawn Python: ${err.message}`));
        });
    });
}

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
        //Using local Gemma model via Python instead of Gemini API
        try {
            const prompt = `
You are an educational programming tutor, not a code generator.

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
            `.trim();

            const response = await loadGemmaModel(prompt);
            this.geminiOutput = response.replace(prompt, '').trim() || response;
        } catch (err: any) {
            this.geminiOutput = "Local model error: " + (err?.message ?? String(err));
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

            compile.stderr.on("data", d => {
                compileErrors += d.toString();
            });

            compile.on("close", () => {
                if (compileErrors.trim()) {
                    resolve("Compilation failed:\n" + compileErrors);
                    return;
                }

                const run = spawn(outputBinary, [], { shell: true });

                let runtimeOutput = "";

                run.stdout.on("data", d => runtimeOutput += d.toString());
                run.stderr.on("data", d => runtimeOutput += d.toString());

                run.on("close", code => {
                    resolve(
                        runtimeOutput.trim()
                            ? runtimeOutput
                            : `Program exited with code ${code} and no output.`
                    );
                });

                run.on("error", err => {
                    resolve("Failed to execute program: " + err.message);
                });
            });

            compile.on("error", err => {
                resolve("Failed to start compiler: " + err.message);
            });
        });
    }

    //Shrestha Stuff
    /* ===== ONLY UI STYLING EDITED ===== */
    private getHtml(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
:root {
    --bg: #0f1115;
    --panel: #1b1f2a;
    --border: #2a2f3a;
    --text: #dcdfe4;
    --accent: #3794ff;
}

body {
    font-family: system-ui;
    padding: 14px;
    background: linear-gradient(180deg, #0f1115, #0c0e13);
    color: var(--text);
}

button {
    width: 100%;
    background: linear-gradient(135deg, #3794ff, #2563eb);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 600;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(55,148,255,0.35);
}

.output {
    background: var(--panel);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 12px;
    padding: 14px;
    min-height: 100px;
    white-space: pre-wrap;
    font-size: 13px;
    line-height: 1.5;
    animation: fadeUp 0.3s ease forwards;
}

.output pre {
    background: #0f1115;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
}

.loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top: 3px solid var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    vertical-align: middle;
    margin-right: 8px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
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

const initialContent = ${JSON.stringify(this.geminiOutput)}; //Atharv Pradeepto stuff
if (typeof marked !== "undefined") {
    output.innerHTML = marked.parse(initialContent);
} else {
    output.textContent = initialContent;
}

document.getElementById("run").addEventListener("click", () => {
    output.innerHTML = '<span class="loading"></span> Running...';
    vscode.postMessage({ command: "runCompiler" });
});
</script>

</body>
</html>
        `;
    }
}