/**
 * ipc.ts — answers the renderer's `window.api` calls (contract: src/shared/ipc.ts).
 *
 * Every handler checks that the call came from the app's own page.
 */
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { IPC, type AppConfig, type SaveBinaryInput, type SavePdfInput, type SaveTextInput, type TableAct, type ThemeSource } from '../shared/ipc';
import { activeStarter, addAccount, getRegistry, listWorlds, openAccount, reorderAccounts, signInAccount, signOutAccount, updateAccount } from './accounts';
import { appIconChoice, setAppIconChoice } from './appIcon';
import { installerChoice } from './installChoices';
import { applyLook, applyToAll, suiteLook, watchSuiteLook } from './look';
import { openManuscript } from './manuscript';
import { importLibraryMap, importLibraryMusic, importMapImage, importMusic, savePicture } from './media';
import { act, answer, campaigns, closePlayWindow, inviteCounts, invites, leave, leaveCampaign, load, openPlayWindow, playing, relay, seed, send, syncSheets } from './table';
import { loadVault, saveVault, saveVaultSync, vaultDir } from './vault';

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith('file://') || (devUrl !== undefined && url.startsWith(devUrl));
}

function handle<T>(channel: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => T) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Blocked ${channel} from ${event.senderFrame?.url}`);
    return fn(event, ...args);
  });
}

function on(channel: string, fn: (event: IpcMainEvent, ...args: unknown[]) => void) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event)) fn(event, ...args);
  });
}

export function registerIpcHandlers() {
  const installed = installerChoice<ThemeSource>('theme', ['system', 'light', 'dark']);
  const config: Omit<AppConfig, 'appIcon' | 'vaultDir' | 'registry' | 'starter' | 'suiteAppearance'> = {
    platform: process.platform,
    version: app.getVersion(),
    userName: os.userInfo().username,
    devTools: !app.isPackaged || process.env.BALLAD_DEV_TOOLS === '1',
    installTheme: installed && { theme: installed.value, at: installed.at },
  };

  // Synchronous: the preload reads it once before the app renders.
  on(IPC.getConfig, (event) => {
    // Read each time, so the reload after changing the icon or switching accounts sees the new one.
    event.returnValue = { ...config, appIcon: appIconChoice(), vaultDir: vaultDir(), registry: getRegistry(), starter: activeStarter(), suiteAppearance: suiteLook() } satisfies AppConfig;
  });

  // The look (main/look.ts): native parts and the next window's background follow it; Apply to all saves it for the suite.
  on(IPC.setLook, (_event, look) => applyLook(look));
  handle(IPC.applyToAll, (_event, look) => applyToAll(look));
  watchSuiteLook();

  on(IPC.setAppIcon, (_event, value) => setAppIconChoice(value as AppConfig['appIcon']));

  handle(IPC.vaultLoad, () => loadVault());
  handle(IPC.vaultSave, (_event, json) => {
    if (typeof json === 'string') return saveVault(json);
  });
  on(IPC.vaultSaveSync, (event, json) => {
    if (typeof json === 'string') saveVaultSync(json);
    event.returnValue = true;
  });
  on(IPC.vaultReveal, () => {
    void shell.openPath(vaultDir());
  });

  handle(IPC.accountsWorlds, () => listWorlds());
  handle(IPC.accountsAdd, (_event, input, starter) => addAccount(input, starter));
  handle(IPC.accountsUpdate, (_event, id, input) => updateAccount(id, input));
  handle(IPC.accountsReorder, (_event, ids) => reorderAccounts(ids));
  handle(IPC.accountsSignIn, (_event, id) => signInAccount(id));
  handle(IPC.accountsSignOut, (_event, id) => signOutAccount(id));
  handle(IPC.accountsSwitch, (_event, id) => {
    // Play is played as the account that opened it.
    closePlayWindow();
    if (!openAccount(id)) throw new Error('That account can’t be opened.');
  });

  handle(IPC.importMap, (event) => importMapImage(event.sender));
  handle(IPC.importMusic, (event) => importMusic(event.sender));
  handle(IPC.importLibraryMusic, (_event, name) => (typeof name === 'string' ? importLibraryMusic(name) : null));
  // Play's table (main/table.ts).
  handle(IPC.tableCampaigns, () => campaigns());
  handle(IPC.tableOpen, (_event, ownerId, worldId) => {
    if (typeof ownerId === 'string' && typeof worldId === 'string') openPlayWindow(ownerId, worldId);
  });
  handle(IPC.tableLoad, (_event, ownerId, worldId) => (typeof ownerId === 'string' && typeof worldId === 'string' ? load(ownerId, worldId) : null));
  ipcMain.on(IPC.tableSend, (event, ownerId, changes) => {
    if (isTrustedSender(event) && typeof ownerId === 'string' && Array.isArray(changes)) send(ownerId, changes);
  });
  ipcMain.on(IPC.tableRelay, (event, changes) => {
    if (isTrustedSender(event) && Array.isArray(changes)) relay(changes);
  });
  handle(IPC.tableInvites, () => invites());
  handle(IPC.tableAnswer, (_event, ownerId, worldId, accept) => (typeof ownerId === 'string' && typeof worldId === 'string' ? answer(ownerId, worldId, accept === true) : false));
  handle(IPC.tableSyncSheets, (_event, changes) => (Array.isArray(changes) ? syncSheets(changes) : undefined));
  handle(IPC.tableSeed, (_event, accountId, changes) => {
    if (typeof accountId === 'string' && Array.isArray(changes)) seed(accountId, changes);
  });
  handle(IPC.tablePlaying, () => playing());
  handle(IPC.tableAct, (_event, a) => {
    const v = a as Partial<TableAct> | null;
    return v && typeof v.worldId === 'string' && typeof v.pcId === 'string' && v.card && typeof v.card === 'object' ? act({ worldId: v.worldId, pcId: v.pcId, card: v.card }) : false;
  });
  handle(IPC.tableLeaveCampaign, (_event, ownerId, worldId) => (typeof ownerId === 'string' && typeof worldId === 'string' ? leaveCampaign(ownerId, worldId) : []));
  handle(IPC.tableInviteCounts, () => inviteCounts());
  handle(IPC.tableLeave, (_event, pcId, worldId) => (typeof pcId === 'string' && typeof worldId === 'string' ? leave(pcId, worldId) : undefined));
  handle(IPC.openManuscript, (event) => openManuscript(event));
  handle(IPC.savePicture, (_event, data, ext) => (data instanceof Uint8Array && typeof ext === 'string' ? savePicture(data, ext) : null));
  handle(IPC.importLibraryMap, (_event, raw) => {
    const input = raw as { bundled?: unknown; url?: unknown };
    return importLibraryMap({ bundled: typeof input?.bundled === 'string' ? input.bundled : undefined, url: typeof input?.url === 'string' ? input.url : undefined });
  });

  /** Asks where to save (a Save dialog over the window that asked, starting in Downloads): the path, or null if cancelled. */
  const askSavePath = async (event: IpcMainInvokeEvent, defaultName: string, filter?: { name: string; extensions: string[] }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { defaultPath: path.join(app.getPath('downloads'), path.basename(defaultName)), filters: filter ? [filter] : undefined };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
  };

  handle(IPC.saveText, async (event, raw) => {
    const input = raw as SaveTextInput;
    if (typeof input?.text !== 'string' || typeof input.defaultName !== 'string') return null;
    const target = await askSavePath(event, input.defaultName, input.filter);
    if (!target) return null;
    await writeFile(target, input.text, 'utf8');
    return target;
  });

  // A file made in the renderer (a Word document, an EPUB), as bytes.
  handle(IPC.saveBinary, async (event, raw) => {
    const input = raw as SaveBinaryInput;
    if (!(input?.data instanceof Uint8Array) || typeof input.defaultName !== 'string') return null;
    const target = await askSavePath(event, input.defaultName, input.filter);
    if (!target) return null;
    await writeFile(target, input.data);
    return target;
  });

  // A PDF of a page of HTML (a manuscript, laid out for print): drawn in a hidden window, no scripts, then printed.
  handle(IPC.savePdf, async (event, raw) => {
    const input = raw as SavePdfInput;
    if (typeof input?.html !== 'string' || typeof input.defaultName !== 'string') return null;
    const target = await askSavePath(event, input.defaultName, { name: 'PDF', extensions: ['pdf'] });
    if (!target) return null;
    const page = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false } });
    try {
      await page.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(input.html)}`);
      const margins = input.margins === 'none' ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 0.9, bottom: 0.9, left: 1, right: 1 };
      const pdf = await page.webContents.printToPDF({ pageSize: input.pageSize === 'A4' ? 'A4' : 'Letter', landscape: input.landscape === true, printBackground: input.background === true, margins });
      await writeFile(target, pdf);
    } finally {
      page.destroy();
    }
    return target;
  });
}
