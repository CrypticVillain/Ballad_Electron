import { useEffect } from 'react';
import { confirmDelete } from '@/components/shared/Confirm';
import { toast } from 'sonner';
import { create } from 'zustand';
import type { SelectOption } from '@/components/shared/SelectField';
import { updateRecord } from '@/lib/actions';
import { useLive } from '@/lib/hooks';
import type { PlayerCharacter } from '@/lib/model';
import { useVault } from '@/stores/vault';
import type { TableCampaign } from '../../../../shared/ipc';
import { bringCharacter } from './actions';

/**
 * The campaigns a character can be in: the open account's own (in its vault),
 * and the ones it's a player in that another account runs (joined from an
 * invite; they're in the GM's vault, so the table lists them: main/table.ts).
 * A character plays in one campaign at a time: putting them in another (or
 * none) takes them out of the one they were in, and out of its GM's party.
 */

export type Campaign = { id: string; name: string; /** Another account's campaign: its GM's name (null: your own). */ gm: string | null; ownerId: string | null };

const useJoined = create<{ list: TableCampaign[] }>(() => ({ list: [] }));
let listening = false;

/** Asks the table again for the campaigns another account runs that you're a player in (after joining one, say). */
export function refreshCampaigns() {
  void window.api.table?.campaigns().then((all) => useJoined.setState({ list: all.filter((c) => !c.owner) }));
}

function listen() {
  if (listening || !window.api.table) return;
  listening = true;
  refreshCampaigns();
  // Another window (or account) may have changed them: invites answered, a player taken out.
  window.addEventListener('focus', refreshCampaigns);
}

/** Your campaigns, then the ones you've joined (by name). */
export function useCampaigns(): Campaign[] {
  useEffect(listen, []);
  const own = useLive('worlds').filter((w) => w.section === 'tabletop');
  const joined = useJoined((s) => s.list);
  return [
    ...own.map((w) => ({ id: w.id, name: w.name || 'Untitled Campaign', gm: null, ownerId: null })),
    ...joined.filter((c) => !own.some((w) => w.id === c.worldId)).map((c) => ({ id: c.worldId, name: c.name, gm: c.ownerName, ownerId: c.ownerId })),
  ];
}

/** A campaign's name ('' for none, or one this account can't see). */
export const campaignName = (campaigns: Campaign[], id: string | null | undefined) => (id ? (campaigns.find((c) => c.id === id)?.name ?? '') : '');

/** A character's campaign dropdown: No Campaign, yours, the ones you've joined (and their GM). */
export function campaignOptions(campaigns: Campaign[]): SelectOption<string | null>[] {
  return [{ value: null, label: 'No Campaign' }, ...campaigns.map((c) => ({ value: c.id as string | null, label: c.gm ? `${c.name} (GM: ${c.gm})` : c.name }))];
}

/** Another account's campaign (it isn't in this vault). */
const othersCampaign = (id: string | null | undefined): id is string => Boolean(id) && !useVault.getState().vault.worlds[id!];

/**
 * Puts one of your characters in a campaign (null: none), out of the one
 * they were in. Into another's campaign (you're a player there), they join
 * its party; out of one, they leave it (main/table.ts: the GM's copy goes).
 */
export async function moveCharacter(pc: PlayerCharacter, to: string | null, campaigns: Campaign[]) {
  const from = pc.worldId;
  if (from === to) return;
  if (othersCampaign(from)) await window.api.table.leave(pc.id, from);
  if (othersCampaign(to)) bringCharacter(pc, to);
  else updateRecord('pcs', pc.id, { worldId: to });
  if (!othersCampaign(from)) return;
  const name = pc.name || 'Your character';
  const left = campaignName(campaigns, from) || 'the campaign';
  toast(`${name} Left ${left}`, {
    description: to ? `They’re in ${campaignName(campaigns, to) || 'the other campaign'} now: a character plays in one campaign at a time.` : 'Their sheet is still yours; the GM’s party doesn’t have them now.',
    action: { label: 'Undo', onClick: () => void moveCharacter({ ...pc, worldId: to }, from, campaigns) },
  });
}

/**
 * You leave a campaign another account runs (you're a player in it): out of
 * its players, your characters there out of its party (they stay yours, in
 * no campaign). After asking. True if you left.
 */
export async function leaveCampaign(campaign: { ownerId: string; worldId: string; name: string }): Promise<boolean> {
  if (!(await confirmDelete(`Leave ${campaign.name}?`, 'You won’t be one of its players any more, and your characters leave its party (they stay yours). Its GM can invite you again.', 'Leave'))) return false;
  const left = await window.api.table.leaveCampaign(campaign.ownerId, campaign.worldId);
  for (const id of left) if (useVault.getState().vault.pcs[id]) updateRecord('pcs', id, { worldId: null });
  // Your own characters there that the party didn't have (yet): out of it too.
  for (const pc of Object.values(useVault.getState().vault.pcs)) if (pc && !pc.deletedAt && pc.worldId === campaign.worldId) updateRecord('pcs', pc.id, { worldId: null });
  refreshCampaigns();
  toast(`You Left ${campaign.name}`, { description: left.length ? 'Your characters there are yours, in no campaign now.' : undefined });
  return true;
}
