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
  saveText: 'files:save-text',
} as const;

export type ThemeSource = 'system' | 'light' | 'dark';

/** The app icon: dark (the default), light, or following the system (on Windows, the taskbar's mode). */
export type AppIconChoice = 'dark' | 'light' | 'system';

export type AppConfig = {
  platform: string;
  version: string;
  /** Where the local vault lives (userData/vault). Shown in Settings → Data. */
  vaultDir: string;
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
  files: {
    /** Asks where to save (a Save dialog) and writes `text` there. The saved path, or null if cancelled. */
    saveText(input: SaveTextInput): Promise<string | null>;
  };
};

export type SaveTextInput = {
  defaultName: string;
  text: string;
  /** e.g. { name: 'Markdown', extensions: ['md'] } */
  filter?: { name: string; extensions: string[] };
};
