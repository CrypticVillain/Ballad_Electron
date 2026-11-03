/**
 * vault.ts — the local vault: everything you make in Ballad, in one JSON
 * file on this computer (userData/vault/vault.json). No server is involved.
 *
 * Saves are atomic (write a temp file, then rename over the old one) and the
 * previous version is kept as vault.backup.json, so a crash mid-save can't
 * lose your notes. The renderer owns the data (stores/vault.ts) and sends the
 * whole vault here a moment after each change.
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function vaultDir(): string {
  return path.join(app.getPath('userData'), 'vault');
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

export async function saveVault(json: string): Promise<void> {
  prepare();
  await fs.promises.writeFile(temp(), json, 'utf8');
  if (fs.existsSync(file())) await fs.promises.copyFile(file(), backup());
  await fs.promises.rename(temp(), file());
}

export function saveVaultSync(json: string): void {
  prepare();
  fs.writeFileSync(temp(), json, 'utf8');
  if (fs.existsSync(file())) fs.copyFileSync(file(), backup());
  fs.renameSync(temp(), file());
}
