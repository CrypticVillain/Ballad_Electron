/**
 * demo-game.ts — Play → Set Up A Demo Game, and what the files that play it
 * (demo.e2e.ts, demo-invites.e2e.ts) read of it: the campaign's records, the
 * accounts it made (accounts.json) and each player's own vault, and switching
 * accounts from the account menu.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { live, userDataDir, type Launched } from './app';

/** `t` is a getter: a file may relaunch. */
export function demoGame(t: () => Launched) {
  const demo = () => live<any>(t().vault().worlds).find((w) => w.name === 'Demo: The Goblin Road');
  const of = (collection: string) => live<any>(t().vault()[collection] ?? {}).filter((r) => r.worldId === demo().id);
  const registry = () => JSON.parse(readFileSync(path.join(userDataDir(), 'accounts.json'), 'utf8')) as { activeId: string; accounts: any[] };
  const account = (name: string) => registry().accounts.find((a) => a.name === name)!;
  /** A player account's own vault, as last saved. */
  const vaultOf = (name: string) => {
    const file = path.join(userDataDir(), 'accounts', account(name).id, 'vault.json');
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  };
  const sheetIn = (name: string, character: string) => live<any>(vaultOf(name)?.pcs ?? {}).find((p) => p.name === character);
  /** The game log's last few events, for a failure's message: what was done, and what's undone. */
  const lastEvents = () =>
    of('gameLog')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-6)
      .map((x) => `${x.undone ? '(undone) ' : ''}${x.text.slice(0, 80)}`)
      .join(' | ');
  /** Waits for something written by another window or account (a file this window doesn't save). */
  const until = async (what: string, ok: () => boolean) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (ok()) return;
      } catch {
        // half-written, or not there yet
      }
      await t().win.waitForTimeout(100);
    }
    assert.fail(`never: ${what}\n  the game log ends: ${lastEvents()}`);
  };

  return {
    demo,
    of,
    registry,
    account,
    sheetIn,
    until,

    /** Play's Home → Set Up A Demo Game, the GM's (the main window in Play). */
    async setUp() {
      await t().win.getByRole('button', { name: 'Set Up A Demo Game' }).first().click();
      await t().win.getByRole('button', { name: 'Open Play: Demo: The Goblin Road' }).waitFor();
      await t().saved();
    },

    /** Switches accounts from the account menu (the item says who they play). */
    async switchTo(item: RegExp) {
      const { win } = t();
      await win.getByRole('button', { name: /^Account:/ }).click();
      await win.getByRole('menuitemradio', { name: item }).click();
      await win.waitForTimeout(500);
      await win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
    },
  };
}
