import * as vscode from 'vscode';
import { DiagnosticsViewProvider } from './diagnosticsViewProvider.mjs';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Tell-me extension ACTIVATED (using local Gemma model)');

    const provider = new DiagnosticsViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DiagnosticsViewProvider.viewType,
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("tellMe.runCompiler", async () => {
            provider["runAnalysis"]?.();
        })
    );
}

export function deactivate() {}
