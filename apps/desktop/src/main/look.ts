/**
 * look.ts — Ballad's look as the main process needs it:
 *
 *   - Native parts (title bar, menus, scrollbars) in its light or dark mode.
 *   - Each window's background before its page paints (no flash), in the
 *     style's own `--rail`. The renderer's preferences live in its storage, out
 *     of reach here, so the last look it applied is remembered in look.json
 *     (in the profile's data folder).
 *   - The suite's look (%APPDATA%\Monospace\appearance.json, main/themes/
 *     appearanceFile.ts): read for the config, written by "Apply to all
 *     Monospace apps", and watched, so a change another app or the setup makes
 *     reaches the open windows.
 */
import { app, BrowserWindow, nativeTheme } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { DEFAULT_APPEARANCE, toAppearance, type Appearance, type SuiteAppearance } from '../shared/themes/appearance';
import { suiteStyle } from '../shared/themes/styles';
import { readSuiteAppearance, watchSuiteAppearance, writeSuiteAppearance } from './themes/appearanceFile';

const remembered = () => join(app.getPath('userData'), 'look.json');

/** The look the windows open in: the last one applied here, else the suite's, else the default. */
function currentLook(): Appearance {
  try {
    return toAppearance(JSON.parse(readFileSync(remembered(), 'utf8')));
  } catch {
    return readSuiteAppearance() ?? DEFAULT_APPEARANCE;
  }
}

/** A window's background before its page paints: the open style's --rail, in the open mode. */
export function windowBackground(): string {
  const look = currentLook();
  const dark = look.theme === 'system' ? nativeTheme.shouldUseDarkColors : look.theme === 'dark';
  return suiteStyle(look.style).window[dark ? 'dark' : 'light'];
}

/** The renderer applied a look: native parts follow its mode, and the next window opens in it. */
export function applyLook(value: unknown) {
  const look = toAppearance(value);
  nativeTheme.themeSource = look.theme;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(remembered(), JSON.stringify(look));
  } catch {
    // the next window opens in the default's background: only a flash
  }
}

/** The suite's look now (for the config the renderer reads at start). */
export function suiteLook(): SuiteAppearance | null {
  return readSuiteAppearance();
}

/** "Apply to all Monospace apps": this look becomes the suite's. */
export function applyToAll(value: unknown): SuiteAppearance {
  return writeSuiteAppearance(toAppearance(value), 'ballad');
}

/** Sends every window the suite's look whenever it's saved (by any app, or the setup). Call once. */
export function watchSuiteLook() {
  watchSuiteAppearance((look) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.suiteLook, look);
    }
  });
}
