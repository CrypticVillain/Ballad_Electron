import { COLLECTIONS, type BaseRecord, type Collection, type Vault } from './model';

/**
 * The Trash (pure): what's been deleted, as the deletes that happened. A
 * delete takes several records at once (an act and its scenes, a scene of
 * Play and its tokens), so records deleted within a moment of each other are
 * one deletion, named for the most important thing in it ("Act II and 4
 * more"). Restoring one brings back all of it, and what it sits in if that
 * was deleted too (a scene's act and book, an entry's world); deleting it
 * forever purges it, and for a world everything in it.
 */

export type TrashRef = { collection: Collection; id: string };
export type Deletion = {
  /** The first record's id: a key. */
  id: string;
  /** When it was deleted (the latest record's deletedAt). */
  at: string;
  /** What it's named for. */
  lead: TrashRef & { noun: string; name: string };
  /** The world it was in, if any (a deleted world: itself). */
  worldId: string | null;
  refs: TrashRef[];
  /** How many of the shown kinds besides the lead ("and 4 more"). */
  more: number;
};

type AnyRecord = BaseRecord & Record<string, unknown>;

/** The kinds the Trash names, most important first. Others (tokens, revisions…) come back with them but aren't listed. */
const SHOWN: { collection: Collection; noun: (r: AnyRecord, vault: Vault) => string; name: (r: AnyRecord) => string }[] = [
  { collection: 'worlds', noun: (r) => (r.section === 'film' ? 'Production' : r.section === 'tabletop' ? 'Campaign' : 'World'), name: (r) => str(r.name) },
  { collection: 'books', noun: () => 'Book', name: (r) => str(r.title) },
  { collection: 'parts', noun: (r, v) => v.books[str(r.bookId)]?.partNoun ?? 'Act', name: (r) => str(r.title) },
  { collection: 'playScenes', noun: () => 'Play Scene', name: (r) => str(r.name) },
  { collection: 'encounters', noun: () => 'Encounter', name: (r) => str(r.name) },
  { collection: 'pcs', noun: () => 'Character', name: (r) => str(r.name) },
  { collection: 'scenes', noun: (r) => (r.kind === 'note' ? 'Note' : 'Scene'), name: (r) => str(r.title) },
  { collection: 'entries', noun: (r) => ({ character: 'Character', place: 'Place', lore: r.document ? 'Document' : 'Lore', crew: 'Crew' })[str(r.kind)] ?? 'Entry', name: (r) => str(r.name) },
  { collection: 'maps', noun: () => 'Map', name: (r) => str(r.name) },
  { collection: 'writingMaps', noun: () => 'Map', name: (r) => str(r.name) },
  { collection: 'monsters', noun: () => 'Creature', name: (r) => str(r.name) },
  { collection: 'storylines', noun: () => 'Storyline', name: (r) => str(r.name) },
  { collection: 'events', noun: () => 'Event', name: (r) => str(r.title) },
  { collection: 'arcs', noun: () => 'Arc', name: (r) => str(r.name) },
  { collection: 'research', noun: () => 'Research Note', name: (r) => str(r.title) },
  { collection: 'relationships', noun: () => 'Relationship', name: (r) => str(r.label) },
  { collection: 'shots', noun: () => 'Shot', name: (r) => str(r.description) },
  { collection: 'shootDays', noun: () => 'Shoot Day', name: (r) => str(r.date) },
  { collection: 'budget', noun: () => 'Budget Line', name: (r) => str(r.item) },
  { collection: 'gear', noun: () => 'Gear', name: (r) => str(r.name) },
  { collection: 'releases', noun: () => 'Release', name: (r) => str(r.name) },
  { collection: 'vfx', noun: () => 'VFX Shot', name: (r) => str(r.code) || str(r.description) },
  { collection: 'cues', noun: () => 'Music Cue', name: (r) => str(r.title) },
  { collection: 'music', noun: () => 'Track', name: (r) => str(r.name) },
  { collection: 'handouts', noun: () => 'Handout', name: (r) => str(r.name) },
  { collection: 'spells', noun: () => 'Spell', name: (r) => str(r.name) },
  { collection: 'items', noun: () => 'Item', name: (r) => str(r.name) },
];
const RANK = new Map(SHOWN.map((k, i) => [k.collection, i]));
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Records deleted this close together (ms) were one delete. */
const TOGETHER = 1500;

const recordOf = (vault: Vault, ref: TrashRef) => (vault[ref.collection] as Record<string, AnyRecord>)[ref.id];

/** The world a record is in: its own worldId, or its book's (an act's, a scene's). */
export function worldOf(vault: Vault, ref: TrashRef): string | null {
  if (ref.collection === 'worlds') return ref.id;
  const r = recordOf(vault, ref);
  if (!r) return null;
  if (typeof r.worldId === 'string' && r.worldId) return r.worldId;
  const bookId = ref.collection === 'books' ? ref.id : typeof r.bookId === 'string' ? r.bookId : null;
  const book = bookId ? vault.books[bookId] : undefined;
  return book?.worldId || null;
}

/** Every deletion, newest first. */
export function deletions(vault: Vault): Deletion[] {
  const deleted: (TrashRef & { t: number; at: string })[] = [];
  for (const collection of COLLECTIONS) {
    if (collection === 'days') continue;
    for (const r of Object.values(vault[collection] as Record<string, AnyRecord>)) if (r.deletedAt) deleted.push({ collection, id: r.id, at: r.deletedAt, t: Date.parse(r.deletedAt) });
  }
  deleted.sort((a, b) => a.t - b.t);
  const groups: (typeof deleted)[] = [];
  for (const d of deleted) {
    const last = groups.at(-1);
    if (last && d.t - last.at(-1)!.t <= TOGETHER) last.push(d);
    else groups.push([d]);
  }
  const out: Deletion[] = [];
  for (const group of groups) {
    const shown = group.filter((d) => RANK.has(d.collection)).sort((a, b) => RANK.get(a.collection)! - RANK.get(b.collection)!);
    const lead = shown[0];
    if (!lead) continue;
    const kind = SHOWN[RANK.get(lead.collection)!]!;
    const record = recordOf(vault, lead)!;
    out.push({
      id: group[0]!.id,
      at: group.at(-1)!.at,
      lead: { collection: lead.collection, id: lead.id, noun: kind.noun(record, vault), name: kind.name(record).trim() },
      worldId: worldOf(vault, lead),
      refs: group.map(({ collection, id }) => ({ collection, id })),
      more: shown.length - 1,
    });
  }
  return out.reverse();
}

/** What restoring a deletion brings back: all of it, and what it sits in, if that's deleted too. */
export function restorePlan(vault: Vault, deletion: Deletion): TrashRef[] {
  const out = new Map<string, TrashRef>();
  const add = (ref: TrashRef) => {
    if (recordOf(vault, ref)?.deletedAt) out.set(`${ref.collection}:${ref.id}`, ref);
  };
  for (const ref of deletion.refs) {
    add(ref);
    const r = recordOf(vault, ref);
    if (!r) continue;
    if (typeof r.partId === 'string' && r.partId) add({ collection: 'parts', id: r.partId });
    if (typeof r.bookId === 'string' && r.bookId) add({ collection: 'books', id: r.bookId });
    const world = worldOf(vault, ref);
    if (world) add({ collection: 'worlds', id: world });
  }
  return [...out.values()];
}

/** What deleting a deletion forever purges: all of it; for a world, everything in it too. */
export function purgePlan(vault: Vault, deletion: Deletion): TrashRef[] {
  const out = new Map(deletion.refs.map((r) => [`${r.collection}:${r.id}`, r]));
  const worlds = new Set(deletion.refs.filter((r) => r.collection === 'worlds').map((r) => r.id));
  if (worlds.size)
    for (const collection of COLLECTIONS)
      for (const r of Object.values(vault[collection] as Record<string, AnyRecord>)) {
        const ref = { collection, id: r.id };
        const world = worldOf(vault, ref);
        if (world && worlds.has(world)) out.set(`${collection}:${r.id}`, ref);
      }
  return [...out.values()];
}
