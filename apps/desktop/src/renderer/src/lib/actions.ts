/**
 * actions.ts — creating and changing records. Screens call these; they go
 * through the vault store's put / patch / remove, so every change is saved
 * and stamped. Deletes are soft: the toast that follows can undo them.
 */
import { today } from '@/lib/dates';
import {
  byOrder,
  COLLECTIONS,
  live,
  newId,
  now,
  type Book,
  type Collection,
  type Entry,
  type EntryKind,
  type Part,
  type Relationship,
  type Scene,
  type Storyline,
  type TimelineEvent,
  type World,
} from '@/lib/model';
import { blocksLinks, blocksToText, wordCount } from '@/lib/text';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

const vault = () => useVault.getState().vault;
const nextOrder = (orders: number[]) => (orders.length ? Math.max(...orders) + 1 : 0);

// ── Worlds ────────────────────────────────────────────────────────────────

/** The open world: the one picked last, else the first. */
export function activeWorld(): World | undefined {
  const worlds = live(vault().worlds).sort(byOrder);
  const id = usePreferences.getState().worldId;
  return worlds.find((w) => w.id === id) ?? worlds[0];
}

export function openWorld(id: string) {
  usePreferences.getState().setPreference('worldId', id);
}

/** A new world with a first book, act and scene, so there's somewhere to start writing. Opens it. */
export function createWorld(input: Partial<World> = {}): { world: World; scene: Scene } {
  const world: World = {
    ...stamp(),
    name: 'Untitled World',
    genre: '',
    era: '',
    summary: '',
    order: nextOrder(live(vault().worlds).map((w) => w.order)),
    ...input,
  };
  useVault.getState().put('worlds', world);
  const scene = startBook(world.id);
  openWorld(world.id);
  return { world, scene };
}

export function updateWorld(id: string, changes: Partial<World>) {
  useVault.getState().patch('worlds', id, changes);
}

// ── The manuscript ────────────────────────────────────────────────────────

export function createBook(worldId: string, input: Partial<Book> = {}): Book {
  const book: Book = {
    ...stamp(),
    worldId,
    title: 'Book One',
    partNoun: 'Act',
    targetWords: 90_000,
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
  const scene: Scene = {
    ...stamp(),
    bookId,
    partId,
    title: '',
    status: 'draft',
    order: nextOrder(live(vault().scenes).filter((s) => s.partId === partId).map((s) => s.order)),
    povId: null,
    placeId: null,
    when: '',
    note: '',
    targetWords: 2000,
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

const DEFAULT_GROUP: Record<EntryKind, string> = { character: 'Main Cast', place: 'Places', lore: 'Lore' };
const DEFAULT_SPECS: Record<EntryKind, string[]> = {
  character: ['Age', 'Occupation', 'Home', 'Wants', 'Fears'],
  place: ['Region', 'Population', 'Known For'],
  lore: ['Category', 'Known To'],
};

export function createEntry(worldId: string, kind: EntryKind, input: Partial<Entry> = {}): Entry {
  const entry: Entry = {
    ...stamp(),
    worldId,
    kind,
    name: '',
    tagline: '',
    group: DEFAULT_GROUP[kind],
    specs: DEFAULT_SPECS[kind].map((label) => ({ label, value: '' })),
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

/** Settings → Data → Remove Starter Content: the sample world and everything in it. */
export function removeSampleContent() {
  for (const collection of COLLECTIONS) {
    for (const record of Object.values(vault()[collection])) if (record.sample) useVault.getState().purge(collection, record.id);
  }
}
