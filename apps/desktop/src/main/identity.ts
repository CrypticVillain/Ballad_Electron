/**
 * identity.ts — who the app is to Windows (the App User Model ID).
 *
 * Windows takes a taskbar button's icon from the Start Menu shortcut that
 * carries the app's ID. Installed copies get theirs from the installer (appId
 * in electron-builder.yml): Ballad.lnk, pointing at Ballad.exe, which has the
 * icon built in. Dev runs use their own ID, so they never touch an installed
 * copy's shortcut; with no shortcut of their own, the taskbar shows the
 * window's icon (appIcon.ts).
 *
 * Overture's identity.ts also tidies the shortcut Electron writes for
 * notifications; Ballad shows none, so it doesn't need that.
 */
import { app, shell } from 'electron';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Same as appId in electron-builder.yml. */
const APP_ID = 'com.ballad.desktop';
const DEV_ID = `${APP_ID}.dev`;

export function applyAppIdentity() {
  if (process.platform !== 'win32') return;
  app.setAppUserModelId(app.isPackaged ? APP_ID : DEV_ID);
}

/**
 * Installed on Windows: points the shortcuts to this Ballad.exe (Start Menu,
 * Desktop; yours and all users') at `icon`. All-users shortcuts need admin
 * rights to change, so those are skipped quietly when they can't be.
 */
export function refreshInstalledShortcuts(icon: string) {
  if (process.platform !== 'win32' || !app.isPackaged || !existsSync(icon)) return;
  const folders = [
    join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    process.env.ProgramData && join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    app.getPath('desktop'),
    process.env.PUBLIC && join(process.env.PUBLIC, 'Desktop'),
  ].filter((f): f is string => Boolean(f));
  const exe = process.execPath.toLowerCase();
  for (const folder of folders) {
    for (const link of shortcutsIn(folder)) {
      try {
        const details = shell.readShortcutLink(link);
        if (details.target.toLowerCase() !== exe || details.icon?.toLowerCase() === icon.toLowerCase()) continue;
        shell.writeShortcutLink(link, 'replace', { ...details, icon, iconIndex: 0 });
      } catch {
        // not readable, or not ours to change
      }
    }
  }
}

/** .lnk files in a folder and its direct subfolders (installers often put theirs in one). */
function shortcutsIn(folder: string): string[] {
  const found: string[] = [];
  try {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (name.toLowerCase().endsWith('.lnk')) found.push(path);
      else if (statSync(path).isDirectory()) for (const inner of readdirSync(path)) if (inner.toLowerCase().endsWith('.lnk')) found.push(join(path, inner));
    }
  } catch {
    // folder missing or unreadable
  }
  return found;
}
