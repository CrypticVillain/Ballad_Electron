/**
 * vault.ts — the local vault: everything the open account makes in Ballad,
 * in one JSON file in its folder (accounts.ts: userData/vault for the first
 * account). No server is involved.
 *
 * Saves are atomic (write a temp file, then rename over the old one) and the
 * previous version is kept as vault.backup.json, so a crash mid-save can't
 * lose your notes. The renderer owns the data (stores/vault.ts) and sends the
 * whole vault here a moment after each change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { activeDir } from './accounts';

export function vaultDir(): string {
  return activeDir();
}

const file = () => path.join(vaultDir(), 'vault.json');
const backup = () => path.join(vaultDir(), 'vault.backup.json');
const temp = () => path.join(vaultDir(), 'vault.tmp.json');

export function loadVault(): string | null {
  for (const candidate of [file(), backup()]) {
    try {
      const text = fs.readFileSync(candidate, 'utf8');
      JSON.parse(text); // a half-written file falls through to the backup
      return text;
    } catch {
      // missing or unreadable: try the next one
    }
  }
  return null;
}

function prepare() {
  fs.mkdirSync(vaultDir(), { recursive: true });
}

/** The saves being written, one after another (two at once would write the same temp file). */
let writing: Promise<void> = Promise.resolve();

/**
 * Writes the open account's vault, after any save still being written. Its
 * folder is the one open when the save arrived, so switching accounts mid-save
 * can't put it in the other account's.
 */
export function saveVault(json: string): Promise<void> {
  const [f, b, t] = [file(), backup(), temp()];
  const write = async () => {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    await fs.promises.writeFile(t, json, 'utf8');
    if (fs.existsSync(f)) await fs.promises.copyFile(f, b);
    await fs.promises.rename(t, f);
  };
  const done = writing.then(write);
  writing = done.catch(() => {});
  return done;
}

/** Once every save sent so far is on disk (table.ts reads the file for a Play window). */
export const vaultWritten = (): Promise<void> => writing;

export function saveVaultSync(json: string): void {
  prepare();
  fs.writeFileSync(temp(), json, 'utf8');
  if (fs.existsSync(file())) fs.copyFileSync(file(), backup());
  fs.renameSync(temp(), file());
}
