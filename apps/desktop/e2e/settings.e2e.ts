/**
 * Settings and Help: the 12/24-hour clock, the status bar's shortcuts, the
 * Help sheet (its footer button, Shift+/, the account menu, the filter) and
 * the Manage Spaces / Manage Folders dialogs.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, openWorldMenu, rail, section, type Launched } from './app';

describe('settings and help', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Writing');
  });
  after(() => t.close());

  const prefs = () => t.win.evaluate(() => JSON.parse(localStorage.getItem('ballad.preferences') ?? '{}'));
  const settings = () => t.win.getByRole('dialog', { name: 'Settings' });
  const help = () => t.win.getByRole('dialog', { name: 'Help' });
  const footer = () => t.win.locator('footer');

  test('the clock: 24-hour, then back to 12', async () => {
    await t.win.keyboard.press('Control+,');
    await settings().getByRole('tab', { name: 'Appearance' }).click();
    await settings().getByRole('radio', { name: /^24-Hour/ }).click();
    assert.equal((await prefs()).clock, '24');
    await settings().getByRole('radio', { name: /^12-Hour/ }).click();
    assert.equal((await prefs()).clock, '12');
  });

  test('the status bar’s shortcuts can be hidden', async () => {
    assert.match(await footer().innerText(), /Search/);
    const toggle = settings().getByRole('switch', { name: 'Show keyboard shortcuts in the status bar' });
    await toggle.click();
    assert.equal((await prefs()).statusShortcuts, false);
    assert.doesNotMatch(await footer().innerText(), /Ctrl\s*K\s*Search/);
    await toggle.click();
    assert.equal((await prefs()).statusShortcuts, true);
    assert.match(await footer().innerText(), /Search/);
    await t.win.keyboard.press('Escape');
  });

  test('Help opens from the status bar, and its filter narrows it', async () => {
    await footer().getByRole('button', { name: /Help/ }).click();
    await help().waitFor();
    await help().getByRole('tab', { name: 'All' }).click();
    await help().getByRole('textbox', { name: 'Filter shortcuts' }).fill('dice');
    const text = await help().innerText();
    assert.match(text, /dice/i);
    assert.doesNotMatch(text, /Focus mode/);
    await t.win.keyboard.press('Escape');
    await help().waitFor({ state: 'hidden' });
  });

  test('Shift+/ opens Help, but not while typing', async () => {
    await t.win.keyboard.press('Shift+/');
    await help().waitFor();
    await t.win.keyboard.press('Escape');
    await rail(t.win, 'Characters');
    await t.win.locator('main input[aria-label="Tagline"]').click();
    await t.win.keyboard.press('Shift+/');
    await t.win.waitForTimeout(200);
    assert.equal(await help().count(), 0);
    await t.win.keyboard.press('Control+z');
  });

  test('the account menu opens Help at Keyboard Shortcuts', async () => {
    await t.win.getByRole('button', { name: /^Account:/ }).click();
    await t.win.getByRole('menuitem', { name: /^Keyboard Shortcuts/ }).click();
    await help().waitFor();
    await t.win.keyboard.press('Escape');
    await help().waitFor({ state: 'hidden' });
  });

  test('the account menu’s Appearance switches light and dark', async () => {
    const pick = async (name: string) => {
      await t.win.locator('[role="menu"]').first().waitFor({ state: 'detached' });
      await t.win.getByRole('button', { name: /^Account:/ }).click();
      await t.win.getByRole('menuitem', { name: 'Appearance' }).hover();
      await t.win.getByRole('menuitemradio', { name, exact: true }).click();
    };
    await pick('Dark');
    assert.equal((await prefs()).theme, 'dark');
    assert.ok(await t.win.evaluate(() => document.documentElement.classList.contains('dark')));
    await pick('Light');
    assert.equal((await prefs()).theme, 'light');
    assert.ok(!(await t.win.evaluate(() => document.documentElement.classList.contains('dark'))));
  });

  test('Manage Spaces renames a space, in tabs for each list', async () => {
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: /Manage Spaces/ }).click();
    const dialog = t.win.getByRole('dialog', { name: 'Manage Spaces' });
    const tabs = await dialog.getByRole('tab').allInnerTexts();
    assert.ok(tabs.includes('Characters') && tabs.includes('Places') && tabs.includes('Lore'), tabs.join(', '));
    await dialog.getByRole('tab', { name: 'Characters' }).click();
    await dialog.getByRole('textbox', { name: /^Name of the .* space$/ }).first().fill('Leads');
    await t.win.keyboard.press('Tab');
    await t.saved();
    const world = live<any>(t.vault().worlds).find((w) => w.section === 'writing');
    assert.equal(world.layouts.character.spaces[0].name, 'Leads');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await t.win.locator('aside').getByRole('button', { name: /^Leads \d/ }).waitFor();
  });

  test('Manage Folders adds a folder', async () => {
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: /Manage Folders/ }).click();
    const dialog = t.win.getByRole('dialog', { name: 'Manage Folders' });
    await dialog.getByRole('tab', { name: 'Places' }).click();
    const before = await dialog.getByRole('textbox', { name: /^Name of the .* folder$/ }).count();
    await dialog.getByRole('button', { name: /New Folder/ }).first().click();
    assert.equal(await dialog.getByRole('textbox', { name: /^Name of the .* folder$/ }).count(), before + 1);
    await t.saved();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'hidden' });
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
