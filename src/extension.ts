import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const URI_LIST_MIME = "text/uri-list";
const IMAGE_EXTENSIONS = new Set([
	".gif",
	".jpg",
	".jpeg",
	".png",
	".webp",
	".svg"
]);
const NOTE_CONFIG_FILE = `${os.homedir()}/.notenote`;

const copyFile = (_document: vscode.TextDocument, uri: vscode.Uri, noteConfig: { notes_folder: string}) => {
	const basename = path.basename(uri.path.trim());

	const currentNoteFile = path.resolve(_document.uri.fsPath);

	const dailyNotesFolder = path.resolve(noteConfig.notes_folder);

	if(currentNoteFile.startsWith(dailyNotesFolder)) {
		const currentNoteFolder = path.dirname(currentNoteFile);
		const filesFolder = currentNoteFolder + "/files";

		if(!fs.existsSync(filesFolder)) {
			fs.mkdirSync(filesFolder);
		}

		const newFile = `${filesFolder}/${basename}`;
		const filePath = vscode.Uri.file(newFile).path;
		const data = fs.readFileSync(uri.path.trim());

		if(fs.existsSync(newFile)) {
			const existingFileData = fs.readFileSync(newFile);

			if(!data.equals(existingFileData)) {
				vscode.window.showWarningMessage(`File ${basename} already exists and is different from the one you're adding.`);
				return;
			}
		}

		fs.writeFileSync(filePath, data);
	}

	const fileExtension = path.extname(basename).toLowerCase();

	let insertText;

	const escapedBasename = encodeURIComponent(basename);

	if(IMAGE_EXTENSIONS.has(fileExtension)) {
		insertText = `![${escapedBasename}](./files/${escapedBasename})`;
	} else {
		insertText = `[${escapedBasename}](./files/${escapedBasename})`;
	}

	return insertText;
};

class FileNameListOnDropProvider implements vscode.DocumentDropEditProvider {
	async provideDocumentDropEdits(
		_document: vscode.TextDocument,
		position: vscode.Position,
		dataTransfer: vscode.DataTransfer,
		token: vscode.CancellationToken
	): Promise<vscode.DocumentDropEdit | undefined> {
		// Check the data transfer to see if we have dropped a list of uris
		const dataTransferItem = dataTransfer.get(URI_LIST_MIME);
		if (!dataTransferItem) {
			return undefined;
		}

		// 'text/uri-list' contains a list of uris separated by new lines.
		// Parse this to an array of uris.
		const urlList = await dataTransferItem.asString();
		if (token.isCancellationRequested) {
			return undefined;
		}

		const uris: vscode.Uri[] = [];
		for (const resource of urlList.split('\n')) {
			try {
				uris.push(vscode.Uri.parse(resource));
			} catch {
				// noop
			}
		}

		if (!uris.length) {
			return undefined;
		}

		const configFile = fs.readFileSync(NOTE_CONFIG_FILE);
		const noteConfig = JSON.parse(configFile.toString());

		const snippets = uris.map(uri => {
			return copyFile(_document, uri, noteConfig);
		});

		return { insertText: snippets.filter(s => s).join("\n") };
	}
}


export function activate(context: vscode.ExtensionContext) {
	const selector: vscode.DocumentSelector = { language: "markdown" };

	context.subscriptions.push(vscode.languages.registerDocumentDropEditProvider(selector, new FileNameListOnDropProvider()));
}
