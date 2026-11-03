/**
 * model.ts — the shapes of everything in the vault.
 *
 * Every record has an id, createdAt / updatedAt and an optional deletedAt
 * (deletes are soft, so a future sync server can tell "deleted" from "never
 * seen"). Dates without a time are local day keys, "2026-11-02"; timestamps
 * are ISO strings.
 *
 * A world holds everything else: its books (each split into parts, each part
 * into scenes), its world bible (characters, places and lore, all "entries"),
 * the relationships between entries, and its timeline (storylines and
 * events). The words you write each day are logged in `days`.
 *
 * Bump VAULT_VERSION and add a step to migrate() in lib/migrate.ts when a
 * shape changes.
 */

export const VAULT_VERSION = 1;

export type BaseRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  /** Starter content made on first run; Settings → Data can remove it. */
  sample?: boolean;
};

export type World = BaseRecord & {
  name: string;
  /** "Low Fantasy", "Space Opera": shown on the world's faceplate. */
  genre: string;
  /** The world's own "now" ("402 A.F."). */
  era: string;
  summary: string;
  order: number;
};

/** What a book calls its top-level divisions. */
export const PART_NOUNS = ['Act', 'Part', 'Book', 'Chapter'] as const;
export type PartNoun = (typeof PART_NOUNS)[number];

export type Book = BaseRecord & {
  worldId: string;
  title: string;
  partNoun: PartNoun;
  /** The draft's word goal (0: none). */
  targetWords: number;
  order: number;
};

/** An act, part or chapter: a run of scenes. */
export type Part = BaseRecord & {
  bookId: string;
  title: string;
  order: number;
};

export const SCENE_STATUSES = ['idea', 'outline', 'draft', 'done'] as const;
export type SceneStatus = (typeof SCENE_STATUSES)[number];

export type Scene = BaseRecord & {
  bookId: string;
  partId: string;
  title: string;
  status: SceneStatus;
  order: number;
  /** The point-of-view character (an entry). */
  povId: string | null;
  /** Where it happens (an entry). */
  placeId: string | null;
  /** When it happens, in the world's own calendar ("402 A.F. · 9th Tide"). */
  when: string;
  /** A note to yourself, beside the scene. */
  note: string;
  /** The scene's word goal (0: none). */
  targetWords: number;
  /** BlockNote's document (an array of blocks). */
  content: unknown[];
  /** Plain text of the content, kept for search and previews. */
  text: string;
  words: number;
  /** Entries this scene mentions (@ and #), kept for "Appears In" and "In This Scene". */
  links: string[];
};

/** The world bible's kinds: each is a module in the rail. */
export const ENTRY_KINDS = ['character', 'place', 'lore'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** A spec-sheet row ("Occupation ····· Lamplighter"). */
export type Spec = { label: string; value: string };

export type Entry = BaseRecord & {
  worldId: string;
  kind: EntryKind;
  name: string;
  /** One line under the name ("Lamplighter of the Causeway"). */
  tagline: string;
  /** Characters: Main Cast, Supporting, Minor. Places: a region. Lore: a category. */
  group: string;
  specs: Spec[];
  /** Free text: who they are, what it is. */
  about: string;
  pinned: boolean;
};

/** A link between two entries (Ines → Tomas: "Brother"). Shown on both. */
export type Relationship = BaseRecord & {
  worldId: string;
  fromId: string;
  toId: string;
  /** How `fromId` is to `toId` ("Younger brother"). */
  label: string;
};

/** The palette storylines take their colors from (styles/globals.css: --story-1…6). */
export const STORY_COLORS = [1, 2, 3, 4, 5, 6] as const;
export type StoryColor = (typeof STORY_COLORS)[number];

/** A lane on the timeline: one character's journey, a faction, a place's history. */
export type Storyline = BaseRecord & {
  worldId: string;
  name: string;
  color: StoryColor;
  order: number;
};

export type TimelineEvent = BaseRecord & {
  worldId: string;
  storylineId: string;
  title: string;
  summary: string;
  /** The year in the world's calendar: where it sits on the timeline. */
  year: number;
  /** Finer than the year, as you'd say it ("9th Tide"). */
  when: string;
  /** Entries it involves. */
  links: string[];
};

/** Words written on a day (the id is the day key), for the week's meter and streaks. */
export type DayLog = BaseRecord & { words: number };

export type Vault = {
  version: number;
  worlds: Record<string, World>;
  books: Record<string, Book>;
  parts: Record<string, Part>;
  scenes: Record<string, Scene>;
  entries: Record<string, Entry>;
  relationships: Record<string, Relationship>;
  storylines: Record<string, Storyline>;
  events: Record<string, TimelineEvent>;
  days: Record<string, DayLog>;
};

export type Collection = Exclude<keyof Vault, 'version'>;
export type RecordOf<C extends Collection> = Vault[C][string];

export const COLLECTIONS: Collection[] = ['worlds', 'books', 'parts', 'scenes', 'entries', 'relationships', 'storylines', 'events', 'days'];

export function emptyVault(): Vault {
  return {
    version: VAULT_VERSION,
    worlds: {},
    books: {},
    parts: {},
    scenes: {},
    entries: {},
    relationships: {},
    storylines: {},
    events: {},
    days: {},
  };
}

export const now = () => new Date().toISOString();

export const newId = () => crypto.randomUUID();

/** The records of a map that aren't deleted. */
export function live<T extends BaseRecord>(records: Record<string, T>): T[] {
  return Object.values(records).filter((r) => !r.deletedAt);
}

export const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
