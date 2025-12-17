import * as vscode from 'vscode';

function getActiveDocumentDiagnostics() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const uri = editor.document.uri;
        const diagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(uri);

        if (diagnostics.length > 0) {
            console.log(`Diagnostics for ${uri.fsPath}:`);
            diagnostics.forEach((diagnostic, index) => {
                console.log(`  Issue ${index + 1}: ${diagnostic.message} (Severity: ${diagnostic.severity})`);
            });
        } else {
            console.log('No diagnostics found for the active file.');
        }
    } else {
        console.log('No active text editor.');
    }
}

// Register a command to run this function
vscode.commands.registerCommand('extension.showDiagnostics', getActiveDocumentDiagnostics);

// You can also call this function when needed within your extension logic

