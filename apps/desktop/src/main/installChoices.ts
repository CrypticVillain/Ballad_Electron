/**
 * installChoices.ts — what you picked in the installer's Appearance page
 * (build/installer.nsh writes them to resources/<name> when installing):
 *
 *   theme      system | light | dark      (the app's colors; the renderer's preferences take it, ipc.ts)
 *   app-icon   dark | light | system      (appIcon.ts)
 *
 * Each comes with when it was written, so the app can tell whether you've
 * changed it in Settings since (the newer choice wins). Only installed copies
 * have these files.
 */
import { app } from 'electron';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function installerChoice<T extends string>(name: 'theme' | 'app-icon', allowed: readonly T[]): { value: T; at: number } | null {
  if (!app.isPackaged) return null;
  const file = join(process.resourcesPath, name);
  try {
    if (!existsSync(file)) return null;
    const value = readFileSync(file, 'utf8').trim() as T;
    return allowed.includes(value) ? { value, at: statSync(file).mtimeMs } : null;
  } catch {
    return null;
  }
}
