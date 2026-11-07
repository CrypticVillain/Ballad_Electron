import { live, type Entry, type GameMap, type Monster, type Share, type ShareCollection, type SharedLink, type Vault } from './model';

/**
 * What sharing sends (lib/shared): a record's content as players get it.
 * Pure, so the vault's migration can use it too.
 */

/** An entry's content as players get it, with its relationships (by the other entry's id). */
function entrySnapshot(entry: Entry, v: Vault): Record<string, unknown> {
  const links: SharedLink[] = live(v.relationships)
    .filter((r) => r.fromId === entry.id || r.toId === entry.id)
    .map((r) => ({ otherId: r.fromId === entry.id ? r.toId : r.fromId, label: r.label, outgoing: r.fromId === entry.id }));
  // A lore document brings its handwriting (only documents: other entries' snapshots stay as they were, so they don't look changed).
  return { kind: entry.kind, name: entry.name, tagline: entry.tagline, specs: entry.specs, about: entry.about, image: entry.image ?? null, links, ...(entry.document ? { document: true, ink: entry.ink ?? [] } : {}) };
}

/** A map as players get it: without the GM-only pins. */
function mapSnapshot(map: GameMap): Record<string, unknown> {
  return { name: map.name, image: map.image, width: map.width, height: map.height, pins: map.pins.filter((p) => !p.gmOnly) };
}

/** A creature as players get it: its whole stat block. */
function monsterSnapshot(m: Monster): Record<string, unknown> {
  return { name: m.name, kind: m.kind, ac: m.ac, hp: m.hp, hpDice: m.hpDice, speed: m.speed, abilities: m.abilities, cr: m.cr, traits: m.traits, actions: m.actions, image: m.image ?? null };
}

/** What sharing this record now would send (null if it's gone). */
export function snapshotOf(collection: ShareCollection, id: string, v: Vault): Record<string, unknown> | null {
  if (collection === 'entries') {
    const entry = v.entries[id];
    return entry && !entry.deletedAt ? entrySnapshot(entry, v) : null;
  }
  if (collection === 'monsters') {
    const monster = v.monsters[id];
    return monster && !monster.deletedAt ? monsterSnapshot(monster) : null;
  }
  const map = v.maps[id];
  return map && !map.deletedAt ? mapSnapshot(map) : null;
}

/** Whether the GM has changed the thing since they last shared it ('gone': deleted). */
export function shareStatus(share: Share, v: Vault): 'current' | 'changed' | 'gone' {
  const now = snapshotOf(share.collection, share.sourceId, v);
  if (!now) return 'gone';
  return JSON.stringify(now) === JSON.stringify(share.snapshot) ? 'current' : 'changed';
}
