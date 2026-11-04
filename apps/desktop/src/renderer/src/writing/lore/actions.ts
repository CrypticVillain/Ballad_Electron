import { createEntry, updateEntry } from '@/lib/actions';
import { newId, type Entry } from '@/lib/model';
import { withTypeFields } from './logic';
import type { LexiconWord, LoreType } from './model';
import { LORE_TYPE_INFO } from './types';

/** Writing → Lore types: making typed lore, changing a type, and a language's words. */

/** A new lore entry of a type: its fields, kept in the type's space. */
export function createLoreEntry(worldId: string, type: LoreType): Entry {
  const info = LORE_TYPE_INFO[type];
  return createEntry(worldId, 'lore', { loreType: type, group: info.plural, specs: info.fields.map((label) => ({ label, value: '' })), ...(type === 'language' ? { lexicon: [], grammar: '' } : {}) });
}

/** Gives an entry a type (or changes it): its fields follow, nothing written is lost. */
export function setLoreType(entry: Entry, type: LoreType) {
  updateEntry(entry.id, { loreType: type, specs: withTypeFields(entry.specs, type), ...(type === 'language' && !entry.lexicon ? { lexicon: [], grammar: '' } : {}) });
}

// ── A language's words ──

export function addWord(entry: Entry, word: Partial<LexiconWord> = {}): LexiconWord {
  const made: LexiconWord = { id: newId(), word: '', meaning: '', part: '', notes: '', ...word };
  updateEntry(entry.id, { lexicon: [...(entry.lexicon ?? []), made] });
  return made;
}

export function updateWord(entry: Entry, id: string, changes: Partial<LexiconWord>) {
  updateEntry(entry.id, { lexicon: (entry.lexicon ?? []).map((w) => (w.id === id ? { ...w, ...changes } : w)) });
}

/** Takes a word out; gives back how to put it back. */
export function removeWord(entry: Entry, id: string): () => void {
  const before = entry.lexicon ?? [];
  updateEntry(entry.id, { lexicon: before.filter((w) => w.id !== id) });
  return () => updateEntry(entry.id, { lexicon: before });
}
