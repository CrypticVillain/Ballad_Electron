import { longRest } from '@/lib/tabletop';
import { byOrder, live, newId, now, type BaseRecord, type Book, type Collection, type Layout, type RecordOf, type Scene, type Vault, type World } from '@/lib/model';

/**
 * Tabletop → Copy Campaign (pure): a new campaign made from one you have, with only
 * what you pick. Each section (sessions, notes, Play's scenes, encounters, the
 * bestiary, the party, NPCs, places, lore, maps, the timeline) is copied thing by thing, so
 * you can take every NPC but one, or the maps and nothing else.
 *
 * Copies are new records with new ids. Links between things are kept when
 * both ends were copied: a session's NPCs and encounters, an encounter's
 * creatures and party, relationships, timeline links, the sidebars' spaces
 * and folders. A link to something left out is dropped, and a mention of it
 * in a session's text becomes its plain name. Pictures are shared, not
 * duplicated (they're files beside the vault).
 *
 * Play's scenes bring their handouts. Not copied: the players' own things
 * (their journals, maps and creatures), what the GM has shared with them
 * (the copy starts unshared), and the marks drawn on scenes in a session.
 */

export const COPY_SECTIONS = ['sessions', 'notes', 'play', 'encounters', 'bestiary', 'party', 'npcs', 'places', 'lore', 'maps', 'timeline'] as const;
export type CopySection = (typeof COPY_SECTIONS)[number];

export type { CopyItem } from '@/components/shared/CopyPicker';
import type { CopyItem } from '@/components/shared/CopyPicker';

/** What can be copied from a campaign, section by section, in the order the app lists them. */
export type CampaignContents = Record<CopySection, CopyItem[]>;

export type CopyPlan = {
  name: string;
  /** The ids picked in each section (CampaignContents' ids). */
  pick: Record<CopySection, string[]>;
  /** The campaign's session calendar (its schedule and next session). */
  schedule: boolean;
  /** How the sidebars are arranged: their spaces and folders. */
  layouts: boolean;
  /** Sessions and notes: every checklist unticked (the secrets and clues, to run again). */
  untickChecklists: boolean;
  /** Sessions: none played yet (played ones back to Prepped, without the day they were played). */
  unplaySessions: boolean;
  /** Encounters: back to not started (no initiative, everyone at full hit points, no conditions). */
  resetEncounters: boolean;
  /** The party: after a long rest (full hit points, slots and uses back, no conditions). */
  restParty: boolean;
  /** Maps: leave out the pins only the GM sees. */
  dropGmPins: boolean;
};

const named = (name: string | undefined, fallback: string) => name?.trim() || fallback;

/** The GM's books of a campaign (the session logs; players' journals are theirs). */
const gmBooks = (vault: Vault, worldId: string) =>
  live(vault.books)
    .filter((b) => b.worldId === worldId && b.audience !== 'player')
    .sort(byOrder);

/** Everything in a campaign that can be copied. */
export function campaignContents(vault: Vault, worldId: string): CampaignContents {
  const mine = <C extends Collection>(collection: C) => live(vault[collection] as unknown as Record<string, RecordOf<C> & BaseRecord>).filter((r) => (r as { worldId?: string | null }).worldId === worldId);
  const books = gmBooks(vault, worldId);
  const several = books.length > 1;
  const parts = live(vault.parts);
  const sessions: CopyItem[] = [];
  const notes: CopyItem[] = [];
  for (const book of books) {
    const scenes = live(vault.scenes).filter((s) => s.bookId === book.id);
    const bookParts = parts.filter((p) => p.bookId === book.id).sort(byOrder);
    let number = 0;
    for (const part of bookParts) {
      for (const s of scenes.filter((x) => x.partId === part.id && x.kind !== 'note').sort(byOrder)) {
        number++;
        sessions.push({ id: s.id, name: named(s.title, `Session ${number}`), detail: several ? named(book.title, 'Session Log') : s.when || undefined });
      }
    }
    for (const s of scenes.filter((x) => x.kind === 'note').sort((a, b) => a.title.localeCompare(b.title))) {
      notes.push({ id: s.id, name: named(s.title, 'Untitled Note'), detail: s.category ? s.category[0]!.toUpperCase() + s.category.slice(1) : undefined });
    }
  }
  const entries = (kind: 'character' | 'place' | 'lore') =>
    mine('entries')
      .filter((e) => e.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ id: e.id, name: named(e.name, 'Untitled'), detail: e.group || undefined }));
  const events = mine('events');
  return {
    sessions,
    notes,
    play: mine('playScenes')
      .sort(byOrder)
      .map((s) => ({ id: s.id, name: named(s.name, 'Untitled Scene'), detail: s.image ? undefined : 'Blank' })),
    encounters: mine('encounters')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ id: e.id, name: named(e.name, 'Encounter'), detail: e.combatants.length ? `${e.combatants.length} in it` : undefined })),
    bestiary: mine('monsters')
      .filter((m) => !m.characterId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ id: m.id, name: named(m.name, 'Creature'), detail: m.cr ? `CR ${m.cr}` : undefined })),
    party: mine('pcs')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pc) => ({ id: pc.id, name: named(pc.name, 'Unnamed Character'), detail: [pc.className && `${pc.className} ${pc.level}`, pc.player].filter(Boolean).join(' · ') || undefined })),
    npcs: entries('character'),
    places: entries('place'),
    lore: entries('lore'),
    maps: mine('maps')
      .filter((m) => !m.characterId)
      .sort(byOrder)
      .map((m) => ({ id: m.id, name: named(m.name, 'Map'), detail: m.pins.length ? `${m.pins.length} ${m.pins.length === 1 ? 'pin' : 'pins'}` : undefined })),
    timeline: mine('storylines')
      .sort(byOrder)
      .map((s) => {
        const count = events.filter((e) => e.storylineId === s.id).length;
        return { id: s.id, name: named(s.name, 'Storyline'), detail: `${count} ${count === 1 ? 'event' : 'events'}` };
      }),
  };
}

/** A plan that copies everything (the dialog's starting point). */
export function everything(contents: CampaignContents, name: string): CopyPlan {
  return {
    name,
    pick: Object.fromEntries(COPY_SECTIONS.map((s) => [s, contents[s].map((i) => i.id)])) as CopyPlan['pick'],
    schedule: true,
    layouts: true,
    untickChecklists: false,
    unplaySessions: false,
    resetEncounters: false,
    restParty: false,
    dropGmPins: false,
  };
}

/**
 * A plan to run the campaign again for a new table: the world, the prep and
 * the bestiary, without the party, the calendar or how far the last table
 * got (no session played, checklists unticked, encounters not started).
 */
export function newTable(contents: CampaignContents, name: string): CopyPlan {
  const all = everything(contents, name);
  return { ...all, pick: { ...all.pick, party: [] }, schedule: false, untickChecklists: true, unplaySessions: true, resetEncounters: true };
}

/**
 * A session's blocks with their mentions pointed at the copies (a mention of
 * something not copied becomes its name, as text) and, if asked, every
 * checklist block unticked.
 */
export function remapContent(content: unknown, ids: Map<string, string>, untick: boolean): unknown {
  if (Array.isArray(content)) return content.map((c) => remapContent(c, ids, untick));
  if (!content || typeof content !== 'object') return content;
  const node = content as { type?: unknown; props?: Record<string, unknown> };
  if (node.type === 'mention' && node.props) {
    const to = ids.get(String(node.props.entryId));
    return to ? { ...node, props: { ...node.props, entryId: to } } : { type: 'text', text: String(node.props.name ?? ''), styles: {} };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) out[k] = remapContent(v, ids, untick);
  if (untick && node.type === 'checkListItem' && node.props?.checked) out.props = { ...(out.props as object), checked: false };
  return out;
}

/** A layout with its items pointed at the copies (the ones not copied left out). Spaces and folders keep their ids: they're the campaign's own. */
export function remapLayout(layout: Layout, ids: Map<string, string>): Layout {
  const items = (list: string[]) => list.flatMap((id) => (ids.has(id) ? [ids.get(id)!] : []));
  return { spaces: layout.spaces.map((s) => ({ ...s, items: items(s.items), folders: s.folders.map((f) => ({ ...f, items: items(f.items) })) })) };
}

export type CopyResult = { vault: Vault; world: World; copied: number };

/** The vault with a copy of a campaign in it, as the plan says. */
export function copyCampaign(vault: Vault, sourceId: string, plan: CopyPlan): CopyResult {
  const source = vault.worlds[sourceId];
  if (!source) throw new Error(`No campaign ${sourceId}`);
  const t = now();
  const ids = new Map<string, string>();
  const fresh = (oldId: string) => {
    const id = newId();
    ids.set(oldId, id);
    return id;
  };
  const record = <T extends BaseRecord>(r: T, id: string): T => ({ ...r, id, createdAt: t, updatedAt: t, deletedAt: null, sample: undefined });
  const picked = Object.fromEntries(COPY_SECTIONS.map((s) => [s, new Set(plan.pick[s])])) as Record<CopySection, Set<string>>;
  const worldId = newId();
  const out: Vault = { ...vault };
  const add = <C extends Collection>(collection: C, r: RecordOf<C>) => {
    if (out[collection] === vault[collection]) out[collection] = { ...vault[collection] } as Vault[C];
    (out[collection] as Record<string, RecordOf<C>>)[(r as BaseRecord).id] = r;
  };
  let copied = 0;
  const count = () => copied++;

  // First every id, so links can point at copies made later.
  const inWorld = <C extends Collection>(collection: C) => live(vault[collection] as unknown as Record<string, RecordOf<C> & BaseRecord>).filter((r) => (r as { worldId?: string | null }).worldId === sourceId);
  const entries = inWorld('entries').filter((e) => (e.kind === 'character' && picked.npcs.has(e.id)) || (e.kind === 'place' && picked.places.has(e.id)) || (e.kind === 'lore' && picked.lore.has(e.id)));
  const monsters = inWorld('monsters').filter((m) => !m.characterId && picked.bestiary.has(m.id));
  const pcs = inWorld('pcs').filter((pc) => picked.party.has(pc.id));
  const encounters = inWorld('encounters').filter((e) => picked.encounters.has(e.id));
  const maps = inWorld('maps').filter((m) => !m.characterId && picked.maps.has(m.id));
  const storylines = inWorld('storylines').filter((s) => picked.timeline.has(s.id));
  const playScenes = inWorld('playScenes').filter((s) => picked.play.has(s.id));
  for (const r of [...entries, ...monsters, ...pcs, ...encounters, ...maps, ...storylines, ...playScenes]) fresh(r.id);
  const linked = (list: string[] | undefined) => (list ?? []).flatMap((id) => (ids.has(id) ? [ids.get(id)!] : []));

  // The campaign itself.
  const layouts = plan.layouts && source.layouts ? Object.fromEntries(Object.entries(source.layouts).map(([k, l]) => [k, remapLayout(l, ids)])) : undefined;
  const tabletop = source.tabletop && {
    ...source.tabletop,
    nextSession: plan.schedule ? source.tabletop.nextSession : '',
    schedule: plan.schedule ? (source.tabletop.schedule ?? []).map((s) => ({ ...s, id: newId() })) : [],
    // A copy starts with no scene started in Play.
    live: null,
  };
  const orders = live(vault.worlds).map((w) => w.order);
  const world: World = {
    ...record(source, worldId),
    name: plan.name.trim() || `${named(source.name, 'Untitled Campaign')} (Copy)`,
    order: orders.length ? Math.max(...orders) + 1 : 0,
    tabletop,
    folders: plan.layouts ? source.folders : undefined,
    layouts,
  };
  add('worlds', world);

  for (const e of entries) {
    add('entries', { ...record(e, ids.get(e.id)!), worldId, via: undefined });
    count();
  }
  for (const r of inWorld('relationships')) {
    if (ids.has(r.fromId) && ids.has(r.toId)) add('relationships', { ...record(r, newId()), worldId, fromId: ids.get(r.fromId)!, toId: ids.get(r.toId)! });
  }
  for (const m of monsters) {
    add('monsters', { ...record(m, ids.get(m.id)!), worldId, characterId: null, via: undefined });
    count();
  }
  for (const pc of pcs) {
    // The copies are the GM's to keep (the party's sheets), not anyone's own character: a player's calendar and sidebars stay theirs.
    const rested = plan.restParty ? { ...longRest(pc), conditions: [] } : {};
    add('pcs', { ...record(pc, ids.get(pc.id)!), worldId, mine: undefined, folder: undefined, schedule: undefined, layouts: undefined, mapFolders: undefined, ...rested });
    count();
  }
  for (const e of encounters) {
    const combatants = e.combatants.flatMap((c) => {
      if (c.kind === 'pc' && !(c.refId && ids.has(c.refId))) return []; // that party member wasn't copied
      const linkedTo = c.refId ? ids.get(c.refId) : undefined;
      const kept = { ...c, id: newId(), refId: linkedTo ?? null, kind: c.kind === 'monster' && !linkedTo ? ('other' as const) : c.kind };
      return [plan.resetEncounters ? { ...kept, initiative: null, hp: kept.maxHp, conditions: [] } : kept];
    });
    add('encounters', { ...record(e, ids.get(e.id)!), worldId, combatants, ...(plan.resetEncounters ? { round: 0, turn: 0 } : {}) });
    count();
  }
  for (const m of maps) {
    add('maps', { ...record(m, ids.get(m.id)!), worldId, characterId: null, via: undefined, pins: plan.dropGmPins ? m.pins.filter((p) => !p.gmOnly) : m.pins });
    count();
  }
  for (const s of storylines) {
    add('storylines', { ...record(s, ids.get(s.id)!), worldId });
    count();
  }
  // Play's scenes: the picture (shared, not duplicated), its grid and settings, and its tokens. A token for a party
  // member who wasn't copied leaves the board; one for a creature or NPC that wasn't keeps its picture and numbers.
  for (const s of playScenes) {
    add('playScenes', { ...record(s, ids.get(s.id)!), worldId });
    count();
  }
  // A scene's handouts come with it (shown or hidden as they are); the marks drawn in a session don't.
  for (const h of live(vault.handouts ?? {}).filter((x) => ids.has(x.sceneId) && playScenes.some((s) => s.id === x.sceneId))) {
    add('handouts', { ...record(h, newId()), worldId, sceneId: ids.get(h.sceneId)! });
  }
  // An encounter's prepared map carries its placed tokens too.
  const boards = new Set([...playScenes.map((s) => s.id), ...encounters.map((e) => e.id)]);
  for (const t of live(vault.tokens).filter((x) => boards.has(x.sceneId))) {
    const linkedTo = t.refId ? ids.get(t.refId) : undefined;
    if (t.kind === 'pc' && !linkedTo) continue;
    const source = t.refId && !linkedTo ? (t.kind === 'monster' ? vault.monsters[t.refId] : t.kind === 'npc' ? vault.entries[t.refId] : undefined) : undefined;
    const reset = plan.resetEncounters ? { hp: t.hp && { ...t.hp, current: t.hp.max, temp: 0 }, conditions: [] } : {};
    add('tokens', {
      ...record(t, newId()),
      worldId,
      sceneId: ids.get(t.sceneId)!,
      refId: linkedTo ?? null,
      kind: t.refId && !linkedTo ? 'other' : t.kind,
      image: t.image ?? source?.image,
      ac: t.ac ?? (source && 'ac' in source ? source.ac : null),
      ...reset,
    });
  }
  for (const e of inWorld('events')) {
    if (ids.has(e.storylineId)) add('events', { ...record(e, newId()), worldId, storylineId: ids.get(e.storylineId)!, links: linked(e.links) });
  }

  // The session logs: a book (and a part) only if something in it was picked.
  const scenes = live(vault.scenes);
  const parts = live(vault.parts);
  const keep = (s: Scene) => (s.kind === 'note' ? picked.notes.has(s.id) : picked.sessions.has(s.id));
  for (const book of gmBooks(vault, sourceId)) {
    const chosen = scenes.filter((s) => s.bookId === book.id && keep(s));
    if (!chosen.length) continue;
    const bookId = newId();
    add('books', { ...record(book, bookId), worldId } satisfies Book);
    const partIds = new Map<string, string>();
    for (const part of parts.filter((p) => p.bookId === book.id && chosen.some((s) => s.partId === p.id))) {
      partIds.set(part.id, newId());
      add('parts', { ...record(part, partIds.get(part.id)!), bookId });
    }
    for (const s of chosen) {
      const untick = plan.untickChecklists;
      const unplay = plan.unplaySessions && s.kind !== 'note' && s.status === 'done';
      add('scenes', {
        ...record(s, newId()),
        bookId,
        partId: s.kind === 'note' ? '' : partIds.get(s.partId)!,
        povId: s.povId ? (ids.get(s.povId) ?? null) : null,
        placeId: s.placeId ? (ids.get(s.placeId) ?? null) : null,
        links: linked(s.links),
        tagged: s.tagged && linked(s.tagged),
        encounterIds: s.encounterIds && linked(s.encounterIds),
        content: remapContent(s.content, ids, untick) as unknown[],
        checklist: s.checklist && (untick ? s.checklist.map((c) => ({ ...c, done: false })) : s.checklist),
        ...(unplay ? { status: 'draft' as const, when: '' } : {}),
      });
      count();
    }
  }
  return { vault: out, world, copied };
}
