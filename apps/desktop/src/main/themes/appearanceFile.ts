/**
 * appearanceFile.ts — the suite's appearance on disk, shared by every
 * Monospace app and the setup (main process only):
 *
 *   %APPDATA%\Monospace\appearance.json   { style, theme, text, effects, at, by }
 *
 * "Apply to all Monospace apps" and the setup write it; every app reads it at
 * start and watches it, taking it when it's newer than the app's own last
 * change (shared/themes/appearance.ts).
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { toSuiteAppearance, type Appearance, type SuiteAppearance } from '../../shared/themes/appearance';

const FILE = 'appearance.json';

/** The suite's own folder in the user's profile (not any one app's). */
export function suiteFolder(): string {
  const roaming = process.env.APPDATA ?? join(homedir(), process.platform === 'darwin' ? 'Library/Application Support' : '.config');
  return join(roaming, 'Monospace');
}

export function readSuiteAppearance(folder = suiteFolder()): SuiteAppearance | null {
  try {
    return toSuiteAppearance(JSON.parse(readFileSync(join(folder, FILE), 'utf8')));
  } catch {
    return null; // not there yet, or half-written
  }
}

/** Saves it as the suite's appearance, now. `by` is "setup" or the app's id. */
export function writeSuiteAppearance(appearance: Appearance, by: string, folder = suiteFolder()): SuiteAppearance {
  const saved: SuiteAppearance = { style: appearance.style, theme: appearance.theme, text: appearance.text, effects: appearance.effects, at: Date.now(), by };
  mkdirSync(folder, { recursive: true });
  // Written beside it and renamed over, so a watching app never reads half a file.
  const temp = join(folder, `${FILE}.${process.pid}.tmp`);
  writeFileSync(temp, `${JSON.stringify(saved, null, 2)}\n`);
  renameSync(temp, join(folder, FILE));
  return saved;
}

/**
 * Calls `onChange` when another app (or the setup) saves the suite's
 * appearance. Returns a function that stops watching.
 */
export function watchSuiteAppearance(onChange: (appearance: SuiteAppearance) => void, folder = suiteFolder()): () => void {
  let last = readSuiteAppearance(folder)?.at ?? 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const now = readSuiteAppearance(folder);
    if (!now || now.at <= last) return;
    last = now.at;
    onChange(now);
  };
  try {
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
    // The folder, not the file: the file is replaced on every save.
    const watcher = watch(folder, (_event, name) => {
      if (name && name !== FILE) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 60);
    });
    watcher.on('error', () => {});
    return () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    };
  } catch {
    return () => {}; // can't watch here: the app still reads it at start
  }
}
