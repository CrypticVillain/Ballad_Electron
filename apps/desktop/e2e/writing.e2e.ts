/**
 * Writing's world-building modules: the Timeline, Arcs, the world's own
 * Calendar, Research notes and Relationships; then Copy World. The
 * Glass Archipelago sample.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, openWorldMenu, rail, scribbleOn, section, type Launched } from './app';

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
  /** Text for a RegExp, as it's written. */
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  test('Timeline: a new event', async () => {
    await rail(t.win, 'Timeline');
    const before = count('events');
    await main().getByRole('button', { name: 'New Event' }).click();
    await t.saved();
    assert.equal(count('events'), before + 1);
  });

  test('Timeline: an era, named and dated', async () => {
    await aside().getByRole('button', { name: 'New Era' }).click();
    const era = main().getByRole('region', { name: 'Era' });
    await era.getByRole('textbox', { name: 'Era name' }).fill('The Long Dark');
    await era.getByRole('spinbutton', { name: 'From' }).fill('300');
    await era.getByRole('spinbutton', { name: 'To' }).fill('350');
    await t.saved();
    assert.deepEqual(
      world().eras.map((e: any) => [e.name, e.from, e.to]),
      [['The Long Dark', 300, 350]],
    );
    await main().getByRole('button', { name: 'The Long Dark' }).waitFor();
  });

  test('Timeline → Story Days: a scene put on a day of the story', async () => {
    await main().getByRole('tab', { name: 'Story Days' }).click();
    const first = live<any>(t.vault().scenes).filter((s) => s.kind !== 'note').sort((a, b) => a.order - b.order)[0];
    await main().getByRole('region', { name: 'No day yet' }).getByRole('button').first().click();
    await main().getByRole('textbox', { name: 'Story day' }).fill('2');
    await t.saved();
    const dated = live<any>(t.vault().scenes).filter((s) => s.storyDay === 2);
    assert.equal(dated.length, 1);
    assert.ok(first);
    await main().getByText('Day 2', { exact: true }).waitFor();
    await main().getByRole('tab', { name: 'History' }).click();
  });

  test('the binder: a scene dragged before another', async () => {
    await rail(t.win, 'Manuscript');
    const binder = aside();
    const book = live<any>(t.vault().books).find((b) => b.worldId === world().id);
    const part = live<any>(t.vault().parts).filter((p) => p.bookId === book.id).sort((a, b) => a.order - b.order)[0];
    const scenes = () => live<any>(t.vault().scenes).filter((s) => s.partId === part.id).sort((a, b) => a.order - b.order);
    const [a, b] = scenes();
    await binder.getByRole('link', { name: new RegExp(`^2 · ${literal(b.title)}`) }).dragTo(binder.getByRole('link', { name: new RegExp(`^1 · ${literal(a.title)}`) }));
    await t.saved();
    assert.deepEqual(scenes().slice(0, 2).map((s) => s.id), [b.id, a.id]);
  });

  test('the Corkboard: a card’s note typed, the cards dragged, the Outline', async () => {
    await main().getByRole('link', { name: 'Corkboard' }).click();
    const card = main().getByRole('article').first();
    await card.waitFor();
    await card.getByRole('textbox', { name: /note$/ }).fill('Ines finds the cracked lens.');
    await t.saved();
    assert.ok(live<any>(t.vault().scenes).some((s) => s.note === 'Ines finds the cracked lens.'));
    const order = () => live<any>(t.vault().scenes).filter((s) => s.partId === live<any>(t.vault().scenes).find((x) => x.note === 'Ines finds the cracked lens.').partId).sort((a, b) => a.order - b.order).map((s) => s.id);
    const before = order();
    await main().locator('li[draggable="true"]').nth(1).dragTo(main().locator('li[draggable="true"]').first(), { sourcePosition: { x: 6, y: 6 }, targetPosition: { x: 6, y: 6 } });
    await t.saved();
    assert.deepEqual(order().slice(0, 2), [before[1], before[0]]);
    await main().getByRole('tab', { name: 'Outline' }).click();
    await main().getByRole('table').first().getByText('Ines finds the cracked lens.').waitFor();
    await main().getByRole('tab', { name: 'Cards' }).click();
  });

  test('the Trash: a deleted scene, restored', async () => {
    await main().getByRole('link', { name: 'Write' }).or(main().getByRole('button', { name: 'Write' })).first().click();
    const scene = live<any>(t.vault().scenes).filter((s) => s.kind !== 'note').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    await aside().getByRole('link', { name: new RegExp(literal(scene.title)) }).first().click({ button: 'right' });
    await t.win.getByRole('menuitem', { name: 'Delete Scene' }).click();
    const confirm = t.win.getByRole('alertdialog');
    await confirm.waitFor({ timeout: 3000 }).then(
      () => confirm.getByRole('button', { name: /^Delete/ }).click(),
      () => {},
    );
    await t.saved();
    assert.ok(t.vault().scenes[scene.id].deletedAt);
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: 'Trash…' }).click();
    const trash = t.win.getByRole('dialog', { name: 'Trash' });
    await trash.waitFor();
    await trash.getByRole('button', { name: new RegExp(`^Restore Scene · ${literal(scene.title)}`) }).click();
    await t.saved();
    assert.equal(t.vault().scenes[scene.id].deletedAt, null);
    await t.win.keyboard.press('Escape');
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

  test('Research: a note’s handwriting', async () => {
    const note = live<any>(t.vault().research)[0];
    await t.win.getByRole('button', { name: 'Add Handwriting' }).click();
    const sheet = t.win.locator('main .ink-block').first();
    await sheet.waitFor();
    await scribbleOn(t.win, sheet);
    await t.saved();
    const ink = live<any>(t.vault().inks).find((i) => i.researchId === note.id);
    assert.ok(ink?.strokes.length >= 1);
  });

  test('Relationships: someone’s links, and the family tree', async () => {
    await rail(t.win, 'Relationships');
    await main().getByRole('button', { name: 'Corin Hale' }).click();
    await main().getByRole('complementary').getByText('Ines Varga').first().waitFor();
    await main().getByRole('tab', { name: 'Family Tree' }).click();
    await main().getByRole('tab', { name: 'Family Tree', selected: true }).waitFor();
  });

  test('Copy World, For A Sequel: the world without the manuscript, and a new book', async () => {
    const source = world();
    const entries = (worldId: string) => live<any>(t.vault().entries).filter((e) => e.worldId === worldId).length;
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitem', { name: /Copy World/ }).click();
    const dialog = t.win.getByRole('dialog', { name: 'Copy World' });
    assert.equal(await dialog.getByRole('textbox', { name: 'Name' }).inputValue(), 'The Glass Archipelago (Copy)');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('The Glass Archipelago II');
    await dialog.getByRole('tab', { name: 'For A Sequel' }).click();
    await dialog.getByRole('checkbox', { name: 'Carry over Arcs' }).click();
    await dialog.getByRole('button', { name: 'Copy World' }).click();
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

  test('the world menu: a world dragged above another', async () => {
    const order = () => live<any>(t.vault().worlds).filter((w) => w.section === 'writing').sort((a, b) => a.order - b.order).map((w) => w.name);
    assert.deepEqual(order(), ['The Glass Archipelago', 'The Glass Archipelago II']);
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitemradio', { name: 'The Glass Archipelago II' }).dragTo(t.win.getByRole('menuitemradio', { name: 'The Glass Archipelago', exact: true }));
    await t.saved();
    assert.deepEqual(order(), ['The Glass Archipelago II', 'The Glass Archipelago']);
    await t.win.keyboard.press('Escape');
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
