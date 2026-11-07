/**
 * Entries (characters, places, lore): making one, editing it, and organizing
 * the sidebar into spaces and folders by dragging, the Kept In picker and the
 * right-click menu. Writing's sample world, The Glass Archipelago.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { choose, launch, live, rail, section, type Launched } from './app';

type Layout = { spaces: { id: string; name: string; items: string[]; folders: { id: string; name: string; items: string[] }[] }[] };

describe('characters, places and lore', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Writing');
    await rail(t.win, 'Characters');
    await t.win.waitForSelector('aside >> text=Main Cast');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside');
  const world = () => live<any>(t.vault().worlds).find((w) => w.section === 'writing');
  /** The sidebar's spaces as saved (none until it's first changed: the sample's are made from its groups). */
  const layout = (kind = 'character'): Layout => world().layouts?.[kind] ?? { spaces: [] };
  const entry = (name: string) => live<any>(t.vault().entries).find((e) => e.name === name);
  /** Where an entry is kept: "Space" or "Space / Folder". */
  const whereIs = (id: string, kind = 'character') => {
    for (const s of layout(kind).spaces) {
      if (s.items.includes(id)) return s.name;
      for (const f of s.folders) if (f.items.includes(id)) return `${s.name} / ${f.name}`;
    }
    return null;
  };

  test('New Character makes one; its name and tagline are saved', async () => {
    await aside().getByRole('button', { name: 'New Character' }).click();
    const name = t.win.locator('main').getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Edda Morrow');
    await t.win.locator('main').getByRole('textbox', { name: 'Tagline' }).fill('Keeper of the last kiln');
    await t.saved();
    const edda = entry('Edda Morrow');
    assert.ok(edda, 'saved to the vault');
    assert.equal(edda.kind, 'character');
    assert.equal(edda.tagline, 'Keeper of the last kiln');
    await aside().getByRole('link', { name: /^Edda Morrow/ }).waitFor();
  });

  test('a new space is named as it’s made', async () => {
    await aside().getByRole('button', { name: 'New Space' }).click();
    await aside().getByRole('textbox', { name: 'Name' }).fill('Villains');
    await t.win.keyboard.press('Enter');
    await t.saved();
    assert.ok(layout().spaces.some((s) => s.name === 'Villains'));
  });

  test('a new folder in a space', async () => {
    await aside().getByRole('button', { name: 'New folder in Main Cast' }).click();
    await aside().getByRole('textbox', { name: 'Name' }).fill('Family');
    await t.win.keyboard.press('Enter');
    await t.saved();
    const main = layout().spaces.find((s) => s.name === 'Main Cast')!;
    assert.ok(main.folders.some((f) => f.name === 'Family'));
  });

  test('dragging a character onto a space moves it there', async () => {
    await aside().getByRole('link', { name: /^Edda Morrow/ }).dragTo(aside().getByRole('button', { name: /^Villains \d/ }));
    await t.saved();
    assert.equal(whereIs(entry('Edda Morrow').id), 'Villains');
  });

  test('Kept In picks its space, and Folder (below it) one of that space’s folders', async () => {
    await choose(t.win, 'Kept In', 'Main Cast');
    await t.saved();
    assert.equal(whereIs(entry('Edda Morrow').id), 'Main Cast');
    await choose(t.win, 'Folder', 'Family');
    await t.saved();
    assert.equal(whereIs(entry('Edda Morrow').id), 'Main Cast / Family');
  });

  test('the right-click menu moves it back to a space', async () => {
    await aside().getByRole('link', { name: /^Edda Morrow/ }).click({ button: 'right' });
    await t.win.getByRole('menuitem', { name: 'Move To' }).hover();
    await t.win.getByRole('menu', { name: 'Move To' }).getByRole('menuitem', { name: 'Villains' }).click();
    await t.saved();
    assert.equal(whereIs(entry('Edda Morrow').id), 'Villains');
  });

  test('deleting a character takes it off the sidebar', async () => {
    await aside().getByRole('link', { name: /^Edda Morrow/ }).click();
    await t.win.locator('main').getByRole('button', { name: 'Delete Character' }).click();
    await t.win.getByRole('alertdialog', { name: 'Delete Edda Morrow?' }).getByRole('button', { name: 'Delete Character' }).click();
    await t.saved();
    assert.equal(entry('Edda Morrow'), undefined);
    assert.equal(await aside().getByRole('link', { name: /^Edda Morrow/ }).count(), 0);
  });

  for (const [module, kind] of [
    ['Places', 'place'],
    ['Lore', 'lore'],
  ] as const) {
    test(`${module} has spaces and folders too`, async () => {
      await rail(t.win, module);
      await aside().getByRole('button', { name: 'New Space' }).waitFor();
      assert.ok((await aside().getByRole('button', { name: /^New folder in / }).count()) > 0, 'a space to put folders in');
      await aside().getByRole('button', { name: 'New Space' }).click();
      await aside().getByRole('textbox', { name: 'Name' }).fill(`More ${module}`);
      await t.win.keyboard.press('Enter');
      await t.saved();
      assert.ok(layout(kind).spaces.some((s) => s.name === `More ${module}`));
    });
  }

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
