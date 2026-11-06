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
  // 5 runs first: the steps below are written in its names.
  if (version < 5) renameTabletop(vault);
  if (version < 2) {
    // 2: sections. Every world so far is a Writing world.
    vault.worlds = Object.fromEntries(Object.entries(vault.worlds).map(([id, w]) => [id, { ...w, section: w.section ?? 'writing' }]));
  }
  if (version < 3) {
    // 3: GM / Player is yours, not the campaign's, and your characters needn't be in one. The character a campaign
    // said you play becomes one of yours, and its journal goes with it.
    for (const world of Object.values(vault.worlds)) {
      const old = world.tabletop as (typeof world.tabletop & { role?: string; myCharacterId?: string | null }) | undefined;
      if (!old) continue;
      const mine = old.myCharacterId && vault.pcs[old.myCharacterId];
      if (mine) vault.pcs[mine.id] = { ...mine, mine: true };
      for (const book of Object.values(vault.books)) {
        if (book.worldId === world.id && book.audience === 'player' && !book.characterId && mine) vault.books[book.id] = { ...book, characterId: mine.id };
      }
      const { role: _role, myCharacterId: _mine, ...tabletop } = old;
      vault.worlds[world.id] = { ...world, tabletop };
    }
  }
  if (version < 4) {
    // 4: sharing. Players used to see every entry the GM hadn't marked GM Only, and every campaign map, live. Now they
    // see what's shared with them: share those, as they are, with every character in the campaign (not its structure).
    const t = new Date().toISOString();
    for (const world of Object.values(vault.worlds)) {
      if (world.section !== 'tabletop' || world.deletedAt) continue;
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

type Loose = Record<string, unknown>;

/** A map's pins, with each one's old `dmOnly` as `gmOnly`. */
function renamePins(pins: unknown): unknown {
  if (!Array.isArray(pins)) return pins;
  return pins.map((pin: Loose) => {
    if (!pin || typeof pin !== 'object' || !('dmOnly' in pin)) return pin;
    const { dmOnly, ...rest } = pin;
    return { ...rest, gmOnly: dmOnly };
  });
}

/**
 * 5: the D&D section is Tabletop, and its Dungeon Master the GM. Worlds in
 * section 'dnd' move to 'tabletop' and their `dnd` details to `tabletop`; a
 * book's audience 'dm' is 'gm'; map pins' `dmOnly` is `gmOnly`, in the maps
 * and in what was shared of them (snapshots and players' copies).
 */
function renameTabletop(vault: Vault) {
  vault.worlds = Object.fromEntries(
    Object.entries(vault.worlds).map(([id, w]) => {
      const { dnd, ...rest } = w as typeof w & { dnd?: Vault['worlds'][string]['tabletop'] };
      const section = (w.section as string) === 'dnd' ? 'tabletop' : w.section;
      return [id, { ...rest, section, ...(dnd || rest.tabletop ? { tabletop: rest.tabletop ?? dnd } : {}) }];
    }),
  );
  vault.books = Object.fromEntries(Object.entries(vault.books).map(([id, b]) => [id, (b.audience as string) === 'dm' ? { ...b, audience: 'gm' as const } : b]));
  vault.maps = Object.fromEntries(Object.entries(vault.maps).map(([id, m]) => [id, { ...m, pins: renamePins(m.pins) as typeof m.pins }]));
  vault.shares = Object.fromEntries(
    Object.entries(vault.shares).map(([id, s]) => [id, s.collection === 'maps' && s.snapshot && 'pins' in s.snapshot ? { ...s, snapshot: { ...s.snapshot, pins: renamePins(s.snapshot.pins) } } : s]),
  );
  vault.copies = Object.fromEntries(
    Object.entries(vault.copies).map(([id, c]) => [id, c.edited && 'pins' in c.edited ? { ...c, edited: { ...c.edited, pins: renamePins(c.edited.pins) } } : c]),
  );
}
