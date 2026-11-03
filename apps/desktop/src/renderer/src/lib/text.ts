/**
 * text.ts — reading a scene's BlockNote document: its plain text (for search,
 * previews and the word count) and the entries it mentions (@ and #).
 *
 * Blocks are { content?: inline[], children?: block[] }; inline content is
 * { type: 'text', text } or { type: 'mention', props: { entryId, name } }
 * (components/editor/schema.tsx).
 */

type Inline = { type?: string; text?: string; props?: { entryId?: string; name?: string } };
type Block = { content?: unknown; children?: unknown[] };

function inlines(block: Block): Inline[] {
  return Array.isArray(block.content) ? (block.content as Inline[]) : [];
}

function walk(blocks: unknown[], visit: (block: Block) => void) {
  for (const raw of blocks) {
    const block = raw as Block;
    visit(block);
    if (Array.isArray(block.children)) walk(block.children, visit);
  }
}

/** The document as plain text, one line per block. Mentions read as the name. */
export function blocksToText(blocks: unknown[]): string {
  const lines: string[] = [];
  walk(blocks, (block) => {
    lines.push(inlines(block).map((i) => (i.type === 'mention' ? (i.props?.name ?? '') : (i.text ?? ''))).join(''));
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The entries the document mentions, each once, in order. */
export function blocksLinks(blocks: unknown[]): string[] {
  const ids = new Set<string>();
  walk(blocks, (block) => {
    for (const i of inlines(block)) if (i.type === 'mention' && i.props?.entryId) ids.add(i.props.entryId);
  });
  return [...ids];
}

/** Words, the way a writer counts them: runs of letters or digits (apostrophes and hyphens stay inside words). */
export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** 41208 → "41,208"; 41208 with `short` → "41.2k". */
export function formatWords(words: number, short = false): string {
  if (short && words >= 1000) return `${(words / 1000).toFixed(words >= 100_000 ? 0 : 1)}k`;
  return words.toLocaleString('en-US');
}

/** 1 → "I", 4 → "IV": parts are numbered in roman numerals ("Act II"). */
export function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [value, numeral] of table) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

/** "Ines Varga" → "IV". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : (words[0]?.[1] ?? ''))).toUpperCase();
}
