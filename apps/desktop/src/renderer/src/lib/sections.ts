/**
 * sections.ts — the app's three sections and what each calls things.
 *
 *   Writing      worlds: books of acts and scenes, characters, places, lore, a timeline
 *   Filmmaking   productions: a script of sequences and scenes, shots, shoot days, a budget, cast, crew, locations
 *   Tabletop          campaigns: a session log, the party's sheets, encounters, a bestiary, NPCs, places, lore, a timeline
 *
 * They share one model (lib/model.ts): a production or campaign is a World
 * with its `section` set, its script or session log is a Book, its cast or
 * NPCs are character entries. The screens read their words from here.
 */
import type { TabletopDetails, EntryKind, FilmDetails, FilmStage, SceneStatus, Section } from './model';

export type KindInfo = {
  plural: string;
  singular: string;
  /** The faceplate code's prefix ("CHR-001"). */
  code: string;
  /** Usual groups, in order (others sort after them by name). */
  groups: string[];
  /** A new entry's group and spec rows. */
  group: string;
  specs: string[];
  /** The empty state's line. */
  empty: string;
  /** The tagline's placeholder. */
  tagline: string;
};

export type SectionInfo = {
  label: string;
  /** What a world is called here. */
  container: string;
  containers: string;
  /** The faceplate code's prefix ("WLD-001"). */
  code: string;
  blurb: string;
  /** The world-bible kinds this section uses, in rail order. */
  kinds: EntryKind[];
  /** A new book's defaults: the script (Filmmaking) or session log (Tabletop). */
  book: { title: string; partNoun: 'Act' | 'Sequence' | 'Arc'; targetWords: number; sceneTarget: number; sceneTitle: string };
  /** The binder's title and what a scene is called. */
  binder: string;
  scene: string;
  status: Record<SceneStatus, string>;
};

const WRITING_KINDS: Partial<Record<EntryKind, KindInfo>> = {
  character: {
    plural: 'Characters', singular: 'Character', code: 'CHR', groups: ['Main Cast', 'Supporting', 'Minor'], group: 'Main Cast',
    specs: ['Age', 'Occupation', 'Home', 'Wants', 'Fears'], empty: 'Who is this story about? Add your first character.', tagline: 'One line about them',
  },
  place: {
    plural: 'Places', singular: 'Place', code: 'PLC', groups: [], group: 'Places',
    specs: ['Region', 'Population', 'Known For'], empty: 'Where does it happen? Add your first place.', tagline: 'One line about it',
  },
  lore: {
    plural: 'Lore', singular: 'Lore Entry', code: 'LOR', groups: [], group: 'Lore',
    specs: ['Category', 'Known To'], empty: 'History, factions, materials, magic: add your first piece of lore.', tagline: 'One line about it',
  },
};

const KINDS: Record<Section, Partial<Record<EntryKind, KindInfo>>> = {
  writing: WRITING_KINDS,
  film: {
    character: {
      plural: 'Cast', singular: 'Cast Member', code: 'CST', groups: ['Lead', 'Supporting', 'Extras'], group: 'Lead',
      specs: ['Plays', 'Agent', 'Contact', 'Day Rate', 'Availability'], empty: 'Who’s on screen? Add your first cast member.', tagline: 'Who they play',
    },
    crew: {
      plural: 'Crew', singular: 'Crew Member', code: 'CRW', groups: ['Direction', 'Camera', 'Sound', 'Art', 'Post', 'Production'], group: 'Production',
      specs: ['Role', 'Contact', 'Day Rate', 'Availability', 'Kit'], empty: 'Who’s behind the camera? Add your first crew member.', tagline: 'Their role',
    },
    place: {
      plural: 'Locations', singular: 'Location', code: 'LOC', groups: [], group: 'Locations',
      specs: ['Address', 'Contact', 'Permit', 'Cost Per Day', 'Power & Parking'], empty: 'Where will you shoot? Add your first location.', tagline: 'What it stands in for',
    },
  },
  tabletop: {
    character: {
      plural: 'NPCs', singular: 'NPC', code: 'NPC', groups: ['Allies', 'Villains', 'Townsfolk'], group: 'Townsfolk',
      specs: ['Species', 'Role', 'Found At', 'Voice', 'Wants'], empty: 'Who will the party meet? Add your first NPC.', tagline: 'One line about them',
    },
    place: WRITING_KINDS.place,
    lore: WRITING_KINDS.lore,
  },
};

export const SECTION_INFO: Record<Section, SectionInfo> = {
  writing: {
    label: 'Writing',
    container: 'World',
    containers: 'Worlds',
    code: 'WLD',
    blurb: 'Books, characters, places, lore',
    kinds: ['character', 'place', 'lore'],
    book: { title: 'Book One', partNoun: 'Act', targetWords: 90_000, sceneTarget: 2000, sceneTitle: '' },
    binder: 'Manuscript',
    scene: 'Scene',
    status: { idea: 'Idea', outline: 'Outline', draft: 'Drafting', done: 'Done' },
  },
  film: {
    label: 'Filmmaking',
    container: 'Production',
    containers: 'Productions',
    code: 'PRD',
    blurb: 'Scripts, shots, schedules, budgets',
    kinds: ['character', 'crew', 'place'],
    book: { title: 'Script', partNoun: 'Sequence', targetWords: 0, sceneTarget: 0, sceneTitle: '' },
    binder: 'Script',
    scene: 'Scene',
    status: { idea: 'Idea', outline: 'Outline', draft: 'Drafting', done: 'Locked' },
  },
  tabletop: {
    label: 'Tabletop',
    container: 'Campaign',
    containers: 'Campaigns',
    code: 'CMP',
    blurb: 'Sessions, party, encounters, bestiary',
    kinds: ['character', 'place', 'lore'],
    book: { title: 'Session Log', partNoun: 'Arc', targetWords: 0, sceneTarget: 0, sceneTitle: 'Session' },
    binder: 'Sessions',
    scene: 'Session',
    status: { idea: 'Idea', outline: 'Planned', draft: 'Prepped', done: 'Played' },
  },
};

/** What a kind is called in a section (a kind a section doesn't use falls back to Writing's, or Crew's). */
export function kindInfo(kind: EntryKind, section: Section): KindInfo {
  return KINDS[section][kind] ?? WRITING_KINDS[kind] ?? KINDS.film.crew!;
}

export const STAGE_LABEL: Record<FilmStage, string> = {
  idea: 'Idea',
  preProduction: 'Pre-Production',
  production: 'Production',
  post: 'Post-Production',
  released: 'Released',
};

export function filmDefaults(): FilmDetails {
  return {
    format: 'YouTube Video',
    stage: 'idea',
    targetMinutes: 0,
    releaseDate: '',
    releaseTitle: '',
    releaseDescription: '',
    tags: '',
    checklist: ['Script Locked', 'Shot List', 'Locations Booked', 'Footage Shot', 'Edit Locked', 'Color & Sound', 'Thumbnail', 'Title & Description', 'Published'].map((label) => ({ label, done: false })),
  };
}

/** A Tabletop player's journal: their own notes of each session, apart from the GM's log. */
export const JOURNAL = { title: 'Journal', partNoun: 'Arc', targetWords: 0, audience: 'player' } as const;

export function tabletopDefaults(): TabletopDetails {
  return { nextSession: '', ruleset: '5e' };
}
