import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, LanguagesIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { create } from 'zustand';
import { confirmDelete } from '@/components/dnd/Sharing';
import { Label } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { updateEntry } from '@/lib/actions';
import type { Entry } from '@/lib/model';
import { cn } from '@/lib/utils';
import { addWord, createLoreEntry, removeWord, setLoreType, updateWord } from './actions';
import { gloss } from './logic';
import { LORE_TYPES, type LoreType } from './model';
import { LORE_TYPE_INFO } from './types';

/**
 * Writing → Lore types, on screen: the type on a lore entry's sheet (its
 * fields follow it), a language's lexicon, grammar and glossing, and New Lore
 * asking what kind first. The world bible's sheet (screens/bible) shows them
 * for a Writing world's lore.
 */

/** The type of a lore entry, to change. Its fields follow (nothing written is lost). */
export function LoreTypeBar({ entry, locked }: { entry: Entry; locked?: boolean }) {
  const type = entry.loreType ?? 'general';
  const Icon = LORE_TYPE_INFO[type].icon;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3.5 py-2.5">
      <Icon className="size-4 text-primary" />
      <span className="label text-[9.5px]">Kind</span>
      <SelectField
        label="Kind of lore"
        variant="chip"
        value={type}
        onChange={(t) => !locked && setLoreType(entry, t)}
        options={LORE_TYPES.map((t) => ({ value: t, label: LORE_TYPE_INFO[t].label }))}
      />
      <span className="ml-auto text-[11.5px] text-muted-foreground">Changing it brings its fields; what you’ve written stays.</span>
    </div>
  );
}

/** A language's words (searchable, editable in place), its grammar, and a sentence glossed word by word. */
export function LanguagePanel({ entry, locked }: { entry: Entry; locked?: boolean }) {
  const words = entry.lexicon ?? [];
  const [query, setQuery] = useState('');
  const [sentence, setSentence] = useState('');
  const shown = words
    .filter((w) => !query || `${w.word} ${w.meaning} ${w.part}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.word || '￿').localeCompare(b.word || '￿'));
  const remove = (id: string) => {
    const word = words.find((w) => w.id === id);
    confirmDelete({ noun: 'Word', name: word?.word || 'this word', area: 'writing:bible', remove: () => removeWord(entry, id) });
  };
  const cell = 'h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] outline-none hover:border-input focus:border-primary read-only:hover:border-transparent';
  return (
    <section className="flex flex-col gap-3 rounded-2xl border px-5 py-4">
      <div className="flex items-center gap-2">
        <LanguagesIcon className="size-4 text-primary" />
        <h3 className="font-display text-[18px] font-black uppercase">Lexicon</h3>
        <span className="font-mono text-[11px] text-muted-foreground">{words.length} words</span>
        <span className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border px-2 focus-within:border-primary">
          <SearchIcon className="size-3.5 text-muted-foreground" />
          <input aria-label="Search the lexicon" value={query} placeholder="Find a word" onChange={(e) => setQuery(e.target.value)} className="w-32 bg-transparent text-[12.5px] outline-none" />
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_1.4fr_0.8fr_1.4fr_28px] gap-1 border-b bg-muted/40 px-2 py-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          <span className="px-2">Word</span>
          <span className="px-2">Meaning</span>
          <span className="px-2">Part</span>
          <span className="px-2">Notes</span>
          <span />
        </div>
        {shown.map((w) => (
          <div key={w.id} className="group/word grid grid-cols-[1fr_1.4fr_0.8fr_1.4fr_28px] items-center gap-1 border-b px-2 py-0.5 last:border-b-0">
            <input aria-label="Lexicon word" readOnly={locked} value={w.word} placeholder="word" onChange={(e) => updateWord(entry, w.id, { word: e.target.value })} className={cn(cell, 'font-semibold')} />
            <input aria-label="Lexicon meaning" readOnly={locked} value={w.meaning} placeholder="meaning" onChange={(e) => updateWord(entry, w.id, { meaning: e.target.value })} className={cell} />
            <input aria-label="Lexicon part of speech" readOnly={locked} value={w.part} placeholder="noun" onChange={(e) => updateWord(entry, w.id, { part: e.target.value })} className={cn(cell, 'font-mono text-[12px]')} />
            <input aria-label="Lexicon notes" readOnly={locked} value={w.notes} placeholder="" onChange={(e) => updateWord(entry, w.id, { notes: e.target.value })} className={cn(cell, 'text-muted-foreground')} />
            {!locked && (
              <button type="button" aria-label={`Delete ${w.word || 'word'}`} onClick={() => remove(w.id)} className="text-muted-foreground opacity-0 group-hover/word:opacity-100 hover:text-foreground focus-visible:opacity-100">
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {!shown.length && <p className="px-4 py-4 text-center text-[12.5px] text-muted-foreground">{words.length ? 'No word matches.' : 'No words yet.'}</p>}
      </div>
      {!locked && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => addWord(entry)}>
          <PlusIcon /> Add Word
        </Button>
      )}
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label>Grammar</Label>
        <Textarea aria-label="Grammar" readOnly={locked} rows={4} value={entry.grammar ?? ''} placeholder="Word order, plurals, tenses, how questions are asked…" onChange={(e) => updateEntry(entry.id, { grammar: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
      </div>
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label>Gloss A Sentence</Label>
        <input aria-label="A sentence in the language" value={sentence} placeholder="Type a sentence in the language…" onChange={(e) => setSentence(e.target.value)} className="h-9 rounded-lg border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary" />
        {sentence.trim() && (
          <div className="flex flex-wrap gap-x-3 gap-y-2 pt-1">
            {gloss(sentence, words).map((g, i) => (
              <span key={i} className="flex flex-col items-center">
                <span className="text-[14px] font-semibold">{g.word}</span>
                <span className={cn('font-mono text-[11px]', g.meaning ? 'text-muted-foreground' : 'text-destructive')}>{g.meaning ?? '?'}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── New Lore: what kind? ─────────────────────────────────────────────────

const useNewLore = create<{ worldId: string | null }>(() => ({ worldId: null }));

/** Asks what kind of lore to make (a Writing world's New Lore). */
export const openNewLore = (worldId: string) => useNewLore.setState({ worldId });

export function NewLoreDialog() {
  const worldId = useNewLore((s) => s.worldId);
  const navigate = useNavigate();
  const close = () => useNewLore.setState({ worldId: null });
  const make = (type: LoreType) => {
    if (!worldId) return;
    const entry = createLoreEntry(worldId, type);
    close();
    void navigate({ to: '/bible/$kind/$entryId', params: { kind: 'lore', entryId: entry.id } });
  };
  return (
    <Dialog open={Boolean(worldId)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">New Lore</DialogTitle>
          <DialogDescription>What kind? It starts with that kind’s fields; you can change the kind later.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {LORE_TYPES.map((t) => {
            const info = LORE_TYPE_INFO[t];
            const Icon = info.icon;
            return (
              <button key={t} type="button" onClick={() => make(t)} className="group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left hover:border-primary hover:bg-primary/5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-4.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] font-semibold">{info.label}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">{info.fields.slice(0, 3).join(' · ')}</span>
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
