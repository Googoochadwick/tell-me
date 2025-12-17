import * as vscode from 'vscode';

export class DiagnosticsViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'diagnosticsView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true
        };

        this.update();
    }

    public update() {
        const editor = vscode.window.activeTextEditor;

        let diagnostics: vscode.Diagnostic[] = [];
        let filePath = 'No active file';

        if (editor) {
            const uri = editor.document.uri;
            diagnostics = vscode.languages.getDiagnostics(uri);
            filePath = uri.fsPath;
        }

        if (this._view) {
            this._view.webview.html = this.getHtml(diagnostics, filePath);
        }
    }

    private getHtml(
        diagnostics: vscode.Diagnostic[],
        filePath: string
    ): string {

        const items = diagnostics.map((d, i) => `
            <div class="diagnostic severity-${d.severity}">
                <div class="title">Issue ${i + 1}</div>
                <div class="message">${this.escape(d.message)}</div>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: system-ui;
                        padding: 12px;
                        background: #1e1e1e;
                        color: #ddd;
                    }

                    .diagnostic {
                        background: #252526;
                        border-left: 4px solid;
                        padding: 8px;
                        margin-bottom: 8px;
                    }

                    .severity-0 { border-color: #f14c4c; }
                    .severity-1 { border-color: #cca700; }
                    .severity-2 { border-color: #3794ff; }
                    .severity-3 { border-color: #6a9955; }

                    .title {
                        font-weight: bold;
                        margin-bottom: 4px;
                    }
                </style>
            </head>
            <body>
                <h3>${this.escape(filePath)}</h3>
                ${items || '<p>No diagnostics found.</p>'}
            </body>
            </html>
        `;
    }

    private escape(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
