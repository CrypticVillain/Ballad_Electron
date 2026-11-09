/**
 * media.ts — pictures and music kept beside the open account's vault (a map
 * you import goes to <vault>/maps/, a track to <vault>/music/), and the
 * `ballad-media://` scheme the renderer loads them through:
 * ballad-media://maps/<file> and ballad-media://music/<file>. Only file names
 * this app made are served, from those folders only. `?owner=<account>`
 * serves another account's instead (a campaign's owner's, to its members in
 * Play: online, the server's files).
 */
import { BrowserWindow, dialog, net, protocol, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { accountDir } from './accounts';
import { vaultDir } from './vault';

export const MEDIA_SCHEME = 'ballad-media';
const IMAGE = /^[a-f0-9-]{36}\.(png|jpe?g|webp|gif|svg)$/i;
const AUDIO_EXT = ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'flac', 'webm'];
const AUDIO = new RegExp(`^[a-f0-9-]{36}\\.(${AUDIO_EXT.join('|')})$`, 'i');
const AUDIO_TYPE: Record<string, string> = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm' };
const mapsDir = () => path.join(vaultDir(), 'maps');
const musicDir = () => path.join(vaultDir(), 'music');

/** A file served in parts, as an audio player asks (it seeks with Range requests). */
async function serveRange(file: string, type: string, range: string | null): Promise<Response> {
  const { size } = await stat(file);
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (!match) return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
    status: 206,
    headers: { 'Content-Type': type, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' },
  });
}

/** Before the app is ready: the scheme behaves like https (images, fetch). */
export function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
}

/** Once ready: serves ballad-media://maps/<file> and ballad-media://music/<file> from the open vault's folders (or ?owner='s). */
export function handleMedia() {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url);
    const name = path.basename(decodeURIComponent(url.pathname));
    const owner = url.searchParams.get('owner');
    const dir = owner ? accountDir(owner) : vaultDir();
    if (!dir) return new Response(null, { status: 404 });
    if (url.host === 'maps' && IMAGE.test(name)) return net.fetch(pathToFileURL(path.join(dir, 'maps', name)).toString());
    if (url.host === 'music' && AUDIO.test(name)) {
      try {
        return await serveRange(path.join(dir, 'music', name), AUDIO_TYPE[path.extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream', request.headers.get('range'));
      } catch {
        return new Response(null, { status: 404 });
      }
    }
    return new Response(null, { status: 404 });
  });
}

/**
 * Asks for music (an Open dialog, several files at once) and copies it beside
 * the vault: each one's new file name and a name from the file. Empty if
 * cancelled.
 */
export async function importMusic(sender: WebContents): Promise<{ file: string; name: string }[]> {
  const window = BrowserWindow.fromWebContents(sender);
  const options: Electron.OpenDialogOptions = { title: 'Add Music', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Music', extensions: AUDIO_EXT }] };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  if (result.canceled) return [];
  await mkdir(musicDir(), { recursive: true });
  const added: { file: string; name: string }[] = [];
  for (const source of result.filePaths) {
    const ext = path.extname(source).toLowerCase().slice(1);
    if (!AUDIO_EXT.includes(ext)) continue;
    const file = `${randomUUID()}.${ext}`;
    await copyFile(source, path.join(musicDir(), file));
    added.push({ file, name: path.basename(source, path.extname(source)) });
  }
  return added;
}

/** Where the Library's bundled music is: the built renderer's library/music (src/renderer/public in development). */
const bundledMusicDir = () => (process.env.ELECTRON_RENDERER_URL ? path.join(__dirname, '../../src/renderer/public/library/music') : path.join(__dirname, '../renderer/library/music'));
const BUNDLED_MUSIC = /^[a-z0-9-]+\.mp3$/;

/** Copies one of the Library's bundled tracks (free music, CC0) beside the vault, to make it a track: its new file name, or null. */
export async function importLibraryMusic(name: string): Promise<{ file: string } | null> {
  if (!BUNDLED_MUSIC.test(name)) return null;
  await mkdir(musicDir(), { recursive: true });
  const file = `${randomUUID()}.mp3`;
  try {
    await copyFile(path.join(bundledMusicDir(), name), path.join(musicDir(), file));
  } catch {
    return null;
  }
  return { file };
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
