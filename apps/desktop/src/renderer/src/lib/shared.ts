import { useMemo } from 'react';
import { useCharacter, useLive, useMaps, useRole, useWorld, useWorldRecords } from './hooks';
import { live, newId, now, type Entry, type GameMap, type Monster, type PlayerCharacter, type Share, type ShareCollection, type SharedCopy, type SharedLink, type SharedPlace, type Vault } from './model';
import { DEFAULT_ABILITIES } from './tabletop';
import { restore, trash } from './actions';
import { snapshotOf as snapshotIn, shareStatus as statusIn } from './snapshots';
import { useVault } from '@/stores/vault';

/**
 * Sharing (Tabletop): the GM gives players NPCs, places, lore, maps and Bestiary
 * creatures, chosen
 * person by person. What a player gets is a copy (a Share's snapshot): it
 * doesn't change when the GM edits their own until the GM presses Update
 * Shared. A player can't change the GM's copy, but can unlock it to keep a
 * version of their own (a SharedCopy) and switch between theirs and the GM's
 * original whenever they like. How players arrange what they're given is
 * theirs too (components/shell/layouts); the GM's spaces and folders only
 * come along if the GM shares the structure, and then only as a start.
 */

const vault = () => useVault.getState().vault;

/** What sharing this record now would send (null if it's gone). */
export const snapshotOf = (collection: ShareCollection, id: string, v: Vault = vault()) => snapshotIn(collection, id, v);

/** Whether the GM has changed the thing since they last shared it ('gone': deleted). */
export const shareStatus = (share: Share, v: Vault = vault()) => statusIn(share, v);

/** The share of a record, if it's shared (one the GM deleted isn't: it's ended). */
export const shareOf = (sourceId: string, v: Vault = vault()): Share | undefined => live(v.shares).find((s) => s.sourceId === sourceId && !s.ended);
const store = () => useVault.getState();

// ── The GM's side ──────────────────────────────────────────────────────

export type ShareRequest = {
  worldId: string;
  collection: ShareCollection;
  ids: string[];
  /** Who gets them. */
  recipients: string[];
  /**
   * 'add': these people get them too (several things at once);
   * 'exact': exactly these people have it (one thing: unticking takes it away).
   */
  mode: 'add' | 'exact';
  /** The space and folder of each, when the GM shares the structure. */
  places?: Record<string, SharedPlace>;
  /** Also sends the GM's latest edits to everyone who has them. */
  refresh?: boolean;
};

/** Shares things (or changes who has them): how many were shared. */
export function shareItems(request: ShareRequest): number {
  const t = now();
  let count = 0;
  for (const id of request.ids) {
    const snapshot = snapshotOf(request.collection, id);
    if (!snapshot) continue;
    const had = shareOf(id);
    const recipients = request.mode === 'exact' ? [...request.recipients] : [...new Set([...(had?.recipients ?? []), ...request.recipients])];
    const place = request.places?.[id] ?? had?.place;
    if (had) {
      const refresh = request.refresh && JSON.stringify(snapshot) !== JSON.stringify(had.snapshot);
      store().patch('shares', had.id, { recipients, place, ...(refresh ? { snapshot, version: had.version + 1 } : {}), updatedAt: t });
    } else {
      if (!recipients.length) continue;
      store().put('shares', { id: newId(), createdAt: t, updatedAt: t, deletedAt: null, worldId: request.worldId, collection: request.collection, sourceId: id, snapshot, version: 1, recipients, place });
    }
    count++;
  }
  return count;
}

/** Update Shared: sends the GM's latest version of each to the players who have it. How many changed. */
export function updateShares(shareIds: string[]): number {
  let count = 0;
  for (const id of shareIds) {
    const share = vault().shares[id];
    if (!share || share.deletedAt) continue;
    const snapshot = snapshotOf(share.collection, share.sourceId);
    if (!snapshot || JSON.stringify(snapshot) === JSON.stringify(share.snapshot)) continue;
    store().patch('shares', id, { snapshot, version: share.version + 1 });
    count++;
  }
  return count;
}

/** Changes who has a shared thing (nobody: it stops being shared). */
export function setRecipients(shareId: string, recipients: string[]) {
  if (!recipients.length) return unshare(shareId);
  store().patch('shares', shareId, { recipients });
}

/** Stops sharing: the players lose it (and their own versions of it). Undo-able: restore. */
export function unshare(shareId: string) {
  store().remove('shares', shareId);
}

export function reshare(shareId: string) {
  store().restore('shares', shareId);
}

/** The players who've made their own version of a shared thing (unlocked it and kept it). */
export function keepersOf(share: Share, v: Vault = vault()): string[] {
  return share.recipients.filter((pc) => {
    const copy = v.copies[copyId(share.id, pc)];
    return Boolean(copy && !copy.deletedAt && copy.edited);
  });
}

/**
 * The GM deleted something they'd shared: players lose the shared version.
 * Anyone who'd made their own version keeps it, as theirs alone: the share
 * stays for them only, ended (no GM's original to switch back to). Gives back
 * how to undo it, share and all.
 */
export function endShare(sourceId: string): () => void {
  const share = shareOf(sourceId);
  if (!share) return () => undefined;
  const keepers = keepersOf(share);
  if (!keepers.length) {
    unshare(share.id);
    return () => reshare(share.id);
  }
  const showing = new Map(keepers.map((pc) => [pc, vault().copies[copyId(share.id, pc)]!.showing]));
  store().patch('shares', share.id, { recipients: keepers, ended: now() });
  for (const pc of keepers) patchCopy(share.id, pc, { showing: 'edited' });
  return () => {
    store().patch('shares', share.id, { recipients: share.recipients, ended: undefined });
    for (const [pc, was] of showing) patchCopy(share.id, pc, { showing: was });
  };
}

/** Deletes a record the GM can share, ending its share (endShare). Undo brings both back. */
export function deleteShared(collection: ShareCollection, id: string): () => void {
  const reopen = endShare(id);
  trash(collection, id);
  return () => {
    restore(collection, id);
    reopen();
  };
}

/** A player deletes their own version of something the GM deleted: it's gone for them (the share too, once nobody has one). */
export function dropCopy(shareId: string, pcId: string): () => void {
  const share = vault().shares[shareId];
  if (!share) return () => undefined;
  const id = copyId(shareId, pcId);
  store().remove('copies', id);
  const left = share.recipients.filter((pc) => pc !== pcId);
  if (left.length) store().patch('shares', shareId, { recipients: left });
  else store().remove('shares', shareId);
  return () => {
    store().restore('copies', id);
    if (left.length) store().patch('shares', shareId, { recipients: share.recipients });
    else store().restore('shares', shareId);
  };
}

// ── The player's side ──────────────────────────────────────────────────

const copyId = (shareId: string, pcId: string) => `${shareId}:${pcId}`;

function patchCopy(shareId: string, pcId: string, changes: Partial<SharedCopy>) {
  const id = copyId(shareId, pcId);
  const had = vault().copies[id];
  const t = now();
  if (had) store().patch('copies', id, changes);
  else store().put('copies', { id, shareId, pcId, showing: 'original', createdAt: t, updatedAt: t, deletedAt: null, ...changes });
}

/** Unlock: the player's own version to edit (the GM's as it is now, if they hadn't one), shown. */
export function unlockShared(shareId: string, pcId: string) {
  const share = vault().shares[shareId];
  if (!share) return;
  const had = vault().copies[copyId(shareId, pcId)];
  patchCopy(shareId, pcId, { edited: had?.edited ?? structuredClone(share.snapshot), showing: 'edited', seen: share.version });
}

/** Switches between the GM's original and the player's own version. */
export function showShared(shareId: string, pcId: string, showing: 'original' | 'edited') {
  patchCopy(shareId, pcId, { showing, seen: vault().shares[shareId]?.version });
}

/** A change to the player's own version (only while it's unlocked and showing). */
export function editShared(shareId: string, pcId: string, changes: Record<string, unknown>) {
  const share = vault().shares[shareId];
  const had = vault().copies[copyId(shareId, pcId)];
  if (!share || had?.showing !== 'edited') return;
  patchCopy(shareId, pcId, { edited: { ...(had.edited ?? share.snapshot), ...changes } });
}

/** The player's pin on a shared thing (theirs: it's not part of the thing). */
export function pinShared(shareId: string, pcId: string, pinned: boolean) {
  patchCopy(shareId, pcId, { pinned });
}

/** The player has seen the GM's latest version. */
export function seeShared(shareId: string, pcId: string) {
  const share = vault().shares[shareId];
  const had = vault().copies[copyId(shareId, pcId)];
  if (share && (had?.seen ?? 1) < share.version) patchCopy(shareId, pcId, { seen: share.version });
}

/** A shared record as this player sees it: the GM's snapshot, or their own version (all that's left once the GM deleted it). */
function viewOf<T>(share: Share, copy: SharedCopy | undefined, base: T): T {
  const showing = (share.ended || copy?.showing === 'edited') && copy?.edited ? 'edited' : 'original';
  const content = showing === 'edited' ? copy!.edited! : share.snapshot;
  const { links, ...rest } = content as { links?: SharedLink[] };
  return {
    ...base,
    ...rest,
    image: (rest as { image?: string | null }).image ?? undefined,
    via: { shareId: share.id, showing, edited: Boolean(copy?.edited), updated: !share.ended && (copy?.seen ?? 1) < share.version, ended: Boolean(share.ended), links: links ?? (share.snapshot as { links?: SharedLink[] }).links },
  };
}

/** The shares the character you're playing has, in their campaign, and their copies of them. */
export function useReceived(collection: ShareCollection): { pc?: PlayerCharacter; shares: Share[]; copies: Map<string, SharedCopy> } {
  const pc = useCharacter();
  const shares = useLive('shares');
  const copies = useLive('copies');
  return useMemo(() => {
    // An ended share (the GM deleted the original) is only for those who kept their own version.
    const mine = pc ? shares.filter((s) => s.collection === collection && s.worldId === pc.worldId && s.recipients.includes(pc.id) && (!s.ended || copies.some((c) => c.shareId === s.id && c.pcId === pc.id && c.edited))) : [];
    return { pc, shares: mine, copies: new Map(copies.filter((c) => c.pcId === pc?.id).map((c) => [c.shareId, c])) };
  }, [pc, shares, copies, collection]);
}

/**
 * The open world's entries that you see: in a campaign's Player view, only
 * what's shared with the character you're playing (as shared, or their own
 * version); otherwise all of them.
 */
export function useWorldEntries(): Entry[] {
  const entries = useWorldRecords('entries');
  const player = useRole() === 'player';
  const { shares, copies } = useReceived('entries');
  return useMemo(() => {
    if (!player) return entries;
    return shares.map((share) => {
      const copy = copies.get(share.id);
      const base: Entry = { id: share.sourceId, worldId: share.worldId, createdAt: share.createdAt, updatedAt: share.updatedAt, deletedAt: null, kind: 'character', name: '', tagline: '', group: '', specs: [], about: '', pinned: Boolean(copy?.pinned) };
      return viewOf(share, copy, base);
    });
  }, [player, entries, shares, copies]);
}

/** One entry as you see it (useWorldEntries). */
export function useWorldEntry(id: string | null | undefined): Entry | undefined {
  const entries = useWorldEntries();
  return useMemo(() => (id ? entries.find((e) => e.id === id) : undefined), [entries, id]);
}

/** The campaign's maps shared with the character you're playing, as they see them. */
export function useSharedMaps(): GameMap[] {
  const { shares, copies } = useReceived('maps');
  const world = useWorld();
  return useMemo(
    () =>
      shares.map((share) => {
        const copy = copies.get(share.id);
        const base: GameMap = { id: share.sourceId, worldId: world?.id ?? share.worldId, characterId: null, createdAt: share.createdAt, updatedAt: share.updatedAt, deletedAt: null, name: '', image: '', width: 1, height: 1, pins: [], order: 0 };
        return viewOf(share, copy, base);
      }),
    [shares, copies, world?.id],
  );
}

/** The maps you see: the GM's (GM view), or a player's own and those shared with them, as they see them. */
export function useVisibleMaps(): GameMap[] {
  const maps = useMaps();
  const shared = useSharedMaps();
  const player = useRole() === 'player';
  return useMemo(() => (player ? [...maps.filter((m) => m.characterId), ...shared] : maps), [player, maps, shared]);
}

/** The campaign's creatures shared with the character you're playing, as they see them. */
export function useSharedMonsters(): Monster[] {
  const { shares, copies } = useReceived('monsters');
  return useMemo(
    () =>
      shares.map((share) => {
        const base: Monster = { id: share.sourceId, worldId: share.worldId, characterId: null, createdAt: share.createdAt, updatedAt: share.updatedAt, deletedAt: null, name: '', kind: '', ac: 10, hp: 1, hpDice: '', speed: '', abilities: { ...DEFAULT_ABILITIES }, cr: '0', traits: '', actions: [] };
        return viewOf(share, copies.get(share.id), base);
      }),
    [shares, copies],
  );
}

/**
 * The Bestiary you see: the campaign's (GM view), or a player's: their
 * character's own creatures and those the GM shared with them, as they see them.
 */
export function useVisibleMonsters(): Monster[] {
  const campaign = useWorldRecords('monsters');
  const all = useLive('monsters');
  const shared = useSharedMonsters();
  const pc = useCharacter();
  const player = useRole() === 'player';
  return useMemo(
    () => (player ? [...all.filter((m) => pc && m.characterId === pc.id), ...shared] : campaign.filter((m) => !m.characterId)),
    [player, all, pc, shared, campaign],
  );
}

/** The GM's shares in the open campaign, with whether each has changed since. */
export function useWorldShares(): (Share & { status: 'current' | 'changed' | 'gone' })[] {
  const shares = useWorldRecords('shares');
  const v = useVault((s) => s.vault);
  return useMemo(() => shares.filter((share) => !share.ended).map((share) => ({ ...share, status: shareStatus(share, v) })), [shares, v]);
}
