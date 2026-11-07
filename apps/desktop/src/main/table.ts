/**
 * table.ts — Play's table, as a server would run it, on this computer.
 *
 * A campaign lives in its owner's vault (the owner is its GM); the accounts
 * it lists as members are its players. Play opens in a window of its own, a
 * client of this "server": it loads the campaign from here and sends its
 * changes back here, record by record. Online, this module is what moves to
 * a real server; the windows stay as they are.
 *
 *   campaigns()          what the open account can play: its own campaigns, and the ones it's a member of
 *   openPlayWindow()     the one Play window (a second one closes the first)
 *   load()               a campaign's records, from its owner's vault (the main window saves first if it's ours)
 *   send()               a Play window's changes: to the main window if the owner is the open account
 *                        (it saves them), else straight into the owner's vault file
 *   relay()              the main window's changes, on to a Play window showing one of its campaigns
 *
 * Who may change what (the GM everything, a player only their tokens) is the
 * Play window's to keep for now; online, it's checked here.
 */
import { BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TableCampaign, TableChange } from '../shared/ipc';
import { IPC } from '../shared/ipc';
import { accountDir, activeAccountId, getRegistry } from './accounts';
import { iconImage } from './appIcon';
import { onDisplay } from './window';

type VaultFile = { version?: number; worlds?: Record<string, { id: string; name: string; section?: string; deletedAt?: string | null; tabletop?: { members?: { accountId: string }[] }; dnd?: unknown }> } & Record<string, unknown>;

let playWindow: BrowserWindow | null = null;
let playOwner: string | null = null;

const vaultFileOf = (accountId: string) => {
  const dir = accountDir(accountId);
  return dir ? path.join(dir, 'vault.json') : null;
};

function readVault(accountId: string): VaultFile | null {
  const file = vaultFileOf(accountId);
  if (!file) return null;
  for (const name of [file, path.join(path.dirname(file), 'vault.backup.json')]) {
    try {
      return JSON.parse(fs.readFileSync(name, 'utf8')) as VaultFile;
    } catch {
      // missing or half-written: try the backup
    }
  }
  return null;
}

const isCampaign = (w: { section?: string; deletedAt?: string | null }) => !w.deletedAt && (w.section === 'tabletop' || w.section === 'dnd');

/** The campaigns the open account can play: its own (it's their GM), then the ones it's a member of. */
export function campaigns(): TableCampaign[] {
  const me = activeAccountId();
  const { accounts } = getRegistry();
  const out: TableCampaign[] = [];
  for (const account of accounts) {
    const vault = readVault(account.id);
    for (const w of Object.values(vault?.worlds ?? {})) {
      if (!isCampaign(w)) continue;
      const owner = account.id === me;
      if (!owner && !w.tabletop?.members?.some((m) => m.accountId === me)) continue;
      out.push({ ownerId: account.id, ownerName: account.name || account.email.split('@')[0] || os.userInfo().username || 'Unnamed Account', worldId: w.id, name: w.name || 'Untitled Campaign', owner });
    }
  }
  return out.sort((a, b) => Number(b.owner) - Number(a.owner) || a.name.localeCompare(b.name));
}

/** The records a campaign's table needs: the campaign, its own records, and the music its scenes and encounters play. */
function campaignRecords(vault: VaultFile, worldId: string): Record<string, unknown> {
  const out: Record<string, unknown> = { version: vault.version };
  for (const [collection, records] of Object.entries(vault)) {
    if (!records || typeof records !== 'object' || collection === 'version') continue;
    if (collection === 'worlds') out.worlds = { [worldId]: (records as Record<string, unknown>)[worldId] };
    else if (collection === 'music') out.music = records;
    else out[collection] = Object.fromEntries(Object.entries(records as Record<string, { worldId?: string }>).filter(([, r]) => r?.worldId === worldId));
  }
  return out;
}

/** The main window (every window but Play's). */
const mainWindow = () => BrowserWindow.getAllWindows().find((w) => w !== playWindow && !w.isDestroyed()) ?? null;

/** Asks the main window to write what it hasn't yet (so a campaign read from its file is up to date). */
function flushMain(): Promise<void> {
  const win = mainWindow();
  if (!win) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      ipcMain.removeListener(IPC.vaultFlushed, done);
      resolve();
    }, 1500);
    ipcMain.once(IPC.vaultFlushed, done);
    win.webContents.send(IPC.vaultFlushNow);
  });
}

export async function load(ownerId: string, worldId: string): Promise<string | null> {
  if (ownerId === activeAccountId()) await flushMain();
  const vault = readVault(ownerId);
  if (!vault?.worlds?.[worldId]) return null;
  return JSON.stringify(campaignRecords(vault, worldId));
}

/** Writes changes into an owner's vault file (an owner whose account isn't the open one). */
function writeChanges(ownerId: string, changes: TableChange[]) {
  const file = vaultFileOf(ownerId);
  const vault = readVault(ownerId);
  if (!file || !vault) return;
  for (const { collection, id, record } of changes) {
    const records = (vault[collection] ??= {}) as Record<string, unknown>;
    if (record) records[id] = record;
    else delete records[id];
  }
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(vault), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
}

export function send(ownerId: string, changes: TableChange[]) {
  if (!changes.length) return;
  if (ownerId === activeAccountId()) mainWindow()?.webContents.send(IPC.tableChanges, changes);
  else writeChanges(ownerId, changes);
}

export function relay(changes: TableChange[]) {
  if (playWindow && !playWindow.isDestroyed() && playOwner === activeAccountId()) playWindow.webContents.send(IPC.tableChanges, changes);
}

/** Closes the Play window, if there is one (switching accounts does: it's played as the account that opened it). */
export function closePlayWindow() {
  if (playWindow && !playWindow.isDestroyed()) playWindow.destroy();
  playWindow = null;
  playOwner = null;
}

/** Opens Play for a campaign in its own window; one already open closes first. */
export function openPlayWindow(ownerId: string, worldId: string) {
  closePlayWindow();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    ...onDisplay(1440, 900),
    minWidth: 900,
    minHeight: 560,
    title: 'Ballad · Play',
    icon: iconImage(),
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // The table's music starts when the GM starts a scene, without a click in this window.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  playWindow = win;
  playOwner = ownerId;
  win.on('closed', () => {
    if (playWindow === win) {
      playWindow = null;
      playOwner = null;
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // Play stays Play: nothing navigates it to the rest of the app.
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  const hash = `/play-window?owner=${encodeURIComponent(ownerId)}&world=${encodeURIComponent(worldId)}`;
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash });
  win.focus();
}
