/**
 * The manuscript: typing in a scene saves it (after the editor's pause, and
 * when you leave it straight away), @ links an entry, / Handwriting makes a
 * sheet to write on (not counted as words), and the binder makes, renames
 * and sets the status of scenes and acts.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, scribbleOn, section, type Launched } from './app';

describe('the manuscript', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Writing');
    await rail(t.win, 'Manuscript');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const scene = (title: string) => live<any>(t.vault().scenes).find((s) => s.title === title);
  const open = async (title: RegExp) => {
    await aside().getByRole('link', { name: title }).click();
    await t.win.locator('main [contenteditable="true"]').first().waitFor();
  };
  /** Puts the caret at the end of the scene's text. */
  const toEnd = async () => {
    const last = t.win.locator('main [contenteditable="true"] p').last();
    const box = (await last.boundingBox())!;
    await last.click({ position: { x: box.width - 2, y: box.height - 4 } });
    await t.win.keyboard.press('End');
  };

  test('typing in a scene saves it, words and all', async () => {
    await open(/^1 · Low Tide/);
    const before = scene('Low Tide').words;
    await toEnd();
    await t.win.keyboard.type(' The tide came back for the lamps.');
    await t.saved();
    const low = scene('Low Tide');
    assert.match(low.text, /The tide came back for the lamps\./);
    assert.equal(low.words, before + 7);
  });

  test('what you type just before leaving a scene is saved too', async () => {
    await toEnd();
    await t.win.keyboard.type(' Nobody counted them.');
    await aside().getByRole('link', { name: /^2 · The Glassworks Gate/ }).click();
    await t.saved();
    assert.match(scene('Low Tide').text, /Nobody counted them\.$/);
  });

  test('@ links a character', async () => {
    await toEnd();
    await t.win.keyboard.type(' @Corin');
    await t.win.getByRole('option', { name: /Corin Hale/ }).first().waitFor();
    await t.win.keyboard.press('Enter');
    await t.saved();
    const gate = scene('The Glassworks Gate');
    const corin = live<any>(t.vault().entries).find((e) => e.name === 'Corin Hale');
    assert.ok(gate.links.includes(corin.id));
    await t.win.locator('main [contenteditable="true"] a', { hasText: 'Corin Hale' }).last().waitFor();
  });

  test('/ Handwriting: a sheet to write on, kept with the scene and not counted as words', async () => {
    const words = scene('The Glassworks Gate').words;
    await toEnd();
    await t.win.keyboard.press('Enter');
    await t.win.keyboard.type('/handwriting');
    await t.win.getByRole('option', { name: /^Handwriting/ }).click();
    const sheet = t.win.locator('main .ink-block').first();
    await sheet.waitFor();
    await scribbleOn(t.win, sheet);
    await t.saved();
    const gate = scene('The Glassworks Gate');
    const ink = live<any>(t.vault().inks).find((i) => i.pageId === gate.id);
    assert.ok(ink?.strokes.length >= 1, 'the ink');
    assert.ok(JSON.stringify(gate.content).includes(ink.id), 'the block keeps its ink');
    assert.equal(gate.words, words);
  });

  test('the scene’s title and status', async () => {
    await t.win.getByRole('textbox', { name: 'Scene title' }).fill('The Gate At Ossery');
    await t.win.getByRole('radiogroup', { name: 'Status' }).getByRole('radio', { name: 'Done' }).click();
    await t.saved();
    const gate = scene('The Gate At Ossery');
    assert.ok(gate);
    assert.equal(gate.status, 'done');
    await aside().getByRole('link', { name: /The Gate At Ossery/ }).waitFor();
  });

  test('New Scene adds one to that act', async () => {
    const third = live<any>(t.vault().parts).find((p) => p.title === 'The Second Firing');
    const count = () => live<any>(t.vault().scenes).filter((s) => s.partId === third.id).length;
    const before = count();
    await aside().getByRole('button', { name: 'New Scene', exact: true }).last().click();
    await t.saved();
    assert.equal(count(), before + 1);
  });

  test('New Act', async () => {
    const before = live<any>(t.vault().parts).length;
    await aside().getByRole('button', { name: 'New Act' }).click();
    await t.saved();
    assert.equal(live<any>(t.vault().parts).length, before + 1);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
