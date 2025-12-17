import * as vscode from 'vscode';
import { DiagnosticsViewProvider } from './diagnosticsViewProvider';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Tell-me extension ACTIVATED');

    const provider = new DiagnosticsViewProvider(context);

    // Register the sidebar Webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DiagnosticsViewProvider.viewType,
            provider
        )
    );

    // Refresh diagnostics when switching active editors
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => provider.update())
    );

    // Refresh diagnostics when typing/editing the active document
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                provider.update();
            }
        })
    );
}

export function deactivate() {}
