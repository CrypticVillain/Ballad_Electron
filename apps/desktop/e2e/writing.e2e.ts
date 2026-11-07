/**
 * Writing's world-building modules: the Timeline, Arcs, the world's own
 * Calendar, Research notes and Relationships; then Create A Sequel. The
 * Glass Archipelago sample.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, openWorldMenu, rail, section, type Launched } from './app';

describe('writing', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Writing');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const main = () => t.win.locator('main');
  const count = (collection: string) => live<any>(t.vault()[collection]).length;
  const world = () => live<any>(t.vault().worlds).find((w) => w.section === 'writing');

  test('Timeline: a new event', async () => {
    await rail(t.win, 'Timeline');
    const before = count('events');
    await main().getByRole('button', { name: 'New Event' }).click();
    await t.saved();
    assert.equal(count('events'), before + 1);
  });

  test('Arcs: a new arc', async () => {
    await rail(t.win, 'Arcs');
    const before = count('arcs');
    await main().getByRole('button', { name: 'New Arc' }).first().click();
    const dialog = t.win.getByRole('dialog', { name: 'New Arc' });
    await dialog.getByRole('textbox', { name: 'Arc name' }).fill('The Lantern’s secret');
    await dialog.getByRole('button', { name: /^Three Acts/ }).click();
    await dialog.getByRole('button', { name: 'Make Arc' }).click();
    await t.saved();
    assert.equal(count('arcs'), before + 1);
    assert.ok(live<any>(t.vault().arcs).some((a) => a.name === 'The Lantern’s secret'));
  });

  test('Calendar: the world gets its own', async () => {
    await rail(t.win, 'Calendar');
    assert.ok(!world().calendar);
    await main().getByRole('button', { name: 'Thirteen Moons' }).click();
    await t.saved();
    assert.ok(world().calendar, 'a calendar on the world');
  });

  test('Research: a new note', async () => {
    await rail(t.win, 'Research');
    const before = count('research');
    await main().getByRole('button', { name: 'New Note' }).click();
    await t.saved();
    assert.equal(count('research'), before + 1);
    await aside().getByText('Notes · 1').waitFor();
  });

  test('Relationships: someone’s links, and the family tree', async () => {
    await rail(t.win, 'Relationships');
    await main().getByRole('button', { name: 'Corin Hale' }).click();
    await main().getByRole('complementary').getByText('Ines Varga').first().waitFor();
    await main().getByRole('tab', { name: 'Family Tree' }).click();
    await main().getByRole('tab', { name: 'Family Tree', selected: true }).waitFor();
  });

  test('Create A Sequel: the world without the manuscript, and a new book', async () => {
    const source = world();
    const entries = (worldId: string) => live<any>(t.vault().entries).filter((e) => e.worldId === worldId).length;
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: /Create A Sequel/ }).click();
    const dialog = t.win.getByRole('dialog', { name: 'Create A Sequel' });
    assert.equal(await dialog.getByRole('textbox', { name: 'Name' }).inputValue(), 'The Glass Archipelago II');
    await dialog.getByRole('checkbox', { name: 'Carry over Arcs' }).click();
    await dialog.getByRole('button', { name: 'Create Sequel' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await t.saved();
    const sequel = live<any>(t.vault().worlds).find((w) => w.name === 'The Glass Archipelago II');
    assert.ok(sequel, 'the sequel');
    assert.equal(sequel.section, 'writing');
    assert.equal(entries(sequel.id), entries(source.id));
    assert.ok(sequel.calendar, 'with the calendar');
    const books = live<any>(t.vault().books).filter((b) => b.worldId === sequel.id);
    assert.deepEqual(
      books.map((b) => b.title),
      ['Book Two'],
    );
    const arcs = live<any>(t.vault().arcs).filter((a) => a.worldId === sequel.id);
    assert.equal(arcs.length, live<any>(t.vault().arcs).filter((a) => a.worldId === source.id).length);
    assert.ok(arcs.every((a) => a.bookId === books[0].id), 'the arcs follow the new book');
    await t.win.locator('nav[aria-label="Modules"] [aria-label$=": The Glass Archipelago II"]').waitFor();
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
