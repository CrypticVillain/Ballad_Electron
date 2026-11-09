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
 *   invites() / answer() the campaigns the open account is invited to (by its email), and joining or declining
 *   syncSheets()         the open account's sheets that are played in another's campaign, mirrored there
 *   seed()               records put straight into another account's vault (the demo game's players)
 *   playing() / act()    which campaign Play's window shows; a Tabletop sheet's roll (Play Mode), on to it
 *   leave()              a player's character out of another's campaign: the GM's party copy goes
 *
 * A player's character is theirs: it lives in their vault (one of theirs,
 * `mine`), and the campaign's GM keeps a copy in the party, the same record
 * by the same id. A change to either is mirrored to the other (the newer
 * wins), so the GM's sheet is the player's and the other way around: what a
 * server's one record would be. Only while the player is in the campaign;
 * the GM taking a sheet out of the party never deletes the player's character.
 * A character plays in one campaign at a time, and it's the player who says
 * which: the GM's copy never moves the player's character to another
 * campaign, or back into one it left.
 *
 * Who may change what (the GM everything, a player only their tokens) is the
 * Play window's to keep for now; online, it's checked here.
 */
import { BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TableAct, TableCampaign, TableChange, TableInvite, TablePlaying } from '../shared/ipc';
import { IPC } from '../shared/ipc';
import { accountDir, activeAccountId, getRegistry } from './accounts';
import { iconImage } from './appIcon';
import { onDisplay } from './window';
import { vaultWritten } from './vault';

type Invite = { email: string; sentAt: string };
type WorldFile = { id: string; name: string; section?: string; deletedAt?: string | null; tabletop?: { members?: { accountId: string }[]; invites?: Invite[] }; dnd?: unknown };
type VaultFile = { version?: number; worlds?: Record<string, WorldFile> } & Record<string, unknown>;
/** A sheet, as far as mirroring it goes. */
type Sheet = { id: string; worldId?: string | null; ownerAccountId?: string; deletedAt?: string | null; updatedAt?: string; mine?: boolean };

let playWindow: BrowserWindow | null = null;
let playOwner: string | null = null;
let playWorld: string | null = null;

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
  if (ownerId === activeAccountId()) {
    // What the main window hasn't saved yet, and what it's saving now (a campaign just made, say), on disk first.
    await flushMain();
    await vaultWritten();
  }
  const vault = readVault(ownerId);
  if (!vault?.worlds?.[worldId]) return null;
  return JSON.stringify(campaignRecords(vault, worldId));
}

/**
 * Writes changes into an account's vault file (one that isn't the open
 * account: the open one's is the main window's to write). An account never
 * opened yet gets its vault made (at `version`). Nothing's written if nothing
 * changes.
 */
function writeChanges(accountId: string, changes: TableChange[], version?: number) {
  const file = vaultFileOf(accountId);
  if (!file) return;
  const vault = readVault(accountId) ?? (version ? ({ version } as VaultFile) : null);
  if (!vault) return;
  let changed = false;
  for (const { collection, id, record } of changes) {
    const records = (vault[collection] ??= {}) as Record<string, unknown>;
    if (JSON.stringify(records[id] ?? null) === JSON.stringify(record ?? null)) continue;
    if (record) records[id] = record;
    else delete records[id];
    changed = true;
  }
  if (!changed) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(vault), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
}

/** Changes into an account's vault: the open account's through its main window (which saves them), another's into its file. */
function deliver(accountId: string, changes: TableChange[], version?: number) {
  if (!changes.length) return;
  if (accountId === activeAccountId()) mainWindow()?.webContents.send(IPC.tableChanges, changes);
  else writeChanges(accountId, changes, version);
}

export function send(ownerId: string, changes: TableChange[]) {
  if (!changes.length) return;
  deliver(ownerId, changes);
  mirrorSheets(ownerId, changes);
}

export function relay(changes: TableChange[]) {
  if (playWindow && !playWindow.isDestroyed()) {
    // The open account's campaign: everything; another's (a player's window): their own sheets, as they change them here.
    const shown = playOwner === activeAccountId() ? changes : changes.filter((c) => c.collection === 'pcs' && (c.record as Sheet | null)?.worldId === playWorld);
    if (shown.length) playWindow.webContents.send(IPC.tableChanges, shown);
  }
  mirrorSheets(activeAccountId(), changes);
}

// -- The party's sheets: each one its player's --------------------------

/** Which account runs a campaign (whose vault it's in), remembered once found. */
const owners = new Map<string, string>();
function campaignOwner(worldId: string): string | null {
  const known = owners.get(worldId);
  if (known && readVault(known)?.worlds?.[worldId]) return known;
  for (const account of getRegistry().accounts) {
    if (readVault(account.id)?.worlds?.[worldId]) {
      owners.set(worldId, account.id);
      return account.id;
    }
  }
  return null;
}

const isMember = (gm: string, worldId: string, player: string) => !!readVault(gm)?.worlds?.[worldId]?.tabletop?.members?.some((m) => m.accountId === player);

/**
 * Sheets changed in one account's vault (`from`), mirrored into the other's:
 * the GM's party copy when the player's changes, the player's own when the
 * GM's does. The newer wins (a copy changed since isn't overwritten by an
 * older one). The GM trashing their copy leaves the player's alone.
 */
function mirrorSheets(from: string, changes: TableChange[]) {
  const out = new Map<string, TableChange[]>();
  for (const { collection, id, record } of changes) {
    if (collection !== 'pcs' || !record) continue;
    const sheet = record as Sheet;
    const player = sheet.ownerAccountId;
    if (!player || !sheet.worldId) continue;
    const gm = campaignOwner(sheet.worldId);
    if (!gm || gm === player) continue;
    const to = from === player ? gm : from === gm ? player : null;
    if (!to || (to === player && sheet.deletedAt) || !isMember(gm, sheet.worldId, player)) continue;
    const there = (readVault(to)?.pcs as Record<string, Sheet> | undefined)?.[id];
    if (there?.updatedAt && sheet.updatedAt && there.updatedAt > sheet.updatedAt) continue;
    // The player's character is where the player put it: one that left this campaign (or went to another) stays out.
    if (to === player && there && (there.worldId ?? null) !== sheet.worldId) continue;
    out.set(to, [...(out.get(to) ?? []), { collection, id, record: { ...sheet, mine: to === player } }]);
  }
  const version = readVault(from)?.version;
  for (const [to, list] of out) {
    deliver(to, list, version);
    // The player's own Play window, on the GM's campaign: the GM's copy changed, so it shows the change.
    if (to !== activeAccountId() && to === playOwner && playWindow && !playWindow.isDestroyed()) {
      const shown = list.filter((c) => (c.record as Sheet).worldId === playWorld);
      if (shown.length) playWindow.webContents.send(IPC.tableChanges, shown);
    }
  }
}

/** Sheets played in another account's campaign (the open account's own, or others' in its campaigns): mirrored now (on opening the app). */
export async function syncSheets(changes: TableChange[]) {
  await flushMain();
  await vaultWritten();
  mirrorSheets(activeAccountId(), changes);
}

/** Records put into another account's vault on this computer (made for it: the demo game's players' characters). */
export function seed(accountId: string, changes: TableChange[]) {
  if (accountId === activeAccountId()) return;
  writeChanges(accountId, changes, readVault(activeAccountId())?.version);
}

/**
 * A character of the open account's leaves a campaign another account runs
 * (the player took them out, or put them in another: one at a time). The
 * GM's party copy goes to their Trash; the player's character is untouched.
 */
export function leave(pcId: string, worldId: string) {
  const me = activeAccountId();
  const gm = campaignOwner(worldId);
  if (!gm || gm === me) return;
  const there = (readVault(gm)?.pcs as Record<string, Sheet> | undefined)?.[pcId];
  if (!there || there.ownerAccountId !== me || there.deletedAt) return;
  const now = new Date().toISOString();
  const gone = [{ collection: 'pcs', id: pcId, record: { ...there, deletedAt: now, updatedAt: now } }];
  deliver(gm, gone);
  // The player's own Play window, on that campaign: the character goes from the table there too.
  if (playOwner === me && playWorld === worldId && playWindow && !playWindow.isDestroyed()) playWindow.webContents.send(IPC.tableChanges, gone);
}

// -- Play Mode: a Tabletop sheet playing at the table ---------------------

/** The campaign Play's window shows, or null. */
export const playing = (): TablePlaying => (playWindow && !playWindow.isDestroyed() && playOwner && playWorld ? { ownerId: playOwner, worldId: playWorld } : null);

const tellPlaying = () => mainWindow()?.webContents.send(IPC.tablePlayingChanged, playing());

/** A Tabletop sheet's roll or card (Play Mode), on to Play's window when it shows that campaign; false if it doesn't. */
export function act(a: TableAct): boolean {
  if (!playWindow || playWindow.isDestroyed() || playWorld !== a.worldId) return false;
  playWindow.webContents.send(IPC.tableActed, a);
  return true;
}

// -- Invitations --------------------------------------------------------

const myEmail = () => getRegistry().accounts.find((a) => a.id === activeAccountId())?.email.trim().toLowerCase() ?? '';
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b;

/** The campaigns the open account is invited to (online: by email), not yet answered. */
export function invites(): TableInvite[] {
  const me = activeAccountId();
  const email = myEmail();
  if (!email) return [];
  const out: TableInvite[] = [];
  for (const account of getRegistry().accounts) {
    if (account.id === me) continue;
    for (const w of Object.values(readVault(account.id)?.worlds ?? {})) {
      if (!isCampaign(w) || w.tabletop?.members?.some((m) => m.accountId === me)) continue;
      const invite = w.tabletop?.invites?.find((i) => sameEmail(i.email, email));
      if (invite) out.push({ ownerId: account.id, ownerName: account.name || account.email.split('@')[0] || 'A GM', worldId: w.id, name: w.name || 'Untitled Campaign', sentAt: invite.sentAt });
    }
  }
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/** Joins a campaign the open account is invited to (a player in it now), or declines: the invite's answered either way. */
export async function answer(ownerId: string, worldId: string, accept: boolean): Promise<boolean> {
  const me = activeAccountId();
  const email = myEmail();
  const world = readVault(ownerId)?.worlds?.[worldId];
  if (ownerId === me || !world || !email || !world.tabletop?.invites?.some((i) => sameEmail(i.email, email))) return false;
  const tabletop = { ...world.tabletop };
  tabletop.invites = (tabletop.invites ?? []).filter((i) => !sameEmail(i.email, email));
  if (accept && !tabletop.members?.some((m) => m.accountId === me)) tabletop.members = [...(tabletop.members ?? []), { accountId: me }];
  deliver(ownerId, [{ collection: 'worlds', id: worldId, record: { ...world, tabletop, updatedAt: new Date().toISOString() } }]);
  return true;
}

/** Closes the Play window, if there is one (switching accounts does: it's played as the account that opened it). */
export function closePlayWindow() {
  const had = Boolean(playWindow);
  if (playWindow && !playWindow.isDestroyed()) playWindow.destroy();
  playWindow = null;
  playOwner = null;
  playWorld = null;
  if (had) tellPlaying();
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
  playWorld = worldId;
  win.on('closed', () => {
    if (playWindow === win) {
      playWindow = null;
      playOwner = null;
      playWorld = null;
      tellPlaying();
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
  tellPlaying();
}
