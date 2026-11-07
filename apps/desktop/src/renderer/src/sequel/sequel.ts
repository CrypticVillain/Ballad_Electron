import { byOrder, live, newId, now, type BaseRecord, type Book, type Collection, type RecordOf, type Scene, type Vault, type World } from '@/lib/model';
import { remapContent, remapLayout, type CopyItem } from '@/tabletop/copy/copy';

/**
 * Writing and Filmmaking → Create A Sequel (pure): a new world, or a new
 * production, made from one you have, with only what you pick. Tabletop's
 * Copy Campaign (tabletop/copy) for the other two sections: each section is
 * copied thing by thing, the sequel preset carrying the world (or the
 * production's people and kit) but not the story, which starts over.
 *
 *   Writing      the manuscript (scene by scene, its books and acts with them), characters,
 *                places, lore, the timeline, arcs, research, maps; the world's calendar
 *   Filmmaking   the script (scene by scene, with its shots), cast, crew, locations, gear,
 *                the budget, releases, the shooting schedule, the breakdown, VFX shots,
 *                music cues; the production's details, started over or as they are
 *
 * Copies are new records with new ids. Links are kept when both ends were
 * copied (a scene's point of view and mentions, relationships, a map's pins,
 * an arc's beats, a shoot day's scenes and its call sheet); a link to
 * something left out is dropped, and a mention of it in a scene becomes its
 * plain name. Pictures are shared, not duplicated.
 *
 * Not copied: revisions and comments, a script's lock and its revision
 * rounds (the copy starts unlocked), cuts, and the words-a-day log.
 */

export type SequelKind = 'writing' | 'film';

export const SEQUEL_SECTIONS = {
  writing: ['manuscript', 'characters', 'places', 'lore', 'timeline', 'arcs', 'research', 'maps'],
  film: ['script', 'cast', 'crew', 'locations', 'gear', 'budget', 'releases', 'schedule', 'breakdown', 'vfx', 'cues'],
} as const;
export type WritingSection = (typeof SEQUEL_SECTIONS.writing)[number];
export type FilmSection = (typeof SEQUEL_SECTIONS.film)[number];
export type SequelSection = WritingSection | FilmSection;

/** What can be carried into a sequel, section by section (only the world's own section's). */
export type SequelContents = { kind: SequelKind; sections: readonly SequelSection[]; items: Partial<Record<SequelSection, CopyItem[]>> };

export type SequelPlan = {
  name: string;
  /** The ids picked in each section (SequelContents' ids). */
  pick: Partial<Record<SequelSection, string[]>>;
  /** How the sidebars are arranged: their spaces and folders. */
  layouts: boolean;
  /** Writing: the world's own calendar. */
  calendar: boolean;
  /** Filmmaking: the production back to Idea, with no release date, title or description, and its checklist unticked (format, runtime and tags stay). */
  restartProduction: boolean;
  /** Filmmaking, the script: each scene with its shots and storyboard frames. */
  shots: boolean;
  /** Filmmaking, gear: nothing packed yet. */
  unpackGear: boolean;
  /** Filmmaking, the budget: estimates only (every actual back to 0). */
  resetActuals: boolean;
  /** Filmmaking, releases: every one back to Needed, without its signed day or scan. */
  resetReleases: boolean;
  /** Filmmaking, the schedule: no day shot yet. */
  resetSchedule: boolean;
};

const named = (name: string | undefined, fallback: string) => name?.trim() || fallback;

/** A sequel's name: "The Glass Archipelago" → "The Glass Archipelago II", "… II" → "… III". */
export function sequelName(name: string, fallback: string): string {
  const base = named(name, fallback);
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const m = base.match(/^(.*\S)\s+([IVX]+)$/);
  const at = m ? numerals.indexOf(m[2]!) : -1;
  if (m && at >= 0 && at < numerals.length - 1) return `${m[1]} ${numerals[at + 1]}`;
  return `${base} II`;
}

/** The world's books, in order. */
const booksOf = (vault: Vault, worldId: string) =>
  live(vault.books)
    .filter((b) => b.worldId === worldId)
    .sort(byOrder);

/** A world's scenes in reading order: book by book, act by act. */
function scenesInOrder(vault: Vault, worldId: string): { scene: Scene; book: Book }[] {
  const parts = live(vault.parts);
  const scenes = live(vault.scenes);
  return booksOf(vault, worldId).flatMap((book) =>
    parts
      .filter((p) => p.bookId === book.id)
      .sort(byOrder)
      .flatMap((part) =>
        scenes
          .filter((s) => s.partId === part.id)
          .sort(byOrder)
          .map((scene) => ({ scene, book })),
      ),
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Everything in a world or production that can go into its sequel. */
export function sequelContents(vault: Vault, worldId: string): SequelContents {
  const world = vault.worlds[worldId];
  const kind: SequelKind = world?.section === 'film' ? 'film' : 'writing';
  const mine = <C extends Collection>(collection: C) => live(vault[collection] as unknown as Record<string, RecordOf<C> & BaseRecord>).filter((r) => (r as { worldId?: string | null }).worldId === worldId);
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  const entries = (k: 'character' | 'place' | 'lore' | 'crew') =>
    mine('entries')
      .filter((e) => e.kind === k)
      .sort(byName)
      .map((e) => ({ id: e.id, name: named(e.name, 'Untitled'), detail: e.group || e.tagline || undefined }));
  const several = booksOf(vault, worldId).length > 1;
  const scenes = scenesInOrder(vault, worldId).map(({ scene, book }, i) => ({
    id: scene.id,
    name: named(scene.title, kind === 'film' ? `Scene ${i + 1}` : 'Untitled Scene'),
    detail: several ? named(book.title, 'Untitled Book') : scene.words ? plural(scene.words, 'word') : undefined,
  }));
  if (kind === 'writing') {
    const events = mine('events');
    return {
      kind,
      sections: SEQUEL_SECTIONS.writing,
      items: {
        manuscript: scenes,
        characters: entries('character'),
        places: entries('place'),
        lore: entries('lore'),
        timeline: mine('storylines')
          .sort(byOrder)
          .map((s) => ({ id: s.id, name: named(s.name, 'Storyline'), detail: plural(events.filter((e) => e.storylineId === s.id).length, 'event') })),
        arcs: mine('arcs')
          .sort(byOrder)
          .map((a) => ({ id: a.id, name: named(a.name, 'Untitled Arc'), detail: a.kind[0]!.toUpperCase() + a.kind.slice(1) })),
        research: mine('research')
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((r) => ({ id: r.id, name: named(r.title, 'Untitled Note'), detail: r.tags.join(', ') || undefined })),
        maps: mine('writingMaps')
          .sort(byOrder)
          .map((m) => ({ id: m.id, name: named(m.name, 'Map'), detail: m.pins.length ? plural(m.pins.length, 'pin') : undefined })),
      },
    };
  }
  const shots = mine('shots');
  return {
    kind,
    sections: SEQUEL_SECTIONS.film,
    items: {
      script: scenes.map((s) => {
        const n = shots.filter((x) => x.sceneId === s.id).length;
        return n ? { ...s, detail: plural(n, 'shot') } : s;
      }),
      cast: entries('character'),
      crew: entries('crew'),
      locations: entries('place'),
      gear: mine('gear')
        .sort(byOrder)
        .map((g) => ({ id: g.id, name: named(g.name, 'Gear'), detail: [g.category, g.qty > 1 && `×${g.qty}`].filter(Boolean).join(' ') || undefined })),
      budget: mine('budget')
        .sort(byOrder)
        .map((b) => ({ id: b.id, name: named(b.item, b.category || 'Line'), detail: `${b.kind === 'income' ? 'Income' : 'Cost'} · ${b.category}` })),
      releases: mine('releases')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ id: r.id, name: named(r.name, 'Release'), detail: r.status[0]!.toUpperCase() + r.status.slice(1) })),
      schedule: mine('shootDays')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({ id: d.id, name: d.date || 'Undated Day', detail: plural(d.sceneIds.length, 'scene') })),
      breakdown: mine('breakdown')
        .sort(byName)
        .map((b) => ({ id: b.id, name: named(b.name, 'Item'), detail: b.category })),
      vfx: mine('vfx')
        .sort(byOrder)
        .map((v) => ({ id: v.id, name: named(v.code, 'VFX Shot'), detail: v.description || undefined })),
      cues: mine('cues')
        .sort(byOrder)
        .map((c) => ({ id: c.id, name: [c.code, c.title].filter(Boolean).join(' · ') || 'Cue', detail: c.by || undefined })),
    },
  };
}

const allOf = (contents: SequelContents) => Object.fromEntries(contents.sections.map((s) => [s, (contents.items[s] ?? []).map((i) => i.id)])) as SequelPlan['pick'];

/** A plan that carries everything as it is. */
export function everything(contents: SequelContents, name: string): SequelPlan {
  return { name, pick: allOf(contents), layouts: true, calendar: true, restartProduction: false, shots: true, unpackGear: false, resetActuals: false, resetReleases: false, resetSchedule: false };
}

/**
 * The sequel: the world without the story. Writing keeps its people,
 * places, lore, timeline, research, maps and calendar, and starts a new
 * book. Filmmaking keeps its cast, crew, locations, gear (unpacked) and
 * budget (estimates only), and starts the production over with a new script.
 */
export function sequel(contents: SequelContents, name: string): SequelPlan {
  const all = everything(contents, name);
  const leave: SequelSection[] = contents.kind === 'writing' ? ['manuscript', 'arcs'] : ['script', 'releases', 'schedule', 'breakdown', 'vfx', 'cues'];
  return {
    ...all,
    pick: { ...all.pick, ...Object.fromEntries(leave.map((s) => [s, []])) },
    restartProduction: true,
    unpackGear: true,
    resetActuals: true,
    resetReleases: true,
    resetSchedule: true,
  };
}

/** Nothing but the name, genre and summary (and, in Filmmaking, the format: a production started over). */
export function nothing(contents: SequelContents, name: string): SequelPlan {
  return { ...everything(contents, name), pick: Object.fromEntries(contents.sections.map((s) => [s, []])), layouts: false, calendar: false, restartProduction: true };
}

export type SequelResult = { vault: Vault; world: World; copied: number };

/**
 * The vault with the sequel in it, as the plan says. An arc whose book
 * wasn't copied comes with no book (bookId ''): the action gives it the
 * sequel's first one.
 */
export function createSequel(vault: Vault, sourceId: string, plan: SequelPlan): SequelResult {
  const source = vault.worlds[sourceId];
  if (!source) throw new Error(`No world ${sourceId}`);
  const kind: SequelKind = source.section === 'film' ? 'film' : 'writing';
  const t = now();
  const ids = new Map<string, string>();
  const record = <T extends BaseRecord>(r: T, id: string): T => ({ ...r, id, createdAt: t, updatedAt: t, deletedAt: null, sample: undefined });
  const picked = (s: SequelSection) => new Set(plan.pick[s] ?? []);
  const worldId = newId();
  const out: Vault = { ...vault };
  const add = <C extends Collection>(collection: C, r: RecordOf<C>) => {
    if (out[collection] === vault[collection]) out[collection] = { ...vault[collection] } as Vault[C];
    (out[collection] as Record<string, RecordOf<C>>)[(r as BaseRecord).id] = r;
  };
  let copied = 0;
  const inWorld = <C extends Collection>(collection: C) => live(vault[collection] as unknown as Record<string, RecordOf<C> & BaseRecord>).filter((r) => (r as { worldId?: string | null }).worldId === sourceId);
  const fresh = <T extends { id: string }>(list: T[]) => {
    for (const r of list) ids.set(r.id, newId());
    return list;
  };
  const to = (id: string | null | undefined) => (id ? (ids.get(id) ?? null) : null);
  const linked = (list: string[] | undefined) => (list ?? []).flatMap((id) => (ids.has(id) ? [ids.get(id)!] : []));
  /** A record keyed by ids (a call sheet's cast, the relationship web) with only the copied keys, pointed at the copies. */
  const rekey = <V>(map: Record<string, V> | undefined) => map && Object.fromEntries(Object.entries(map).flatMap(([k, v]) => (ids.has(k) ? [[ids.get(k)!, v]] : [])));

  // First every id, so links can point at copies made later.
  const kinds: Partial<Record<SequelSection, string>> = kind === 'writing' ? { characters: 'character', places: 'place', lore: 'lore' } : { cast: 'character', crew: 'crew', locations: 'place' };
  const entryPick = new Set(Object.entries(kinds).flatMap(([section, k]) => inWorld('entries').filter((e) => e.kind === k && picked(section as SequelSection).has(e.id)).map((e) => e.id)));
  const entries = fresh(inWorld('entries').filter((e) => entryPick.has(e.id)));
  const sceneSection: SequelSection = kind === 'writing' ? 'manuscript' : 'script';
  const chosenScenes = new Set(picked(sceneSection));
  const ordered = scenesInOrder(vault, sourceId).filter(({ scene }) => chosenScenes.has(scene.id));
  fresh(ordered.map(({ scene }) => scene));
  const storylines = kind === 'writing' ? fresh(inWorld('storylines').filter((s) => picked('timeline').has(s.id))) : [];
  const arcs = kind === 'writing' ? fresh(inWorld('arcs').filter((a) => picked('arcs').has(a.id))) : [];
  const research = kind === 'writing' ? fresh(inWorld('research').filter((r) => picked('research').has(r.id))) : [];
  const maps = kind === 'writing' ? fresh(inWorld('writingMaps').filter((m) => picked('maps').has(m.id))) : [];
  const shots = kind === 'film' && plan.shots ? fresh(inWorld('shots').filter((s) => ids.has(s.sceneId))) : [];
  const film = <C extends 'gear' | 'budget' | 'releases' | 'shootDays' | 'breakdown' | 'vfx' | 'cues'>(collection: C, section: FilmSection) => (kind === 'film' ? fresh(inWorld(collection).filter((r) => picked(section).has(r.id))) : []);
  const gear = film('gear', 'gear');
  const budget = film('budget', 'budget');
  const releases = film('releases', 'releases');
  const days = film('shootDays', 'schedule');
  const breakdown = film('breakdown', 'breakdown');
  const vfx = film('vfx', 'vfx');
  const cues = film('cues', 'cues');

  // The world itself.
  const orders = live(vault.worlds).map((w) => w.order);
  const restart = plan.restartProduction && source.film;
  const world: World = {
    ...record(source, worldId),
    name: plan.name.trim() || sequelName(source.name, kind === 'film' ? 'Untitled Production' : 'Untitled World'),
    order: orders.length ? Math.max(...orders) + 1 : 0,
    film: restart ? { ...source.film!, stage: 'idea', releaseDate: '', releaseTitle: '', releaseDescription: '', checklist: source.film!.checklist.map((c) => ({ ...c, done: false })) } : source.film,
    folders: plan.layouts ? source.folders : undefined,
    layouts: plan.layouts && source.layouts ? Object.fromEntries(Object.entries(source.layouts).map(([k, l]) => [k, remapLayout(l, ids)])) : undefined,
    calendar: plan.calendar ? source.calendar : undefined,
    web: rekey(source.web),
  };
  add('worlds', world);

  for (const e of entries) {
    add('entries', { ...record(e, ids.get(e.id)!), worldId, via: undefined });
    copied++;
  }
  for (const r of inWorld('relationships')) {
    if (ids.has(r.fromId) && ids.has(r.toId)) add('relationships', { ...record(r, newId()), worldId, fromId: ids.get(r.fromId)!, toId: ids.get(r.toId)! });
  }

  // The manuscript or the script: a book (and an act) only if something in it was picked.
  const bookIds = new Map<string, string>();
  const partIds = new Map<string, string>();
  const parts = live(vault.parts);
  for (const { scene, book } of ordered) {
    if (!bookIds.has(book.id)) {
      bookIds.set(book.id, newId());
      // The copy starts unlocked: its revision rounds measure against snapshots that stay behind.
      add('books', { ...record(book, bookIds.get(book.id)!), worldId, script: book.script && { ...book.script, lock: null } });
    }
    if (!partIds.has(scene.partId)) {
      partIds.set(scene.partId, newId());
      const part = parts.find((p) => p.id === scene.partId)!;
      add('parts', { ...record(part, partIds.get(part.id)!), bookId: bookIds.get(book.id)! });
    }
    add('scenes', {
      ...record(scene, ids.get(scene.id)!),
      bookId: bookIds.get(book.id)!,
      partId: partIds.get(scene.partId)!,
      povId: to(scene.povId),
      placeId: to(scene.placeId),
      links: linked(scene.links),
      tagged: scene.tagged && linked(scene.tagged),
      content: remapContent(scene.content, ids, false) as unknown[],
    });
    copied++;
  }

  // Writing.
  for (const s of storylines) {
    add('storylines', { ...record(s, ids.get(s.id)!), worldId });
    copied++;
  }
  for (const e of inWorld('events')) {
    if (ids.has(e.storylineId)) add('events', { ...record(e, newId()), worldId, storylineId: ids.get(e.storylineId)!, links: linked(e.links) });
  }
  for (const a of arcs) {
    add('arcs', { ...record(a, ids.get(a.id)!), worldId, bookId: bookIds.get(a.bookId) ?? '', entryId: to(a.entryId), beats: rekey(a.beats) ?? {} });
    copied++;
  }
  for (const r of research) {
    add('research', { ...record(r, ids.get(r.id)!), worldId, links: linked(r.links) });
    copied++;
  }
  for (const m of maps) {
    add('writingMaps', { ...record(m, ids.get(m.id)!), worldId, parentId: to(m.parentId), pins: m.pins.map((p) => ({ ...p, entryId: to(p.entryId), mapId: to(p.mapId) })) });
    copied++;
  }

  // Filmmaking.
  for (const s of shots) add('shots', { ...record(s, ids.get(s.id)!), worldId, sceneId: ids.get(s.sceneId)! });
  for (const g of gear) {
    add('gear', { ...record(g, ids.get(g.id)!), worldId, ...(plan.unpackGear ? { packed: false } : {}) });
    copied++;
  }
  for (const b of budget) {
    add('budget', { ...record(b, ids.get(b.id)!), worldId, ...(plan.resetActuals ? { actual: 0 } : {}) });
    copied++;
  }
  for (const r of releases) {
    add('releases', { ...record(r, ids.get(r.id)!), worldId, entryId: to(r.entryId), ...(plan.resetReleases ? { status: 'needed' as const, signedOn: '', scan: undefined } : {}) });
    copied++;
  }
  for (const d of days) {
    const sheet = d.sheet && { ...d.sheet, cast: rekey(d.sheet.cast), crew: rekey(d.sheet.crew), sceneNotes: rekey(d.sheet.sceneNotes) };
    add('shootDays', { ...record(d, ids.get(d.id)!), worldId, placeId: to(d.placeId), sceneIds: linked(d.sceneIds), sheet, ...(plan.resetSchedule ? { done: false } : {}) });
    copied++;
  }
  for (const b of breakdown) {
    add('breakdown', { ...record(b, ids.get(b.id)!), worldId, sceneIds: linked(b.sceneIds) });
    copied++;
  }
  for (const v of vfx) {
    add('vfx', { ...record(v, ids.get(v.id)!), worldId, sceneId: to(v.sceneId), shotId: to(v.shotId) });
    copied++;
  }
  for (const c of cues) {
    add('cues', { ...record(c, ids.get(c.id)!), worldId, sceneId: to(c.sceneId) });
    copied++;
  }
  return { vault: out, world, copied };
}

/** "Book Two" for a world that has one book, and so on. */
export function nextBookTitle(vault: Vault, worldId: string): string {
  const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const n = booksOf(vault, worldId).length + 1;
  return `Book ${words[n - 1] ?? n}`;
}
