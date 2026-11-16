/**
 * Play, as an online table on this computer (main/table.ts plays the server):
 * the GM's music in the Library, an encounter's map prepared in Tabletop
 * (the fight placed, fog, music), Play in a window of its own (one at a
 * time), a scene made from the encounter, Start (live, its music on); Show
 * Scene, the sidebar's eyes, a handout, a document from Lore (made there
 * before, handwritten and put in a folder) written on, the GM's marks; then
 * test players made for the party, and one of them (Sam, who plays Brin) at
 * the table: the started scene, a player's tools, only his token to move,
 * the shown handout, his own marks to clear (not the GM's). The Sunken
 * Lantern sample. The GM's steps to the started scene are lantern.ts's;
 * the GM's tools on it (the ruler, initiative, chat, Sheet, walls…) are
 * play-board.e2e.ts's, run beside this file.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Page } from 'playwright-core';
import { focusedWindows, go, live, newWindow, relaunch, section, type Launched } from './app';
import { launchGm, lantern } from './lantern';

describe('Play', () => {
  let t: Launched;
  let play: Page;
  before(async () => {
    t = await launchGm();
  });
  after(() => t.close());

  const { campaign, encounter, scene, tokensOn, waitFor, ...gm } = lantern(() => t);
  const windows = () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
  /** The Play window (a new one: not `previous`), found among the app's windows. */
  const playWindow = (previous?: Page): Promise<Page> => newWindow(t, previous);
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

  test('Library → Music: tracks added from files', async () => {
    await gm.addMusic();
    assert.deepEqual(live<any>(t.vault().music).map((m) => m.name).sort(), ['Battle Drums', 'Tavern Theme']);
  });

  test('an encounter’s map: blank, the fight placed, fog revealed, music attached', async () => {
    await gm.mapEncounter();
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
    // Play opens on its Home (nothing opens by itself); a campaign's Open Play opens the window.
    await gm.playHome();
    assert.equal((await windows()).length, 1, 'no Play window yet');
    play = await gm.openPlay();
    assert.equal((await windows()).length, 2);
    // Neither window took the focus from what you're doing (--no-focus: e2e/app.ts).
    assert.deepEqual(await focusedWindows(t.app), []);
    assert.equal(await play.locator('nav[aria-label="Modules"]').count(), 0, 'no rail: Play alone');
    await t.win.getByText('You Run · 1').waitFor();
  });

  test('a scene from the encounter: its map, tokens, fog and music', async () => {
    await gm.newScene(play);
    const s = scene();
    assert.equal(s.encounterId, encounter().id);
    assert.equal(s.fog.enabled, true);
    assert.equal(tokensOn(s.id).length, encounter().combatants.length);
    assert.equal(s.music.tracks.length, 1);
  });

  test('Start: the scene is live for the table, its music on; Stop', async () => {
    await gm.start(play);
    assert.equal(campaign().tabletop.live.sceneId, scene().id);
    assert.ok(scene().nowPlaying?.trackId);
    await play.getByRole('button', { name: 'Stop The Scene' }).click();
    await play.getByLabel('Now playing').filter({ hasText: 'No music' }).waitFor();
    await play.getByRole('button', { name: /^Start (The|This) Scene/ }).click();
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
    await play.getByRole('button', { name: /^Start (The|This) Scene/ }).click();
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

  test('test players: an account for each, in the campaign, playing their sheet', async () => {
    await section(t.win, 'Tabletop');
    await t.win.locator('nav[aria-label="Modules"] button').first().click();
    await t.win.getByRole('menuitem', { name: 'Edit Campaign…' }).click();
    await t.win.getByRole('button', { name: 'Make Test Players For The Party' }).click();
    await t.win.getByRole('dialog').getByText('Plays Brin Ashvale').waitFor();
    await t.win.keyboard.press('Escape');
    await t.saved();
    const party = live<any>(t.vault().pcs).filter((p) => p.worldId === campaign().id);
    assert.ok(party.length >= 4 && party.every((p) => p.ownerAccountId));
    assert.equal(campaign().tabletop.members.length, party.length);
  });

  test('the GM whispers to a player, by the character’s name (/w Brin …)', async () => {
    await play.getByRole('button', { name: 'Chat', exact: true }).click();
    const chat = play.getByRole('complementary', { name: 'Chat' });
    await chat.getByRole('textbox', { name: 'Message' }).fill('/w Brin The ferryman is lying.');
    await chat.getByRole('button', { name: 'Send' }).click();
    await chat.getByText('The ferryman is lying.').waitFor();
    await t.saved();
    const brin = live<any>(t.vault().pcs).find((p) => p.name === 'Brin Ashvale');
    const whisper = live<any>(t.vault().tableLog).find((e) => e.text === 'The ferryman is lying.');
    assert.deepEqual(whisper.to, [brin.ownerAccountId]);
    await chat.getByRole('button', { name: 'Close the chat' }).click();
    // The main window back in Play's Home, as the tests after this one want it.
    await section(t.win, 'Play');
  });

  test('opening Play again: still one Play window (the first one closes)', async () => {
    const playIds = () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.getTitle() === 'Ballad · Play').map((w) => w.id));
    const [before] = await playIds();
    await t.win.getByRole('button', { name: /^Open Play: The Sunken Lantern/ }).click();
    let after: number[] = [];
    for (let i = 0; i < 50; i++) {
      after = await playIds();
      if (after.length === 1 && after[0] !== before) break;
      await t.win.waitForTimeout(100);
    }
    assert.equal(after.length, 1, 'one Play window');
    assert.notEqual(after[0], before, 'a new one, the first closed');
    // Opening Play again brings its window forward for you; in a test (--no-focus) it stays in the background.
    assert.deepEqual(await focusedWindows(t.app), []);
    assert.equal((await windows()).length, 2);
  });

  test('Play module → Scenes: the same scene set up here; the dropdown picks, and shows what’s picked', async () => {
    await go(t.win, '/scenes');
    await t.win.getByRole('application').waitFor();
    // Whose scenes: the campaign picked at the top; Table Settings at the sidebar's foot.
    await t.win.getByRole('combobox', { name: 'Campaign' }).filter({ hasText: 'The Sunken Lantern' }).waitFor();
    await t.win.getByRole('button', { name: 'Table Settings' }).click();
    await t.win.getByRole('dialog', { name: /Table Settings · The Sunken Lantern/ }).waitFor();
    await t.win.keyboard.press('Escape');
    await t.win.getByRole('dialog', { name: /Table Settings/ }).waitFor({ state: 'detached' });
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
    assert.deepEqual(await play.getByRole('toolbar', { name: 'Tools' }).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['Select', 'Ruler', 'Mark Up', 'Areas']);
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

  test('a player’s Sheet and Chat: his attack in the chat, a check only the GM sees, the GM’s whisper to him, his to the GM', async () => {
    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const sheet = play.getByRole('complementary', { name: 'Sheet' });
    await sheet.getByText('Brin Ashvale').first().waitFor();
    assert.equal(await sheet.getByRole('combobox', { name: 'Whose sheet' }).count(), 0, 'only his own');
    await sheet.getByRole('button', { name: 'Attack with Shortsword' }).click();
    const chat = play.getByRole('complementary', { name: 'Chat' });
    if (!(await chat.count())) await play.getByRole('button', { name: 'Chat', exact: true }).click();
    await chat.locator('[data-card="attack"]').filter({ hasText: 'Shortsword' }).waitFor();
    await chat.getByText('The ferryman is lying.').waitFor();
    await sheet.getByRole('checkbox', { name: 'To the GM only' }).click();
    await sheet.getByRole('tab', { name: 'checks' }).click();
    await sheet.getByRole('button', { name: 'Stealth check' }).click();
    await chat.locator('[data-card="skill"]').filter({ hasText: 'Stealth' }).waitFor();
    await chat.getByRole('combobox', { name: 'Send to' }).click();
    await play.getByRole('option', { name: /the GM/ }).click();
    await chat.getByRole('textbox', { name: 'Message' }).fill('I pocket the key.');
    await chat.getByRole('button', { name: 'Send' }).click();
    await chat.getByText('I pocket the key.').waitFor();
    await t.saved();
    const brin = live<any>(t.vault().pcs).find((p) => p.name === 'Brin Ashvale');
    const log = live<any>(t.vault().tableLog);
    const stealth = log.find((e) => e.kind === 'card' && e.card.title === 'Stealth');
    assert.deepEqual(stealth.to, [], 'the GM only');
    const toGm = log.find((e) => e.text === 'I pocket the key.');
    assert.equal(toGm.accountId, brin.ownerAccountId);
    assert.equal(toGm.to.length, 1, 'to the GM');
    assert.ok(log.some((e) => e.kind === 'card' && e.card.title === 'Shortsword' && !e.to));
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
