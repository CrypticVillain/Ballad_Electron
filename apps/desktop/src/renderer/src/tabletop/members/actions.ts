import { tabletopDefaults } from '@/lib/sections';
import { live, now, type PlayerCharacter, type World } from '@/lib/model';
import { useAccounts } from '@/stores/accounts';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

/**
 * A campaign's players: the GM invites them (by email; online, an email goes
 * out), a player answers from Play's Home and brings a character of their
 * own, and the GM can take a player out again. A player's character lives in
 * their own vault; the GM's party has the same sheet, kept the same by the
 * table (main/table.ts). Play gives each player their sheet's tokens to move.
 */

const store = () => useVault.getState();
const cleanEmail = (email: string) => email.trim().toLowerCase();

const patchTabletop = (world: World, tabletop: Partial<NonNullable<World['tabletop']>>) => store().patch('worlds', world.id, { tabletop: { ...tabletopDefaults(), ...world.tabletop, ...tabletop } });

/** Sets the accounts in a campaign (the owner, its GM, isn't one of them). */
export function setMembers(world: World, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  patchTabletop(world, { members: unique.map((accountId) => ({ accountId })) });
}

/** Invites someone to a campaign by their email (again: the invite's sent again). False if it isn't an email. */
export function invitePlayer(world: World, email: string): boolean {
  const clean = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
  const others = (world.tabletop?.invites ?? []).filter((i) => cleanEmail(i.email) !== clean);
  patchTabletop(world, { invites: [...others, { email: clean, sentAt: now() }] });
  return true;
}

/** Takes an invite back, before it's answered. */
export function cancelInvite(world: World, email: string) {
  patchTabletop(world, { invites: (world.tabletop?.invites ?? []).filter((i) => cleanEmail(i.email) !== cleanEmail(email)) });
}

/** Takes a player out of the campaign: their characters leave the party (their own sheets stay theirs). */
export function removePlayer(world: World, accountId: string) {
  setMembers(world, (world.tabletop?.members ?? []).map((m) => m.accountId).filter((id) => id !== accountId));
  for (const pc of live(store().vault.pcs).filter((p) => p.worldId === world.id && p.ownerAccountId === accountId)) store().remove('pcs', pc.id);
}

/** Sets which account plays a sheet (undefined: no one, the GM keeps it). */
export function setSheetOwner(pcId: string, accountId: string | undefined) {
  store().patch('pcs', pcId, { ownerAccountId: accountId });
  void syncPlayers();
}

/**
 * A player's character into a campaign they're in (or, null, out of it): the
 * table puts it in the GM's party (main/table.ts mirrors it there).
 */
export function bringCharacter(pc: PlayerCharacter, worldId: string | null) {
  store().patch('pcs', pc.id, { worldId, ownerAccountId: useAccounts.getState().activeId });
}

/**
 * The sheets played across accounts, kept the same: this account's own
 * characters in another's campaign, and its party's sheets that other
 * accounts play (main/table.ts mirrors each into the other's vault, the newer
 * winning). And each account playing a sheet here is labelled with its
 * characters, which the account menu shows under its name ("Sam · Plays Brin
 * Ashvale"). On opening the app, and as sheets change hands.
 */
export async function syncPlayers(): Promise<void> {
  const { vault } = store();
  const { accounts, activeId } = useAccounts.getState();
  const played = live(vault.pcs).filter((pc) => pc.ownerAccountId && pc.worldId);
  await window.api.table?.syncSheets(played.map((pc) => ({ collection: 'pcs', id: pc.id, record: pc })));
  const worlds = new Set(live(vault.worlds).map((w) => w.id));
  const theirs = played.filter((pc) => pc.ownerAccountId !== activeId && worlds.has(pc.worldId!));
  for (const account of accounts) {
    const plays = [...new Set(theirs.filter((pc) => pc.ownerAccountId === account.id).map((pc) => pc.name.trim() || 'Unnamed'))].sort();
    if (!plays.length || JSON.stringify(account.plays ?? []) === JSON.stringify(plays)) continue;
    useAccounts.setState(await window.api.accounts.update(account.id, { name: account.name, email: account.email, plays }));
  }
}

/** A test account's email for a player's name: the same name finds the same account again. */
export const testEmail = (name: string) => `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'player'}@players.ballad.test`;

/** A local account for a test player (made once: the same name finds it again), which opens as a player, in Play. Its id. */
export async function testAccount(name: string): Promise<string> {
  const { registry, id } = await window.api.accounts.add({ name: name.trim(), email: testEmail(name) }, false);
  useAccounts.setState(registry);
  const prefs = usePreferences.getState();
  if (!prefs.sections[id]) prefs.setPreference('sections', { ...prefs.sections, [id]: 'play' });
  if (!prefs.tabletopRoles[id]) prefs.setPreference('tabletopRoles', { ...prefs.tabletopRoles, [id]: 'player' });
  return id;
}

/**
 * For trying the table as its players on this computer (online: they'd sign
 * up themselves). A local account for each player named on the party's
 * sheets, each in the campaign and given their sheet, which goes into their
 * account as their own character. How many sheets got a player.
 */
export async function makeTestPlayers(world: World): Promise<number> {
  const party = live(store().vault.pcs).filter((pc) => pc.worldId === world.id && pc.player.trim());
  const members = new Set((world.tabletop?.members ?? []).map((m) => m.accountId));
  for (const pc of party) {
    const id = await testAccount(pc.player);
    members.add(id);
    store().patch('pcs', pc.id, { ownerAccountId: id });
  }
  setMembers(store().vault.worlds[world.id] ?? world, [...members]);
  await syncPlayers();
  return party.length;
}
