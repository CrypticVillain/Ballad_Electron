import JSZip from 'jszip';
import { createBook, createPart, createScene, trash, updateScene } from '@/lib/actions';
import { newId, type Scene } from '@/lib/model';
import { blocksToText, wordCount } from '@/lib/text';
import type { OpenedManuscript } from '../../../../../shared/ipc';
import type { Para } from '../export/document';
import { baseName, docxLines, markdownLines, scrivenerBook, structure, type ImportBook } from './parse';

/** A manuscript picked to import (main/manuscript.ts), read as a book. */
export async function readManuscript(opened: OpenedManuscript): Promise<ImportBook> {
  const title = baseName(opened.name);
  if (opened.kind === 'text') return structure(markdownLines(opened.text, opened.plain), title);
  if (opened.kind === 'scrivener') return scrivenerBook(opened.scrivx, opened.docs, title);
  const zip = await JSZip.loadAsync(opened.data);
  const document = await zip.file('word/document.xml')?.async('string');
  if (!document) throw new Error('That isn’t a Word document Ballad can read.');
  const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';
  return structure(docxLines(document, styles), title);
}

const BLOCK: Record<Para['kind'], { type: string; props: Record<string, unknown> }> = {
  p: { type: 'paragraph', props: {} },
  h1: { type: 'heading', props: { level: 1 } },
  h2: { type: 'heading', props: { level: 2 } },
  h3: { type: 'heading', props: { level: 3 } },
  quote: { type: 'quote', props: {} },
  bullet: { type: 'bulletListItem', props: {} },
  number: { type: 'numberedListItem', props: {} },
};

/** Paragraphs as the editor's blocks (BlockNote's shape). */
export const parasToBlocks = (paras: Para[]) =>
  paras.map((p) => ({
    id: newId(),
    ...BLOCK[p.kind],
    content: p.runs.map((r) => ({
      type: 'text',
      text: r.text,
      styles: { ...(r.bold ? { bold: true } : {}), ...(r.italic ? { italic: true } : {}), ...(r.underline ? { underline: true } : {}), ...(r.strike ? { strike: true } : {}) },
    })),
    children: [],
  }));

/**
 * The book in the world: a new book with its acts and scenes, every scene a
 * draft (imported words aren't today's writing). Its first scene, and how to
 * take it all back.
 */
export function importBook(worldId: string, imported: ImportBook): { scene: Scene; undo: () => void } {
  const book = createBook(worldId, { title: imported.title });
  const made: { parts: string[]; scenes: string[] } = { parts: [], scenes: [] };
  let first: Scene | null = null;
  for (const p of imported.parts) {
    const part = createPart(book.id, { title: p.title });
    made.parts.push(part.id);
    for (const s of p.scenes) {
      const scene = createScene(book.id, part.id, { title: s.title, status: 'draft' });
      const content = parasToBlocks(s.paras);
      const text = blocksToText(content);
      updateScene(scene.id, { content, text, words: wordCount(text) });
      made.scenes.push(scene.id);
      first ??= scene;
    }
  }
  const undo = () => {
    for (const id of made.scenes) trash('scenes', id);
    for (const id of made.parts) trash('parts', id);
    trash('books', book.id);
  };
  return { scene: first!, undo };
}
