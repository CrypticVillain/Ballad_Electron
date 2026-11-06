/**
 * The name generator: it starts on the world's genre, makes more on Space or
 * Generate, names places and taverns too, keeps the ones you star, makes a
 * name a character, and suggests names from the wand beside a name, in
 * Writing and in Tabletop (the GM's rail and a player's).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { go, launch, live, rail, role, section, type Launched } from './app';

describe('names', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'Writing');
    await rail(t.win, 'Names');
  });
  after(() => t.close());

  const main = () => t.win.locator('main');
  /** The names showing, read from their Save buttons. */
  const names = async () => (await main().getByRole('region', { name: 'Names' }).getByRole('button', { name: /^Save / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))).map((l) => l.replace(/^Save /, ''));
  /** The genre's heading, as written (it shows in capitals). */
  const heading = async () => (await main().getByRole('heading', { level: 1 }).textContent())?.trim();

  test('it starts on the genre that fits the world', async () => {
    assert.equal(await heading(), 'Low Fantasy & Medieval');
    assert.ok((await names()).length >= 8);
  });

  test('Generate and Space make new ones', async () => {
    const first = await names();
    await main().getByRole('button', { name: 'Generate' }).click();
    const second = await names();
    assert.notDeepEqual(second, first);
    await main().getByRole('heading', { level: 1 }).click();
    await t.win.keyboard.press('Space');
    assert.notDeepEqual(await names(), second);
  });

  test('places, taverns and groups', async () => {
    const people = await names();
    for (const kind of ['Places', 'Taverns & Shops', 'Groups']) {
      await main().getByRole('radiogroup', { name: 'What to name' }).getByRole('radio', { name: kind }).click();
      const these = await names();
      assert.ok(these.length >= 8, kind);
      assert.notDeepEqual(these, people, kind);
    }
    await main().getByRole('radiogroup', { name: 'What to name' }).getByRole('radio', { name: 'People' }).click();
  });

  test('another genre', async () => {
    await t.win.locator('aside').getByRole('button', { name: 'Norse' }).click();
    assert.equal(await heading(), 'Norse');
  });

  test('a starred name is kept', async () => {
    const [name] = await names();
    await main().getByRole('button', { name: `Save ${name}` }).click();
    const saved = await t.win.evaluate(() => JSON.parse(localStorage.getItem('ballad.preferences') ?? '{}').savedNames ?? []);
    assert.ok(saved.some((s: { name: string }) => s.name === name), JSON.stringify(saved));
  });

  test('Make A Character opens it with that name', async () => {
    const [name] = await names();
    await main().getByRole('button', { name: `Make A Character: ${name}` }).click();
    await t.win.waitForSelector('main input[aria-label="Name"]');
    assert.equal(await main().getByRole('textbox', { name: 'Name', exact: true }).inputValue(), name);
    await t.saved();
    assert.ok(live<any>(t.vault().entries).some((e) => e.name === name && e.kind === 'character'));
  });

  test('the wand beside a name suggests one', async () => {
    await main().getByRole('button', { name: 'Suggest a name' }).click();
    const option = t.win.getByRole('option').first();
    const picked = (await option.innerText()).split('\n')[0]!.trim();
    await option.click();
    assert.equal(await main().getByRole('textbox', { name: 'Name', exact: true }).inputValue(), picked);
  });

  test('Tabletop: on the GM’s rail', async () => {
    await section(t.win, 'Tabletop');
    await role(t.win, 'gm');
    await rail(t.win, 'Names');
    await t.win.locator('aside').getByRole('button', { name: 'Dwarvish' }).click();
    assert.equal(await heading(), 'Dwarvish');
    assert.ok((await names()).length >= 8);
  });

  test('Tabletop: on a player’s rail, and the character creator’s wand', async () => {
    await role(t.win, 'player');
    await t.win.locator('nav[aria-label="Modules"] a[aria-label="Names"]').waitFor();
    await go(t.win, '/create');
    await main().getByRole('button', { name: 'Suggest a name' }).click();
    const option = t.win.getByRole('option').first();
    const picked = (await option.innerText()).split('\n')[0]!.trim();
    await option.click();
    assert.equal(await t.win.getByRole('textbox', { name: 'Character name' }).inputValue(), picked);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
