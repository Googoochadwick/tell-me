import * as vscode from 'vscode';
//test
export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand(
        'extension.showDiagnostics',
        () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showInformationMessage('No active text editor.');
                return;
            }

            const uri = editor.document.uri;
            const diagnostics = vscode.languages.getDiagnostics(uri);

            showDiagnosticsPanel(diagnostics, uri.fsPath);
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Nothing to clean up
}

function showDiagnosticsPanel(
    diagnostics: vscode.Diagnostic[],
    filePath: string
) {
    const panel = vscode.window.createWebviewPanel(
        'diagnosticsView',
        'Diagnostics',
        vscode.ViewColumn.One,
        {
            enableScripts: false
        }
    );

    panel.webview.html = getWebviewContent(diagnostics, filePath);
}

function getWebviewContent(
    diagnostics: vscode.Diagnostic[],
    filePath: string
): string {

    const diagnosticItems = diagnostics.map((d, i) => `
        <div class="diagnostic severity-${d.severity}">
            <div class="header">
                <span class="index">Issue ${i + 1}</span>
                <span class="severity">${severityLabel(d.severity)}</span>
            </div>
            <div class="message">${escapeHtml(d.message)}</div>
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    padding: 16px;
                }

                h1 {
                    font-size: 16px;
                    margin-bottom: 16px;
                }

                .diagnostic {
                    background: #252526;
                    border-left: 4px solid;
                    padding: 10px 12px;
                    margin-bottom: 12px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    font-size: 13px;
                }

                .index {
                    font-weight: bold;
                }

                .message {
                    font-size: 13px;
                    line-height: 1.4;
                }

                .severity-0 { border-color: #f14c4c; } /* Error */
                .severity-1 { border-color: #cca700; } /* Warning */
                .severity-2 { border-color: #3794ff; } /* Info */
                .severity-3 { border-color: #6a9955; } /* Hint */
            </style>
        </head>
        <body>
            <h1>Diagnostics for ${escapeHtml(filePath)}</h1>
            ${diagnosticItems || '<p>No diagnostics found.</p>'}
        </body>
        </html>
    `;
}

function severityLabel(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error: return 'Error';
        case vscode.DiagnosticSeverity.Warning: return 'Warning';
        case vscode.DiagnosticSeverity.Information: return 'Info';
        case vscode.DiagnosticSeverity.Hint: return 'Hint';
        default: return 'Unknown';
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
