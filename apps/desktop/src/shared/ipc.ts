/**
 * ipc.ts — the contract between the main process and the React app.
 *
 * The renderer runs sandboxed with no Node access. Everything it may ask the
 * OS for goes through `window.api` (preload/index.ts), whose shape is
 * `BalladApi`; main/ipc.ts answers each channel in `IPC`. To add something:
 * add the channel here, a handler in main/ipc.ts and a wrapper in preload.
 */

export const IPC = {
  getConfig: 'app:get-config',
  setLook: 'app:set-look',
  applyToAll: 'app:apply-to-all',
  suiteLook: 'app:suite-look',
  setAppIcon: 'app:set-app-icon',
  vaultLoad: 'vault:load',
  vaultSave: 'vault:save',
  vaultSaveSync: 'vault:save-sync',
  vaultReveal: 'vault:reveal',
  accountsWorlds: 'accounts:worlds',
  accountsAdd: 'accounts:add',
  accountsUpdate: 'accounts:update',
  accountsReorder: 'accounts:reorder',
  accountsSignIn: 'accounts:sign-in',
  accountsSignOut: 'accounts:sign-out',
  accountsSwitch: 'accounts:switch',
  saveText: 'files:save-text',
  saveBinary: 'files:save-binary',
  savePdf: 'files:save-pdf',
  importMap: 'files:import-map',
  importMusic: 'files:import-music',
  importLibraryMusic: 'files:import-library-music',
  tableCampaigns: 'table:campaigns',
  tableOpen: 'table:open',
  tableLoad: 'table:load',
  tableSend: 'table:send',
  tableRelay: 'table:relay',
  tableChanges: 'table:changes',
  tableInvites: 'table:invites',
  tableAnswer: 'table:answer',
  tableSyncSheets: 'table:sync-sheets',
  tableSeed: 'table:seed',
  tablePlaying: 'table:playing',
  tablePlayingChanged: 'table:playing-changed',
  tableAct: 'table:act',
  tableActed: 'table:acted',
  tableLeave: 'table:leave',
  tableLeaveCampaign: 'table:leave-campaign',
  tableInviteCounts: 'table:invite-counts',
  vaultFlushNow: 'vault:flush-now',
  vaultFlushed: 'vault:flushed',
  importLibraryMap: 'files:import-library-map',
  savePicture: 'files:save-picture',
  openManuscript: 'files:open-manuscript',
} as const;

import type { Appearance, SuiteAppearance } from './themes/appearance';

export type ThemeSource = 'system' | 'light' | 'dark';

/** The app icon: dark (the default), light, or following the system (on Windows, the taskbar's mode). */
export type AppIconChoice = 'dark' | 'light' | 'system';

export type AppConfig = {
  platform: string;
  version: string;
  /** Your account name on this computer: the first account's name until you set one. */
  userName: string;
  /** The open account's folder, where its vault lives. Shown in Settings → Data. */
  vaultDir: string;
  /** The accounts and which one is open (main/accounts.ts). */
  registry: Registry;
  /** A new account's first run gets the sample world (the first account's always did). */
  starter: boolean;
  /** On in development, off in installed builds (or BALLAD_DEV_TOOLS=1). */
  devTools: boolean;
  /** The app icon picked in the installer or Settings (main/appIcon.ts). */
  appIcon: AppIconChoice;
  /** The theme picked in the installer, and when (installed copies; main/installChoices.ts). The renderer takes it if it's newer than yours. */
  installTheme: { theme: ThemeSource; at: number } | null;
  /** The suite's look (%APPDATA%Monospaceappearance.json), if one was saved: the renderer takes it if it's newer than yours. */
  suiteAppearance: SuiteAppearance | null;
};

export type BalladApi = {
  /** Read once at startup (synchronously), so the app can be wired up before it renders. */
  config: AppConfig;
  app: {
    /** The look the window shows now: native parts (title bar, menus, scrollbars) follow its mode, and the next window opens in it. */
    setLook(look: Appearance): void;
    /** "Apply to all Monospace apps": saves this look as the suite's, which every app takes. */
    applyToAll(look: Appearance): Promise<SuiteAppearance>;
    /** The suite's look, whenever it's saved (by any app, or the setup). Returns how to stop listening. */
    onSuiteLook(listener: (look: SuiteAppearance) => void): () => void;
    /** Switches the window, taskbar and shortcut icons, and remembers the choice. */
    setAppIcon(choice: AppIconChoice): void;
  };
  vault: {
    /** The saved vault as JSON text, or null on first run. */
    load(): Promise<string | null>;
    /** Writes the vault (atomically, keeping the previous copy as a backup). */
    save(json: string): Promise<void>;
    /** The same, blocking — only for the last save as the window closes. */
    saveSync(json: string): void;
    /** Opens the vault folder in Explorer / Finder. */
    reveal(): void;
  };
  accounts: {
    /** Every signed-in account's worlds, as last saved (the world menu). */
    worlds(): Promise<AccountWorlds[]>;
    /** Signs in another account (kept on this computer for now) with a vault of its own, or signs a signed-out one with that email back in. */
    add(input: AccountInput, starter: boolean): Promise<{ registry: Registry; id: string }>;
    update(id: string, input: AccountInput): Promise<Registry>;
    /** Puts the accounts in this order (dragged in the account menu). */
    reorder(ids: string[]): Promise<Registry>;
    /** Signs a signed-out account back in. */
    signIn(id: string): Promise<Registry>;
    /** Signs an account out: its vault stays on this computer, hidden. Never the last one signed in. reload: it was the open account, so another one is open now. */
    signOut(id: string): Promise<{ registry: Registry; reload: boolean }>;
    /** Opens the account. The renderer reloads to load its vault. */
    switch(id: string): Promise<void>;
  };
  files: {
    /** Asks where to save (a Save dialog) and writes `text` there. The saved path, or null if cancelled. */
    saveText(input: SaveTextInput): Promise<string | null>;
    /** Asks where to save and writes the bytes there (a Word document, an EPUB). The saved path, or null if cancelled. */
    saveBinary(input: SaveBinaryInput): Promise<string | null>;
    /** Asks where to save and prints the HTML there as a PDF (no scripts run). The saved path, or null if cancelled. */
    savePdf(input: SavePdfInput): Promise<string | null>;
    /** Asks for a map image (an Open dialog) and copies it beside the vault: its file (load it as ballad-media://maps/<file>) and a name, or null if cancelled. */
    importMap(): Promise<{ file: string; name: string } | null>;
    /** Asks for music (several files at once) and copies it beside the vault (its music folder). */
    importMusic(): Promise<{ file: string; name: string }[]>;
    /** One of the Library's bundled tracks (free music), copied beside the vault: its file name, or null. */
    importLibraryMusic(name: string): Promise<{ file: string } | null>;
    /** Saves a picture (the bytes of a png, jpg or webp) beside the vault: its file (ballad-media://maps/<file>), or null. */
    savePicture(data: Uint8Array, ext: string): Promise<{ file: string } | null>;
    /** Copies a Library map beside the vault: one bundled with the app, or one downloaded from Dyson Logos's catalog. Its file, or null. */
    importLibraryMap(input: { bundled?: string; url?: string }): Promise<{ file: string } | null>;
    /** Writing → Import A Book: asks for a manuscript (Markdown, text, Word, Scrivener) and reads it; null if cancelled. */
    openManuscript(): Promise<OpenedManuscript | null>;
  };
  /** Play's table (main/table.ts: a server's part, on this computer). */
  table: {
    campaigns(): Promise<TableCampaign[]>;
    /** Opens Play for a campaign in its own window (one at a time). */
    open(ownerId: string, worldId: string): Promise<void>;
    /** A campaign's records (JSON), from its owner's vault; null if it's gone. */
    load(ownerId: string, worldId: string): Promise<string | null>;
    /** A Play window's changes, to the campaign's owner. */
    send(ownerId: string, changes: TableChange[]): void;
    /** The main window's changes, on to a Play window showing one of its campaigns. */
    relay(changes: TableChange[]): void;
    /** Changes from the other window. Returns how to stop listening. */
    onChanges(listener: (changes: TableChange[]) => void): () => void;
    /** The main window: write what's pending now (Play is about to read the file), then say so. */
    onFlush(flush: () => Promise<void>): void;
    /** The campaigns the open account is invited to. */
    invites(): Promise<TableInvite[]>;
    /** Joins (accept) or declines a campaign it's invited to. */
    answer(ownerId: string, worldId: string, accept: boolean): Promise<boolean>;
    /** Sheets played in another account's campaign (or another's in this one's), mirrored to the other vault. */
    syncSheets(changes: TableChange[]): Promise<void>;
    /** Records put into another account's vault on this computer (the demo game's players). */
    seed(accountId: string, changes: TableChange[]): Promise<void>;
    /** The campaign Play's window shows now (null: it isn't open). */
    playing(): Promise<TablePlaying>;
    /** The main window: Play's window opened (on a campaign) or closed. Returns how to stop listening. */
    onPlaying(listener: (playing: TablePlaying) => void): () => void;
    /** A sheet in Tabletop, in Play Mode: what it rolled or sent, on to Play's window (false: Play isn't open on that campaign). */
    act(act: TableAct): Promise<boolean>;
    /** Play's window: what a sheet in Tabletop sent, to put on the table. Returns how to stop listening. */
    onAct(listener: (act: TableAct) => void): () => void;
    /** A character of the open account's leaves another's campaign: the GM's party copy goes. */
    leave(pcId: string, worldId: string): Promise<void>;
    /** The open account leaves a campaign it's a player in; the ids of its characters that left with it. */
    leaveCampaign(ownerId: string, worldId: string): Promise<string[]>;
    /** How many unanswered invites each account on this computer has, by account id (none: left out). */
    inviteCounts(): Promise<Record<string, number>>;
  };
};

/**
 * An account signed in to Ballad. Accounts are kept on this computer until
 * sign-in arrives; each has its own vault (and so its own worlds), and
 * several can be signed in at once (the account menu switches between them).
 */
export type Account = {
  id: string;
  /** Empty: the email (or, for the first account, your computer's account name) shows instead. */
  name: string;
  email: string;
  signedIn: boolean;
  createdAt: number;
  /** The characters it plays in campaigns on this computer (a test player's: Brin Ashvale), shown under its name in the account menu. */
  plays?: string[];
};

/** `plays` left out: unchanged. */
export type AccountInput = { name: string; email: string; plays?: string[] };

/** Every account (signed in or not) and the open one. */
export type Registry = { activeId: string; accounts: Account[] };

/** An account's worlds, for the world menu. */
export type AccountWorlds = { accountId: string; worlds: { id: string; name: string; section: 'writing' | 'film' | 'tabletop' }[] };

/** A manuscript picked to import (main/manuscript.ts): a text file's text, a Word document's bytes, or a Scrivener project's binder and documents' RTF. */
export type OpenedManuscript = { name: string } & ({ kind: 'text'; text: string; plain: boolean } | { kind: 'docx'; data: Uint8Array } | { kind: 'scrivener'; scrivx: string; docs: Record<string, string> });

export type SaveBinaryInput = { defaultName: string; data: Uint8Array; filter?: { name: string; extensions: string[] } };

/** `margins` 'none': the HTML lays out its own pages (a screenplay). `background`: print backgrounds (revision pages' colors). */
export type SavePdfInput = { defaultName: string; html: string; pageSize?: 'Letter' | 'A4'; margins?: 'none'; background?: boolean; landscape?: boolean };

export type SaveTextInput = {
  defaultName: string;
  text: string;
  /** e.g. { name: 'Markdown', extensions: ['md'] } */
  filter?: { name: string; extensions: string[] };
};

/** A campaign the open account can play (main/table.ts): its own (it's the GM), or one it's a member of. */
export type TableCampaign = { ownerId: string; ownerName: string; worldId: string; name: string; owner: boolean };

/** A campaign the open account is invited to (by its email), from its GM. */
export type TableInvite = { ownerId: string; ownerName: string; worldId: string; name: string; sentAt: string };

/** The campaign Play's window shows (whose it is, which), or null: no Play window. */
export type TablePlaying = { ownerId: string; worldId: string } | null;

/** What a Tabletop sheet in Play Mode sent to the table: a card (play/sheet/rolls' RollCard) for a character in a campaign. */
export type TableAct = { worldId: string; pcId: string; card: unknown };

/** A record changed (record), or purged (null), as windows send each other through main/table.ts. */
export type TableChange = { collection: string; id: string; record: unknown };
