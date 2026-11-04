/**
 * Writing → Lore types: what a lore entry is (a magic system, a species, a
 * culture…), which gives it its fields (writing/lore/types.ts). A language
 * also keeps a lexicon and its grammar.
 */
export const LORE_TYPES = ['general', 'magic', 'species', 'culture', 'item', 'organization', 'religion', 'philosophy', 'language'] as const;
export type LoreType = (typeof LORE_TYPES)[number];

/** One word of a constructed language. */
export type LexiconWord = { id: string; word: string; meaning: string; part: string; notes: string };
