import { cueName } from './elements';
import type { ScriptElement } from './model';

/**
 * Filmmaking → Script: a script laid out on pages the way a screenplay is
 * (pure). Courier 12 on Letter: 1.5" left margin, 1" the rest, so 54 lines a
 * page and 60 characters across. Each element sits at its own indent; a
 * scene heading never ends a page; action breaks only with two lines either
 * side; a speech breaks between lines with (MORE) at the bottom and the
 * name (CONT'D) at the top of the next page. Dual dialogue sits side by side.
 *
 * From the pages come the page count and each scene's length in eighths of a
 * page, the way schedules count it.
 */

export const LINES_PER_PAGE = 54;
export const WIDTH = 60;

/** Where each element starts (characters from the left margin) and how wide it runs. */
export const INDENT = { sceneHeading: 0, action: 0, character: 22, parenthetical: 16, dialogue: 10, transition: 0, more: 22 } as const;
const SPAN = { sceneHeading: 60, action: 60, character: 38, parenthetical: 25, dialogue: 35, transition: 60 } as const;
/** In dual dialogue, each side is half as wide. */
const DUAL = { character: { indent: 7, span: 22 }, parenthetical: { indent: 3, span: 22 }, dialogue: { indent: 0, span: 28 } } as const;

export type LineKind = 'sceneHeading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'more';
export type Line = { kind: LineKind; text: string; indent: number; right?: boolean; changed?: boolean };
export type PageItem = { kind: 'blank' } | { kind: 'line'; line: Line; scene?: string } | { kind: 'dual'; left: Line[]; right: Line[] };
export type Page = { number: number; items: PageItem[]; changed: boolean };

export type LayoutElement = ScriptElement & { changed?: boolean };
export type LayoutScene = { id: string; number: string; omitted?: boolean; elements: LayoutElement[]; /** An omitted scene that's newly omitted (marked as changed). */ changed?: boolean };
export type Layout = {
  pages: Page[];
  /** Each scene's length in eighths of a page (at least 1) and the page it starts on. */
  scenes: Record<string, { eighths: number; page: number }>;
  eighths: number;
};

/** Words wrapped to `width` characters (a hard line break starts a new line; a word too long is cut). */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) out.push(line);
        line = '';
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

// ── Units: what's placed on a page together ──

type Speech = { cue: Line[]; body: Line[] };
type Unit =
  | { kind: 'heading'; lines: Line[]; scene?: string; space: number }
  | { kind: 'action' | 'transition'; lines: Line[]; space: number }
  | { kind: 'speech'; speech: Speech; space: number }
  | { kind: 'dual'; left: Line[]; right: Line[]; space: number };

const lines = (kind: LineKind, text: string, changed?: boolean): Line[] => {
  const span = kind === 'more' ? 38 : SPAN[kind];
  const upper = kind === 'sceneHeading' || kind === 'character' || kind === 'transition';
  return wrap(upper ? text.toUpperCase() : text, span).map((t) => ({
    kind,
    text: t,
    indent: kind === 'transition' ? Math.max(0, WIDTH - t.length) : INDENT[kind],
    ...(kind === 'transition' ? { right: true } : {}),
    ...(changed ? { changed } : {}),
  }));
};

const dualLines = (kind: 'character' | 'parenthetical' | 'dialogue', text: string, changed?: boolean): Line[] =>
  wrap(kind === 'character' ? text.toUpperCase() : text, DUAL[kind].span).map((t) => ({ kind, text: t, indent: DUAL[kind].indent, ...(changed ? { changed } : {}) }));

function unitsOf(scene: LayoutScene): Unit[] {
  if (scene.omitted) return [{ kind: 'heading', lines: [{ kind: 'sceneHeading', text: 'OMITTED', indent: 0, ...(scene.changed ? { changed: true } : {}) }], scene: scene.number, space: 1 }];
  const units: Unit[] = [];
  const els = scene.elements;
  let numbered = false;
  for (let i = 0; i < els.length; i++) {
    const e = els[i]!;
    if (e.type === 'sceneHeading') {
      units.push({ kind: 'heading', lines: lines('sceneHeading', e.text, e.changed), scene: numbered ? undefined : scene.number, space: 1 });
      numbered = true;
    } else if (e.type === 'action' || e.type === 'transition') {
      units.push({ kind: e.type, lines: lines(e.type, e.text, e.changed), space: 1 });
    } else {
      // A speech: the cue, then its parentheticals and lines.
      const start = i;
      const cue = e.type === 'character' ? e : null;
      if (cue) i++;
      const body: LayoutElement[] = [];
      while (i < els.length && (els[i]!.type === 'dialogue' || els[i]!.type === 'parenthetical')) body.push(els[i++]!);
      i--;
      const next = els[i + 1];
      if (cue && next?.type === 'character' && next.dual && !cue.dual) {
        // The other half of dual dialogue: both speeches, side by side.
        let j = i + 2;
        const other: LayoutElement[] = [];
        while (j < els.length && (els[j]!.type === 'dialogue' || els[j]!.type === 'parenthetical')) other.push(els[j++]!);
        const side = (c: LayoutElement, b: LayoutElement[]) => [...dualLines('character', c.text, c.changed), ...b.flatMap((x) => dualLines(x.type as 'dialogue' | 'parenthetical', x.text, x.changed))];
        units.push({ kind: 'dual', left: side(cue, body), right: side(next, other), space: 1 });
        i = j - 1;
        continue;
      }
      if (!cue && !body.length) {
        i = start;
        continue;
      }
      units.push({
        kind: 'speech',
        speech: { cue: cue ? lines('character', cue.text, cue.changed) : [], body: body.flatMap((x) => lines(x.type as 'dialogue' | 'parenthetical', x.text, x.changed)) },
        space: cue ? 1 : 0,
      });
    }
  }
  return units;
}

const height = (u: Unit) => (u.kind === 'speech' ? u.speech.cue.length + u.speech.body.length : u.kind === 'dual' ? Math.max(u.left.length, u.right.length) : u.lines.length);

/** How many lines of a unit must come with a scene heading onto its page. */
const leadOf = (u: Unit | undefined) => (!u ? 0 : u.kind === 'speech' ? Math.min(height(u), u.speech.cue.length + 2) : Math.min(height(u), 2));

/** Lays the scenes out on pages. */
export function layoutScript(scenes: LayoutScene[], perPage = LINES_PER_PAGE): Layout {
  const pages: Page[] = [];
  let items: PageItem[] = [];
  let used = 0;
  let current = '';
  const lengths: Record<string, { lines: number; page: number }> = {};
  const count = (n: number) => {
    const s = lengths[current];
    if (s) s.lines += n;
  };
  const newPage = () => {
    pages.push({ number: pages.length + 1, items, changed: items.some((it) => (it.kind === 'line' ? it.line.changed : it.kind === 'dual' ? [...it.left, ...it.right].some((l) => l.changed) : false)) });
    items = [];
    used = 0;
  };
  const blank = (n: number) => {
    if (!used) return;
    for (let k = 0; k < n; k++) items.push({ kind: 'blank' });
    used += n;
    count(n);
  };
  const put = (ls: Line[], scene?: string) => {
    ls.forEach((line, k) => items.push(k === 0 && scene ? { kind: 'line', line, scene } : { kind: 'line', line }));
    used += ls.length;
    count(ls.length);
  };

  for (const scene of scenes) {
    current = scene.id;
    lengths[scene.id] = { lines: 0, page: pages.length + 1 };
    let started = false;
    const units = unitsOf(scene);
    units.forEach((unit, index) => {
      const space = used ? unit.space : 0;
      const free = perPage - used - space;
      const h = height(unit);
      if (unit.kind === 'heading') {
        // Never the last thing on a page: it brings the start of what follows.
        if (h + leadOf(units[index + 1]) > free && used) newPage();
        if (!started) lengths[scene.id]!.page = pages.length + 1;
        started = true;
        blank(unit.space);
        put(unit.lines, unit.scene);
        return;
      }
      if (!started) {
        lengths[scene.id]!.page = pages.length + 1;
        started = true;
      }
      if (h <= free) {
        blank(unit.space);
        if (unit.kind === 'speech') put([...unit.speech.cue, ...unit.speech.body]);
        else if (unit.kind === 'dual') {
          items.push({ kind: 'dual', left: unit.left, right: unit.right });
          used += h;
          count(h);
        } else put(unit.lines);
        return;
      }
      // It doesn't fit: break it, or start it on the next page.
      if (unit.kind === 'action' && free >= 2 && h >= 4) {
        const take = Math.min(free, h - 2);
        blank(unit.space);
        put(unit.lines.slice(0, take));
        newPage();
        put(unit.lines.slice(take));
        return;
      }
      if (unit.kind === 'speech' && unit.speech.cue.length) {
        const { cue, body } = unit.speech;
        // Lines of the speech on this page: at least 2, room for the cue and (MORE), not ending on a parenthetical, at least 2 left over.
        let take = Math.min(body.length - 2, free - cue.length - 1);
        while (take >= 2 && body[take - 1]!.kind === 'parenthetical') take--;
        if (take >= 2) {
          blank(unit.space);
          put([...cue, ...body.slice(0, take), { kind: 'more', text: '(MORE)', indent: INDENT.more }]);
          newPage();
          const name = cueName(cue.map((l) => l.text).join(' '));
          put([...lines('character', `${name} (CONT'D)`), ...body.slice(take)]);
          return;
        }
      }
      if (used) newPage();
      if (unit.kind === 'speech') put([...unit.speech.cue, ...unit.speech.body]);
      else if (unit.kind === 'dual') {
        items.push({ kind: 'dual', left: unit.left, right: unit.right });
        used += h;
        count(h);
      } else {
        // Longer than a page: it runs on.
        let rest = unit.lines;
        while (rest.length > perPage - used) {
          const take = perPage - used;
          put(rest.slice(0, take));
          rest = rest.slice(take);
          newPage();
        }
        put(rest);
      }
    });
  }
  if (items.length || !pages.length) newPage();

  const out: Layout['scenes'] = {};
  let total = 0;
  for (const [id, { lines: n, page }] of Object.entries(lengths)) {
    const eighths = Math.max(1, Math.round((n / perPage) * 8));
    out[id] = { eighths, page };
    total += eighths;
  }
  return { pages, scenes: out, eighths: total };
}

/** 11 eighths → "1 3/8"; 4 → "4/8"; 16 → "2". */
export function eighthsLabel(eighths: number): string {
  const whole = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (!rest) return String(whole);
  return whole ? `${whole} ${rest}/8` : `${rest}/8`;
}

/** Adds (CONT'D) to a character who speaks again with only action between, in the same scene. */
export function withContinueds<T extends ScriptElement>(elements: T[]): T[] {
  let last = '';
  return elements.map((e) => {
    if (e.type === 'sceneHeading' || e.type === 'transition') last = '';
    if (e.type !== 'character') return e;
    const name = cueName(e.text);
    const again = name && name === last && !e.dual && !/\(\s*cont['’]?d\s*\)/i.test(e.text);
    last = name;
    return again ? { ...e, text: `${e.text.trim()} (CONT'D)` } : e;
  });
}
