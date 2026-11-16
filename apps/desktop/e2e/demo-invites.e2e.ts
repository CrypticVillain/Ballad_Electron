/**
 * Play → Set Up A Demo Game: its fifth player, Quinn, invited. Quinn joins,
 * bringing Bram (his own character), whose sheet then says the campaign;
 * taking him out takes him from the party; Quinn leaves, the GM invites him
 * again, he declines, and the GM sees it. None of it needs what the GM and
 * the other players do at the table (demo.e2e.ts), so it runs here, beside it.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, rail, role, section, type Launched } from './app';
import { demoGame } from './demo-game';

describe('Demo game: invites', () => {
  let t: Launched;
  const game = demoGame(() => t);
  const { demo, of, account, sheetIn, until, switchTo } = game;
  before(async () => {
    t = await launch();
    await section(t.win, 'Play');
    await game.setUp();
  });
  after(() => t.close());

  test('as Quinn: the GM’s invite on Play’s Home; joining, bringing Bram', async () => {
    await switchTo(/Quinn/);
    await section(t.win, 'Play');
    const invite = t.win.getByRole('listitem', { name: 'Invite: Demo: The Goblin Road' });
    await invite.getByRole('combobox', { name: 'Bring a character' }).filter({ hasText: 'Bring Bram Fennick' }).waitFor();
    await invite.getByRole('button', { name: 'Join' }).click();
    await t.win.getByRole('listitem').filter({ hasText: 'Demo: The Goblin Road' }).getByText('You play Bram Fennick').waitFor();
    await t.saved();
    const quinn = account('Quinn');
    await until('Bram in the party', () => of('pcs').some((p) => p.name === 'Bram Fennick' && p.ownerAccountId === quinn.id && !p.mine));
    assert.ok(demo().tabletop.members.some((m: any) => m.accountId === quinn.id));
    assert.deepEqual(demo().tabletop.invites, []);
    assert.equal(sheetIn('Quinn', 'Bram Fennick').worldId, demo().id);
    // Scenes are a GM's: Quinn runs no campaign, so Scenes says how to get one (and where the GM's scenes are).
    await rail(t.win, 'Scenes');
    await t.win.getByText('Run A Campaign First').waitFor();
    await t.win.getByText(/In Demo: The Goblin Road, the GM’s scenes show in Play’s window/).waitFor();
    // Making one goes to Tabletop in GM view (Quinn was a player there), New Campaign open.
    const roleNow = () => t.win.evaluate((id) => JSON.parse(localStorage.getItem('ballad.preferences') ?? '{}').tabletopRoles?.[id], quinn.id);
    assert.equal(await roleNow(), 'player');
    await t.win.getByRole('button', { name: 'Make A Campaign In Tabletop' }).click();
    await t.win.getByRole('dialog', { name: 'New Campaign' }).waitFor();
    assert.equal(await roleNow(), 'gm');
    await t.win.locator('footer button', { hasText: 'GM View' }).waitFor();
    await t.win.keyboard.press('Escape');
    await t.win.getByRole('dialog', { name: 'New Campaign' }).waitFor({ state: 'detached' });
    await role(t.win, 'player');
    await section(t.win, 'Play');
  });

  test('as Quinn, in Tabletop: Bram’s sheet is in the campaign; taking him out takes him from the party (one campaign at a time)', async () => {
    await section(t.win, 'Tabletop');
    const chip = t.win.getByRole('combobox', { name: "The campaign they're in" });
    await chip.filter({ hasText: 'Demo: The Goblin Road' }).waitFor();
    await chip.click();
    await t.win.getByRole('option', { name: 'No Campaign' }).click();
    await t.win.getByText('Bram Fennick Left Demo: The Goblin Road').waitFor();
    await t.saved();
    await until('Bram gone from the party', () => !of('pcs').some((p) => p.name === 'Bram Fennick'));
    assert.equal(sheetIn('Quinn', 'Bram Fennick').worldId, null, 'still Quinn’s, in no campaign');
    // Back in: the party has him again.
    await chip.click();
    await t.win.getByRole('option', { name: /^Demo: The Goblin Road/ }).click();
    await until('Bram back in the party', () => of('pcs').some((p) => p.name === 'Bram Fennick' && p.ownerAccountId === account('Quinn').id));
    // A click on the Play tile goes to Play (its Home): no Play window opens.
    await section(t.win, 'Play');
    await t.win.getByRole('button', { name: 'Open Play: Demo: The Goblin Road' }).waitFor();
    await t.win.waitForTimeout(1000);
    assert.equal(t.app.windows().filter((w) => !w.isClosed()).length, 1, 'only the main window');
  });

  test('as Quinn: leaving the campaign (Bram with him); the GM invites Quinn again, Quinn declines, the GM sees it', async () => {
    const quinn = account('Quinn');
    await t.win.getByRole('button', { name: 'Leave Demo: The Goblin Road' }).click();
    await t.win.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await t.win.getByText('You Left Demo: The Goblin Road').waitFor();
    await t.saved();
    await until('Quinn out of the players', () => !demo().tabletop.members.some((m: any) => m.accountId === quinn.id));
    assert.ok(!of('pcs').some((p) => p.name === 'Bram Fennick'), 'Bram out of the party');
    await until('Quinn’s Bram in no campaign', () => sheetIn('Quinn', 'Bram Fennick').worldId === null);
    await t.win.getByRole('button', { name: 'Open Play: Demo: The Goblin Road' }).waitFor({ state: 'detached' });

    // The GM invites Quinn again: the badges say so (the avatar; Quinn in the account list).
    await t.win.getByRole('button', { name: /^Account:/ }).click();
    await t.win.getByRole('menuitemradio').first().click();
    await t.win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
    await section(t.win, 'Play');
    await t.win.getByRole('button', { name: 'Players: Demo: The Goblin Road' }).click();
    await t.win.getByRole('dialog').getByRole('button', { name: 'Invite Quinn' }).click();
    await t.win.keyboard.press('Escape');
    await t.win.getByRole('button', { name: /^Account:.*invites waiting/ }).click();
    await t.win.getByRole('menuitemradio', { name: /Quinn/ }).getByText('1 invite').waitFor();
    await t.win.getByRole('menuitemradio', { name: /Quinn/ }).click();
    await t.win.waitForTimeout(500);
    await t.win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
    // As Quinn: the app menu's mark says one invite waits; declined.
    await t.win.getByRole('button', { name: /· 1 invite$/ }).waitFor();
    await t.win.getByRole('listitem', { name: 'Invite: Demo: The Goblin Road' }).getByRole('button', { name: 'Decline' }).click();
    await t.win.getByRole('button', { name: /· 1 invite$/ }).waitFor({ state: 'detached' });
    await until('declined, for the GM', () => demo().tabletop.declined?.some((i: any) => i.email === quinn.email));

    // The GM's Players: Quinn declined, and can be invited again.
    await t.win.getByRole('button', { name: /^Account:/ }).click();
    await t.win.getByRole('menuitemradio').first().click();
    await t.win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
    await section(t.win, 'Play');
    await t.win.getByRole('button', { name: 'Players: Demo: The Goblin Road' }).click();
    const declined = t.win.getByRole('dialog').getByRole('list', { name: 'Declined' });
    await declined.getByText(quinn.email).waitFor();
    await declined.getByRole('button', { name: 'Invite Again' }).waitFor();
    await t.win.keyboard.press('Escape');
  });

  test('no errors', () => {
    assert.deepEqual(t.errors, []);
  });
});
