/**
 * Every module on the rail opens without an error, in every section: Writing,
 * Filmmaking, and D&D as the DM and as a player. The rail is read from the
 * page, so a module added to components/shell/modules.ts is covered too.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, role, section, type Launched } from './app';

describe('every module opens', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
  });
  after(() => t.close());

  /** Clicks each rail module in turn; returns the ones that threw, logged an error or showed nothing. */
  const visitAll = async () => {
    const labels = await t.win.locator('nav[aria-label="Modules"] a[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!));
    assert.ok(labels.length >= 5, `the rail has its modules (${labels.join(', ')})`);
    const broken: string[] = [];
    for (const label of labels) {
      const before = t.errors.length;
      await t.win.locator(`nav[aria-label="Modules"] a[aria-label="${label}"]`).click();
      await t.win.waitForSelector(`nav[aria-label="Modules"] a[aria-label="${label}"][aria-current="page"]`);
      await t.win.waitForTimeout(150);
      const text = await t.win.locator('main').first().innerText().catch(() => '');
      if (t.errors.length > before) broken.push(`${label}: ${t.errors.slice(before).join(' / ').slice(0, 300)}`);
      else if (!text.trim()) broken.push(`${label}: nothing on screen`);
    }
    return { labels, broken };
  };

  test('Writing', async () => {
    await section(t.win, 'Writing');
    const { labels, broken } = await visitAll();
    assert.ok(labels.includes('Manuscript') && labels.includes('Names'));
    assert.deepEqual(broken, []);
  });

  test('Filmmaking', async () => {
    await section(t.win, 'Filmmaking');
    const { labels, broken } = await visitAll();
    assert.ok(labels.includes('Script') && labels.includes('Breakdown'));
    assert.deepEqual(broken, []);
  });

  test('D&D, the DM', async () => {
    await section(t.win, 'D&D');
    await role(t.win, 'dm');
    const { labels, broken } = await visitAll();
    assert.ok(labels.includes('Campaign Home') && labels.includes('Encounters'));
    assert.deepEqual(broken, []);
  });

  test('D&D, a player', async () => {
    await role(t.win, 'player');
    const { labels, broken } = await visitAll();
    assert.ok(labels.includes('Character') && labels.includes('Journal'));
    assert.deepEqual(broken, []);
  });
});
