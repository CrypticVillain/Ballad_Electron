/**
 * Writing → Manuscript export: a book as the exporters see it (pure). A
 * scene's editor blocks become paragraphs of styled runs (bold, italic…);
 * mentions of characters and places become their names. Every format (Word,
 * EPUB, PDF, Markdown) is made from this.
 */

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
export type ParaKind = 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'number';
export type Para = { kind: ParaKind; runs: Run[] };
export type ExportScene = { title: string; paras: Para[] };
export type ExportPart = { heading: string; scenes: ExportScene[] };
export type ExportBook = { title: string; byline: string; parts: ExportPart[] };

export type ExportOptions = {
  /** Each act's heading ("Act I: The Causeway"). */
  partHeadings: boolean;
  /** Each scene's title above it. */
  sceneTitles: boolean;
};

type Inline = { type?: string; text?: string; styles?: Record<string, unknown>; content?: unknown; props?: Record<string, unknown> };
type Block = { type?: string; props?: Record<string, unknown>; content?: unknown; children?: unknown };

/** A block's inline content as runs (links and mentions as their text). */
function runsOf(content: unknown): Run[] {
  if (!Array.isArray(content)) return [];
  const runs: Run[] = [];
  for (const raw of content as Inline[]) {
    if (raw?.type === 'text' && typeof raw.text === 'string') {
      const s = raw.styles ?? {};
      runs.push({ text: raw.text, bold: Boolean(s.bold) || undefined, italic: Boolean(s.italic) || undefined, underline: Boolean(s.underline) || undefined, strike: Boolean(s.strike) || undefined });
    } else if (raw?.type === 'link') runs.push(...runsOf(raw.content));
    else if (raw?.type === 'mention') runs.push({ text: String(raw.props?.name ?? '') });
  }
  return runs.filter((r) => r.text);
}

/** A scene's blocks as paragraphs, nested blocks after their parent. Empty paragraphs are dropped. */
export function blocksToParas(blocks: unknown[]): Para[] {
  const out: Para[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const block of list as Block[]) {
      const runs = runsOf(block?.content);
      const type = block?.type ?? 'paragraph';
      let kind: ParaKind = 'p';
      if (type === 'heading') kind = (['h1', 'h2', 'h3'] as const)[Math.min(3, Math.max(1, Number(block.props?.level) || 1)) - 1]!;
      else if (type === 'quote') kind = 'quote';
      else if (type === 'bulletListItem') kind = 'bullet';
      else if (type === 'numberedListItem') kind = 'number';
      else if (type === 'checkListItem') {
        kind = 'bullet';
        runs.unshift({ text: block.props?.checked ? '☑ ' : '☐ ' });
      }
      if (runs.some((r) => r.text.trim())) out.push({ kind, runs });
      walk(block?.children);
    }
  };
  walk(blocks);
  return out;
}

/** Plain text as paragraphs (a scene saved before it had blocks). */
export const textToParas = (text: string): Para[] =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ kind: 'p' as const, runs: [{ text: line }] }));

/** A run list's plain text. */
export const plain = (runs: Run[]) => runs.map((r) => r.text).join('');

/** Escapes text for HTML and XHTML. */
export const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A file name from a title: no characters Windows or macOS refuse. */
export const fileName = (title: string, ext: string) => `${(title.trim() || 'Untitled').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').slice(0, 80)}.${ext}`;
