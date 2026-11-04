import { byOrder, type Book, type Part, type Scene } from '@/lib/model';
import { roman } from '@/lib/text';
import { blocksToParas, textToParas, type ExportBook } from './document';

/**
 * A book as the exporters see it (export/document), from its acts and scenes
 * in manuscript order. Notes and empty acts are left out; a scene with no
 * blocks yet uses its plain text.
 */
export function buildBook(book: Book, parts: Part[], scenes: Scene[], byline: string): ExportBook {
  const own = parts.filter((p) => p.bookId === book.id && !p.deletedAt).sort(byOrder);
  return {
    title: book.title || 'Untitled Book',
    byline,
    parts: own
      .map((part, i) => ({
        heading: `${book.partNoun} ${roman(i + 1)}${part.title ? `: ${part.title}` : ''}`,
        scenes: scenes
          .filter((s) => s.partId === part.id && s.kind !== 'note' && !s.deletedAt)
          .sort(byOrder)
          .map((s) => ({ title: s.title, paras: s.content.length ? blocksToParas(s.content) : textToParas(s.text) })),
      }))
      .filter((part) => part.scenes.length),
  };
}
