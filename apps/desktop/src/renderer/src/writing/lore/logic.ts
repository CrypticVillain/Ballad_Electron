import type { Spec } from '@/lib/model';
import type { LexiconWord, LoreType } from './model';
import { LORE_TYPE_INFO } from './types';

/** Writing → Lore types: the pure parts (fields after a type change, glossing a sentence). */

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** A field some lore type starts with ("Cost", "Deities"…). */
const isTypeField = (label: string) => Object.values(LORE_TYPE_INFO).some((t) => t.fields.some((f) => same(f, label)));

/**
 * The fields an entry has after taking a type: everything you've filled in
 * (or added yourself) stays; the old type's empty fields go; the new type's
 * fields it doesn't have yet are added, empty.
 */
export function withTypeFields(specs: Spec[], type: LoreType): Spec[] {
  const kept = specs.filter((s) => s.value.trim() || !isTypeField(s.label));
  const added = LORE_TYPE_INFO[type].fields.filter((f) => !kept.some((s) => same(s.label, f))).map((label) => ({ label, value: '' }));
  return [...kept, ...added];
}

/**
 * A sentence in the language, word by word: each word with its meaning from
 * the lexicon (matched without case or punctuation), or null if it isn't in
 * it yet (a gloss, as conlangers say).
 */
export function gloss(sentence: string, lexicon: LexiconWord[]): { word: string; meaning: string | null }[] {
  const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, '');
  const known = new Map(lexicon.filter((w) => w.word.trim()).map((w) => [plain(w.word), w.meaning]));
  return sentence
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, meaning: known.get(plain(word)) ?? null }));
}
