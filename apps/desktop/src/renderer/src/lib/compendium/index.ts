/**
 * compendium — every spell and item the Spells and Inventory pages list: the
 * System Reference Document's (SRD 5.1, srd-spells.json / srd-items.json,
 * made from 5e-bits/5e-database by scripts/srd-convert.mjs) merged with your
 * own (the vault's `spells` and `items`).
 *
 * Yours win: an edit of an SRD entry is saved as your own record pointing at
 * it (`srd`), and hiding one is the same record with `hidden`. Reset drops
 * your record, bringing the SRD's back. Homebrew is a record with no `srd`.
 *
 * Credit (CC-BY-4.0): SRD_CREDIT, shown on both pages and in the README.
 */
import { useMemo } from 'react';
import { restore, trash } from '@/lib/actions';
import { useLive } from '@/lib/hooks';
import { libraryNow, useLibrary } from '@/lib/library';
import { newId, now, type ItemInfo, type ItemRecord, type SpellInfo, type SpellRecord } from '@/lib/model';
import { useVault } from '@/stores/vault';
import srdItems from './srd-items.json';
import srdSpells from './srd-spells.json';

export const SRD_CREDIT =
  'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

export const SRD_SPELLS = srdSpells as unknown as (SpellInfo & {
  id: string;
})[];
export const SRD_ITEMS = srdItems as unknown as (ItemInfo & { id: string })[];

/** Where a listed entry comes from: the SRD as is, the SRD as you edited it, or your own. */
export type Source = 'srd' | 'edited' | 'homebrew';

/**
 * A spell or item as listed: its id is the SRD's ("srd:fireball"), the
 * Library's ("deepm_abhorrent-apparition") or your record's. `book`: the
 * source it's from (lib/library SOURCES; the app's own SRD 5.1 is
 * "srd-2014"); unset for homebrew.
 */
export type Listed<T> = T & {
  id: string;
  source: Source;
  srd?: string;
  hidden: boolean;
  recordId?: string;
  book?: string;
};

type Kind = 'spells' | 'items';
type InfoOf<K extends Kind> = K extends 'spells' ? SpellInfo : ItemInfo;
type RecordFor<K extends Kind> = K extends 'spells' ? SpellRecord : ItemRecord;

const SRD = { spells: SRD_SPELLS, items: SRD_ITEMS } as const;

/** The vault store's writes, for either kind (the generics above are only for the lists' shapes). */
const store = () =>
  useVault.getState() as unknown as {
    put: (collection: Kind, record: object) => void;
    patch: (collection: Kind, id: string, changes: object) => void;
    purge: (collection: Kind, id: string) => void;
    vault: {
      spells: Record<string, SpellRecord>;
      items: Record<string, ItemRecord>;
    };
  };

/** Whether your record of an SRD entry changes any of its text (a record that only hides it doesn't). */
function differs(record: object, entry: object): boolean {
  const mine = strip(record) as Record<string, unknown>;
  return Object.entries(entry).some(([key, value]) => key !== 'id' && key in mine && JSON.stringify(mine[key]) !== JSON.stringify(value));
}

function strip<T extends object>(record: T): T {
  const { createdAt: _c, updatedAt: _u, deletedAt: _d, sample: _s, srd: _srd, hidden: _h, id: _id, book: _b, src: _src, ...info } = record as T & Record<string, unknown>;
  return info as T;
}

/** The whole list for a kind, hidden ones included (flagged), sorted by name. */
function useListed<K extends Kind>(kind: K): Listed<InfoOf<K>>[] {
  const records = useLive(kind) as RecordFor<K>[];
  // The Library's spells and items join the SRD's once it's loaded (asking here loads it).
  const library = useLibrary();
  return useMemo(() => {
    const bySrd = new Map(records.filter((r) => r.srd).map((r) => [r.srd!, r]));
    const originals = [
      ...(SRD[kind] as unknown as (InfoOf<K> & { id: string })[]).map((entry) => ({ ...entry, src: 'srd-2014' })),
      ...((library?.[kind] ?? []) as unknown as (InfoOf<K> & { id: string; src: string })[]),
    ];
    const srd = originals.map(({ src: book, ...original }): Listed<InfoOf<K>> => {
      const entry = original as unknown as InfoOf<K> & { id: string };
      const mine = bySrd.get(entry.id);
      return mine
        ? {
            ...(strip(mine) as InfoOf<K>),
            id: entry.id,
            source: differs(mine, entry) ? 'edited' : 'srd',
            srd: entry.id,
            hidden: Boolean(mine.hidden),
            recordId: mine.id,
            book,
          }
        : { ...entry, source: 'srd', hidden: false, book };
    });
    const homebrew = records
      .filter((r) => !r.srd)
      .map((r): Listed<InfoOf<K>> => ({
        ...(strip(r) as InfoOf<K>),
        id: r.id,
        source: 'homebrew',
        hidden: false,
        recordId: r.id,
      }));
    return [...srd, ...homebrew].sort((a, b) => a.name.localeCompare(b.name));
  }, [kind, records, library]);
}

export const useSpells = () => useListed('spells');
export const useItems = () => useListed('items');

/** The SRD's own version of an entry (for "Reset To SRD"). */
export const srdEntry = (kind: Kind, id: string) => (SRD[kind] as { id: string }[]).find((e) => e.id === id) ?? (libraryNow()?.[kind] as { id: string }[] | undefined)?.find((e) => e.id === id);

/** Changes an entry: your own record directly; an SRD one by saving your copy of it first. */
export function editEntry<K extends Kind>(kind: K, entry: Listed<InfoOf<K>>, changes: Partial<InfoOf<K> & { hidden: boolean }>) {
  if (entry.recordId) {
    store().patch(kind, entry.recordId, changes);
    return;
  }
  const { id, source: _s, srd: _srd, hidden: _h, recordId: _r, book: _b, ...info } = entry;
  const t = now();
  store().put(kind, {
    ...info,
    ...changes,
    id: newId(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    srd: id,
  });
}

/** A new homebrew entry; returns its id. */
export function createEntry<K extends Kind>(kind: K): string {
  const t = now();
  const base = { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
  const record =
    kind === 'spells'
      ? ({
          ...base,
          name: '',
          level: 1,
          school: 'Evocation',
          castingTime: '1 action',
          range: '60 feet',
          components: 'V, S',
          duration: 'Instantaneous',
          concentration: false,
          ritual: false,
          classes: [],
          text: '',
          higher: '',
        } satisfies SpellRecord)
      : ({
          ...base,
          name: '',
          category: 'Gear',
          type: 'Adventuring Gear',
          rarity: '',
          attunement: false,
          cost: '',
          weight: 0,
          stats: '',
          text: '',
        } satisfies ItemRecord);
  store().put(kind, record);
  return record.id;
}

/**
 * Takes an entry off the list: an SRD one is hidden (Show Hidden brings it
 * back), your own is deleted. Returns an undo.
 */
export function removeEntry<K extends Kind>(kind: K, entry: Listed<InfoOf<K>>): () => void {
  if (entry.source === 'homebrew' && entry.recordId) {
    trash(kind, entry.recordId);
    const id = entry.recordId;
    return () => restore(kind, id);
  }
  editEntry(kind, entry, { hidden: true } as Partial<InfoOf<K> & { hidden: boolean }>);
  return () => unhideEntry(kind, entry.id);
}

/** Puts a hidden SRD entry back on the list (keeping your edits to it). */
export function unhideEntry(kind: Kind, srdId: string) {
  const record = (Object.values(store().vault[kind]) as (SpellRecord | ItemRecord)[]).find((r) => r.srd === srdId && !r.deletedAt);
  if (!record) return;
  // Hidden and never edited: nothing of yours left to keep.
  const entry = srdEntry(kind, srdId);
  if (entry && !differs(record, entry)) store().purge(kind, record.id);
  else store().patch(kind, record.id, { hidden: false });
}

/** Drops your edits to an SRD entry, so the SRD's text is back. */
export function resetEntry(kind: Kind, entry: Listed<unknown>) {
  if (entry.source === 'edited' && entry.recordId) store().purge(kind, entry.recordId);
}

// ── Words ───────────────────────────────────────────────────────────────

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** "3rd-level evocation", "Evocation cantrip". */
export const spellLine = (spell: Pick<SpellInfo, 'level' | 'school' | 'ritual'>) =>
  (spell.level === 0 ? `${spell.school} cantrip` : `${ORDINAL[spell.level] ?? `${spell.level}th`}-level ${spell.school.toLowerCase()}`) + (spell.ritual ? ' (ritual)' : '');

/** "Cantrip", "Level 3". */
export const levelLabel = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`);

export const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
export const CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];

/** Names match ignoring case, spacing and curly apostrophes (the sheet keeps spells and items by name). */
const fold = (name: string) => name.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
export const sameName = (a: string, b: string) => fold(a) === fold(b);

/** 0 when every word typed is in the name, else 1: name matches are listed before ones found only in the text. */
export function nameRank(query: string, name: string) {
  const hay = fold(name);
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w)) ? 0 : 1;
}

/** Text search over an entry's name and words: every word typed must appear. */
export function matches(query: string, ...fields: string[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}
