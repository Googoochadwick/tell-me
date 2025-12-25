import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export class DiagnosticsViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'diagnosticsView';

    private _view?: vscode.WebviewView;
    private geminiOutput = "Open a C/C++ file and click 'Compile & Run' to get started.";
    private compilationResult = "";
    private isLoading = false;
    private conversationHistory: Array<{role: string, content: string}> = [];

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "runCompiler") {
                await this.runAnalysis();
            } else if (message.command === "openSettings") {
                vscode.commands.executeCommand('workbench.action.openSettings', 'geminiApiKey');
            } else if (message.command === "askFollowUp") {
                await this.handleFollowUp(message.question);
            } else if (message.command === "copyCode") {
                vscode.env.clipboard.writeText(message.code);
                vscode.window.showInformationMessage('Code copied to clipboard!');
            } else if (message.command === "clearHistory") {
                this.conversationHistory = [];
                this.geminiOutput = "Conversation cleared. Ready for a new analysis!";
                this.update();
            }
        });

        this.update();
    }

    private update() {
        if (this._view) {
            this._view.webview.html = this.getHtml();
        }
    }

    private async handleFollowUp(question: string) {
        const config = vscode.workspace.getConfiguration();
        const apiKey = config.get<string>('geminiApiKey');

        if (!apiKey || apiKey.trim() === '') {
            this.geminiOutput = "⚠️ **API Key Required**\n\nPlease set your API key first.";
            this.update();
            return;
        }

        this.isLoading = true;
        this.update();

        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // Add user question to history
            this.conversationHistory.push({
                role: "user",
                content: question
            });

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `Original compilation result: ${this.compilationResult}` }]
                    },
                    ...this.conversationHistory.map(msg => ({
                        role: msg.role === "user" ? "user" : "model",
                        parts: [{ text: msg.content }]
                    }))
                ]
            });

            const assistantResponse = response.text ?? "No response from Gemini.";
            
            this.conversationHistory.push({
                role: "assistant",
                content: assistantResponse
            });

            this.geminiOutput = this.formatConversation();
        } catch (err: any) {
            this.geminiOutput = "Error: " + (err?.message ?? String(err));
        }

        this.isLoading = false;
        this.update();
    }

    private formatConversation(): string {
        let formatted = "## 📊 Analysis Results\n\n" + this.conversationHistory[0].content;
        
        for (let i = 1; i < this.conversationHistory.length; i++) {
            const msg = this.conversationHistory[i];
            if (msg.role === "user") {
                formatted += `\n\n---\n\n**🤔 You asked:** ${msg.content}`;
            } else {
                formatted += `\n\n**💡 Answer:**\n\n${msg.content}`;
            }
        }
        
        return formatted;
    }

    private async runAnalysis() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            this.geminiOutput = "⚠️ **No Active Editor**\n\nPlease open a C/C++ file to analyze.";
            this.update();
            return;
        }

        // Get API key from settings
        const config = vscode.workspace.getConfiguration();
        const apiKey = config.get<string>('geminiApiKey');

        if (!apiKey || apiKey.trim() === '') {
            this.geminiOutput = "⚠️ **API Key Required**\n\nPlease set your Google Gemini API key in the settings.\n\nClick the button below to open settings.";
            this.update();
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const fileName = path.basename(filePath);
        const fileContent = editor.document.getText();

        this.isLoading = true;
        this.update();

        const result = await this.compileAndRun(filePath);
        this.compilationResult = result;
        
        // Get file statistics
        const lines = fileContent.split('\n').length;
        const chars = fileContent.length;
        
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `
You are an educational programming tutor helping students understand their code.

Context:
- File: ${fileName}
- Lines of code: ${lines}
- File size: ${chars} characters

IMPORTANT FORMATTING RULES:
1. Use clear markdown headings (##, ###) to organize your response
2. Use bullet points for lists of hints or steps
3. Use **bold** for emphasis on key terms
4. Use \`inline code\` for variable names, function names, and small code snippets
5. Use code blocks with language specification for multi-line examples:
   \`\`\`c
   // example code here
   \`\`\`
6. Use > blockquotes for important warnings or tips
7. Break long explanations into short, digestible paragraphs

Your response structure should be:

## 🎯 Quick Summary
[One sentence about what happened - success, compile error, runtime error, or logic issue]

## 🔍 What's Happening
[2-3 sentences explaining the issue in plain English]

## 💡 Key Concepts
[Bullet points of programming concepts involved]

## 🛠️ Hints to Fix This
[3-4 specific, actionable hints WITHOUT giving the full solution]

## ✅ What You're Doing Right
[Mention at least one positive thing about their code]

---

Program Output:
${result}

Remember: Be encouraging, educational, and format your response for easy reading!
                `.trim()
            });

            const analysisResponse = response.text ?? "No response from Gemini.";
            
            // Initialize conversation history with the first analysis
            this.conversationHistory = [
                {
                    role: "assistant",
                    content: analysisResponse
                }
            ];

            this.geminiOutput = `## 📊 Analysis Results\n\n${analysisResponse}`;
        } catch (err: any) {
            if (err?.message?.includes('API key')) {
                this.geminiOutput = "❌ **Invalid API Key**\n\nThe API key appears to be invalid. Please check your settings and try again.";
            } else {
                this.geminiOutput = "❌ **Error**\n\n" + (err?.message ?? String(err));
            }
        }

        this.isLoading = false;
        this.update();
    }

    private compileAndRun(filePath: string): Promise<string> {
        return new Promise((resolve) => {
            const ext = path.extname(filePath).toLowerCase();

            let compiler: string | null = null;

            if (ext === ".c") compiler = "gcc";
            if ([".cpp", ".cc", ".cxx"].includes(ext)) compiler = "g++";

            if (!compiler) {
                resolve(`❌ Unsupported file type (${ext}). Please use .c, .cpp, .cc, or .cxx files.`);
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
                    resolve("❌ Compilation Failed:\n\n```\n" + compileErrors + "\n```");
                    return;
                }

                const run = spawn(outputBinary, [], { shell: true });

                let runtimeOutput = "";

                run.stdout.on("data", d => runtimeOutput += d.toString());
                run.stderr.on("data", d => runtimeOutput += d.toString());

                run.on("close", code => {
                    if (runtimeOutput.trim()) {
                        resolve("✅ Program Output:\n\n```\n" + runtimeOutput + "\n```");
                    } else {
                        resolve(`✅ Program compiled and ran successfully.\nExit code: ${code}\n(No output generated)`);
                    }
                });

                run.on("error", err => {
                    resolve("❌ Failed to execute program: " + err.message);
                });
            });

            compile.on("error", err => {
                resolve("❌ Failed to start compiler: " + err.message + "\n\nMake sure " + compiler + " is installed and in your PATH.");
            });
        });
    }

    private getHtml(): string {
        const config = vscode.workspace.getConfiguration();
        const hasApiKey = config.get<string>('geminiApiKey')?.trim() !== '';
        
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
    --bg: #0f1115;
    --panel: #1b1f2a;
    --border: #2a2f3a;
    --text: #dcdfe4;
    --text-muted: #9ca3af;
    --accent: #3794ff;
    --accent-hover: #2563eb;
    --success: #10b981;
    --warning: #f59e0b;
    --error: #ef4444;
    --code-bg: #0d0f13;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    padding: 16px;
    background: linear-gradient(180deg, #0f1115, #0c0e13);
    color: var(--text);
    line-height: 1.6;
}

.button-group {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

button {
    flex: 1;
    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(55,148,255,0.35);
}

button:active {
    transform: translateY(0);
}

button.secondary {
    background: linear-gradient(135deg, #374151, #1f2937);
    flex: 0 0 auto;
    padding: 12px;
}

button.secondary:hover {
    box-shadow: 0 8px 22px rgba(55,65,81,0.35);
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
}

.output-container {
    background: var(--panel);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 12px;
    overflow: hidden;
    animation: fadeUp 0.3s ease forwards;
}

.output-header {
    padding: 12px 16px;
    background: rgba(55, 148, 255, 0.1);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.output-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--accent);
}

.output {
    padding: 16px;
    min-height: 150px;
    max-height: 70vh;
    overflow-y: auto;
    font-size: 14px;
}

.output h2 {
    font-size: 18px;
    margin: 20px 0 12px 0;
    color: var(--text);
    font-weight: 700;
}

.output h2:first-child {
    margin-top: 0;
}

.output h3 {
    font-size: 16px;
    margin: 16px 0 10px 0;
    color: var(--text);
    font-weight: 600;
}

.output p {
    margin: 10px 0;
    color: var(--text);
}

.output ul, .output ol {
    margin: 10px 0;
    padding-left: 24px;
}

.output li {
    margin: 6px 0;
    color: var(--text);
}

.output code {
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    color: #10b981;
}

.output pre {
    background: var(--code-bg);
    padding: 14px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    border: 1px solid var(--border);
    position: relative;
}

.output pre code {
    background: none;
    padding: 0;
    color: var(--text);
}

.output blockquote {
    border-left: 3px solid var(--warning);
    background: rgba(245, 158, 11, 0.1);
    padding: 12px 16px;
    margin: 12px 0;
    border-radius: 6px;
    color: var(--text);
}

.output hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 20px 0;
}

.output strong {
    color: var(--accent);
    font-weight: 600;
}

.output::-webkit-scrollbar {
    width: 8px;
}

.output::-webkit-scrollbar-track {
    background: var(--code-bg);
    border-radius: 4px;
}

.output::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
}

.output::-webkit-scrollbar-thumb:hover {
    background: #3a3f4a;
}

.follow-up-section {
    padding: 16px;
    border-top: 1px solid var(--border);
    background: rgba(55, 148, 255, 0.05);
}

.follow-up-input {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.follow-up-input input {
    flex: 1;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
}

.follow-up-input input:focus {
    outline: none;
    border-color: var(--accent);
}

.follow-up-input button {
    flex: 0 0 auto;
    padding: 10px 20px;
}

.quick-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}

.quick-question {
    background: var(--code-bg);
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.quick-question:hover {
    border-color: var(--accent);
    color: var(--accent);
}

.loading {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top: 3px solid var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
}

.empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}
</style>
</head>

<body>

<div class="button-group">
    <button id="run" ${this.isLoading ? 'disabled' : ''}>
        ${this.isLoading ? '<span class="loading"></span>' : '▶️'} 
        ${this.isLoading ? 'Analyzing...' : 'Compile & Run'}
    </button>
    <button class="secondary" id="settings" title="Settings">⚙️</button>
</div>

<div class="output-container">
    <div class="output-header">
        <span class="output-title">📝 Analysis</span>
    </div>
    <div class="output" id="output"></div>
    
    ${this.conversationHistory.length > 0 && !this.isLoading ? `
    <div class="follow-up-section">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">
            💬 Ask a follow-up question
        </div>
        <div class="quick-questions">
            <span class="quick-question" data-q="Can you explain this in simpler terms?">Explain simpler</span>
            <span class="quick-question" data-q="What should I learn next?">What's next?</span>
            <span class="quick-question" data-q="Can you give me an example?">Show example</span>
        </div>
        <div class="follow-up-input">
            <input type="text" id="followUpInput" placeholder="Ask anything about this code..." />
            <button id="askBtn">Ask</button>
        </div>
    </div>
    ` : ''}
</div>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<script>
const vscode = acquireVsCodeApi();
const output = document.getElementById("output");

function renderOutput() {
    const content = ${JSON.stringify(this.geminiOutput)};
    if (typeof marked !== "undefined") {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        output.innerHTML = marked.parse(content);
    } else {
        output.textContent = content;
    }
}

renderOutput();

document.getElementById("run")?.addEventListener("click", () => {
    vscode.postMessage({ command: "runCompiler" });
});

document.getElementById("settings")?.addEventListener("click", () => {
    vscode.postMessage({ command: "openSettings" });
});

document.getElementById("clear")?.addEventListener("click", () => {
    if (confirm("Clear conversation history?")) {
        vscode.postMessage({ command: "clearHistory" });
    }
});

document.getElementById("askBtn")?.addEventListener("click", () => {
    const input = document.getElementById("followUpInput");
    const question = input.value.trim();
    if (question) {
        vscode.postMessage({ command: "askFollowUp", question: question });
        input.value = "";
    }
});

document.getElementById("followUpInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        document.getElementById("askBtn").click();
    }
});

document.querySelectorAll(".quick-question").forEach(btn => {
    btn.addEventListener("click", () => {
        const question = btn.getAttribute("data-q");
        vscode.postMessage({ command: "askFollowUp", question: question });
    });
});

// Copy code blocks on click
output.addEventListener("click", (e) => {
    if (e.target.tagName === "CODE" && e.target.parentElement.tagName === "PRE") {
        const code = e.target.textContent;
        vscode.postMessage({ command: "copyCode", code: code });
    }
});
</script>

</body>
</html>
        `;
    }
}