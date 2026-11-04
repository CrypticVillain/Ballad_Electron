/**
 * migrate.ts — brings a saved vault (any older version, or partial) up to
 * VAULT_VERSION. The vault store runs it on load and on replace; each step
 * only fills in what that version added, so running it twice is harmless.
 *
 * Missing collections are filled in for every version.
 */
import { emptyVault, live, newId, VAULT_VERSION, type Vault } from './model';
import { snapshotOf } from './snapshots';

export function migrate(raw: Partial<Vault>): Vault {
  const vault = { ...emptyVault(), ...raw };
  const version = vault.version ?? 1;
  if (version < 2) {
    // 2: sections. Every world so far is a Writing world.
    vault.worlds = Object.fromEntries(Object.entries(vault.worlds).map(([id, w]) => [id, { ...w, section: w.section ?? 'writing' }]));
  }
  if (version < 3) {
    // 3: DM / Player is yours, not the campaign's, and your characters needn't be in one. The character a campaign
    // said you play becomes one of yours, and its journal goes with it.
    for (const world of Object.values(vault.worlds)) {
      const old = world.dnd as (typeof world.dnd & { role?: string; myCharacterId?: string | null }) | undefined;
      if (!old) continue;
      const mine = old.myCharacterId && vault.pcs[old.myCharacterId];
      if (mine) vault.pcs[mine.id] = { ...mine, mine: true };
      for (const book of Object.values(vault.books)) {
        if (book.worldId === world.id && book.audience === 'player' && !book.characterId && mine) vault.books[book.id] = { ...book, characterId: mine.id };
      }
      const { role: _role, myCharacterId: _mine, ...dnd } = old;
      vault.worlds[world.id] = { ...world, dnd };
    }
  }
  if (version < 4) {
    // 4: sharing. Players used to see every entry the DM hadn't marked DM Only, and every campaign map, live. Now they
    // see what's shared with them: share those, as they are, with every character in the campaign (not its structure).
    const t = new Date().toISOString();
    for (const world of Object.values(vault.worlds)) {
      if (world.section !== 'dnd' || world.deletedAt) continue;
      const party = live(vault.pcs).filter((pc) => pc.worldId === world.id).map((pc) => pc.id);
      if (!party.length) continue;
      const things = [
        ...live(vault.entries).filter((e) => e.worldId === world.id && !e.secret).map((e) => ({ collection: 'entries' as const, id: e.id })),
        ...live(vault.maps).filter((m) => m.worldId === world.id && !m.characterId).map((m) => ({ collection: 'maps' as const, id: m.id })),
      ];
      for (const thing of things) {
        if (live(vault.shares).some((s) => s.sourceId === thing.id)) continue;
        const snapshot = snapshotOf(thing.collection, thing.id, vault);
        if (!snapshot) continue;
        const id = newId();
        vault.shares = { ...vault.shares, [id]: { id, createdAt: t, updatedAt: t, deletedAt: null, worldId: world.id, collection: thing.collection, sourceId: thing.id, snapshot, version: 1, recipients: party } };
      }
    }
  }
  vault.version = VAULT_VERSION;
  return vault;
}
