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
 * Every world belongs to one of the app's three sections (lib/sections.ts):
 * Writing (a world), Filmmaking (a production: its script is a book, plus
 * shots, shoot days and a budget) or Tabletop (a campaign: its session log is a
 * book, plus player characters, monsters and encounters).
 *
 * Bump VAULT_VERSION and add a step to migrate() in lib/migrate.ts when a
 * shape changes.
 */

export const VAULT_VERSION = 5;

// The Writing modules' own records (each in its folder under writing/).
import type { Arc } from '@/writing/arcs/model';
import type { WorldCalendar } from '@/writing/calendar/model';
import type { LexiconWord, LoreType } from '@/writing/lore/model';
import type { Revision, SceneComment } from '@/writing/manuscript/model';
import type { WritingMap } from '@/writing/maps/model';
import type { ResearchNote } from '@/writing/research/model';
import type { BreakdownItem } from '@/film/breakdown/model';
import type { CallSheet } from '@/film/callsheets/model';
import type { GearItem } from '@/film/gear/model';
import type { Cut, MusicCue, VfxShot } from '@/film/post/model';
import type { ReleaseForm } from '@/film/releases/model';
import type { ScriptDetails, ScriptSnapshot } from '@/film/script/model';
import type { Stroke } from '@/film/storyboard/model';

export type BaseRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  /** Starter content made on first run; Settings → Data can remove it. */
  sample?: boolean;
};

/** The app's top-level sections, switched from the world menu. */
export const SECTIONS = ['writing', 'film', 'tabletop'] as const;
export type Section = (typeof SECTIONS)[number];

export const FILM_FORMATS = ['YouTube Video', 'YouTube Short', 'Short Film', 'Feature Film', 'Series Episode', 'Commercial', 'Documentary'] as const;
export const FILM_STAGES = ['idea', 'preProduction', 'production', 'post', 'released'] as const;
export type FilmStage = (typeof FILM_STAGES)[number];

/** A production's details (Filmmaking). */
export type FilmDetails = {
  format: string;
  stage: FilmStage;
  /** Minutes the finished cut should run (0: not set). */
  targetMinutes: number;
  /** Day key, or '' (the release / publish date). */
  releaseDate: string;
  /** The release's own copy: the video title, description and tags as they'll be published. */
  releaseTitle: string;
  releaseDescription: string;
  tags: string;
  /** Deliverables to tick off on the way to release. */
  checklist: { label: string; done: boolean }[];
};

/** A session on the calendar: its day, start ("19:00", or the table's usual) and a title. */
export type ScheduledSession = { id: string; date: string; time?: string; title?: string };

/** Who you are at the table: the GM, or a player. */
export type TabletopRole = 'gm' | 'player';

/** A campaign's details (Tabletop). Whether you're its GM or a player is yours, not the campaign's (preferences: tabletopRoles). */
export type TabletopDetails = {
  /** Day key, or '' (the next session). */
  nextSession: string;
  /** When the table usually starts, "19:00" (or ''). */
  sessionTime?: string;
  /** Sessions the GM put on the calendar (the players see them too). */
  schedule?: ScheduledSession[];
  /** The rules the table uses ("5e", "5e (2024)", homebrew): a label only. */
  ruleset: string;
};

export type World = BaseRecord & {
  section: Section;
  name: string;
  /** "Low Fantasy", "Space Opera": shown on the world's faceplate. */
  genre: string;
  /** The world's own "now" ("402 A.F."). */
  era: string;
  summary: string;
  order: number;
  film?: FilmDetails;
  tabletop?: TabletopDetails;
  /** Folder names by list ('character', 'place', 'lore', 'crew', 'maps'), in order, kept even while empty. (Before spaces: read once to set up `layouts`.) */
  folders?: Record<string, string[]>;
  /** How each list's sidebar is arranged ('npc', 'place', 'lore', 'maps'…): its spaces, their folders, and what's in each, in order. */
  layouts?: Record<string, Layout>;
  /** Writing: the world's own calendar (writing/calendar), if it has one. */
  calendar?: WorldCalendar;
  /** Writing: where you've dragged entries on the relationship web (writing/relationships), 0–1 across and down. */
  web?: Record<string, { x: number; y: number }>;
};

/**
 * A sidebar's arrangement (lib/layout): spaces ("Allies", "Villains"), each
 * with its folders and its loose items, everything by id and in order. Items
 * it doesn't name yet (new ones) go where their old group says, or the first
 * space.
 */
export type Layout = { spaces: LayoutSpace[] };
export type LayoutSpace = { id: string; name: string; folders: LayoutFolder[]; items: string[] };
export type LayoutFolder = { id: string; name: string; items: string[] };

/** What a book calls its top-level divisions. */
export const PART_NOUNS = ['Act', 'Part', 'Book', 'Chapter', 'Sequence', 'Episode', 'Arc'] as const;
export type PartNoun = (typeof PART_NOUNS)[number];

export type Book = BaseRecord & {
  worldId: string;
  title: string;
  partNoun: PartNoun;
  /** The draft's word goal (0: none). */
  targetWords: number;
  order: number;
  /** Tabletop: whose book it is. The GM's session log (unset), or a player's journal: each view sees only its own. */
  audience?: TabletopRole;
  /** A player's journal: the character it's kept by (a journal goes with its character, campaign or not). */
  characterId?: string;
  /** Filmmaking: the script's title page, lock and revision rounds (film/script). */
  script?: ScriptDetails;
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
  /** Tabletop: a free-standing note (a quest, a clue, an NPC to remember) rather than a session. Notes sit in no part (partId ''). */
  kind?: 'note';
  /** A note's category (NOTE_CATEGORIES). */
  category?: NoteCategory;
  /** Kept at the top of the notes list. */
  pinned?: boolean;
  /** Things to tick off: the GM's secrets and clues, a player's leads, a note's to-dos. */
  checklist?: ChecklistItem[];
  /** Entries added by hand, besides the ones the text mentions. */
  tagged?: string[];
  /** Tabletop (GM): the campaign's encounters planned for this session. */
  encounterIds?: string[];
};

export type ChecklistItem = { id: string; text: string; done: boolean };

/** What a Tabletop note is about. */
export const NOTE_CATEGORIES = ['general', 'quest', 'npc', 'place', 'clue', 'loot', 'lore', 'todo'] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

/** The world bible's kinds: each is a module in the rail (labeled per section: lib/sections.ts). Crew is Filmmaking's. */
export const ENTRY_KINDS = ['character', 'place', 'lore', 'crew'] as const;
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
  /** Tabletop, before sharing: for the GM's eyes only. (Players now see only what's shared with them: Share.) */
  secret?: boolean;
  /** A picture (a file beside the vault: lib/media.ts), shown in place of the initials. */
  image?: string;
  /** A player's view of an entry shared with them (lib/shared adds it; never saved). */
  via?: SharedVia;
  /** Writing lore: what it is (writing/lore), which gives it its fields. */
  loreType?: LoreType;
  /** Writing lore, a language: its words, and how it works. */
  lexicon?: LexiconWord[];
  grammar?: string;
  /** Filmmaking locations: scouting photos (film/locations). */
  photos?: string[];
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
  /** Writing: the day in the world's calendar (writing/calendar), within `year`. */
  month?: number;
  day?: number;
};

/** Words written on a day (the id is the day key), for the week's meter and streaks. */
export type DayLog = BaseRecord & { words: number };

// ── Filmmaking ───────────────────────────────────────────────────────────

export const SHOT_SIZES = ['EWS', 'WS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV', 'Insert'] as const;
export const SHOT_MOVES = ['Static', 'Pan', 'Tilt', 'Dolly', 'Tracking', 'Handheld', 'Gimbal', 'Crane', 'Drone', 'Zoom'] as const;
export const SHOT_STATUSES = ['planned', 'shot', 'cut'] as const;
export type ShotStatus = (typeof SHOT_STATUSES)[number];

/** One shot of a script scene. */
export type Shot = BaseRecord & {
  worldId: string;
  sceneId: string;
  order: number;
  size: string;
  move: string;
  lens: string;
  description: string;
  /** Seconds it should run on screen. */
  seconds: number;
  status: ShotStatus;
  /** Its storyboard frame: a picture (film/storyboard). */
  frame?: string;
  /** The sketch the frame was drawn as, to draw on again. */
  sketch?: Stroke[];
};

/** A day of shooting: when, where, and which script scenes. */
export type ShootDay = BaseRecord & {
  worldId: string;
  /** Day key. */
  date: string;
  /** "HH:mm". */
  call: string;
  placeId: string | null;
  sceneIds: string[];
  notes: string;
  done: boolean;
  /** Its call sheet: everyone's calls, the day's times, safety (film/callsheets). */
  sheet?: CallSheet;
};

export const COST_CATEGORIES = ['Cast', 'Crew', 'Equipment', 'Locations', 'Props & Wardrobe', 'Post-Production', 'Music & Licensing', 'Marketing', 'Travel', 'Other'] as const;
export const INCOME_CATEGORIES = ['Sponsorship', 'Ad Revenue', 'Licensing', 'Grants', 'Crowdfunding', 'Other'] as const;

/** A budget line: money going out (cost) or coming in (income). */
export type BudgetLine = BaseRecord & {
  worldId: string;
  kind: 'cost' | 'income';
  category: string;
  item: string;
  estimate: number;
  actual: number;
  order: number;
};

// ── Tabletop ──────────────────────────────────────────────────────────────────

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export type Abilities = Record<Ability, number>;

/** Something a character carries. Weight is each, in pounds; equipped: worn or in hand; attuned: a magic item bound to them (three at most). */
export type Item = { name: string; qty: number; weight?: number; equipped?: boolean; attuned?: boolean; notes?: string };

/**
 * A feature or trait (Second Wind, Darkvision, a feat): what it does, and if
 * it's limited, its uses (ticked off like spell slots, back on a short or long
 * rest) and a roll ("1d10+3").
 */
export type Feature = {
  id: string;
  name: string;
  /** Where it's from: Species, Class, Subclass, Background, Feat, Other. */
  source: string;
  text: string;
  uses?: { max: number; used: number; reset: 'short' | 'long' | 'none' } | null;
  roll?: string;
  /** How it's used in a turn (listed in Actions too), or passive. */
  action?: 'action' | 'bonus' | 'reaction' | 'passive';
};

export const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
export type Coin = (typeof COINS)[number];

/** A player character's sheet. */
export type PlayerCharacter = BaseRecord & {
  /** The campaign they're in, or null: a character needn't be in one. */
  worldId: string | null;
  /** One of yours: you play them (Player view). The others are the party's, kept by the GM. */
  mine?: boolean;
  /** A folder of yours to keep them in ("One-shots", "Retired"), or none. */
  folder?: string;
  /** Put away in the archive (out of the menus, kept whole): when, or unset. */
  archivedAt?: string | null;
  /** A portrait (a file beside the vault), shown in place of the initials. */
  image?: string;
  /** Sessions this player put on their own calendar (only they see them). */
  schedule?: ScheduledSession[];
  /** The folders of this character's own maps, in order. (Before spaces: read once to set up `layouts.maps`.) */
  mapFolders?: string[];
  /**
   * This player's own arrangement of their sidebars: their maps ('maps'), and
   * the campaign's NPCs, places and lore as they like them (to start, the
   * GM's). The GM's arrangement isn't changed by it.
   */
  layouts?: Record<string, Layout>;
  name: string;
  /** Who plays them. */
  player: string;
  species: string;
  className: string;
  subclass: string;
  background: string;
  level: number;
  abilities: Abilities;
  saves: Ability[];
  /** Skill names (lib/tabletop.ts SKILLS) with proficiency; expertise doubles it. */
  skills: string[];
  expertise: string[];
  hp: { max: number; current: number; temp: number };
  ac: number;
  speed: number;
  /** Added to the DEX modifier for initiative (feats, items). */
  initiativeBonus: number;
  /** Spell slots per level 1-9: [max, used]. */
  slots: [number, number][];
  deathSaves: { successes: number; failures: number };
  inspiration: boolean;
  conditions: string[];
  attacks: { name: string; bonus: number; damage: string }[];
  spells: { name: string; level: number; prepared: boolean }[];
  inventory: Item[];
  /** Coins by kind (unset: none yet). */
  currency?: Record<Coin, number>;
  /** The ability they cast spells with (spell save DC, spell attack), or none. */
  spellcasting?: Ability | null;
  /** Armor, weapons, tools and languages they're trained in. */
  proficiencies?: string;
  /** Features & traits, one by one. */
  traits?: Feature[];
  /** More features & traits, as free text (all a sheet had before `traits`). */
  features: string;
  notes: string;
  /** The SRD's species, class and subclass they were built from (lib/compendium/classes.ts), for leveling up. */
  speciesId?: string;
  classId?: string;
  subclassId?: string;
  /** The class's hit die (d8: 8). */
  hitDie?: number;
};

/**
 * A creature's stat block (homebrew, or copied from your own books). A
 * campaign's (worldId, no characterId: the GM's, which they can share with the
 * players) or one of your characters' own (characterId, worldId null).
 */
export type Monster = BaseRecord & {
  /** A player's view of a creature shared with them (lib/shared adds it; never saved). */
  via?: SharedVia;
  worldId: string | null;
  characterId?: string | null;
  name: string;
  /** "Medium undead, neutral evil". */
  kind: string;
  ac: number;
  hp: number;
  /** "4d8 + 4". */
  hpDice: string;
  speed: string;
  abilities: Abilities;
  cr: string;
  traits: string;
  actions: { name: string; text: string }[];
  /** A picture of it (a file beside the vault). */
  image?: string;
};

/** Someone in an encounter's initiative order. A player character's HP is the sheet's own. */
export type Combatant = {
  id: string;
  kind: 'pc' | 'monster' | 'other';
  /** The PlayerCharacter or Monster it comes from. */
  refId: string | null;
  name: string;
  initiative: number | null;
  ac: number;
  hp: number;
  maxHp: number;
  conditions: string[];
};

export type Encounter = BaseRecord & {
  worldId: string;
  name: string;
  notes: string;
  combatants: Combatant[];
  /** 0: not started. */
  round: number;
  /** Whose turn it is: an index into the initiative order. */
  turn: number;
};

export const PIN_TONES = ['place', 'party', 'danger', 'note'] as const;
export type PinTone = (typeof PIN_TONES)[number];

/** A pin on a map: where (0-1 across and down the image), what, and (GM) whether players see it. */
export type MapPin = { id: string; x: number; y: number; label: string; note: string; tone: PinTone; gmOnly?: boolean };

/**
 * A map: an image (a file in the vault's maps folder, or a data: URL) and its
 * pins. A campaign's (worldId, characterId null: the GM's, shared with the
 * players) or one of your characters' own (characterId).
 */
export type GameMap = BaseRecord & {
  /** A player's view of a map shared with them (lib/shared adds it; never saved). */
  via?: SharedVia;
  worldId: string | null;
  characterId: string | null;
  name: string;
  image: string;
  width: number;
  height: number;
  pins: MapPin[];
  order: number;
  /** The folder it's kept in, or none. */
  folder?: string;
};

// ── The compendium (the Spells and Inventory pages) ───────────────────────

/** A spell as the compendium lists it (lib/compendium). */
export type SpellInfo = {
  name: string;
  /** 0: a cantrip. */
  level: number;
  school: string;
  castingTime: string;
  range: string;
  /** "V, S, M (a pinch of soot)". */
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  /** The classes that can learn it. */
  classes: string[];
  text: string;
  /** At Higher Levels. */
  higher: string;
};

export const ITEM_CATEGORIES = ['Weapon', 'Armor', 'Gear', 'Tools', 'Mounts & Vehicles', 'Magic Item'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'] as const;

/** An item as the compendium lists it. */
export type ItemInfo = {
  name: string;
  category: ItemCategory;
  /** "Martial Melee Weapon", "Wondrous item, rare". */
  type: string;
  /** A magic item's (RARITIES), or ''. */
  rarity: string;
  attunement: boolean;
  /** "15 gp", or ''. */
  cost: string;
  /** Pounds (0: not listed). */
  weight: number;
  /** "1d8 slashing · Versatile (1d10)", "AC 16 · Str 13". */
  stats: string;
  text: string;
};

/**
 * Your spells and items in the compendium: homebrew, or your edit of an SRD
 * one (`srd`: the SRD entry it replaces). `hidden`: an SRD entry you removed
 * from the list (deleting your own is a plain delete).
 */
export type SpellRecord = BaseRecord & SpellInfo & { srd?: string; hidden?: boolean };
export type ItemRecord = BaseRecord & ItemInfo & { srd?: string; hidden?: boolean };

/**
 * A picture for something that isn't a record of its own: a spell, an item,
 * a Library entry (SRD, Kobold Press…). Its id is that thing's id.
 */
export type Picture = BaseRecord & { image: string; name?: string };

// ── Sharing (Tabletop): what the GM has given the players ──────────────────────

/** What can be shared: the world bible's entries (NPCs, places, lore), maps and Bestiary creatures. */
export type ShareCollection = 'entries' | 'maps' | 'monsters';

/** Where a shared thing sat in the GM's sidebar, sent along when the GM shares the structure too. */
export type SharedPlace = { space: string; folder?: string };

/**
 * A thing the GM shared: a copy of it as it was then (`snapshot`: its content,
 * not the record), and who has it. The players see the snapshot, never the
 * GM's live record; Update Shared sends a new one. One per thing shared.
 */
export type Share = BaseRecord & {
  worldId: string;
  collection: ShareCollection;
  /** The GM's record it's a copy of. */
  sourceId: string;
  snapshot: Record<string, unknown>;
  /** 1 when first shared; one more each Update Shared. */
  version: number;
  /** The characters (pcs) it's shared with. */
  recipients: string[];
  /** Its space and folder in the GM's sidebar, if the GM shared the structure too: where it starts out in the players'. */
  place?: SharedPlace;
  /**
   * When the GM deleted the original. The players who had made their own
   * version keep it (they're the recipients left); nobody gets the GM's any more.
   */
  ended?: string;
};

/**
 * One player's own state of a thing shared with them: their edits (once
 * they've unlocked it), which version shows (the GM's original or theirs:
 * they can switch back and forth), and their pin. Its id is `${shareId}:${pcId}`.
 */
export type SharedCopy = BaseRecord & {
  shareId: string;
  pcId: string;
  edited?: Record<string, unknown>;
  showing: 'original' | 'edited';
  pinned?: boolean;
  /** The share's version this player last saw (to say the GM has updated it). */
  seen?: number;
};

/** How a shared thing reaches a player, on the record they see (never saved). */
export type SharedVia = {
  shareId: string;
  showing: 'original' | 'edited';
  /** The player has a version of their own. */
  edited: boolean;
  /** The GM sent an update since the player last looked. */
  updated: boolean;
  /** The GM deleted the original: only the player's own version is left. */
  ended?: boolean;
  /** Entries: the relationships as shared (to other entries, by id). */
  links?: SharedLink[];
};

export type SharedLink = { otherId: string; label: string; outgoing: boolean };

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
  shots: Record<string, Shot>;
  shootDays: Record<string, ShootDay>;
  budget: Record<string, BudgetLine>;
  pcs: Record<string, PlayerCharacter>;
  monsters: Record<string, Monster>;
  encounters: Record<string, Encounter>;
  maps: Record<string, GameMap>;
  spells: Record<string, SpellRecord>;
  items: Record<string, ItemRecord>;
  pictures: Record<string, Picture>;
  shares: Record<string, Share>;
  copies: Record<string, SharedCopy>;
  writingMaps: Record<string, WritingMap>;
  arcs: Record<string, Arc>;
  research: Record<string, ResearchNote>;
  revisions: Record<string, Revision>;
  comments: Record<string, SceneComment>;
  scriptSnapshots: Record<string, ScriptSnapshot>;
  breakdown: Record<string, BreakdownItem>;
  gear: Record<string, GearItem>;
  releases: Record<string, ReleaseForm>;
  vfx: Record<string, VfxShot>;
  cues: Record<string, MusicCue>;
  cuts: Record<string, Cut>;
};

export type Collection = Exclude<keyof Vault, 'version'>;
export type RecordOf<C extends Collection> = Vault[C][string];

export const COLLECTIONS: Collection[] = ['worlds', 'books', 'parts', 'scenes', 'entries', 'relationships', 'storylines', 'events', 'days', 'shots', 'shootDays', 'budget', 'pcs', 'monsters', 'encounters', 'maps', 'spells', 'items', 'pictures', 'shares', 'copies', 'writingMaps', 'arcs', 'research', 'revisions', 'comments', 'scriptSnapshots', 'breakdown', 'gear', 'releases', 'vfx', 'cues', 'cuts'];

/** The collections whose records belong to a world (worldId). */
export type WorldCollection = 'books' | 'entries' | 'relationships' | 'storylines' | 'events' | 'shots' | 'shootDays' | 'budget' | 'pcs' | 'monsters' | 'encounters' | 'maps' | 'shares' | 'writingMaps' | 'arcs' | 'research' | 'revisions' | 'comments' | 'scriptSnapshots' | 'breakdown' | 'gear' | 'releases' | 'vfx' | 'cues' | 'cuts';

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
    shots: {},
    shootDays: {},
    budget: {},
    pcs: {},
    monsters: {},
    encounters: {},
    maps: {},
    spells: {},
    items: {},
    pictures: {},
    shares: {},
    copies: {},
    writingMaps: {},
    arcs: {},
    research: {},
    revisions: {},
    comments: {},
    scriptSnapshots: {},
    breakdown: {},
    gear: {},
    releases: {},
    vfx: {},
    cues: {},
    cuts: {},
  };
}

export const now = () => new Date().toISOString();

export const newId = () => crypto.randomUUID();

/** The records of a map that aren't deleted. */
export function live<T extends BaseRecord>(records: Record<string, T>): T[] {
  return Object.values(records).filter((r) => !r.deletedAt);
}

export const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
