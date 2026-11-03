/**
 * ipc.ts — answers the renderer's `window.api` calls (contract: src/shared/ipc.ts).
 *
 * Every handler checks that the call came from the app's own page.
 */
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IPC, type AppConfig, type SaveTextInput, type ThemeSource } from '../shared/ipc';
import { appIconChoice, setAppIconChoice } from './appIcon';
import { installerChoice } from './installChoices';
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
  const config: Omit<AppConfig, 'appIcon'> = {
    platform: process.platform,
    version: app.getVersion(),
    vaultDir: vaultDir(),
    devTools: !app.isPackaged || process.env.BALLAD_DEV_TOOLS === '1',
    installTheme: installed && { theme: installed.value, at: installed.at },
  };

  // Synchronous: the preload reads it once before the app renders.
  on(IPC.getConfig, (event) => {
    // The icon choice is read each time, so a reload after changing it sees the new one.
    event.returnValue = { ...config, appIcon: appIconChoice() } satisfies AppConfig;
  });

  on(IPC.setTheme, (_event, theme) => {
    if (theme === 'system' || theme === 'light' || theme === 'dark') nativeTheme.themeSource = theme as ThemeSource;
  });

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

  handle(IPC.saveText, async (event, raw) => {
    const input = raw as SaveTextInput;
    if (typeof input?.text !== 'string' || typeof input.defaultName !== 'string') return null;
    const name = path.basename(input.defaultName);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: input.filter ? [input.filter] : undefined,
    };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, input.text, 'utf8');
    return result.filePath;
  });
}
