/**
 * library — the open-licensed material beyond the SRD 5.1 the app ships in
 * lib/compendium: Open5e's documents (scripts/library-convert.mjs; Wizards'
 * SRD 5.2, Kobold Press, EN Publishing's Level Up, Green Ronin's Tal'Dorei
 * open content and more) and Dyson Logos's free commercial maps
 * (scripts/dyson-maps.mjs).
 *
 * The big files (monsters, spells, items, classes…) load the first time
 * something asks for them (loadLibrary / useLibrary), so the app starts as
 * fast as before. The sources, licenses and map catalog are small and here
 * at once.
 */
import { useEffect, useState } from 'react';
import type { ItemInfo, SpellInfo } from '@/lib/model';
import dysonMaps from './dyson-maps.json';
import licenses from './licenses.json';
import sources from './open5e-sources.json';

export type Block = { name: string; text: string };

export type LibraryMonster = {
  id: string;
  src: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  acNote: string;
  hp: number;
  hpDice: string;
  speed: string;
  abilities: number[];
  saves: string;
  skills: string;
  vulnerable: string;
  resist: string;
  immune: string;
  conditionImmune: string;
  senses: string;
  languages: string;
  cr: string;
  xp: number | null;
  traits: Block[];
  actions: Block[];
  bonus: Block[];
  reactions: Block[];
  legendary: Block[];
  environments: string[];
};
export type LibrarySpell = SpellInfo & { id: string; src: string };
export type LibraryItem = ItemInfo & { id: string; src: string };
export type LibraryEntry = { id: string; src: string; name: string; text: string; benefits: Block[]; prerequisite?: string; kind?: string; parent?: string | null };
export type LibraryClass = { id: string; src: string; name: string; parent: string | null; hitDie: string; saves: string[]; text: string; features: (Block & { level: number })[] };
export type LibraryRule = { id: string; src: string; name: string; text: string };

export type Library = {
  monsters: LibraryMonster[];
  spells: LibrarySpell[];
  items: LibraryItem[];
  feats: LibraryEntry[];
  backgrounds: LibraryEntry[];
  species: LibraryEntry[];
  classes: LibraryClass[];
  rules: LibraryRule[];
};

export type Source = {
  key: string;
  name: string;
  publisher: string;
  authors: string;
  year: string;
  licenses: string[];
  url: string;
  about: string;
  credit: string;
  ogl: boolean;
  included: boolean;
  counts: Record<string, number>;
  overlap: Record<string, { app: number; others: Record<string, number> }>;
};

export const SOURCES = sources as unknown as Source[];
export const LICENSES = licenses as { key: string; name: string; text: string }[];
export type DysonMap = { title: string; post: string; image: string; width: number; height: number; file?: string };
export const DYSON_MAPS = dysonMaps as DysonMap[];

/** A source's short name for badges ("Tome of Beasts 2"); the app's own SRD 5.1 is "SRD 5.1". */
export const SHORT: Record<string, string> = {
  'srd-2014': 'SRD 5.1',
  'srd-2024': 'SRD 5.2',
  tob: 'Tome of Beasts',
  'tob-2023': 'Tome of Beasts (2023)',
  tob2: 'Tome of Beasts 2',
  tob3: 'Tome of Beasts 3',
  ccdx: 'Creature Codex',
  bfrd: 'Black Flag SRD',
  deepm: 'Deep Magic',
  deepmx: 'Deep Magic Extended',
  kp: 'Kobold Press',
  wz: 'Warlock Zine',
  toh: 'Tome of Heroes',
  vom: 'Vault of Magic',
  'a5e-ag': 'Level Up: Adventurer’s Guide',
  'a5e-ddg': 'Level Up: Dungeon Delver’s Guide',
  'a5e-gpg': 'Level Up: Gate Pass Gazette',
  'a5e-mm': 'Level Up: Monstrous Menagerie',
  tdcs: 'Tal’Dorei Campaign Setting',
  open5e: 'Open5e Originals',
  'open5e-2024': 'Open5e Originals (2024)',
  'spells-that-dont-suck': 'Spells That Don’t Suck',
};
export const sourceName = (key: string) => SHORT[key] ?? SOURCES.find((s) => s.key === key)?.name ?? key;

/** What each license lets a seller do, in a line. */
export const LICENSE_NOTE: Record<string, { name: string; commercial: string }> = {
  'cc-by-40': { name: 'CC-BY-4.0', commercial: 'Yes, with the attribution notice.' },
  'ogl-10a': { name: 'OGL 1.0a', commercial: 'Yes, under the OGL: include its full text and each source’s Section 15 notice, and use none of the publisher’s Product Identity.' },
  'cc0-10': { name: 'CC0', commercial: 'Yes, no conditions.' },
};

let loading: Promise<Library> | null = null;
let loaded: Library | null = null;

/** The Library if it's loaded already (for code outside React). */
export const libraryNow = () => loaded;

/** Loads the Library's files (once). */
export function loadLibrary(): Promise<Library> {
  loading ??= Promise.all([
    import('./open5e-monsters.json'),
    import('./open5e-spells.json'),
    import('./open5e-items.json'),
    import('./open5e-feats.json'),
    import('./open5e-backgrounds.json'),
    import('./open5e-species.json'),
    import('./open5e-classes.json'),
    import('./open5e-rules.json'),
  ]).then(([monsters, spells, items, feats, backgrounds, species, classes, rules]) => {
    loaded = {
      monsters: monsters.default as unknown as LibraryMonster[],
      spells: spells.default as unknown as LibrarySpell[],
      items: items.default as unknown as LibraryItem[],
      feats: feats.default as unknown as LibraryEntry[],
      backgrounds: backgrounds.default as unknown as LibraryEntry[],
      species: species.default as unknown as LibraryEntry[],
      classes: classes.default as unknown as LibraryClass[],
      rules: rules.default as unknown as LibraryRule[],
    };
    return loaded;
  });
  return loading;
}

/** The Library once it's loaded (null until then); asking starts the load. */
export function useLibrary(): Library | null {
  const [library, setLibrary] = useState<Library | null>(loaded);
  useEffect(() => {
    if (!library) void loadLibrary().then(setLibrary);
  }, [library]);
  return library;
}
