/**
 * Play (Tabletop, the GM): on the rail after Sessions; a blank scene; its grid
 * settings; the ruler (squares and feet, a waypoint); lining the grid up with
 * a box; deleting the scene.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Page } from 'playwright-core';
import { launch, live, rail, role, section, type Launched } from './app';

/** The board fits the scene in it at first: where a point of the scene is on screen (Board.tsx `fit`). */
async function onScreen(win: Page, scene: { width: number; height: number }) {
  const box = (await win.getByRole('application').boundingBox())!;
  const zoom = Math.min(box.width / scene.width, box.height / scene.height) * 0.92;
  const x0 = box.x + (box.width - scene.width * zoom) / 2;
  const y0 = box.y + (box.height - scene.height * zoom) / 2;
  return (x: number, y: number) => ({ x: x0 + x * zoom, y: y0 + y * zoom });
}

describe('Play', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Tabletop');
    await role(t.win, 'gm');
  });
  after(() => t.close());

  const scenes = () => live<any>(t.vault().playScenes ?? {});
  const scene = () => scenes()[0];
  const main = () => t.win.locator('main');
  const settings = () => t.win.getByRole('complementary', { name: 'Scene settings' });

  test('on the GM’s rail, after Sessions', async () => {
    const labels = await t.win.locator('nav[aria-label="Modules"] [aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    assert.equal(labels[labels.indexOf('Sessions') + 1], 'Play');
  });

  test('a blank scene, ten squares by eight', async () => {
    await rail(t.win, 'Play');
    await main().getByRole('button', { name: 'New Scene' }).click();
    const dialog = t.win.getByRole('dialog', { name: 'New Scene' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Breakwater Brawl');
    await dialog.getByRole('tab', { name: 'Blank' }).click();
    await dialog.getByRole('spinbutton', { name: 'Squares Across' }).fill('10');
    await dialog.getByRole('spinbutton', { name: 'Squares Down' }).fill('8');
    await dialog.getByRole('button', { name: 'Stone' }).click();
    await dialog.getByRole('button', { name: 'Create Scene' }).click();
    await t.win.getByRole('application', { name: /Breakwater Brawl/ }).waitFor();
    await t.saved();
    assert.equal(scenes().length, 1);
    assert.deepEqual([scene().name, scene().width, scene().height, scene().background, scene().image], ['Breakwater Brawl', 700, 560, '#8a8a84', '']);
  });

  test('the grid’s settings are saved', async () => {
    await settings().getByRole('spinbutton', { name: 'Size (px)' }).fill('50');
    await settings().getByRole('switch', { name: 'Show the grid' }).click();
    await t.saved();
    assert.equal(scene().grid.size, 50);
    assert.equal(scene().grid.show, false);
    await settings().getByRole('switch', { name: 'Show the grid' }).click();
  });

  test('the ruler: three squares diagonally is 15 ft, and a waypoint', async () => {
    const at = await onScreen(t.win, scene());
    await t.win.getByRole('application').click({ position: { x: 5, y: 5 } });
    await t.win.keyboard.press('r');
    const from = at(25, 25);
    const to = at(175, 175);
    await t.win.mouse.move(from.x, from.y);
    await t.win.mouse.down();
    await t.win.mouse.move(to.x, to.y, { steps: 6 });
    await t.win.mouse.up();
    const label = t.win.getByRole('status', { name: 'Distance' });
    assert.match(await label.innerText(), /15 ft\s+3 squares/);
    // Again, with a waypoint: across three, then down two.
    const corner = at(175, 25);
    const end = at(175, 125);
    await t.win.mouse.move(from.x, from.y);
    await t.win.mouse.down();
    await t.win.mouse.move(corner.x, corner.y, { steps: 4 });
    await t.win.keyboard.press(' ');
    await t.win.mouse.move(end.x, end.y, { steps: 4 });
    await t.win.mouse.up();
    assert.match(await label.innerText(), /25 ft\s+5 squares · 1 waypoint/);
    await t.win.keyboard.press('Escape');
    assert.equal(await label.count(), 0);
  });

  test('lining up the grid with a box over one square', async () => {
    const at = await onScreen(t.win, scene());
    await t.win.keyboard.press('g');
    const from = at(100, 100);
    const to = at(160, 160);
    await t.win.mouse.move(from.x, from.y);
    await t.win.mouse.down();
    await t.win.mouse.move(to.x, to.y, { steps: 6 });
    await t.win.mouse.up();
    await t.saved();
    const grid = scene().grid;
    assert.ok(Math.abs(grid.size - 60) < 1.5, `size ${grid.size}`);
    assert.ok(Math.abs(grid.offsetX - 40) < 1.5 && Math.abs(grid.offsetY - 40) < 1.5, `offset ${grid.offsetX}, ${grid.offsetY}`);
  });

  test('deleting the scene', async () => {
    await settings().getByRole('button', { name: 'Delete Scene' }).click();
    await t.win.getByRole('alertdialog', { name: 'Delete Breakwater Brawl?' }).getByRole('button', { name: 'Delete Scene' }).click();
    await main().getByText('No Scenes Yet').waitFor();
    await t.saved();
    assert.equal(scenes().length, 0);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
