/**
 * D&D maps: the DM pins and renames the campaign's map; a player gets it
 * without the DM Only pins, can copy it to their own maps, and unlock it to
 * edit. The Sunken Lantern sample (its map is shared with the whole party).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, role, section, type Launched } from './app';

describe('maps', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'D&D');
    await role(t.win, 'dm');
    await rail(t.win, 'Maps');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const main = () => t.win.locator('main');
  const campaignMap = () => live<any>(t.vault().maps).find((m) => !m.characterId);
  const pins = async () => (await main().getByRole('button', { name: /^Pin: / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))).map((l) => l.slice('Pin: '.length));

  test('Add Pin, then a click on the map, pins it there', async () => {
    const before = campaignMap().pins.length;
    await main().getByRole('button', { name: 'Add Pin' }).click();
    const map = main().locator('img').first();
    const box = (await map.boundingBox())!;
    await t.win.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.85);
    await t.saved();
    assert.equal(campaignMap().pins.length, before + 1);
  });

  test('the map’s name', async () => {
    await main().getByRole('textbox', { name: 'Map name' }).fill('Saltreach & The Lantern');
    await t.saved();
    assert.equal(campaignMap().name, 'Saltreach & The Lantern');
  });

  test('a player has it without the DM Only pins', async () => {
    const dmOnly = campaignMap().pins.filter((p: any) => p.dmOnly).map((p: any) => p.label);
    assert.ok(dmOnly.length > 0, 'the sample has DM Only pins');
    await role(t.win, 'player');
    await rail(t.win, 'Maps');
    await aside().getByRole('link', { name: /^Saltreach/ }).click();
    const shown = await pins();
    assert.ok(shown.includes('Saltreach'));
    for (const label of dmOnly) assert.ok(!shown.includes(label), `${label} is the DM’s`);
    assert.ok(await main().getByRole('textbox', { name: 'Map name' }).isDisabled());
  });

  test('Copy To My Maps makes the player one of their own', async () => {
    const before = live<any>(t.vault().maps).filter((m) => m.characterId).length;
    await main().getByRole('button', { name: 'Copy To My Maps' }).click();
    await t.saved();
    assert.equal(live<any>(t.vault().maps).filter((m) => m.characterId).length, before + 1);
  });

  test('Unlock To Edit lets the player change their version', async () => {
    await aside().getByRole('link', { name: /^Saltreach/ }).first().click();
    await main().getByRole('button', { name: 'Unlock To Edit' }).click();
    assert.ok(await main().getByRole('textbox', { name: 'Map name' }).isEnabled());
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
