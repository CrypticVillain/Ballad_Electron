/**
 * Handwriting's second wave: a storyboard frame drawn with the ink tools,
 * a portrait marked up (the picture never changes), marks on a campaign
 * map (hidden and shown), handwriting under an entry's About, and the GM's
 * scratchpad in Play's window. The sample worlds, with a portrait given to
 * Corin Hale.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import type { Locator, Page } from 'playwright-core';
import { launch, live, rail, role, scribbleOn, section, userDataDir, type Launched } from './app';

/** A picture: a PNG, `w` × `h`, one color. */
function png(w: number, h: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0xb0)]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}

describe('marking up', () => {
  let t: Launched;
  before(async () => {
    // The sample, with a portrait for Corin Hale.
    const first = await launch();
    const vault = first.vault();
    await first.close();
    const corin = Object.values<any>(vault.entries).find((e) => e.name === 'Corin Hale');
    corin.image = 'c0ffee00-0000-4000-8000-000000000001.png';
    t = await launch(vault);
    mkdirSync(path.join(userDataDir(), 'vault', 'maps'), { recursive: true });
    writeFileSync(path.join(userDataDir(), 'vault', 'maps', 'c0ffee00-0000-4000-8000-000000000001.png'), png(400, 300));
  });
  after(() => t.close());

  const marks = () => live<any>(t.vault().marks ?? {});
  const inks = () => live<any>(t.vault().inks ?? {});
  const squiggle = async (page: Page, on: Locator) => {
    const b = (await on.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (0.3 + i * 0.03), b.y + b.height * (0.5 + (i % 2 ? 0.08 : -0.08)));
    await page.mouse.up();
  };

  test('a storyboard frame, drawn with the ink tools, saved as the frame', async () => {
    await section(t.win, 'Filmmaking');
    await rail(t.win, 'Shots');
    await t.win.getByRole('tab', { name: 'Storyboard' }).click();
    await t.win.getByRole('button', { name: 'Draw', exact: true }).first().click();
    const frame = t.win.getByLabel('Frame', { exact: true });
    await squiggle(t.win, frame);
    await t.win.getByRole('button', { name: 'Save Frame' }).click();
    await t.saved();
    const shot = live<any>(t.vault().shots).find((s) => s.ink?.length);
    assert.ok(shot?.frame, 'the frame, a picture');
    assert.equal(shot.base ?? null, null, 'drawn on a blank frame');
  });

  test('a portrait marked up: the picture stays as it is', async () => {
    await section(t.win, 'Writing');
    await rail(t.win, 'Characters');
    await t.win.locator('aside').first().getByRole('link', { name: /^Corin Hale/ }).click();
    await t.win.getByRole('button', { name: 'Mark up the picture of Corin Hale' }).click();
    const dialog = t.win.getByRole('dialog', { name: /Mark Up/ });
    const surface = dialog.getByLabel('Marking up the picture');
    await surface.waitFor();
    await squiggle(t.win, surface);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await t.saved();
    const corin = live<any>(t.vault().entries).find((e) => e.name === 'Corin Hale');
    assert.equal(corin.image, 'c0ffee00-0000-4000-8000-000000000001.png');
    assert.ok(marks().some((m) => m.onId === `${corin.id}:c0ffee00-0000-4000-8000-000000000001.png` && m.strokes.length));
    await dialog.getByRole('button', { name: 'Hide Marks' }).click();
    await t.saved();
    assert.ok(marks().find((m) => m.onId === `${corin.id}:c0ffee00-0000-4000-8000-000000000001.png`).hidden);
    await t.win.keyboard.press('Escape');
  });

  test('handwriting under an entry’s About', async () => {
    await t.win.getByRole('button', { name: 'Add Handwriting' }).click();
    await scribbleOn(t.win, t.win.locator('main .ink-block').first());
    await t.saved();
    const corin = live<any>(t.vault().entries).find((e) => e.name === 'Corin Hale');
    assert.ok(inks().find((i) => i.entryId === corin.id)?.strokes.length);
  });

  test('a campaign map marked up; the marks hidden and shown again', async () => {
    await section(t.win, 'Tabletop');
    await role(t.win, 'gm');
    await rail(t.win, 'Maps');
    await t.win.locator('aside').first().getByRole('link').first().click();
    const map = live<any>(t.vault().maps).find((m) => !m.characterId);
    await t.win.getByRole('button', { name: 'Mark Up', exact: true }).click();
    await squiggle(t.win, t.win.getByLabel('Marking up the map'));
    await t.win.getByRole('button', { name: 'Done' }).click();
    await t.saved();
    const mine = () => marks().find((m) => m.onId === map.id);
    assert.ok(mine()?.strokes.length);
    await t.win.getByRole('button', { name: 'Hide Marks' }).click();
    await t.saved();
    assert.equal(mine().hidden, true);
    await t.win.getByRole('button', { name: 'Show Marks' }).click();
    await t.saved();
    assert.equal(mine().hidden, false);
    assert.equal(live<any>(t.vault().maps).find((m) => m.id === map.id).image, map.image, 'the map itself is as it was');
  });

  test('the GM’s scratchpad in Play’s window', async () => {
    await section(t.win, 'Play');
    let play: Page | undefined;
    for (let i = 0; i < 300 && !play; i++) {
      play = t.app.windows().find((w) => w !== t.win && !w.isClosed());
      if (!play) await t.win.waitForTimeout(100);
    }
    await play!.getByRole('button', { name: 'Scratchpad' }).click();
    await scribbleOn(play!, play!.locator('main .ink-block').first());
    await t.saved();
    const campaign = live<any>(t.vault().worlds).find((w) => w.name === 'The Sunken Lantern');
    assert.ok(inks().find((i) => i.scratchFor === campaign.id)?.strokes.length);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
