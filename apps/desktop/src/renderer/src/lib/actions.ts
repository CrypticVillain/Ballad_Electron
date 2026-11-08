/**
 * actions.ts — creating and changing records. Screens call these; they go
 * through the vault store's put / patch / remove, so every change is saved
 * and stamped. Deletes are soft: the toast that follows can undo them.
 */
import { today } from '@/lib/dates';
import { DEFAULT_ABILITIES } from '@/lib/tabletop';
import { tabletopDefaults, filmDefaults, kindInfo, SECTION_INFO, worldSection } from '@/lib/sections';
import {
  byOrder,
  COLLECTIONS,
  live,
  newId,
  now,
  type Book,
  type BudgetLine,
  type Collection,
  type Combatant,
  type TabletopDetails,
  type Encounter,
  type Entry,
  type EntryKind,
  type FilmDetails,
  type Monster,
  type Part,
  type PlayerCharacter,
  type RecordOf,
  type Relationship,
  type Scene,
  type Section,
  type ShootDay,
  type Shot,
  type Storyline,
  type TimelineEvent,
  type World,
  type TabletopRole,
  type GameMap,
  type Ink,
} from '@/lib/model';
import { blocksLinks, blocksToText, wordCount } from '@/lib/text';
import { currentAccountId, currentRole, currentSection, usePreferences, worldKey } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

const vault = () => useVault.getState().vault;
const nextOrder = (orders: number[]) => (orders.length ? Math.max(...orders) + 1 : 0);

// ── Worlds ────────────────────────────────────────────────────────────────

/** The open world of a section (the open one by default): the one picked last, else the section's first. Play's is Tabletop's. */
export function activeWorld(section: Section = currentSection()): World | undefined {
  const worlds = live(vault().worlds)
    .filter((w) => w.section === worldSection(section))
    .sort(byOrder);
  // Player view: the campaign of the character you're playing (if they're in one).
  if (section === 'tabletop' && currentRole() === 'player') return worlds.find((w) => w.id === activeCharacter()?.worldId);
  const id = usePreferences.getState().worldIds[worldKey(currentAccountId(), worldSection(section))];
  return worlds.find((w) => w.id === id) ?? worlds[0];
}

/** The character you're playing (Player view): the one picked last, else your first by name. */
export function activeCharacter(): PlayerCharacter | undefined {
  const mine = live(vault().pcs)
    .filter((pc) => pc.mine)
    .sort((a, b) => a.name.localeCompare(b.name));
  const id = usePreferences.getState().characterIds[currentAccountId()];
  return mine.find((pc) => pc.id === id) ?? mine[0];
}

/** Plays a character (Player view). */
export function pickCharacter(id: string) {
  const prefs = usePreferences.getState();
  prefs.setPreference('characterIds', { ...prefs.characterIds, [currentAccountId()]: id });
}

/** Sets whether you're the GM or a player (Tabletop), in the open account. */
export function setRole(role: TabletopRole) {
  const prefs = usePreferences.getState();
  prefs.setPreference('tabletopRoles', { ...prefs.tabletopRoles, [currentAccountId()]: role });
}

/** A character of your own (Player view), in no campaign until you put them in one; you're playing them now. */
export function createMyCharacter(input: Partial<PlayerCharacter> = {}): PlayerCharacter {
  const pc = createPc(null, { mine: true, ...input });
  pickCharacter(pc.id);
  return pc;
}

/**
 * Opens a world (in its own section, which opens too: a campaign opened from
 * Play stays in Play). Another account's world is remembered for that account
 * before the reload into it (stores/accounts.ts): pass its account and section.
 */
export function openWorld(id: string, accountId = currentAccountId(), section: Section = sectionFor(id)) {
  const prefs = usePreferences.getState();
  prefs.setPreference('worldIds', { ...prefs.worldIds, [worldKey(accountId, worldSection(section))]: id });
  prefs.setPreference('sections', { ...prefs.sections, [accountId]: section });
}

/** The section a world opens in: the one you're in if it runs that world's section (Play, a campaign), else the world's own. */
function sectionFor(id: string): Section {
  const own = vault().worlds[id]?.section;
  const here = currentSection();
  return !own || worldSection(here) === own ? here : own;
}

/** Switches the open account to another section (its last world opens). */
export function openSection(section: Section) {
  const prefs = usePreferences.getState();
  prefs.setPreference('sections', { ...prefs.sections, [currentAccountId()]: section });
}

/**
 * A new world in a section (the open one by default) with a first book, part
 * and scene, so there's somewhere to start: a manuscript, a script or a
 * session log. Opens it.
 */
export function createWorld(input: Partial<World> = {}): { world: World; scene: Scene } {
  // A campaign made from Play is Tabletop's.
  const section = worldSection(input.section ?? currentSection());
  const world: World = {
    ...stamp(),
    name: `Untitled ${SECTION_INFO[section].container}`,
    genre: '',
    era: '',
    summary: '',
    order: nextOrder(live(vault().worlds).map((w) => w.order)),
    ...(section === 'film' ? { film: filmDefaults() } : section === 'tabletop' ? { tabletop: tabletopDefaults() } : {}),
    ...input,
    section,
  };
  useVault.getState().put('worlds', world);
  const scene = startBook(world.id);
  openWorld(world.id);
  return { world, scene };
}

export function updateWorld(id: string, changes: Partial<World>) {
  useVault.getState().patch('worlds', id, changes);
}

/** Changes a production's details (filling in the defaults on an older one). */
export function updateFilm(id: string, changes: Partial<FilmDetails>) {
  const world = vault().worlds[id];
  if (world) updateWorld(id, { film: { ...filmDefaults(), ...world.film, ...changes } });
}

/** Changes a campaign's details. */
export function updateTabletop(id: string, changes: Partial<TabletopDetails>) {
  const world = vault().worlds[id];
  if (world) updateWorld(id, { tabletop: { ...tabletopDefaults(), ...world.tabletop, ...changes } });
}

const sectionOf = (worldId: string): Section => vault().worlds[worldId]?.section ?? 'writing';

/**
 * Deletes a world (soft, so the toast's Undo brings it back whole). Its books,
 * entries and timeline stay in the vault with it, out of sight. If it was
 * open, the account's first world opens.
 */
export function trashWorld(id: string) {
  useVault.getState().remove('worlds', id);
}

// ── The manuscript ────────────────────────────────────────────────────────

export function createBook(worldId: string, input: Partial<Book> = {}): Book {
  const defaults = SECTION_INFO[sectionOf(worldId)].book;
  const book: Book = {
    ...stamp(),
    worldId,
    title: defaults.title,
    partNoun: defaults.partNoun,
    targetWords: defaults.targetWords,
    order: nextOrder(live(vault().books).filter((b) => b.worldId === worldId).map((b) => b.order)),
    ...input,
  };
  useVault.getState().put('books', book);
  return book;
}

/** A new book with its first act and scene; returns the scene, to open it. */
export function startBook(worldId: string, input: Partial<Book> = {}): Scene {
  const book = createBook(worldId, input);
  return createScene(book.id, createPart(book.id).id);
}

export function updateBook(id: string, changes: Partial<Book>) {
  useVault.getState().patch('books', id, changes);
}

export function createPart(bookId: string, input: Partial<Part> = {}): Part {
  const part: Part = {
    ...stamp(),
    bookId,
    title: '',
    order: nextOrder(live(vault().parts).filter((p) => p.bookId === bookId).map((p) => p.order)),
    ...input,
  };
  useVault.getState().put('parts', part);
  return part;
}

export function updatePart(id: string, changes: Partial<Part>) {
  useVault.getState().patch('parts', id, changes);
}

export function createScene(bookId: string, partId: string, input: Partial<Scene> = {}): Scene {
  const book = vault().books[bookId];
  // A player's journal is Tabletop's, campaign or not.
  const defaults = SECTION_INFO[book?.audience === 'player' ? 'tabletop' : book?.worldId ? sectionOf(book.worldId) : 'writing'].book;
  const order = nextOrder(live(vault().scenes).filter((s) => s.partId === partId).map((s) => s.order));
  // A session log numbers its sessions across the whole book ("Session 4").
  const number = live(vault().scenes).filter((s) => s.bookId === bookId && s.kind !== 'note').length + 1;
  const scene: Scene = {
    ...stamp(),
    bookId,
    partId,
    title: defaults.sceneTitle ? `${defaults.sceneTitle} ${number}` : '',
    status: 'draft',
    order,
    povId: null,
    placeId: null,
    when: '',
    note: '',
    targetWords: defaults.sceneTarget,
    content: [],
    text: '',
    words: 0,
    links: [],
    ...input,
  };
  if (input.content && !input.text) Object.assign(scene, readContent(scene.content));
  useVault.getState().put('scenes', scene);
  return scene;
}

/** A Tabletop note (a quest, a clue, someone to remember): kept in a book beside its sessions, in no part. */
export function createNote(bookId: string, input: Partial<Scene> = {}): Scene {
  return createScene(bookId, '', { kind: 'note', category: 'general', title: '', status: 'draft', ...input });
}

export function updateScene(id: string, changes: Partial<Scene>) {
  useVault.getState().patch('scenes', id, changes);
}

function readContent(content: unknown[]) {
  const text = blocksToText(content);
  return { text, words: wordCount(text), links: blocksLinks(content) };
}

/** Saves what the editor holds, and adds the words gained to today's count. */
export function updateSceneContent(id: string, content: unknown[]) {
  const scene = vault().scenes[id];
  if (!scene) return;
  const read = readContent(content);
  const gained = read.words - scene.words;
  updateScene(id, { content, ...read });
  if (gained > 0) logWords(gained);
}

/** Moves a scene (or part) one place up or down among its siblings. */
export function shift(collection: 'scenes' | 'parts', id: string, direction: -1 | 1) {
  const record = vault()[collection][id];
  if (!record) return;
  const siblings = (
    collection === 'scenes'
      ? live(vault().scenes).filter((s) => s.partId === (record as Scene).partId)
      : live(vault().parts).filter((p) => p.bookId === (record as Part).bookId)
  ).sort(byOrder);
  const index = siblings.findIndex((s) => s.id === id);
  const other = siblings[index + direction];
  if (!other) return;
  useVault.getState().patch(collection, id, { order: other.order });
  useVault.getState().patch(collection, other.id, { order: record.order });
}

/** Moves a scene to the end of another part. */
export function moveScene(id: string, partId: string) {
  updateScene(id, { partId, order: nextOrder(live(vault().scenes).filter((s) => s.partId === partId).map((s) => s.order)) });
}

/** The ids in a new order: `id` taken out and put back just before `before` (at the end if it's null or not there). */
export function placeBefore(ids: string[], id: string, before: string | null): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = before ? rest.indexOf(before) : -1;
  return at < 0 ? [...rest, id] : [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** Numbers records 0, 1, 2… in the order given, changing only those whose place changed. */
function renumber(collection: 'scenes' | 'parts', ids: string[]) {
  ids.forEach((id, order) => {
    if (vault()[collection][id]?.order !== order) useVault.getState().patch(collection, id, { order });
  });
}

/** Drag and drop in the binder: a scene into a part, just before another of its scenes (or at its end). */
export function placeScene(id: string, partId: string, before: string | null) {
  const scene = vault().scenes[id];
  if (!scene || !vault().parts[partId]) return;
  const siblings = live(vault().scenes)
    .filter((s) => s.partId === partId && s.kind === scene.kind)
    .sort(byOrder)
    .map((s) => s.id);
  if (scene.partId !== partId) updateScene(id, { partId });
  renumber('scenes', placeBefore(siblings, id, before));
}

/** The world menu, dragged: a world just before another of its section's. */
export function placeWorld(id: string, before: string) {
  const world = vault().worlds[id];
  if (!world) return;
  const ids = live(vault().worlds)
    .filter((w) => w.section === world.section)
    .sort(byOrder)
    .map((w) => w.id);
  placeBefore(ids, id, before).forEach((wid, order) => {
    if (vault().worlds[wid]?.order !== order) useVault.getState().patch('worlds', wid, { order });
  });
}

/** Drag and drop in the binder: a part (an act) just before another of its book's (or last). */
export function placePart(id: string, before: string | null) {
  const part = vault().parts[id];
  if (!part) return;
  const siblings = live(vault().parts)
    .filter((p) => p.bookId === part.bookId)
    .sort(byOrder)
    .map((p) => p.id);
  renumber('parts', placeBefore(siblings, id, before));
}

/** A book's scenes in reading order (part by part). */
export function scenesInOrder(bookId: string): Scene[] {
  const parts = live(vault().parts).filter((p) => p.bookId === bookId).sort(byOrder);
  const scenes = live(vault().scenes);
  return parts.flatMap((part) => scenes.filter((s) => s.partId === part.id).sort(byOrder));
}

// ── The writing log ───────────────────────────────────────────────────────

export function logWords(words: number, day = today()) {
  const current = vault().days[day];
  if (current && !current.deletedAt) useVault.getState().patch('days', day, { words: current.words + words });
  else useVault.getState().put('days', { id: day, createdAt: now(), updatedAt: now(), deletedAt: null, words });
}

// ── The world bible ───────────────────────────────────────────────────────

/** A new entry, with its section's usual group and spec rows for its kind (lib/sections.ts). */
export function createEntry(worldId: string, kind: EntryKind, input: Partial<Entry> = {}): Entry {
  const info = kindInfo(kind, sectionOf(worldId));
  const entry: Entry = {
    ...stamp(),
    worldId,
    kind,
    name: '',
    tagline: '',
    group: info.group,
    specs: info.specs.map((label) => ({ label, value: '' })),
    about: '',
    pinned: false,
    ...input,
  };
  useVault.getState().put('entries', entry);
  return entry;
}

export function updateEntry(id: string, changes: Partial<Entry>) {
  useVault.getState().patch('entries', id, changes);
}

export function addRelationship(worldId: string, fromId: string, toId: string, label: string, input: Partial<Relationship> = {}): Relationship {
  const relationship: Relationship = { ...stamp(), worldId, fromId, toId, label, ...input };
  useVault.getState().put('relationships', relationship);
  return relationship;
}

// ── The timeline ──────────────────────────────────────────────────────────

export function createStoryline(worldId: string, input: Partial<Storyline> = {}): Storyline {
  const existing = live(vault().storylines).filter((s) => s.worldId === worldId);
  const storyline: Storyline = {
    ...stamp(),
    worldId,
    name: 'New Storyline',
    color: ((existing.length % 6) + 1) as Storyline['color'],
    order: nextOrder(existing.map((s) => s.order)),
    ...input,
  };
  useVault.getState().put('storylines', storyline);
  return storyline;
}

export function updateStoryline(id: string, changes: Partial<Storyline>) {
  useVault.getState().patch('storylines', id, changes);
}

export function createEvent(worldId: string, storylineId: string, input: Partial<TimelineEvent> = {}): TimelineEvent {
  const event: TimelineEvent = { ...stamp(), worldId, storylineId, title: 'New Event', summary: '', year: 0, when: '', links: [], ...input };
  useVault.getState().put('events', event);
  return event;
}

export function updateEvent(id: string, changes: Partial<TimelineEvent>) {
  useVault.getState().patch('events', id, changes);
}

// ── Any record ───────────────────────────────────────────────────────────

/** Changes any record: the screens of Filmmaking and Tabletop edit their records in place with this. */
export function updateRecord<C extends Collection>(collection: C, id: string, changes: Partial<RecordOf<C>>) {
  useVault.getState().patch(collection, id, changes);
}

// ── Filmmaking ───────────────────────────────────────────────────────────

export function createShot(worldId: string, sceneId: string, input: Partial<Shot> = {}): Shot {
  const shot: Shot = {
    ...stamp(),
    worldId,
    sceneId,
    order: nextOrder(live(vault().shots).filter((s) => s.sceneId === sceneId).map((s) => s.order)),
    size: 'MS',
    move: 'Static',
    lens: '',
    description: '',
    seconds: 5,
    status: 'planned',
    ...input,
  };
  useVault.getState().put('shots', shot);
  return shot;
}

export function createShootDay(worldId: string, input: Partial<ShootDay> = {}): ShootDay {
  const day: ShootDay = { ...stamp(), worldId, date: today(), call: '08:00', placeId: null, sceneIds: [], notes: '', done: false, ...input };
  useVault.getState().put('shootDays', day);
  return day;
}

export function createBudgetLine(worldId: string, kind: BudgetLine['kind'], input: Partial<BudgetLine> = {}): BudgetLine {
  const line: BudgetLine = {
    ...stamp(),
    worldId,
    kind,
    category: kind === 'cost' ? 'Equipment' : 'Sponsorship',
    item: '',
    estimate: 0,
    actual: 0,
    order: nextOrder(live(vault().budget).filter((l) => l.worldId === worldId && l.kind === kind).map((l) => l.order)),
    ...input,
  };
  useVault.getState().put('budget', line);
  return line;
}

// ── Tabletop ──────────────────────────────────────────────────────────────────

export function createPc(worldId: string | null, input: Partial<PlayerCharacter> = {}): PlayerCharacter {
  const pc: PlayerCharacter = {
    ...stamp(),
    worldId,
    name: '',
    player: '',
    species: '',
    className: '',
    subclass: '',
    background: '',
    level: 1,
    abilities: { ...DEFAULT_ABILITIES },
    saves: [],
    skills: [],
    expertise: [],
    hp: { max: 10, current: 10, temp: 0 },
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    slots: Array.from({ length: 9 }, () => [0, 0] as [number, number]),
    deathSaves: { successes: 0, failures: 0 },
    inspiration: false,
    conditions: [],
    attacks: [],
    spells: [],
    inventory: [],
    features: '',
    notes: '',
    ...input,
  };
  useVault.getState().put('pcs', pc);
  return pc;
}

/** A map of an imported image (or a data: URL): a campaign's, or (characterId) a character's own. */
export function createMap(input: Pick<GameMap, 'worldId' | 'characterId' | 'name' | 'image' | 'width' | 'height'> & Partial<GameMap>): GameMap {
  const map: GameMap = {
    ...stamp(),
    pins: [],
    order: nextOrder(live(vault().maps).map((m) => m.order)),
    ...input,
  };
  useVault.getState().put('maps', map);
  return map;
}

/** A creature for the campaign's Bestiary (worldId), or a player's own (worldId null, with `characterId`). */
export function createMonster(worldId: string | null, input: Partial<Monster> = {}): Monster {
  const monster: Monster = {
    ...stamp(),
    worldId,
    name: '',
    kind: '',
    ac: 12,
    hp: 10,
    hpDice: '',
    speed: '30 ft.',
    abilities: { ...DEFAULT_ABILITIES },
    cr: '1',
    traits: '',
    actions: [],
    ...input,
  };
  useVault.getState().put('monsters', monster);
  return monster;
}

export function createEncounter(worldId: string, input: Partial<Encounter> = {}): Encounter {
  const encounter: Encounter = { ...stamp(), worldId, name: 'New Encounter', notes: '', combatants: [], round: 0, turn: 0, ...input };
  useVault.getState().put('encounters', encounter);
  return encounter;
}

/** A combatant, with its own id within the encounter. */
export function combatant(input: Omit<Combatant, 'id'>): Combatant {
  return { id: newId(), ...input };
}

// ── Deleting ──────────────────────────────────────────────────────────────

/** Soft-deletes a record; `restore` undoes it (the toasts' Undo). */
export function trash(collection: Collection, id: string) {
  useVault.getState().remove(collection, id);
}

export function restore(collection: Collection, id: string) {
  useVault.getState().restore(collection, id);
}

/** Deletes a part with its scenes; returns the scenes' ids so Undo can bring them back too. */
export function trashPart(id: string): string[] {
  const scenes = live(vault().scenes).filter((s) => s.partId === id);
  for (const scene of scenes) trash('scenes', scene.id);
  trash('parts', id);
  return scenes.map((s) => s.id);
}

/** Settings → Data → Remove Starter Content: the sample world, production and campaign, and everything in them. */
export function removeSampleContent() {
  for (const collection of COLLECTIONS) {
    for (const record of Object.values(vault()[collection])) if (record.sample) useVault.getState().purge(collection, record.id);
  }
}

// ── Handwriting ──────────────────────────────────────────────────────────

/** A sheet of handwriting (a Handwriting block's, a research note's, an entry's, Play's scratchpad), empty or a copy of `from`. */
export function createInk(pageId: string | null, from?: Partial<Pick<Ink, 'height' | 'background' | 'strokes' | 'image' | 'hidden' | 'researchId' | 'entryId' | 'scratchFor' | 'worldId'>>): Ink {
  const { height, background, strokes, image, hidden, researchId, entryId, scratchFor, worldId } = structuredClone(from ?? {});
  const ink: Ink = {
    ...stamp(),
    pageId,
    height: height ?? 300,
    background: background ?? 'blank',
    strokes: strokes ?? [],
    ...(image ? { image } : {}),
    ...(hidden ? { hidden } : {}),
    ...(researchId ? { researchId } : {}),
    ...(entryId ? { entryId } : {}),
    ...(scratchFor ? { scratchFor } : {}),
    ...(worldId ? { worldId } : {}),
  };
  useVault.getState().put('inks', ink);
  return ink;
}
