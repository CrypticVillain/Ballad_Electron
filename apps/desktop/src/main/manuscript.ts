import { BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { OpenedManuscript } from '../shared/ipc';

/**
 * Writing → Import A Book: asks for a manuscript (Markdown or text, a Word
 * document, or a Scrivener project's .scrivx) and reads it for the renderer,
 * which makes the book (writing/manuscript/import). A Scrivener project
 * comes with each of its documents' RTF, by UUID (Scrivener 3:
 * Files/Data/<UUID>/content.rtf) or ID (Scrivener 2: Files/Docs/<ID>.rtf).
 */

const LIMIT = 50 * 1024 * 1024;

export async function openManuscript(event: IpcMainInvokeEvent): Promise<OpenedManuscript | null> {
  const window = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    title: 'Import A Book',
    properties: ['openFile'],
    filters: [
      { name: 'Manuscripts', extensions: ['md', 'markdown', 'txt', 'docx', 'scrivx'] },
      { name: 'Markdown or text', extensions: ['md', 'markdown', 'txt'] },
      { name: 'Word document', extensions: ['docx'] },
      { name: 'Scrivener project (the .scrivx inside the .scriv)', extensions: ['scrivx'] },
    ],
  };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const file = result.canceled ? undefined : result.filePaths[0];
  if (!file) return null;
  if ((await stat(file)).size > LIMIT) throw new Error('That file is too big to import (over 50 MB).');
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file);
  if (ext === '.docx') return { kind: 'docx', name, data: new Uint8Array(await readFile(file)) };
  if (ext === '.scrivx') return { kind: 'scrivener', name, scrivx: await readFile(file, 'utf8'), docs: await scrivenerDocs(path.dirname(file)) };
  return { kind: 'text', name, text: await readFile(file, 'utf8'), plain: ext === '.txt' };
}

/** Every document's RTF in a Scrivener project folder, by UUID or ID. */
async function scrivenerDocs(folder: string): Promise<Record<string, string>> {
  const docs: Record<string, string> = {};
  const list = async (dir: string) => readdir(dir).catch(() => [] as string[]);
  // Scrivener 3: Files/Data/<UUID>/content.rtf
  const data = path.join(folder, 'Files', 'Data');
  for (const id of await list(data)) {
    const rtf = await readFile(path.join(data, id, 'content.rtf'), 'latin1').catch(() => null);
    if (rtf !== null) docs[id] = rtf;
  }
  // Scrivener 2: Files/Docs/<ID>.rtf
  const old = path.join(folder, 'Files', 'Docs');
  for (const file of await list(old)) {
    const m = /^(\d+)\.rtf$/i.exec(file);
    if (m) docs[m[1]!] = await readFile(path.join(old, file), 'latin1');
  }
  return docs;
}
