import { createBook, createEntry, createPart, createScene, updateBook } from '@/lib/actions';
import { live, newId, type Book, type Scene } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/film/common';
import { elementsToBlocks, parseHeading, titleCase } from './elements';
import type { ScriptDetails, ScriptElement, TitlePage } from './model';

/** Filmmaking → Script: a script's title page, and bringing a script in from a file. */

const store = () => useVault.getState();

export function updateScriptDetails(book: Book, changes: Partial<ScriptDetails>) {
  updateBook(book.id, { script: { ...book.script, ...changes } });
}

export function updateTitlePage(book: Book, changes: Partial<TitlePage>) {
  const current = book.script?.titlePage;
  updateScriptDetails(book, { titlePage: { title: '', credit: 'Written by', authors: '', source: '', draft: '', date: '', contact: '', ...current, ...changes } });
}

export type ImportedScript = { titlePage: TitlePage; sections: { title: string; scenes: { number?: string; elements: ScriptElement[] }[] }[] };

export type ImportOptions = {
  /** Make a Location for each set the script names that isn't one yet. */
  locations: boolean;
  /** Make a Cast entry for each speaking role no one plays yet. */
  cast: boolean;
  /** Keep the file's scene numbers (locking the script with them). */
  numbers: boolean;
};

/** The file as a new script in the production: a sequence per section, a scene per scene heading. Gives back its first scene. */
export function importScript(worldId: string, file: ImportedScript, title: string, options: ImportOptions): Scene | null {
  const sections = file.sections.filter((s) => s.scenes.length);
  if (!sections.length) return null;
  const book = createBook(worldId, { title: title || file.titlePage.title || 'Imported Script', script: { titlePage: file.titlePage } });
  const entries = live(store().vault.entries).filter((e) => e.worldId === worldId);
  const places = new Map(entries.filter((e) => e.kind === 'place').map((e) => [e.name.trim().toUpperCase(), e.id]));
  const cast = entries.filter((e) => e.kind === 'character');
  const known = new Set(cast.flatMap((c) => [c.name, c.specs.find((s) => s.label === 'Plays')?.value ?? ''].map((n) => n.trim().toUpperCase())).filter(Boolean));
  const numbers: [string, string][] = [];
  let first: Scene | null = null;

  for (const section of sections) {
    const part = createPart(book.id, { title: section.title });
    for (const s of section.scenes) {
      const heading = s.elements.find((e) => e.type === 'sceneHeading');
      const h = heading ? parseHeading(heading.text) : null;
      const set = h?.place.split(/\s+[-–—]\s+/)[0]?.trim() ?? '';
      let placeId: string | null = places.get(set) ?? null;
      if (!placeId && set && options.locations) {
        placeId = createEntry(worldId, 'place', { name: titleCase(set) }).id;
        places.set(set, placeId);
      }
      if (options.cast) {
        for (const cue of s.elements.filter((e) => e.type === 'character')) {
          const name = cue.text.replace(/\s*\([^)]*\)/g, '').replace(/\^$/, '').trim().toUpperCase();
          if (!name || known.has(name) || known.has(name.split(/\s+/)[0]!)) continue;
          createEntry(worldId, 'character', { name: titleCase(name), specs: [{ label: 'Plays', value: titleCase(name) }] });
          known.add(name);
        }
      }
      const scene = createScene(book.id, part.id, {
        title: set ? titleCase(set) : '',
        when: h?.time ? titleCase(h.time) : '',
        placeId,
        status: 'draft',
        content: elementsToBlocks(s.elements, newId),
      });
      if (s.number) numbers.push([scene.id, s.number]);
      first ??= scene;
    }
  }
  if (options.numbers && numbers.length) {
    const lockedAt = stamp().createdAt;
    updateBook(book.id, { script: { titlePage: file.titlePage, lock: { lockedAt, numbers, rounds: [{ color: 0, startedAt: lockedAt, label: 'Imported' }] } } });
  }
  return first;
}
