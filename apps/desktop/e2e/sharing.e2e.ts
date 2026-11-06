/**
 * Sharing in D&D: the DM shares an NPC with one player; that player sees it
 * read-only, unlocks it to keep a version of their own and toggles back to
 * the DM's; the DM's edits reach them only on Update Shared, marked with a dot
 * until they open it; Stop Sharing takes it away. The Sunken Lantern sample,
 * whose player is Kael Thorn.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, live, rail, role, section, type Launched } from './app';

describe('sharing between the DM and players', () => {
  let t: Launched;
  before(async () => {
    t = await launch();
    await section(t.win, 'D&D');
    await role(t.win, 'dm');
    await rail(t.win, 'NPCs');
  });
  after(() => t.close());

  const aside = () => t.win.locator('aside').first();
  const main = () => t.win.locator('main');
  const pc = (name: string) => live<any>(t.vault().pcs).find((p) => p.name === name);
  const abbot = () => live<any>(t.vault().entries).find((e) => e.name === 'The Drowned Abbot');
  const share = () => live<any>(t.vault().shares).find((s) => s.sourceId === abbot().id);
  const field = (name: string) => main().getByRole('textbox', { name, exact: true });
  const openAbbot = async () => {
    await aside().getByRole('link', { name: /The Drowned Abbot/ }).click();
    await t.win.waitForFunction(() => (document.querySelector('main input[aria-label="Name"]') as HTMLInputElement | null)?.value === 'The Drowned Abbot');
  };

  test('the DM shares an NPC with one player', async () => {
    await openAbbot();
    assert.equal(share(), undefined, 'not shared to start with');
    await main().getByRole('button', { name: /^Share/ }).first().click();
    const dialog = t.win.getByRole('dialog', { name: 'Share The Drowned Abbot' });
    await dialog.getByRole('button', { name: 'None' }).click();
    await dialog.getByRole('checkbox', { name: /Kael Thorn/ }).click();
    await dialog.getByRole('button', { name: /Share$/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    await t.saved();
    assert.deepEqual(share().recipients, [pc('Kael Thorn').id]);
    await aside().getByRole('link', { name: /^Shared The Drowned Abbot/ }).waitFor();
  });

  test('the player has it, read-only', async () => {
    await role(t.win, 'player');
    await rail(t.win, 'NPCs');
    await openAbbot();
    assert.equal(await field('Name').getAttribute('readonly'), '');
    await main().getByRole('button', { name: 'Unlock To Edit' }).waitFor();
  });

  test('unlocked, the player keeps their own version; the DM’s is untouched', async () => {
    const original = abbot().tagline;
    await main().getByRole('button', { name: 'Unlock To Edit' }).click();
    await field('Tagline').fill('Definitely lying about the tide');
    await t.saved();
    assert.equal(abbot().tagline, original);
    const copy = live<any>(t.vault().copies).find((c) => c.shareId === share().id && c.pcId === pc('Kael Thorn').id);
    assert.equal(copy.edited.tagline, 'Definitely lying about the tide');
  });

  test('Revert shows the DM’s again, and Back To Mine the player’s', async () => {
    const original = abbot().tagline;
    await main().getByRole('button', { name: /^Revert To DM/ }).click();
    assert.equal(await field('Tagline').inputValue(), original);
    await main().getByRole('button', { name: 'Back To Mine' }).click();
    assert.equal(await field('Tagline').inputValue(), 'Definitely lying about the tide');
    await main().getByRole('button', { name: /^Revert To DM/ }).click();
    await t.saved();
    // Leave it, so NPCs doesn't reopen it (and see the update) when the player comes back.
    await aside().getByRole('link', { name: /Harbormaster Quill/ }).click();
  });

  test('the DM’s edits reach the player only on Update Shared', async () => {
    await role(t.win, 'dm');
    await rail(t.win, 'NPCs');
    await openAbbot();
    await field('Tagline').fill('He kept the light, and the light kept him');
    await t.saved();
    assert.notEqual(share().snapshot.tagline, 'He kept the light, and the light kept him');
    await main().getByRole('button', { name: /Update Shared/ }).click();
    await t.saved();
    assert.equal(share().snapshot.tagline, 'He kept the light, and the light kept him');
    // NPCs reopens the last one opened, in either view; opening it would be reading the update.
    await aside().getByRole('link', { name: /Harbormaster Quill/ }).click();
  });

  test('the player sees a dot until they open it', async () => {
    await role(t.win, 'player');
    await rail(t.win, 'NPCs');
    const link = aside().getByRole('link', { name: /The Drowned Abbot/ });
    await link.getByRole('img', { name: 'Updated by the DM' }).waitFor();
    await openAbbot();
    assert.equal(await field('Tagline').inputValue(), 'He kept the light, and the light kept him');
    await aside().getByRole('link', { name: /Harbormaster Quill/ }).click();
    await t.saved();
    assert.equal(await link.getByRole('img', { name: 'Updated by the DM' }).count(), 0);
  });

  test('Stop Sharing takes it away from the player', async () => {
    await role(t.win, 'dm');
    await rail(t.win, 'NPCs');
    await aside().getByRole('link', { name: /The Drowned Abbot/ }).click({ button: 'right' });
    await t.win.getByRole('menuitem', { name: 'Stop Sharing' }).click();
    await t.saved();
    await role(t.win, 'player');
    await rail(t.win, 'NPCs');
    await aside().getByRole('link', { name: /Harbormaster Quill/ }).waitFor();
    assert.equal(await aside().getByRole('link', { name: /The Drowned Abbot/ }).count(), 0);
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
