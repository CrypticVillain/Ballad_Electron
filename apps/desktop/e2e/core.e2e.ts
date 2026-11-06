/**
 * The shell: the first run's sample worlds, the world menu's sections, the
 * rail and its Alt+number keys, Back and Forward, search (Ctrl+K) and a new
 * scene (Ctrl+N).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, section, worldMenu, type Launched } from './app';

describe('the shell', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
  });
  after(() => t.close());

  const mark = () => worldMenu(t.win);
  const current = () => t.win.locator('nav[aria-label="Modules"] a[aria-current="page"]').getAttribute('aria-label');
  const route = () => t.win.evaluate(() => location.hash.slice(1));

  test('the first run makes a sample world in each section', async () => {
    await t.saved();
    const worlds = live<any>(t.vault().worlds);
    assert.deepEqual(worlds.map((w) => w.section).sort(), ['film', 'tabletop', 'writing']);
    assert.ok(worlds.every((w) => w.sample));
  });

  test('the world menu switches sections', async () => {
    await section(t.win, 'Writing');
    assert.equal(await mark().getAttribute('aria-label'), 'Writing · World: The Glass Archipelago');
    await section(t.win, 'Filmmaking');
    assert.match((await mark().getAttribute('aria-label'))!, /^Filmmaking · /);
    await section(t.win, 'Tabletop');
    assert.match((await mark().getAttribute('aria-label'))!, /^Tabletop · Campaign: The Sunken Lantern/);
    await section(t.win, 'Writing');
  });

  test('Alt+number opens that module on the rail', async () => {
    await t.win.keyboard.press('Alt+2');
    await t.win.waitForSelector('nav[aria-label="Modules"] a[aria-label="Manuscript"][aria-current="page"]');
    await t.win.keyboard.press('Alt+3');
    await t.win.waitForSelector('nav[aria-label="Modules"] a[aria-label="Characters"][aria-current="page"]');
  });

  test('Back and Forward', async () => {
    await rail(t.win, 'Places');
    await t.win.waitForSelector('nav[aria-label="Modules"] a[aria-label="Places"][aria-current="page"]');
    await t.win.locator('main').getByRole('button', { name: 'Back' }).click();
    await t.win.waitForSelector('nav[aria-label="Modules"] a[aria-label="Characters"][aria-current="page"]');
    await t.win.locator('main').getByRole('button', { name: 'Forward' }).click();
    await t.win.waitForSelector('nav[aria-label="Modules"] a[aria-label="Places"][aria-current="page"]');
    assert.equal(await current(), 'Places');
  });

  test('Ctrl+K searches the world and opens what you pick', async () => {
    await t.win.keyboard.press('Control+k');
    const dialog = t.win.getByRole('dialog', { name: 'Search' });
    await dialog.getByRole('combobox').fill('Corin');
    await dialog.getByRole('option', { name: /^Corin Hale Magistrate/ }).click();
    await t.win.waitForSelector('main input[aria-label="Name"]');
    assert.match(await route(), /^\/bible\/character\//);
    assert.equal(await t.win.locator('main input[aria-label="Name"]').inputValue(), 'Corin Hale');
  });

  test('Ctrl+N makes a new scene and opens it', async () => {
    const before = live<any>(t.vault().scenes).length;
    await t.win.keyboard.press('Control+n');
    await t.saved();
    assert.equal(live<any>(t.vault().scenes).length, before + 1);
    assert.match(await route(), /^\/manuscript\//);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
