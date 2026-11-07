/**
 * app.ts — launching the built app for the end-to-end tests (npm run test:e2e).
 *
 * Each test file (its own process) launches under --profile=e2e-<its pid>, so
 * it has its own data folder, never touches your vault, and test files can
 * run side by side (scripts/e2e.mjs runs several at once). The folder is
 * wiped before and after; ones left by a run that was cut short are cleared
 * away an hour later. BALLAD_E2E_PROFILE changes the "e2e" part. Pass a
 * vault to start from it instead of the first-run sample worlds.
 *
 * `saved()` waits until nothing is waiting to be written (window.__balladIdle:
 * a manuscript editor's pause in typing, the vault's debounce), not for a
 * fixed time. Windows behind others aren't slowed down (Chromium's background
 * throttling is off), since the test windows open on top of each other.
 *
 * The window opens on your fourth monitor (--display=4), out of the way of
 * what you're doing on the main one. Set BALLAD_E2E_DISPLAY to pick
 * another: a number (1 is the main one, then left to right) or part of a
 * monitor's name ("ASUS"); 0 leaves it where the app puts it. A monitor that
 * isn't there (one monitor, say) leaves it on the main one.
 */
import { _electron, type ElectronApplication, type Page } from 'playwright-core';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(DESKTOP, '../..');
/** The electron package's path to its binary (found up the folders, so a worktree inside the repo uses the repo's). */
const ELECTRON = createRequire(import.meta.url)('electron') as string;
const BASE = (process.env.BALLAD_E2E_PROFILE ?? 'e2e').replace(/[^A-Za-z0-9_-]/g, '') || 'e2e';
const PROFILE = `${BASE}-${process.pid}`;
const DISPLAY = (process.env.BALLAD_E2E_DISPLAY ?? '4').trim();

const appData = () =>
  process.platform === 'win32'
    ? process.env.APPDATA!
    : process.platform === 'darwin'
      ? path.join(process.env.HOME!, 'Library/Application Support')
      : (process.env.XDG_CONFIG_HOME ?? path.join(process.env.HOME!, '.config'));

/** Where --profile=<PROFILE> keeps its data (userData + "-e2e-<pid>"). */
export function userDataDir(): string {
  return path.join(appData(), `Ballad-${PROFILE}`);
}

// Data folders left by runs that were cut short (a crash, a stopped run): gone after an hour.
try {
  for (const name of readdirSync(appData())) {
    if (!name.startsWith(`Ballad-${BASE}`) || name === `Ballad-${PROFILE}`) continue;
    const dir = path.join(appData(), name);
    if (Date.now() - statSync(dir).mtimeMs > 60 * 60_000) rmSync(dir, { recursive: true, force: true });
  }
} catch {
  // nothing to clear
}

/** Chromium slows down windows that are hidden behind others; the test windows open on top of each other, so it mustn't. */
const NO_THROTTLING = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'];

/** The first account's vault (src/main/accounts.ts: userData/vault). */
const vaultFile = () => path.join(userDataDir(), 'vault', 'vault.json');

export type Launched = {
  app: ElectronApplication;
  win: Page;
  /** The vault file as last saved. */
  vault: () => any;
  /** Waits until everything is written to the vault file (nothing waiting in an editor or the vault's debounce). */
  saved: () => Promise<void>;
  /** Errors the page threw or logged, for a test to say there were none. */
  errors: string[];
  close: () => Promise<void>;
};

export async function launch(vault?: object, keep = false): Promise<Launched> {
  if (!keep) rmSync(userDataDir(), { recursive: true, force: true });
  if (vault) {
    mkdirSync(path.dirname(vaultFile()), { recursive: true });
    writeFileSync(vaultFile(), JSON.stringify(vault));
  }
  const app = await _electron.launch({
    executablePath: ELECTRON,
    args: [DESKTOP, `--profile=${PROFILE}`, ...(DISPLAY && DISPLAY !== '0' ? [`--display=${DISPLAY}`] : []), ...NO_THROTTLING],
    cwd: ROOT,
  });
  const win = await app.firstWindow();
  // A step that can't happen fails in 10 s, not 30.
  win.setDefaultTimeout(10_000);
  const errors: string[] = [];
  win.on('pageerror', (e) => errors.push(String(e)));
  win.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
  // The first run's sample worlds are written before a test reads the vault.
  await idle(win);
  return {
    app,
    win,
    vault: () => JSON.parse(readFileSync(vaultFile(), 'utf8')),
    saved: () => idle(win),
    errors,
    close: async () => {
      await app.evaluate(({ app: electron }) => electron.exit(0)).catch(() => {});
      await app.close().catch(() => {});
      rmSync(userDataDir(), { recursive: true, force: true });
    },
  };
}

/** Quits the app and starts it again on the same data (a new session, as the next day). */
export async function relaunch(t: Launched): Promise<Launched> {
  await t.saved();
  await t.app.evaluate(({ app: electron }) => electron.exit(0)).catch(() => {});
  await t.app.close().catch(() => {});
  return launch(undefined, true);
}

/**
 * Waits until the app has nothing left to write: what was just done gets a
 * moment to start its save (an effect, the editor's pause), then the app
 * must say it's idle twice in a row, a moment apart.
 */
async function idle(win: Page): Promise<void> {
  const check = () => win.waitForFunction(() => (window as unknown as { __balladIdle?: () => boolean }).__balladIdle?.() ?? true, null, { polling: 30, timeout: 20_000 });
  await win.waitForTimeout(100);
  await check();
  await win.waitForTimeout(60);
  await check();
}

/** The rail's button for a module ("Places", "Names"…). */
export async function rail(win: Page, label: string): Promise<void> {
  await win.locator(`nav[aria-label="Modules"] [aria-label="${label}"]`).click();
}

export type SectionName = 'Writing' | 'Filmmaking' | 'Tabletop' | 'Play';

/** The world menu's button: the Ballad mark at the top of the rail, labeled "<section> · <world>". */
export const worldMenu = (win: Page) => win.locator('nav[aria-label="Modules"] [aria-label*=" · "]').first();

/** Opens the world menu, once any menu still closing has gone. */
export async function openWorldMenu(win: Page): Promise<void> {
  await win.locator('[role="menu"]').first().waitFor({ state: 'detached' });
  await worldMenu(win).click();
  await win.getByRole('group', { name: 'Section' }).waitFor();
}

/** Opens a section from the world menu (not if it's open already: clicking Tabletop again would switch GM and player). */
export async function section(win: Page, name: SectionName): Promise<void> {
  if ((await worldMenu(win).getAttribute('aria-label'))?.startsWith(`${name} · `)) return;
  await openWorldMenu(win);
  await win
    .getByRole('group', { name: 'Section' })
    .getByRole('menuitem', name === 'Tabletop' ? { name: /^Tabletop · / } : { name, exact: true })
    .click();
  await win.locator(`nav[aria-label="Modules"] [aria-label^="${name} · "]`).waitFor();
  await win.locator('[role="menu"]').first().waitFor({ state: 'detached' });
}

/** Tabletop: switches between the GM's view and a player's (the status bar's role button). */
export async function role(win: Page, to: 'gm' | 'player'): Promise<void> {
  const button = win.locator('footer button', { hasText: /GM View|Player View/ }).first();
  // textContent, not innerText: it shows in capitals.
  const now = (await button.textContent())?.includes('Player') ? 'player' : 'gm';
  if (now === to) return;
  await button.click();
  await win.locator('footer button', { hasText: to === 'gm' ? 'GM View' : 'Player View' }).waitFor();
}

/** Goes straight to a route ("/names", "/bible/place"…). */
export async function go(win: Page, route: string): Promise<void> {
  await win.evaluate((r) => (location.hash = `#${r}`), route);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DD" for `offset` days from today. */
export function day(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Picks an option in one of the app's dropdowns (a Radix combobox, not a native <select>). */
export async function choose(win: Page, name: string, option: string): Promise<void> {
  await win.getByRole('combobox', { name }).click();
  await win.getByRole('option', { name: option, exact: true }).click();
}

/** Records in a vault collection that aren't deleted. */
export function live<T extends { deletedAt?: string | null }>(collection: Record<string, T>): T[] {
  return Object.values(collection).filter((r) => !r.deletedAt);
}
