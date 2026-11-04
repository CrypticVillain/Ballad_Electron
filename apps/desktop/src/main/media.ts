/**
 * media.ts — images kept beside the open account's vault (a map you import
 * goes to <vault>/maps/), and the `ballad-media://` scheme the renderer loads
 * them through: ballad-media://maps/<file>. Only file names this app made are
 * served, from that folder only.
 */
import { BrowserWindow, dialog, net, protocol, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { vaultDir } from './vault';

export const MEDIA_SCHEME = 'ballad-media';
const IMAGE = /^[a-f0-9-]{36}\.(png|jpe?g|webp|gif|svg)$/i;
const mapsDir = () => path.join(vaultDir(), 'maps');

/** Before the app is ready: the scheme behaves like https (images, fetch). */
export function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

/** Once ready: serves ballad-media://maps/<file> from the open vault's maps folder. */
export function handleMedia() {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url);
    const name = path.basename(decodeURIComponent(url.pathname));
    if (url.host !== 'maps' || !IMAGE.test(name)) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(path.join(mapsDir(), name)).toString());
  });
}

/** Where the Library's bundled maps are: the built renderer's library/maps (src/renderer/public in development). */
const bundledMapsDir = () => (process.env.ELECTRON_RENDERER_URL ? path.join(__dirname, '../../src/renderer/public/library/maps') : path.join(__dirname, '../renderer/library/maps'));
const BUNDLED = /^[a-z0-9-]+\.(png|jpg)$/;
/** Dyson Logos's map images, the only place the Library downloads from. */
const DYSON = /^https:\/\/dysonlogos\.blog\/wp-content\/uploads\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+\.(png|jpe?g)$/i;

/**
 * Copies one of the Library's maps beside the vault, to make it a map: one
 * bundled with the app (its file name), or one from Dyson Logos's catalog (its
 * image URL), downloaded at 3,000 px. Its new file name, or null.
 */
export async function importLibraryMap(input: { bundled?: string; url?: string }): Promise<{ file: string } | null> {
  await mkdir(mapsDir(), { recursive: true });
  if (input.bundled && BUNDLED.test(input.bundled)) {
    const file = `${randomUUID()}${path.extname(input.bundled)}`;
    await copyFile(path.join(bundledMapsDir(), input.bundled), path.join(mapsDir(), file));
    return { file };
  }
  if (input.url && DYSON.test(input.url)) {
    const response = await net.fetch(`${input.url}?w=3000`);
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    const ext = type.includes('png') ? '.png' : type.includes('jpeg') || type.includes('jpg') ? '.jpg' : type.includes('webp') ? '.webp' : null;
    if (!ext) return null;
    const file = `${randomUUID()}${ext}`;
    await writeFile(path.join(mapsDir(), file), Buffer.from(await response.arrayBuffer()));
    return { file };
  }
  return null;
}

/**
 * Saves a picture the window picked and shrank (a portrait, a creature, an
 * item) beside the vault: its new file name, or null if it isn't one.
 */
export async function savePicture(data: Uint8Array, ext: string): Promise<{ file: string } | null> {
  if (!/^(png|jpg|webp)$/.test(ext) || data.byteLength === 0 || data.byteLength > 15 * 1024 * 1024) return null;
  await mkdir(mapsDir(), { recursive: true });
  const file = `${randomUUID()}.${ext}`;
  await writeFile(path.join(mapsDir(), file), data);
  return { file };
}

/**
 * Asks for an image (an Open dialog) and copies it beside the vault (the maps
 * folder holds every picture: maps, portraits, creatures): its new file name
 * and a name from the file, or null.
 */
export async function importMapImage(sender: WebContents, title = 'Add A Map'): Promise<{ file: string; name: string } | null> {
  const window = BrowserWindow.fromWebContents(sender);
  const options: Electron.OpenDialogOptions = {
    title,
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
  };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const source = result.filePaths[0];
  if (result.canceled || !source) return null;
  const ext = path.extname(source).toLowerCase().replace('jpeg', 'jpg');
  if (!/^\.(png|jpg|webp|gif|svg)$/.test(ext)) return null;
  const file = `${randomUUID()}${ext}`;
  await mkdir(mapsDir(), { recursive: true });
  await copyFile(source, path.join(mapsDir(), file));
  return { file, name: path.basename(source, path.extname(source)) };
}
