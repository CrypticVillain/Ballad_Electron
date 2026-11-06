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
  setTheme: 'app:set-theme',
  setAppIcon: 'app:set-app-icon',
  vaultLoad: 'vault:load',
  vaultSave: 'vault:save',
  vaultSaveSync: 'vault:save-sync',
  vaultReveal: 'vault:reveal',
  accountsWorlds: 'accounts:worlds',
  accountsAdd: 'accounts:add',
  accountsUpdate: 'accounts:update',
  accountsSignIn: 'accounts:sign-in',
  accountsSignOut: 'accounts:sign-out',
  accountsSwitch: 'accounts:switch',
  saveText: 'files:save-text',
  saveBinary: 'files:save-binary',
  savePdf: 'files:save-pdf',
  importMap: 'files:import-map',
  importLibraryMap: 'files:import-library-map',
  savePicture: 'files:save-picture',
} as const;

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
};

export type BalladApi = {
  /** Read once at startup (synchronously), so the app can be wired up before it renders. */
  config: AppConfig;
  app: {
    /** Keeps native parts (title bar, menus, scrollbars) in the app's light / dark theme. */
    setTheme(theme: ThemeSource): void;
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
    /** Saves a picture (the bytes of a png, jpg or webp) beside the vault: its file (ballad-media://maps/<file>), or null. */
    savePicture(data: Uint8Array, ext: string): Promise<{ file: string } | null>;
    /** Copies a Library map beside the vault: one bundled with the app, or one downloaded from Dyson Logos's catalog. Its file, or null. */
    importLibraryMap(input: { bundled?: string; url?: string }): Promise<{ file: string } | null>;
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
};

export type AccountInput = { name: string; email: string };

/** Every account (signed in or not) and the open one. */
export type Registry = { activeId: string; accounts: Account[] };

/** An account's worlds, for the world menu. */
export type AccountWorlds = { accountId: string; worlds: { id: string; name: string; section: 'writing' | 'film' | 'tabletop' }[] };

export type SaveBinaryInput = { defaultName: string; data: Uint8Array; filter?: { name: string; extensions: string[] } };

/** `margins` 'none': the HTML lays out its own pages (a screenplay). `background`: print backgrounds (revision pages' colors). */
export type SavePdfInput = { defaultName: string; html: string; pageSize?: 'Letter' | 'A4'; margins?: 'none'; background?: boolean; landscape?: boolean };

export type SaveTextInput = {
  defaultName: string;
  text: string;
  /** e.g. { name: 'Markdown', extensions: ['md'] } */
  filter?: { name: string; extensions: string[] };
};
