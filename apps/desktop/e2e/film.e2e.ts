/**
 * Filmmaking: the script saves as you type, and each production module
 * makes and edits its records (shots, shoot days, budget lines, gear,
 * releases, VFX shots, crew). The How Glass Is Made sample.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, section, type Launched } from './app';

describe('filmmaking', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Filmmaking');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const main = () => t.win.locator('main');
  const count = (collection: string) => live<any>(t.vault()[collection]).length;
  /** Clicks something that adds a record, and says the collection grew by one. */
  const adds = async (collection: string, click: () => Promise<void>) => {
    const before = count(collection);
    await click();
    await t.saved();
    assert.equal(count(collection), before + 1, collection);
  };

  test('the script saves as you type', async () => {
    await rail(t.win, 'Script');
    await aside().getByRole('link', { name: /^1 · The Furnace/ }).click();
    const last = t.win.locator('main [contenteditable="true"] > * ').last();
    await last.waitFor();
    await t.win.locator('main [contenteditable="true"]').first().click();
    await t.win.keyboard.press('Control+End');
    await t.win.keyboard.press('Enter');
    await t.win.keyboard.type('The glass sings as it cools.');
    await t.saved();
    const furnace = live<any>(t.vault().scenes).find((s) => s.title === 'The Furnace');
    assert.match(furnace.text, /The glass sings as it cools\./);
  });

  test('Shots: what we see', async () => {
    await rail(t.win, 'Shots');
    await main().getByRole('textbox', { name: 'What we see' }).first().fill('The furnace door, slow, then all at once');
    await t.saved();
    assert.ok(live<any>(t.vault().shots).some((s) => s.description === 'The furnace door, slow, then all at once'));
  });

  test('Schedule: a new shoot day', async () => {
    await rail(t.win, 'Schedule');
    await adds('shootDays', () => main().getByRole('button', { name: 'New Shoot Day' }).click());
  });

  test('Budget: a new line', async () => {
    await rail(t.win, 'Budget');
    await adds('budget', () => main().getByRole('button', { name: 'Add Line' }).first().click());
  });

  test('Gear: add some', async () => {
    await rail(t.win, 'Gear');
    await adds('gear', () => main().getByRole('button', { name: 'Add Gear' }).click());
  });

  test('Releases: a signed one', async () => {
    await rail(t.win, 'Releases');
    await main().getByRole('combobox', { name: 'Status' }).first().click();
    await t.win.getByRole('option', { name: 'Signed', exact: true }).click();
    await t.saved();
    assert.ok(live<any>(t.vault().releases).some((r) => r.status === 'signed'));
  });

  test('Post: a VFX shot', async () => {
    await rail(t.win, 'Post');
    await adds('vfx', () => main().getByRole('button', { name: 'VFX Shot' }).click());
  });

  test('Crew: a new crew member', async () => {
    await rail(t.win, 'Crew');
    await aside().getByRole('button', { name: 'New Crew Member' }).click();
    await main().getByRole('textbox', { name: 'Name', exact: true }).fill('Rosa Kint');
    await t.saved();
    assert.ok(live<any>(t.vault().entries).some((e) => e.name === 'Rosa Kint' && e.kind === 'crew'));
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
