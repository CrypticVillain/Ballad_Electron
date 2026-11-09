/**
 * Play → Set Up A Demo Game, played as a real table would be: the campaign
 * it makes (a level 5 party, the creatures, two scenes, a handout each), its
 * players' accounts, each with their character as their own (in their
 * account; the party has it too), a fifth player invited. The GM opens Play
 * from Play's Home (it doesn't open by itself), rolls from the party's sheets
 * and a creature's, and starts the fight. Switched to a player's account
 * (the account menu says who each plays), the campaign in Play as that
 * player: a spell from their sheet (theirs and the party's both change), and
 * End Turn on their turn, and their sheet in Tabletop rolling at the table
 * (Play Mode). The invited player joins, bringing their character, whose
 * sheet then says the campaign; taking him out takes him from the party.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { Page } from 'playwright-core';
import { go, launch, live, openWorldMenu, relaunch, section, userDataDir, type Launched } from './app';

describe('Demo game', () => {
  let t: Launched;
  let play: Page;
  before(async () => {
    t = await launch();
    await section(t.win, 'Play');
  });
  after(() => t.close());

  const demo = () => live<any>(t.vault().worlds).find((w) => w.name === 'Demo: The Goblin Road');
  const of = (collection: string) => live<any>(t.vault()[collection] ?? {}).filter((r) => r.worldId === demo().id);
  const registry = () => JSON.parse(readFileSync(path.join(userDataDir(), 'accounts.json'), 'utf8')) as { activeId: string; accounts: any[] };
  const account = (name: string) => registry().accounts.find((a) => a.name === name)!;
  /** A player account's own vault, as last saved. */
  const vaultOf = (name: string) => {
    const file = path.join(userDataDir(), 'accounts', account(name).id, 'vault.json');
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  };
  const sheetIn = (name: string, character: string) => live<any>(vaultOf(name)?.pcs ?? {}).find((p) => p.name === character);
  /** Waits for something written by another window or account (a file this window doesn't save). */
  const until = async (what: string, ok: () => boolean) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (ok()) return;
      } catch {
        // half-written, or not there yet
      }
      await t.win.waitForTimeout(100);
    }
    assert.fail(`never: ${what}`);
  };
  /** The Play window: a new one, not `previous`. */
  const playWindow = async (previous?: Page): Promise<Page> => {
    for (let i = 0; i < 600; i++) {
      const found = t.app.windows().find((w) => w !== t.win && w !== previous && !w.isClosed());
      if (found) return found;
      await t.win.waitForTimeout(100);
    }
    throw new Error('No Play window opened');
  };
  /** Switches accounts from the account menu (the item says who they play). */
  const switchTo = async (item: RegExp) => {
    await t.win.getByRole('button', { name: /^Account:/ }).click();
    await t.win.getByRole('menuitemradio', { name: item }).click();
    await t.win.waitForTimeout(500);
    await t.win.waitForSelector('nav[aria-label="Modules"]', { timeout: 30_000 });
  };

  test('Set Up A Demo Game: the party, their players (each character theirs), an invite, two scenes; Play opens from Home', async () => {
    await t.win.getByRole('button', { name: 'Set Up A Demo Game' }).first().click();
    const open = t.win.getByRole('button', { name: 'Open Play: Demo: The Goblin Road' });
    await open.waitFor();
    await t.saved();
    assert.equal(t.app.windows().filter((w) => !w.isClosed()).length, 1, 'Play’s window doesn’t open by itself');
    const pcs = of('pcs');
    assert.deepEqual(pcs.map((p) => p.name).sort(), ['Garrick Stone', 'Hilde Ironbrew', 'Ilsa Marrow', 'Pip Thistlewood']);
    assert.ok(pcs.every((p) => p.level === 5 && p.ownerAccountId && p.traits.length && !p.mine));
    const players = registry().accounts.filter((a: any) => pcs.some((p) => p.ownerAccountId === a.id));
    assert.deepEqual(players.map((a: any) => a.name).sort(), ['Casey', 'Jamie', 'Morgan', 'Riley']);
    assert.deepEqual(Object.fromEntries(players.map((a: any) => [a.name, a.plays])), { Casey: ['Hilde Ironbrew'], Jamie: ['Pip Thistlewood'], Morgan: ['Ilsa Marrow'], Riley: ['Garrick Stone'] });
    // Each character is its player's: in their own account, one of theirs, the same sheet as the party's.
    for (const [player, character] of [['Riley', 'Garrick Stone'], ['Morgan', 'Ilsa Marrow'], ['Casey', 'Hilde Ironbrew'], ['Jamie', 'Pip Thistlewood']] as const) {
      const own = sheetIn(player, character);
      const party = pcs.find((p) => p.name === character);
      assert.ok(own?.mine && own.ownerAccountId === account(player).id && own.worldId === demo().id, `${character} is ${player}’s`);
      assert.equal(own.id, party.id);
    }
    assert.equal(demo().tabletop.members.length, 4);
    // Quinn made Bram in their own account, and has the GM's invite.
    assert.deepEqual(demo().tabletop.invites.map((i: any) => i.email), [account('Quinn').email]);
    const bram = sheetIn('Quinn', 'Bram Fennick');
    assert.ok(bram?.mine && bram.worldId === null);
    assert.ok(!live<any>(t.vault().pcs).some((p) => p.name === 'Bram Fennick'), 'Bram isn’t the GM’s');
    assert.deepEqual(of('monsters').map((m) => m.name).sort(), ['Bugbear', 'Goblin', 'Grukk, Goblin Chief', 'Hobgoblin', 'Wolf']);
    const scenes = of('playScenes').sort((a, b) => a.order - b.order);
    assert.deepEqual(scenes.map((s) => s.name), ['The Goblin Road', 'The Goblin Cave']);
    assert.equal(demo().tabletop.live.sceneId, scenes[0].id, 'the road is started');
    const tokens = of('tokens');
    assert.equal(tokens.filter((x) => x.sceneId === scenes[0].id).length, 13);
    assert.equal(tokens.filter((x) => x.sceneId === scenes[1].id).length, 10);
    assert.ok(scenes[1].vision.enabled && scenes[1].walls.length === 2);
    // Their music: the Library's free tracks, copied beside the vault.
    const track = (id: string) => live<any>(t.vault().music).find((m) => m.id === id);
    assert.deepEqual(scenes[0].music.tracks.map((x: any) => [track(x.trackId)?.library, x.start]), [['medieval-exploration', 'auto'], ['medieval-battle', 'manual']]);
    assert.deepEqual(scenes[1].music.tracks.map((x: any) => track(x.trackId)?.library), ['medieval-battle']);
    assert.ok(existsSync(path.join(userDataDir(), 'vault', 'music', track(scenes[0].music.tracks[0].trackId).file)), 'the file is beside the vault');
    assert.ok(track(scenes[0].music.tracks[0].trackId).duration > 60, 'its length read');
    assert.equal(of('handouts').length, 2);
    assert.equal(of('encounters').length, 2);
    // The GM's Players: the four, and Quinn invited.
    await t.win.getByRole('button', { name: 'Players: Demo: The Goblin Road' }).click();
    const dialog = t.win.getByRole('dialog');
    await dialog.getByText('Plays Ilsa Marrow').waitFor();
    await dialog.getByText(account('Quinn').email).waitFor();
    await t.win.keyboard.press('Escape');
    await open.click();
    play = await playWindow();
    play.setDefaultTimeout(15_000);
    await play.getByRole('application').waitFor();
    assert.equal(await play.getByText('This campaign isn’t there any more.').count(), 0);
  });

  test('in Play’s window: a wizard’s Fireball, the cleric’s potion (her player’s sheet too), a creature’s attack', async () => {
    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const sheet = play.getByRole('complementary', { name: 'Sheet' });
    const chat = play.getByRole('complementary', { name: 'Chat' });
    const whose = async (name: string) => {
      await sheet.getByRole('combobox', { name: 'Whose sheet' }).click();
      await play.getByRole('option', { name }).click();
    };
    await whose('Ilsa Marrow');
    await sheet.getByRole('tab', { name: 'spells' }).click();
    await sheet.getByRole('button', { name: 'Cast Fireball' }).click();
    const fireball = chat.locator('[data-card="spell"]').filter({ hasText: 'Fireball' });
    await fireball.getByText(/DC 15 Dexterity/).waitFor();
    await chat.getByText('Welcome to the demo table', { exact: false }).waitFor();
    await whose('Hilde Ironbrew');
    await sheet.getByRole('tab', { name: 'items' }).click();
    await sheet.getByRole('button', { name: 'Use Potion of Greater Healing' }).click();
    await chat.locator('[data-card="item"]').filter({ hasText: 'Potion of Greater Healing' }).waitFor();
    await whose('Bugbear (creature)');
    await sheet.getByRole('button', { name: 'Bugbear: Morningstar' }).click();
    await chat.locator('[data-card]').filter({ hasText: 'Morningstar' }).waitFor();
    await t.saved();
    const ilsa = of('pcs').find((p) => p.name === 'Ilsa Marrow');
    assert.equal(ilsa.slots[2][1], 1, 'a 3rd-level slot spent');
    const hilde = of('pcs').find((p) => p.name === 'Hilde Ironbrew');
    assert.ok(hilde.hp.current > 31, 'healed');
    assert.ok(!hilde.inventory.some((i: any) => i.name === 'Potion of Greater Healing'), 'the potion drunk');
    // Her player's own sheet is the same.
    await until('Casey’s Hilde healed', () => sheetIn('Casey', 'Hilde Ironbrew').hp.current === hilde.hp.current);
    await until('Morgan’s Ilsa’s slot spent', () => sheetIn('Morgan', 'Ilsa Marrow').slots[2][1] === 1);
    await sheet.getByRole('button', { name: 'Close the sheet' }).click();
  });

  test('the GM starts the fight, and steps it to Ilsa’s turn', async () => {
    await play.getByRole('button', { name: 'Start Combat' }).click();
    const order = play.getByRole('region', { name: 'Turn order' });
    for (let i = 0; i < 14 && !(await order.locator('li[aria-current="true"]').textContent())?.includes('Ilsa Marrow'); i++) await order.getByRole('button', { name: 'Next' }).click();
    await order.locator('li[aria-current="true"]').filter({ hasText: 'Ilsa Marrow' }).waitFor();
    await t.saved();
    // The GM's party sheet in Tabletop, beside Play: its change shows in Play's Sheet at once.
    await section(t.win, 'Tabletop');
    await openWorldMenu(t.win);
    await t.win.getByRole('menuitemradio', { name: 'Demo: The Goblin Road' }).click();
    const ilsa = of('pcs').find((p) => p.name === 'Ilsa Marrow');
    await go(t.win, `/party/${ilsa.id}`);
    await t.win.getByRole('spinbutton', { name: 'Amount' }).fill('4');
    await t.win.getByRole('button', { name: 'Damage', exact: true }).click();
    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const sheet = play.getByRole('complementary', { name: 'Sheet' });
    await sheet.getByRole('combobox', { name: 'Whose sheet' }).click();
    await play.getByRole('option', { name: 'Ilsa Marrow' }).click();
    await sheet.getByLabel('Hit points').filter({ hasText: `${ilsa.hp.current - 4}/` }).waitFor();
    await sheet.getByRole('button', { name: 'Close the sheet' }).click();
    await section(t.win, 'Play');
  });

  test('as Morgan: the account menu says who each plays; Ilsa’s sheet in Play (her own and the party’s), End Turn', async () => {
    // An account from before accounts said who they play (labelled when the app opens).
    const morgan = account('Morgan');
    await t.win.evaluate(({ id, email }) => (window as any).api.accounts.update(id, { name: 'Morgan', email, plays: [] }), morgan);
    t = await relaunch(t);
    await t.win.getByRole('button', { name: /^Account:/ }).click();
    await t.win.getByRole('menuitemradio', { name: /Riley.*Plays Garrick Stone/ }).waitFor();
    await t.win.keyboard.press('Escape');
    await switchTo(/Morgan.*Plays Ilsa Marrow/);
    assert.equal(registry().activeId, morgan.id);
    // A test player opens in Play: the campaign they're in, and who they play in it.
    const card = t.win.getByRole('listitem').filter({ hasText: 'Demo: The Goblin Road' });
    await card.getByText('You play Ilsa Marrow').waitFor();
    // The app menu's Play tile: its dropdown lists the games you're in, one opening Play's window on it straight away.
    await openWorldMenu(t.win);
    await t.win.getByRole('group', { name: 'Section' }).getByRole('menuitem', { name: 'Play', exact: true }).hover();
    await t.win.locator('[data-slot="dropdown-menu-sub-content"]').getByRole('menuitem', { name: 'Play Demo: The Goblin Road' }).click();
    play = await playWindow();
    play.setDefaultTimeout(15_000);
    await play.getByRole('application').waitFor();
    await play.getByText('Playing Ilsa Marrow').waitFor();

    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const sheet = play.getByRole('complementary', { name: 'Sheet' });
    await sheet.getByRole('tab', { name: 'spells' }).click();
    await sheet.getByRole('button', { name: 'Cast Magic Missile' }).click();
    await until('the party’s Ilsa spent a 1st-level slot', () => of('pcs').find((p) => p.name === 'Ilsa Marrow').slots[0][1] === 1);
    await t.saved();
    await until('Morgan’s own Ilsa too', () => sheetIn('Morgan', 'Ilsa Marrow').slots[0][1] === 1);
    await sheet.getByRole('button', { name: 'Close the sheet' }).click();

    const road = () => of('playScenes').find((s) => s.name === 'The Goblin Road');
    const turn = road().combat.turn;
    await play.getByRole('region', { name: 'Turn order' }).getByRole('button', { name: 'End Turn' }).click();
    await until('the turn moved on', () => road().combat.turn !== turn);
    assert.ok(live<any>(t.vault().tableLog).some((e) => e.kind === 'system' && e.text === 'Ilsa Marrow ends their turn.'));
    await play.getByRole('region', { name: 'Turn order' }).getByRole('button', { name: 'End Turn' }).waitFor({ state: 'detached' });
  });

  test('as Morgan, in Tabletop: Ilsa’s sheet says her campaign; in Play Mode it rolls at the table', async () => {
    await section(t.win, 'Tabletop');
    await t.win.getByRole('combobox', { name: "The campaign they're in" }).filter({ hasText: 'Demo: The Goblin Road' }).waitFor();
    await t.win.getByRole('button', { name: 'Play Mode' }).click();
    await t.win.getByRole('status', { name: 'Play Mode' }).getByText(/go to/).waitFor();
    const chat = play.getByRole('complementary', { name: 'Chat' });
    await t.win.getByRole('button', { name: 'Roll Perception' }).click();
    await chat.locator('[data-card="skill"]').filter({ hasText: 'Perception' }).waitFor();
    await t.win.getByRole('navigation', { name: 'Sheet' }).getByRole('link', { name: 'Spells' }).click();
    await t.win.getByRole('button', { name: 'Cast Magic Missile' }).click();
    await until('a slot spent from Tabletop, the party’s Ilsa too', () => of('pcs').find((p) => p.name === 'Ilsa Marrow').slots[0][1] === 2);
    assert.equal(await chat.locator('[data-card="spell"]').filter({ hasText: 'Magic Missile' }).count(), 2);
    // A spell linked in the chat: its words, no slot spent.
    await t.win.getByRole('button', { name: 'Send Magic Missile to the table' }).click();
    await chat.locator('[data-card="spell"]').filter({ hasText: 'Magic Missile' }).nth(2).waitFor();
    // The Dagger: Adv (on the plate) for the next roll, to hit alone; then damage alone, the whole attack, and the weapon linked.
    await t.win.getByRole('navigation', { name: 'Sheet' }).getByRole('link', { name: 'Actions' }).click();
    const rollWith = t.win.getByRole('radiogroup', { name: 'Roll with' });
    await rollWith.getByRole('radio', { name: 'Adv' }).click();
    await t.win.getByRole('button', { name: 'Roll Dagger to hit' }).click();
    await chat.locator('[data-card="attack"]').filter({ hasText: 'Advantage' }).waitFor();
    await rollWith.getByRole('radio', { name: 'Normal', checked: true }).waitFor();
    // Dmg right after Hit joins the Hit's card: one attack.
    await t.win.getByRole('button', { name: 'Roll Dagger damage' }).click();
    await chat.locator('[data-card="attack"]').filter({ hasText: 'Advantage' }).filter({ hasText: /Damage/ }).waitFor();
    await t.win.getByRole('button', { name: 'Attack with Dagger' }).click();
    await t.win.getByRole('button', { name: 'Send Dagger to the table' }).click();
    await chat.locator('[data-card="attack"]').filter({ hasText: 'Dagger' }).nth(2).waitFor();
    assert.equal(await chat.locator('[data-card="attack"]').filter({ hasText: 'Dagger' }).count(), 3, 'Hit and Dmg are one card');
    // Both windows open: hit points changed on either sheet show on the other at once.
    const current = t.win.getByRole('textbox', { name: 'Current hit points' });
    const hp = Number(await current.inputValue());
    await t.win.getByRole('spinbutton', { name: 'Amount' }).fill('3');
    await t.win.getByRole('button', { name: 'Damage', exact: true }).click();
    await play.getByRole('button', { name: 'Sheet', exact: true }).click();
    const playSheet = play.getByRole('complementary', { name: 'Sheet' });
    await playSheet.getByLabel('Hit points').filter({ hasText: `${hp - 3}/` }).waitFor();
    await playSheet.getByRole('textbox', { name: 'Hit points to lose or gain' }).fill('2');
    await playSheet.getByRole('button', { name: 'Heal' }).click();
    await t.win.waitForFunction((n) => (document.querySelector('[aria-label="Current hit points"]') as HTMLInputElement | null)?.value === String(n), hp - 1);
    await playSheet.getByRole('button', { name: 'Close the sheet' }).click();
    // The Library, in Play Mode with Play open: an entry sent to the table.
    await go(t.win, '/library/spells');
    await t.win.getByRole('button', { name: 'Send To The Table' }).click();
    await chat.locator('[data-card="spell"]').nth(3).waitFor();
    await go(t.win, '/');
    // Play closed: the sheet rolls here again, and says how to open Play.
    await play.close();
    await t.win.getByRole('status', { name: 'Play Mode' }).getByRole('button', { name: 'Open Play' }).waitFor();
    await t.win.getByRole('button', { name: 'Play Mode' }).click();
    await t.win.getByRole('status', { name: 'Play Mode' }).waitFor({ state: 'detached' });
  });

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
