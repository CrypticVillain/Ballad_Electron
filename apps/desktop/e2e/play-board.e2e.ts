/**
 * Play: the GM's tools at the table, in Play's window, on a started scene made
 * from the encounter (lantern.ts gets it there, through the UI, as play.e2e.ts
 * does and checks): the ruler, initiative, the chat and dice tray, the Sheet's
 * spells, attacks and skills, a ping and a spell's area, walls and line of
 * sight, the dice's History, the GM's Library in the board's place, and Music
 * from Play's window. The Sunken Lantern sample. Nothing later in Play's story
 * (the players at the table: play.e2e.ts) depends on these, so they run here,
 * beside it.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Page } from 'playwright-core';
import { live, type Launched } from './app';
import { launchGm, lantern } from './lantern';

describe('Play: the GM’s board', () => {
  let t: Launched;
  let play: Page;
  const { scene, tokensOn, waitFor, ...gm } = lantern(() => t);
  before(async () => {
    t = await launchGm();
    await gm.addMusic();
    await gm.mapEncounter();
    await gm.playHome();
    play = await gm.openPlay();
    await gm.newScene(play);
    await gm.start(play);
  });
  after(() => t.close());

  test('the ruler, in the Play window', async () => {
    const board = play.getByRole('application');
    await board.click({ position: { x: 5, y: 5 } });
    await play.keyboard.press('r');
    const box = (await board.boundingBox())!;
    await play.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
    await play.mouse.down();
    await play.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 6 });
    await play.mouse.up();
    assert.match(await play.getByRole('status', { name: 'Distance' }).innerText(), /\d+ ft/);
    await play.keyboard.press('Escape');
  });

  test('initiative on the board: Start Combat rolls for everyone, Next steps the turn, its token ringed', async () => {
    await play.getByRole('button', { name: 'Start Combat' }).click();
    const order = play.getByRole('region', { name: 'Turn order' });
    await order.waitFor();
    await waitFor(() => Boolean(scene().combat));
    await t.saved();
    const combat = scene().combat;
    assert.equal(combat.round, 1);
    assert.equal(combat.entries.length, tokensOn(scene().id).length);
    assert.ok(combat.entries.every((e: { initiative: number | null }) => typeof e.initiative === 'number'));
    await play.locator('[data-turn]').waitFor();
    const first = await order.locator('li[aria-current="true"]').innerText();
    await order.getByRole('button', { name: 'Next' }).click();
    await waitFor(() => scene().combat.turn === 1);
    assert.notEqual(await order.locator('li[aria-current="true"]').innerText(), first);
  });

  test('the table’s log: what’s said, and a roll from the dice tray', async () => {
    await play.getByRole('button', { name: 'Chat', exact: true }).click();
    const log = play.getByRole('complementary', { name: 'Chat' });
    await log.getByText('Combat starts.', { exact: false }).waitFor();
    await log.getByRole('textbox', { name: 'Message' }).fill('The tide is turning.');
    await log.getByRole('button', { name: 'Send' }).click();
    await log.getByText('The tide is turning.').waitFor();
    await play.getByRole('button', { name: 'Dice' }).click();
    const tray = play.getByRole('dialog', { name: /Dice/ });
    await tray.getByRole('button', { name: 'Roll 1d20' }).click();
    await tray.getByRole('button', { name: 'Close' }).click();
    await waitFor(() => live<any>(t.vault().tableLog ?? {}).some((e) => e.kind === 'roll'));
    await t.saved();
    const entries = live<any>(t.vault().tableLog);
    assert.ok(entries.some((e) => e.kind === 'chat' && e.text === 'The tide is turning.' && e.who === 'GM'));
    assert.ok(entries.some((e) => e.kind === 'roll' && e.roll.expression.includes('d20')));
    // Roll20's commands: /r rolls, /em says what you do.
    await log.getByRole('textbox', { name: 'Message' }).fill('/r 2d6+3 Falling rocks');
    await log.getByRole('button', { name: 'Send' }).click();
    await log.locator('[data-card="roll"]').getByText('Falling rocks').first().waitFor();
    await log.getByRole('textbox', { name: 'Message' }).fill('/em rings the lantern bell');
    await log.getByRole('button', { name: 'Send' }).click();
    await log.getByText('rings the lantern bell').waitFor();
    await log.getByRole('button', { name: 'Close the chat' }).click();
  });

  test('the Sheet (the GM’s, any of the party): a spell cast, its attack, damage and slot; an attack’s card; a skill', async () => {
    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const sheet = play.getByRole('complementary', { name: 'Sheet' });
    await sheet.getByRole('combobox', { name: 'Whose sheet' }).click();
    await play.getByRole('option', { name: 'Tamsin Reed' }).click();
    const tamsin = () => live<any>(t.vault().pcs).find((p) => p.name === 'Tamsin Reed');
    const slotsBefore = tamsin().slots[0][1];
    await sheet.getByRole('tab', { name: 'spells' }).click();
    await sheet.getByRole('button', { name: 'Cast Guiding Bolt' }).click();
    const chat = play.getByRole('complementary', { name: 'Chat' });
    // A roll doesn't open the chat (Settings → Dice): it's opened here.
    if (!(await chat.count())) await play.getByRole('button', { name: 'Chat', exact: true }).click();
    const card = chat.locator('[data-card="spell"]').filter({ hasText: 'Guiding Bolt' }).last();
    await card.waitFor();
    await card.getByText('Ranged Spell Attack').waitFor();
    await card.getByText(/^Damage|^Critical Damage/).first().waitFor();
    await waitFor(() => tamsin().slots[0][1] === slotsBefore + 1);
    assert.equal(tamsin().slots[0][1], slotsBefore + 1, 'a 1st-level slot spent');
    await sheet.getByRole('button', { name: 'Cast Sacred Flame' }).click();
    await chat.locator('[data-card="spell"]').filter({ hasText: 'Sacred Flame' }).getByText(/DC \d+ Dexterity/).waitFor();
    await sheet.getByRole('tab', { name: 'actions' }).click();
    await sheet.getByRole('button', { name: 'Attack with Mace' }).click();
    const attack = chat.locator('[data-card="attack"]').filter({ hasText: 'Mace' }).last();
    await attack.getByText('To Hit').waitFor();
    await sheet.getByRole('tab', { name: 'checks' }).click();
    await sheet.getByRole('button', { name: 'Insight check' }).click();
    await chat.locator('[data-card="skill"]').filter({ hasText: 'Insight' }).waitFor();
    await sheet.getByRole('tab', { name: 'spells' }).click();
    await t.saved();
    const cards = live<any>(t.vault().tableLog).filter((e) => e.kind === 'card');
    assert.ok(cards.some((e) => e.card.title === 'Guiding Bolt' && e.card.rolls.some((r: any) => r.type === 'radiant')));
    await sheet.getByRole('button', { name: 'Close the sheet' }).click();
    await chat.getByRole('button', { name: 'Close the chat' }).click();
  });

  test('a ping (Alt + click), and a spell’s area (A: a cone), on the board', async () => {
    const board = play.getByRole('application');
    const box = (await board.boundingBox())!;
    // Over a token, too: Alt + click pings rather than picks.
    const brin = (await play.locator('[data-token][aria-label^="Brin Ashvale,"]').boundingBox())!;
    await play.keyboard.down('Alt');
    await play.mouse.click(brin.x + brin.width / 2, brin.y + brin.height / 2);
    await play.keyboard.up('Alt');
    await play.locator('[data-ping]').waitFor();
    await board.click({ position: { x: 5, y: 5 } });
    await play.keyboard.press('a');
    await play.getByRole('toolbar', { name: 'Areas' }).getByRole('button', { name: 'A Cone' }).click();
    await play.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 + 80);
    await play.mouse.down();
    await play.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 80, { steps: 6 });
    assert.match(await play.getByRole('status', { name: 'Area' }).innerText(), /\d+ ft/);
    await play.mouse.up();
    await waitFor(() => live<any>(t.vault().templates ?? {}).length > 0);
    assert.equal(live<any>(t.vault().templates)[0].shape, 'cone');
    await play.locator('[data-template="cone"]').waitFor();
    await play.keyboard.press('Escape');
  });

  test('walls (W) and line of sight: the GM sees as the players do', async () => {
    const board = play.getByRole('application');
    const box = (await board.boundingBox())!;
    await board.click({ position: { x: 5, y: 5 } });
    await play.keyboard.press('w');
    await play.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);
    await play.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * 0.9);
    await waitFor(() => (scene().walls ?? []).length === 1);
    assert.equal(scene().walls[0].points.length, 2);
    await play.getByRole('toolbar', { name: 'Walls' }).getByRole('button', { name: 'See As The Players Do' }).click();
    assert.equal(await play.locator('[data-vision]').count(), 0, 'line of sight is off');
    await play.keyboard.press('Escape');
    await play.getByRole('switch', { name: 'Line of sight' }).click();
    await waitFor(() => Boolean(scene().vision?.enabled));
    await play.locator('[data-vision]').waitFor();
    await play.getByRole('switch', { name: 'Line of sight' }).click();
    await waitFor(() => !scene().vision?.enabled);
    await play.keyboard.press('w');
    await play.getByRole('toolbar', { name: 'Walls' }).getByRole('button', { name: 'See As The Players Do' }).click();
    await play.keyboard.press('Escape');
  });

  test('the dice, in the Play window: a roll lands in its History', async () => {
    await play.getByRole('button', { name: 'Dice' }).click();
    const tray = play.getByRole('dialog', { name: /Dice/ });
    await tray.getByRole('button', { name: 'Roll 1d20' }).click();
    await tray.getByText(/1d20/).first().waitFor();
    await tray.getByRole('button', { name: 'Close' }).click();
    await tray.waitFor({ state: 'hidden' });
  });

  test('the GM’s Library, at the foot of the Scenes sidebar: in the board’s place until a scene is picked', async () => {
    await play.getByRole('complementary', { name: 'Scenes' }).getByRole('button', { name: 'Library', exact: true }).click();
    await play.getByRole('textbox', { name: 'Search' }).fill('goblin');
    await play.getByRole('option', { name: /^Goblin\b/ }).first().waitFor();
    assert.equal(await play.getByRole('application').count(), 0, 'the board makes way');
    await play.getByRole('button', { name: /^Music \d/ }).click();
    await play.getByRole('button', { name: 'Play Battle Drums' }).waitFor();
    await play.getByRole('complementary', { name: 'Scenes' }).getByRole('button', { name: new RegExp(`^${scene().name}`) }).click();
    await play.getByRole('application').waitFor();
  });

  test('Play’s window → Music (not the Play module): a Library track on the scene', async () => {
    assert.equal(await t.win.locator('nav[aria-label="Modules"] [aria-label="Music"]').count(), 0, 'no Music in the module');
    const scenes = play.getByRole('complementary', { name: 'Scenes' });
    await scenes.getByRole('button', { name: 'Music', exact: true }).click();
    await play.locator('main').getByRole('button', { name: 'Add Music' }).first().click();
    await play.getByRole('dialog').getByRole('button', { name: /Tavern Theme/ }).click();
    await t.saved();
    assert.equal(scene().music.tracks.length, 2);
    assert.equal(await play.getByRole('application').count(), 0, 'in the board’s place');
    await scenes.getByRole('button', { name: new RegExp(`^${scene().name}`) }).click();
    await play.getByRole('application').waitFor();
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
