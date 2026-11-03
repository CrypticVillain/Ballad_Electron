/**
 * appIcon.ts — the app icon you picked: dark (the default), light, or one
 * that follows the system (on Windows, the taskbar's own light / dark mode).
 *
 * Where the choice comes from: the installer's App Icon page writes it to
 * resources/app-icon (build/installer.nsh), and Settings → Appearance writes
 * it to userData/app-icon.json. The more recent of the two wins, so a reinstall
 * with a new pick, or a change in Settings afterward, both take effect.
 *
 * Where it shows: the window and its taskbar button, the Dock (macOS), and
 * Windows shortcuts to Ballad (Start Menu, Desktop), which Windows also uses
 * for the taskbar. Ballad.exe's own file icon is built in and stays dark.
 */
import { app, BrowserWindow, nativeImage, nativeTheme, type NativeImage } from 'electron';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import darkPng from '../../build/icon.png?asset';
import lightPng from '../../build/icon-light.png?asset';
import type { AppIconChoice } from '../shared/ipc';
import { refreshInstalledShortcuts } from './identity';
import { installerChoice } from './installChoices';

export type IconVariant = 'dark' | 'light';

const userFile = () => join(app.getPath('userData'), 'app-icon.json');

const isChoice = (value: unknown): value is AppIconChoice => value === 'dark' || value === 'light' || value === 'system';

function read(file: string, parse: (text: string) => unknown): { choice: AppIconChoice; at: number } | null {
  try {
    if (!existsSync(file)) return null;
    const choice = parse(readFileSync(file, 'utf8'));
    return isChoice(choice) ? { choice, at: statSync(file).mtimeMs } : null;
  } catch {
    return null;
  }
}

let choice: AppIconChoice = 'dark';

function loadChoice(): AppIconChoice {
  const fromSettings = read(userFile(), (text) => (JSON.parse(text) as { choice?: unknown }).choice);
  const installed = installerChoice<AppIconChoice>('app-icon', ['dark', 'light', 'system']);
  const fromInstaller = installed && { choice: installed.value, at: installed.at };
  const newest = [fromSettings, fromInstaller].filter((c) => c !== null).sort((a, b) => b.at - a.at)[0];
  return newest?.choice ?? 'dark';
}

export const appIconChoice = () => choice;

/** The icon to show now. "system" follows the taskbar's mode (Windows) or the system's (macOS). */
export function currentVariant(): IconVariant {
  if (choice !== 'system') return choice;
  return nativeTheme.shouldUseDarkColorsForSystemIntegratedUI ? 'dark' : 'light';
}

export const iconImage = (variant = currentVariant()): NativeImage => nativeImage.createFromPath(variant === 'light' ? lightPng : darkPng);

/** The .ico for Windows shortcuts: in resources/icons when installed, build/icons in development. */
export const iconFile = (variant = currentVariant()) =>
  join(app.isPackaged ? join(process.resourcesPath, 'icons') : join(app.getAppPath(), 'build', 'icons'), `ballad-${variant}.ico`);

function apply() {
  const image = iconImage();
  for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.setIcon(image);
  if (process.platform === 'darwin') app.dock?.setIcon(image);
  if (process.platform === 'win32' && app.isPackaged) refreshInstalledShortcuts(iconFile());
}

let shown: IconVariant | null = null;

/** At startup: read the choice, show it, and follow the system while it's "system". */
export function initAppIcon() {
  choice = loadChoice();
  shown = currentVariant();
  apply();
  nativeTheme.on('updated', () => {
    if (choice !== 'system' || currentVariant() === shown) return;
    shown = currentVariant();
    apply();
  });
}

/** Settings → Appearance → App Icon. */
export function setAppIconChoice(next: AppIconChoice) {
  if (!isChoice(next)) return;
  choice = next;
  shown = currentVariant();
  try {
    writeFileSync(userFile(), JSON.stringify({ choice: next }));
  } catch (error) {
    console.warn('Could not save the app icon choice', error);
  }
  apply();
}
