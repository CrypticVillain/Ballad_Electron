/**
 * Writing's world-building modules: the Timeline, Arcs, the world's own
 * Calendar, Research notes and Relationships. The Glass Archipelago sample.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, section, type Launched } from './app';

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

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
