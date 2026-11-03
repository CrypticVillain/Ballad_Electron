/**
 * profile.ts — `--profile=<name>` gives this copy of the app its own data
 * folder (saved sign-in, preferences, cache), so two accounts can run side by
 * side for testing: `npm run dev:second -w @ballad/desktop`.
 *
 * Must run before anything reads userData (the single-instance lock does).
 */
import { app } from 'electron';

export function applyProfile(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--profile='));
  const profile = arg?.slice('--profile='.length).replace(/[^A-Za-z0-9_-]/g, '') || null;
  if (profile) app.setPath('userData', `${app.getPath('userData')}-${profile}`);
  return profile;
}
