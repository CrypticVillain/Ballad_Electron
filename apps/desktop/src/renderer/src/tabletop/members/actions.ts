import { tabletopDefaults } from '@/lib/sections';
import { live, type World } from '@/lib/model';
import { useAccounts } from '@/stores/accounts';
import { useVault } from '@/stores/vault';

/**
 * Tabletop → Players: who's in a campaign besides its owner (online: its
 * players, by their accounts), and which account plays each party sheet.
 * Play gives each player their sheet's tokens to move.
 */

const store = () => useVault.getState();

/** Sets the accounts in a campaign (the owner, its GM, isn't one of them). */
export function setMembers(world: World, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  store().patch('worlds', world.id, { tabletop: { ...tabletopDefaults(), ...world.tabletop, members: unique.map((accountId) => ({ accountId })) } });
}

/** Sets which account plays a sheet (undefined: no one, the GM keeps it). */
export function setSheetOwner(pcId: string, accountId: string | undefined) {
  store().patch('pcs', pcId, { ownerAccountId: accountId });
}

/** A test account's email for a player's name: the same name finds the same account again. */
export const testEmail = (name: string) => `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'player'}@players.ballad.test`;

/**
 * For trying the table as its players on this computer (online: they'd sign
 * up themselves). A local account for each player named on the party's
 * sheets (made once: the same name finds it again), each added to the
 * campaign and given their sheet. How many sheets got a player.
 */
export async function makeTestPlayers(world: World): Promise<number> {
  const party = live(store().vault.pcs).filter((pc) => pc.worldId === world.id && pc.player.trim());
  const members = new Set((world.tabletop?.members ?? []).map((m) => m.accountId));
  let given = 0;
  for (const pc of party) {
    const { registry, id } = await window.api.accounts.add({ name: pc.player.trim(), email: testEmail(pc.player) }, false);
    useAccounts.setState(registry);
    members.add(id);
    setSheetOwner(pc.id, id);
    given++;
  }
  setMembers(store().vault.worlds[world.id] ?? world, [...members]);
  return given;
}
