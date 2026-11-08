/**
 * Tabletop as the GM: Campaign Home, an encounter (the party, a creature, damage
 * and healing, initiative), the Bestiary, a character's hit points, a new
 * session, the dice, the Library, Copy Campaign; and a player making a
 * character. The Sunken Lantern sample.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { go, launch, live, openWorldMenu, rail, role, section, type Launched } from './app';

describe('Tabletop', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Tabletop');
    await role(t.win, 'gm');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const main = () => t.win.locator('main');
  const campaign = () => live<any>(t.vault().worlds).find((w) => w.section === 'tabletop' && w.name === 'The Sunken Lantern');
  const encounter = (name: string) => live<any>(t.vault().encounters).find((e) => e.name === name);

  test('Campaign Home: the summary is saved', async () => {
    await rail(t.win, 'Campaign Home');
    await main().getByRole('textbox', { name: 'Summary' }).fill('The light is back, and so are the ships. Not their crews.');
    await t.saved();
    assert.equal(campaign().summary, 'The light is back, and so are the ships. Not their crews.');
  });

  test('a new encounter with the party and a creature', async () => {
    await rail(t.win, 'Encounters');
    await aside().getByRole('button', { name: 'New Encounter' }).click();
    await t.win.getByRole('dialog', { name: 'New Encounter' }).getByRole('button', { name: /^Create Custom/ }).click();
    await main().getByRole('textbox', { name: 'Encounter name' }).fill('Wreck Watch');
    await main().getByRole('button', { name: 'Add The Party' }).click();
    await main().getByRole('combobox', { name: 'Add a creature' }).click();
    await t.win.getByRole('option', { name: /^Brine Ghoul/ }).click();
    await t.saved();
    const e = encounter('Wreck Watch');
    assert.equal(e.combatants.filter((c: any) => c.kind === 'pc').length, 4);
    assert.equal(e.combatants.filter((c: any) => c.kind === 'monster' && c.name === 'Brine Ghoul').length, 1);
  });

  test('damage and healing', async () => {
    const ghoul = () => encounter('Wreck Watch').combatants.find((c: any) => c.name === 'Brine Ghoul');
    const max = ghoul().maxHp;
    await main().getByRole('textbox', { name: 'Damage or healing for Brine Ghoul' }).fill('5');
    await main().getByRole('button', { name: 'Damage Brine Ghoul' }).click();
    await t.saved();
    assert.equal(ghoul().hp, max - 5);
    await main().getByRole('textbox', { name: 'Damage or healing for Brine Ghoul' }).fill('2');
    await main().getByRole('button', { name: 'Heal Brine Ghoul' }).click();
    await t.saved();
    assert.equal(ghoul().hp, max - 3);
  });

  test('Roll Initiative gives everyone one', async () => {
    await main().getByRole('button', { name: 'Roll Initiative' }).click();
    await t.saved();
    assert.ok(encounter('Wreck Watch').combatants.every((c: any) => typeof c.initiative === 'number'));
  });

  test('rewards: the fight’s XP shared, a thing for one of them, coins split; on their sheets', async () => {
    const party = () => live<any>(t.vault().pcs).filter((p) => encounter('Wreck Watch').combatants.some((c: any) => c.refId === p.id));
    const before = new Map(party().map((p) => [p.id, { xp: p.xp ?? 0, gp: p.currency?.gp ?? 0, items: p.inventory.length }]));
    const rewards = main().getByRole('region', { name: 'Rewards' });
    await rewards.getByRole('button', { name: 'Add Loot' }).click();
    await rewards.getByRole('textbox', { name: 'Loot' }).fill('Silver Key');
    await rewards.getByRole('textbox', { name: 'GP found' }).fill('9');
    await t.saved();
    await rewards.scrollIntoViewIfNeeded();
    await rewards.getByRole('button', { name: 'Give Rewards' }).click();
    await t.saved();
    const after = party();
    const gained = after.map((p) => (p.xp ?? 0) - before.get(p.id)!.xp);
    assert.ok(gained.every((g) => g > 0 && g === gained[0]), 'the same XP each');
    assert.equal(after.reduce((n, p) => n + (p.currency?.gp ?? 0) - before.get(p.id)!.gp, 0), 9, 'every coin given');
    assert.equal(after.filter((p) => p.inventory.some((i: any) => i.name === 'Silver Key')).length, 1, 'the key to one of them');
    assert.ok(encounter('Wreck Watch').awarded?.to.length === after.length);
  });

  test('the Bestiary: a new creature', async () => {
    await rail(t.win, 'Bestiary');
    await aside().getByRole('button', { name: 'New Creature' }).click();
    await t.win.getByRole('dialog', { name: 'New Creature' }).getByRole('button', { name: /^Create Custom/ }).click();
    await main().getByRole('textbox', { name: 'Name', exact: true }).fill('Tide Hag');
    await t.saved();
    assert.ok(live<any>(t.vault().monsters).some((m) => m.name === 'Tide Hag'));
    await aside().getByRole('link', { name: /^Tide Hag/ }).waitFor();
  });

  test('the Party: damage on a character’s sheet', async () => {
    await rail(t.win, 'Party');
    await aside().getByRole('link', { name: /^Brin Ashvale/ }).click();
    const brin = () => live<any>(t.vault().pcs).find((p) => p.name === 'Brin Ashvale');
    const before = brin().hp.current;
    await main().getByRole('spinbutton', { name: 'Amount' }).fill('4');
    await main().getByRole('button', { name: 'Damage', exact: true }).click();
    await t.saved();
    assert.equal(brin().hp.current, before - 4);
  });

  test('Ctrl+N makes a new session', async () => {
    const sessions = () => live<any>(t.vault().scenes).filter((s) => live<any>(t.vault().books).some((b) => b.id === s.bookId && b.worldId === campaign().id)).length;
    const before = sessions();
    await t.win.keyboard.press('Control+n');
    await t.saved();
    assert.equal(sessions(), before + 1);
  });

  test('the dice: a roll lands in History', async () => {
    await t.win.keyboard.press('Control+d');
    const dice = t.win.getByRole('dialog', { name: 'Dice' });
    await dice.getByRole('button', { name: 'Roll 1d20' }).click();
    await t.win.waitForFunction(() => !document.querySelector('[role="dialog"]')?.textContent?.includes('No rolls yet'));
    await dice.getByRole('button', { name: 'Close' }).click();
    await dice.waitFor({ state: 'hidden' });
  });

  test('the Library finds a monster', async () => {
    await rail(t.win, 'Library');
    await main().getByRole('textbox', { name: 'Search' }).fill('goblin');
    await main().getByRole('option', { name: /^Goblin\b/ }).first().waitFor();
  });

  test('Copy Campaign makes a new campaign with what’s in it', async () => {
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: /Copy Campaign/ }).click();
    const dialog = t.win.getByRole('dialog', { name: 'Copy Campaign' });
    await dialog.getByRole('button', { name: 'Copy Campaign' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await t.saved();
    const copy = live<any>(t.vault().worlds).find((w) => w.name === 'The Sunken Lantern (Copy)');
    assert.ok(copy, 'the new campaign');
    const npcs = (worldId: string) => live<any>(t.vault().entries).filter((e) => e.worldId === worldId && e.kind === 'character').length;
    assert.equal(npcs(copy.id), npcs(campaign().id));
    assert.ok(live<any>(t.vault().encounters).some((e) => e.worldId === copy.id));
  });

  test('a player makes a character', async () => {
    await role(t.win, 'player');
    await go(t.win, '/create');
    await t.win.getByRole('textbox', { name: 'Character name' }).fill('Wren Halloway');
    await main().getByRole('button', { name: 'Skip, Fill In The Sheet' }).click();
    await t.saved();
    assert.ok(live<any>(t.vault().pcs).some((p) => p.name === 'Wren Halloway'));
    assert.equal(await t.win.getByRole('textbox', { name: 'Character name' }).inputValue(), 'Wren Halloway');
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
