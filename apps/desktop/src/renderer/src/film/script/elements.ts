import { ELEMENT_TYPES, type ElementType, type ScriptElement } from './model';

/**
 * Filmmaking → Script: reading a scene's editor blocks as screenplay elements
 * (and back), and reading scene headings and character cues (pure).
 */

type Inline = { type?: string; text?: string; props?: { name?: string } };
type Block = { type?: string; props?: Record<string, unknown>; content?: unknown; children?: unknown[] };

const isElement = (type: string | undefined): type is ElementType => (ELEMENT_TYPES as readonly string[]).includes(type ?? '');

const inlineText = (content: unknown) => (Array.isArray(content) ? (content as Inline[]).map((i) => (i.type === 'mention' ? (i.props?.name ?? '') : (i.text ?? ''))).join('') : typeof content === 'string' ? content : '');

/** A scene's blocks as elements: prose blocks (paragraphs, headings, lists) read as Action; empty ones are dropped. */
export function blocksToElements(blocks: unknown[]): ScriptElement[] {
  const out: ScriptElement[] = [];
  const walk = (list: unknown[]) => {
    for (const raw of list) {
      const block = raw as Block;
      const text = inlineText(block.content).replace(/\s+$/g, '');
      if (text.trim()) {
        const type: ElementType = isElement(block.type) ? block.type : 'action';
        out.push(type === 'character' && block.props?.dual ? { type, text, dual: true } : { type, text });
      }
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);
  return out;
}

/** Elements as editor blocks (a new scene's content, on import). */
export function elementsToBlocks(elements: ScriptElement[], id: () => string): unknown[] {
  return elements.map((e) => ({
    id: id(),
    type: e.type,
    props: e.type === 'character' ? { dual: Boolean(e.dual) } : {},
    content: e.text ? [{ type: 'text', text: e.text, styles: {} }] : [],
    children: [],
  }));
}

export type Heading = {
  /** INT, EXT, INT/EXT, or '' when it doesn't say. */
  ie: 'INT' | 'EXT' | 'INT/EXT' | '';
  /** The set: "KITCHEN", "ROOFTOP GARDEN". */
  place: string;
  /** DAY, NIGHT, CONTINUOUS…: what follows the last dash. */
  time: string;
};

const PREFIX = /^(int\.?\s*\/\s*ext\.?|ext\.?\s*\/\s*int\.?|i\s*\/\s*e\.?|int\.?|ext\.?|est\.?)(?=\s|$)\s*/i;

/** "INT. KITCHEN - NIGHT" → INT, KITCHEN, NIGHT. */
export function parseHeading(text: string): Heading {
  let rest = text.trim().replace(/^\./, '');
  const prefix = rest.match(PREFIX);
  let ie: Heading['ie'] = '';
  if (prefix) {
    const p = prefix[1]!.toUpperCase().replace(/[.\s]/g, '');
    ie = p.includes('/') ? 'INT/EXT' : p.startsWith('EXT') ? 'EXT' : 'INT';
    rest = rest.slice(prefix[0].length);
  }
  const dash = rest.search(/\s+[-–—]+\s+(?!.*\s[-–—]+\s)/);
  const place = (dash >= 0 ? rest.slice(0, dash) : rest).trim().toUpperCase();
  const time = (dash >= 0 ? rest.slice(dash).replace(/^\s*[-–—]+\s*/, '') : '').trim().toUpperCase();
  return { ie, place, time };
}

/** Whether the time of day reads as night (for strip colors and reports). */
export const isNight = (time: string) => /\b(night|evening|dusk|midnight|late)\b/i.test(time);

/** Whether a line looks like a scene heading (for import). */
export const looksLikeHeading = (text: string) => PREFIX.test(text.trim());

/** "INES (V.O.)" → INES; "MRS. HALE (CONT'D)" → MRS. HALE. The name a cue names, without its extensions or the dual mark. */
export const cueName = (text: string) =>
  text
    .replace(/\^\s*$/, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toUpperCase();

/** A cue's extensions: "INES (V.O.) (CONT'D)" → ["V.O.", "CONT'D"]. */
export const cueExtensions = (text: string) => [...text.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim().toUpperCase());

/** "kitchen" → "Kitchen"; "THE OLD MILL" → "The Old Mill". */
export const titleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
    .trim();
