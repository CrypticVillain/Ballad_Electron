/**
 * Play, as an online table on this computer (main/table.ts plays the server):
 * the GM's music in the Library, an encounter's map prepared in Tabletop
 * (the fight placed, fog, music), Play in a window of its own (one at a
 * time), a scene made from the encounter, Start (live, its music on), the
 * ruler; Show Scene, the sidebar's eyes, a handout, a document from Lore (made
 * there before, handwritten and put in a folder) written on, the GM's marks; then
 * test players made for the party, and one of them (Sam, who plays Brin) at
 * the table: the started scene, a player's tools, only his token to move,
 * the shown handout, his own marks to clear (not the GM's). The Sunken
 * Lantern sample.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { Page } from 'playwright-core';
import { go, launch, live, relaunch, role, section, type Launched } from './app';

/** A short tone, as a .wav (the Open dialog is answered with two of them). */
function tone(file: string) {
  const rate = 8000;
  const n = rate * 2;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 3000), 44 + i * 2);
  writeFileSync(file, b);
}

describe('Play', () => {
  let t: Launched;
  let play: Page;
  const media = path.join(os.tmpdir(), `ballad-e2e-music-${process.pid}`);
  before(async () => {
    mkdirSync(media, { recursive: true });
    tone(path.join(media, 'Tavern Theme.wav'));
    tone(path.join(media, 'Battle Drums.wav'));
    t = await launch();
    await t.app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [`${dir}/Tavern Theme.wav`, `${dir}/Battle Drums.wav`] });
    }, media);
    await section(t.win, 'Tabletop');
    await role(t.win, 'gm');
  });
  after(() => t.close());

  const campaign = () => live<any>(t.vault().worlds).find((w) => w.name === 'The Sunken Lantern');
  const encounter = () => live<any>(t.vault().encounters).find((e) => e.worldId === campaign().id);
  const scene = () => live<any>(t.vault().playScenes ?? {})[0];
  const tokensOn = (id: string) => live<any>(t.vault().tokens ?? {}).filter((x) => x.sceneId === id);
  const windows = () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
  /** The Play window (a new one: not `previous`), found among the app's windows. */
  const playWindow = async (previous?: Page): Promise<Page> => {
    // The app opens it at once; Playwright can take a while to attach to a new window (seconds, sometimes tens).
    for (let i = 0; i < 600; i++) {
      const found = t.app.windows().find((w) => w !== t.win && w !== previous && !w.isClosed());
      if (found) return found;
      await t.win.waitForTimeout(100);
    }
    throw new Error(`No Play window opened: the app has ${(await windows()).join(', ')}; Playwright sees ${t.app.windows().length}`);
  };
  const marks = () => live<any>(t.vault().marks ?? {});
  const handouts = () => live<any>(t.vault().handouts ?? {});
  /** A squiggle across the middle of what's drawn on. */
  const scribble = async (page: Page, on: ReturnType<Page['getByRole']>) => {
    const b = (await on.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.45);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (0.35 + i * 0.02), b.y + b.height * (0.45 + (i % 2 ? 0.03 : -0.03)));
    await page.mouse.up();
  };
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 50 && !check(); i++) await t.win.waitForTimeout(100);
  };

  test('Library → Music: tracks added from files', async () => {
    await go(t.win, '/library/music');
    await t.win.getByRole('button', { name: 'Add Music' }).first().click();
    await t.win.getByRole('button', { name: /Battle Drums/ }).waitFor();
    await t.saved();
    assert.deepEqual(live<any>(t.vault().music).map((m) => m.name).sort(), ['Battle Drums', 'Tavern Theme']);
  });

  test('an encounter’s map: blank, the fight placed, fog revealed, music attached', async () => {
    await go(t.win, `/encounters/${encounter().id}`);
    await t.win.getByRole('tab', { name: /^Map/ }).click();
    await t.win.getByRole('tab', { name: 'Blank' }).click();
    await t.win.getByRole('spinbutton', { name: 'Squares Across' }).fill('16');
    await t.win.getByRole('spinbutton', { name: 'Squares Down' }).fill('10');
    await t.win.getByRole('button', { name: 'Use This Map' }).click();
    await t.win.getByRole('application').waitFor();
    await t.win.getByRole('button', { name: 'Add Tokens' }).click();
    await t.win.getByRole('button', { name: 'Place The Rest Of The Fight' }).click();
    await t.win.getByRole('button', { name: 'Close Add Tokens' }).click();
    await t.win.keyboard.press('Escape');
    await t.win.getByRole('complementary', { name: 'Map settings' }).getByRole('switch', { name: 'Fog of war' }).click();
    await t.win.keyboard.press('f');
    const box = (await t.win.getByRole('application').boundingBox())!;
    await t.win.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await t.win.mouse.down();
    await t.win.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 6 });
    await t.win.mouse.up();
    await t.win.getByRole('tab', { name: /^Music/ }).click();
    await t.win.getByRole('button', { name: 'Add Music' }).click();
    await t.win.getByRole('button', { name: /Battle Drums/ }).click();
    await t.saved();
    const e = encounter();
    assert.deepEqual([e.map.width, e.map.height, e.map.fog.enabled, e.map.fog.ops.length], [1120, 700, true, 1]);
    assert.equal(tokensOn(e.id).length, e.combatants.length);
    assert.deepEqual(e.music.tracks.map((x: any) => x.start), ['auto']);
  });

  test('Lore → New Document (the GM’s): its words, handwriting on it, and a folder from the spec sheet', async () => {
    await go(t.win, '/bible/lore');
    await t.win.locator('aside').first().getByRole('button', { name: 'New Lore Entry' }).click();
    await t.win.getByRole('menuitem', { name: 'New Document' }).click();
    await t.win.getByRole('textbox', { name: 'Name', exact: true }).fill('The Ferryman’s Letter');
    await t.win.getByRole('textbox', { name: 'Document', exact: true }).fill('The tide owes me a debt.');
    await t.win.getByRole('button', { name: 'Handwrite' }).click();
    await scribble(t.win, t.win.getByLabel('Writing on the document'));
    await t.win.getByRole('button', { name: 'Done' }).click();
    await t.saved();
    const doc = () => live<any>(t.vault().entries).find((e) => e.document && e.worldId === campaign().id);
    assert.equal(doc().name, 'The Ferryman’s Letter');
    assert.equal(doc().about, 'The tide owes me a debt.');
    assert.ok(doc().ink.length, 'handwritten on');
    // The spec sheet's Folder, below Kept In: a new one, and the note in it.
    await t.win.locator('main').getByRole('button', { name: 'New Folder' }).click();
    await t.win.getByRole('textbox', { name: 'New folder name' }).fill('Letters');
    await t.win.keyboard.press('Enter');
    await t.saved();
    const folder = campaign().layouts.lore.spaces.flatMap((s: any) => s.folders).find((f: any) => f.name === 'Letters');
    assert.deepEqual(folder.items, [doc().id]);
    await t.win.locator('aside').first().getByText('Letters', { exact: true }).waitFor();
  });

  test('Play opens in its own window, with nothing of the rest of the app', async () => {
    await section(t.win, 'Play');
    play = await playWindow();
    await play.getByRole('complementary', { name: 'Scenes' }).waitFor();
    assert.equal((await windows()).length, 2);
    assert.equal(await play.locator('nav[aria-label="Modules"]').count(), 0, 'no rail: Play alone');
    await t.win.getByText('You Run · 1').waitFor();
  });

  test('a scene from the encounter: its map, tokens, fog and music', async () => {
    await play.getByRole('button', { name: 'New Scene' }).first().click();
    const dialog = play.getByRole('dialog', { name: 'New Scene' });
    await dialog.locator('ul button').first().click();
    await dialog.getByRole('button', { name: 'Create Scene' }).click();
    await play.getByRole('application').waitFor();
    await waitFor(() => Boolean(scene()));
    await t.saved();
    const s = scene();
    assert.equal(s.encounterId, encounter().id);
    assert.equal(s.fog.enabled, true);
    assert.equal(tokensOn(s.id).length, encounter().combatants.length);
    assert.equal(s.music.tracks.length, 1);
  });

  test('Start: the scene is live for the table, its music on; Stop', async () => {
    await play.getByRole('button', { name: /^Start/ }).click();
    await play.getByLabel('Now playing').filter({ hasText: 'Battle Drums' }).waitFor();
    await waitFor(() => campaign().tabletop?.live?.sceneId === scene()?.id);
    await t.saved();
    assert.equal(campaign().tabletop.live.sceneId, scene().id);
    assert.ok(scene().nowPlaying?.trackId);
    await play.getByRole('button', { name: 'Stop The Scene' }).click();
    await play.getByLabel('Now playing').filter({ hasText: 'No music' }).waitFor();
    await play.getByRole('button', { name: /^Start/ }).click();
  });

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
    await play.bringToFront();
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

  test('Show Scene: the players see it before it starts (no music); Start starts it', async () => {
    await play.getByRole('button', { name: 'Stop The Scene' }).click();
    await play.getByRole('button', { name: 'Show Scene' }).click();
    await waitFor(() => Boolean(campaign().tabletop?.live?.shownOnly));
    assert.equal(campaign().tabletop.live.sceneId, scene().id);
    assert.equal(scene().nowPlaying ?? null, null, 'no music yet');
    const scenes = play.getByRole('complementary', { name: 'Scenes' });
    await scenes.getByText('Shown', { exact: true }).waitFor();
    assert.equal(await scenes.getByRole('button', { name: `Hide ${scene().name}` }).getAttribute('data-visible'), '', 'its eye is lit');
    await play.getByRole('button', { name: /^Start/ }).click();
    await waitFor(() => campaign().tabletop?.live?.shownOnly === false || !campaign().tabletop?.live?.shownOnly);
    await scenes.getByText('Live', { exact: true }).waitFor();
    assert.ok(scene().nowPlaying?.trackId);
  });

  test('the sidebar’s eyes: a token hidden and shown, by its eye and by a right-click', async () => {
    const scenes = play.getByRole('complementary', { name: 'Scenes' });
    const ghoul = () => tokensOn(scene().id).find((x) => x.name.startsWith('Brine Ghoul'));
    const name = ghoul().name;
    await scenes.getByRole('button', { name: `Hide ${name}`, exact: true }).click();
    await waitFor(() => ghoul().hidden);
    assert.equal(ghoul().hidden, true);
    await scenes.getByRole('button', { name: `Show ${name}`, exact: true }).click({ button: 'right' });
    await play.getByRole('menuitem', { name: 'Show To The Players' }).click();
    await waitFor(() => !ghoul().hidden);
    assert.equal(ghoul().hidden, false);
  });

  test('a handout: a note, hidden until its eye shows it', async () => {
    await play.getByRole('button', { name: 'Add Handout' }).first().click();
    await play.getByRole('menuitem', { name: 'A Note', exact: true }).click();
    await play.getByRole('textbox', { name: 'Note' }).fill('Meet me at the lantern at midnight.');
    await t.saved();
    assert.equal(handouts()[0].hidden, true);
    await play.getByRole('button', { name: 'Show Note' }).first().click();
    await waitFor(() => handouts()[0]?.hidden === false);
    assert.equal(handouts()[0].text, 'Meet me at the lantern at midnight.');
    await play.getByRole('button', { name: 'The Scene', exact: true }).click();
  });

  test('a document from Lore, brought to the scene as a note (hidden); the GM handwrites on it', async () => {
    await play.getByRole('button', { name: 'Add Handout' }).first().click();
    await play.getByRole('menuitem', { name: 'A Document From Lore' }).click();
    await play.getByRole('menuitem', { name: 'The Ferryman’s Letter' }).click();
    const letter = () => handouts().find((h) => h.name === 'The Ferryman’s Letter');
    await waitFor(() => Boolean(letter()));
    assert.equal(letter().text, 'The tide owes me a debt.');
    assert.equal(letter().hidden, true);
    const had = letter().ink.length;
    assert.ok(had, 'its handwriting came with it');
    await play.getByRole('button', { name: 'Handwrite' }).click();
    await scribble(play, play.getByLabel('Writing on the note'));
    await play.getByRole('button', { name: 'Done' }).click();
    await waitFor(() => letter().ink.length > had);
    assert.ok(letter().ink.length > had);
    await play.getByRole('button', { name: 'The Scene', exact: true }).click();
  });

  test('the GM marks up the board', async () => {
    const board = play.getByRole('application');
    await board.click({ position: { x: 5, y: 5 } });
    await play.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Mark Up' }).click();
    await scribble(play, board);
    await play.getByRole('button', { name: 'Done' }).click();
    await waitFor(() => marks().length === 1);
    assert.equal(marks()[0].onId, scene().id);
    assert.ok(marks()[0].strokes.length >= 1);
  });

  test('the Play window takes the main window’s look', async () => {
    const look = (page: Page) => page.evaluate(() => [document.documentElement.dataset.style, document.documentElement.classList.contains('dark')]);
    assert.deepEqual(await look(play), await look(t.win));
  });

  test('opening Play again: still one Play window (the first one closes)', async () => {
    const playIds = () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.getTitle() === 'Ballad · Play').map((w) => w.id));
    const [before] = await playIds();
    // The Play window has the focus: the main window comes forward first, as a click on it would bring it.
    await t.win.bringToFront();
    await t.win.getByRole('button', { name: /^Open Play: The Sunken Lantern/ }).click();
    let after: number[] = [];
    for (let i = 0; i < 50; i++) {
      after = await playIds();
      if (after.length === 1 && after[0] !== before) break;
      await t.win.waitForTimeout(100);
    }
    assert.equal(after.length, 1, 'one Play window');
    assert.notEqual(after[0], before, 'a new one, the first closed');
    assert.equal((await windows()).length, 2);
  });

  test('Play module → Scenes: the same scene set up here; the dropdown picks, and shows what’s picked', async () => {
    await t.win.bringToFront();
    await go(t.win, '/scenes');
    await t.win.getByRole('application').waitFor();
    const picker = t.win.getByRole('combobox', { name: 'What’s picked' });
    await picker.click();
    await t.win.getByRole('option', { name: /^Brin Ashvale/ }).click();
    await t.win.getByRole('complementary', { name: 'Picked token' }).waitFor();
    assert.equal(await t.win.locator('[data-token][aria-label^="Brin Ashvale,"]').getAttribute('aria-pressed'), 'true', 'picked on the board too');
    // Picked on the board (the Select tool: the encounter left Fog on): the dropdown says so.
    await t.win.getByRole('application').focus();
    await t.win.keyboard.press('v');
    await t.win.locator('[data-token][aria-label^="Kael Thorn,"]').click();
    await picker.filter({ hasText: 'Kael Thorn' }).waitFor();
    await picker.click();
    await t.win.getByRole('option', { name: 'The Scene (Its Settings)' }).click();
    await t.win.getByRole('complementary', { name: 'Scene settings' }).waitFor();
  });

  test('the fog brush paints the fog away', async () => {
    const before = scene().fog.ops.length;
    await t.win.keyboard.press('f');
    await t.win.getByRole('button', { name: 'A Brush' }).click();
    await t.win.getByRole('radio', { name: 'Brush 4 wide' }).click();
    const box = (await t.win.getByRole('application').boundingBox())!;
    await t.win.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await t.win.mouse.down();
    await t.win.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.85, { steps: 10 });
    await t.win.mouse.up();
    await t.saved();
    const ops = scene().fog.ops;
    assert.equal(ops.length, before + 1);
    assert.deepEqual([ops.at(-1).shape, ops.at(-1).mode, ops.at(-1).radius], ['brush', 'reveal', 2 * scene().grid.size]);
    assert.ok(ops.at(-1).points.length > 2);
    await t.win.keyboard.press('Escape');
  });

  test('test players: an account for each, in the campaign, playing their sheet', async () => {
    await section(t.win, 'Tabletop');
    await t.win.locator('nav[aria-label="Modules"] button').first().click();
    await t.win.getByRole('menuitem', { name: 'Edit Campaign…' }).click();
    await t.win.getByRole('button', { name: 'Make Test Players For The Party' }).click();
    await t.win.getByRole('dialog').getByText('sam@players.ballad.test').waitFor();
    await t.win.keyboard.press('Escape');
    await t.saved();
    const party = live<any>(t.vault().pcs).filter((p) => p.worldId === campaign().id);
    assert.ok(party.length >= 4 && party.every((p) => p.ownerAccountId));
    assert.equal(campaign().tabletop.members.length, party.length);
  });

  test('a player at the table: the started scene, a player’s tools, only his token moves', async () => {
    // A new session (Playwright finds a session's first new window most surely): the GM's data as it was left.
    t = await relaunch(t);
    const brin = live<any>(t.vault().pcs).find((p) => p.name === 'Brin Ashvale');
    await t.win.evaluate(
      (id) =>
        (window as unknown as { api: { accounts: { switch: (id: string) => Promise<unknown> } } }).api.accounts.switch(id).then(() => {
          location.hash = '#/';
          location.reload();
        }),
      brin.ownerAccountId,
    );
    await t.win.waitForTimeout(500);
    await t.win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
    await section(t.win, 'Play');
    await t.win.getByRole('button', { name: /^Open Play: The Sunken Lantern/ }).click();
    play = await playWindow();
    await play.getByRole('application').waitFor();
    assert.equal(await play.getByRole('complementary', { name: 'Scenes' }).count(), 0);
    assert.deepEqual(await play.getByRole('toolbar', { name: 'Tools' }).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Select', 'Ruler', 'Mark Up']);
    assert.equal(await play.getByRole('button', { name: 'Add Tokens' }).count(), 0);
    await play.getByText('Playing Brin Ashvale').waitFor();

    const sceneId = scene().id;
    const at = (name: string) => tokensOn(sceneId).find((x) => x.name === name);
    const drag = async (name: string) => {
      const box = (await play.locator(`[data-token][aria-label^="${name},"]`).boundingBox())!;
      await play.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await play.mouse.down();
      await play.mouse.move(box.x + box.width / 2 + box.width * 2.1, box.y + box.height / 2, { steps: 8 });
      await play.mouse.up();
      await play.waitForTimeout(300);
    };
    const brinBefore = at('Brin Ashvale');
    const kaelBefore = at('Kael Thorn');
    await drag('Brin Ashvale');
    await waitFor(() => at('Brin Ashvale').x !== brinBefore.x);
    assert.ok(at('Brin Ashvale').x > brinBefore.x, 'Brin moved, in the GM’s vault');
    await drag('Kael Thorn');
    assert.equal(at('Kael Thorn').x, kaelBefore.x, 'Kael isn’t his to move');
    // Muting is his alone: the scene still plays.
    await play.getByRole('button', { name: 'Mute' }).click();
    assert.ok(scene().nowPlaying?.trackId);
  });

  test('a player: the shown handout, and his own marks, which he can clear (not the GM’s)', async () => {
    await play.getByRole('navigation', { name: 'Handouts' }).getByRole('button', { name: /Note/ }).click();
    await play.getByText('Meet me at the lantern at midnight.').waitFor();
    await play.getByRole('navigation', { name: 'Handouts' }).getByRole('button', { name: 'The Scene', exact: true }).click();
    const board = play.getByRole('application');
    await board.waitFor();
    await play.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Mark Up' }).click();
    await scribble(play, board);
    await play.getByRole('button', { name: 'Done' }).click();
    const brin = live<any>(t.vault().pcs).find((p) => p.name === 'Brin Ashvale');
    await waitFor(() => marks().some((m) => m.accountId === brin.ownerAccountId));
    assert.equal(marks().length, 2, 'the GM’s and his');
    await play.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Mark Up' }).click();
    await play.getByRole('button', { name: 'Clear My Marks' }).click();
    await play.getByRole('button', { name: 'Done' }).click();
    await waitFor(() => marks().length === 1);
    assert.equal(marks().length, 1);
    assert.notEqual(marks()[0].accountId, brin.ownerAccountId, 'the GM’s marks stay');
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
