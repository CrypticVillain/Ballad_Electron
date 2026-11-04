import { looksLikeHeading } from './elements';
import { emptyTitlePage, type ScriptElement, type TitlePage } from './model';

/**
 * Filmmaking → Script: Fountain, the plain-text screenplay format (pure).
 * Written out with forced marks where a line could be misread; read back with
 * the common rules: title page keys, scene headings (INT./EXT. or a leading
 * "."), all-caps character cues, (parentheticals), transitions ending "TO:",
 * "^" for dual dialogue, "#" sections (which become sequences). Notes [[…]],
 * boneyard /*…*\/ and synopses (=) are left out; *emphasis* marks are dropped.
 */

export type FountainSection = { title: string; scenes: { number?: string; elements: ScriptElement[] }[] };
export type FountainScript = { titlePage: TitlePage; sections: FountainSection[] };

const TITLE_KEYS: Record<string, keyof TitlePage> = {
  title: 'title',
  credit: 'credit',
  author: 'authors',
  authors: 'authors',
  source: 'source',
  'draft date': 'date',
  date: 'date',
  draft: 'draft',
  contact: 'contact',
  notes: 'draft',
};

// ── Writing ──

const isUpperLine = (text: string) => /\p{Lu}/u.test(text) && text === text.toUpperCase();

/** One script as Fountain text. Sections ("# Act One") only when there's more than one. */
export function toFountain(script: { titlePage: TitlePage; title: string; sections: { title: string; scenes: { number?: string; elements: ScriptElement[] }[] }[] }): string {
  const out: string[] = [];
  const tp = script.titlePage;
  const title = tp.title || script.title;
  const head: string[] = [];
  if (title) head.push(`Title: ${title}`);
  if (tp.credit) head.push(`Credit: ${tp.credit}`);
  if (tp.authors) head.push(`Author: ${tp.authors}`);
  if (tp.source) head.push(`Source: ${tp.source}`);
  if (tp.draft) head.push(`Draft: ${tp.draft}`);
  if (tp.date) head.push(`Draft date: ${tp.date}`);
  if (tp.contact.trim()) head.push('Contact:', ...tp.contact.split('\n').map((l) => `    ${l}`));
  if (head.length) out.push(head.join('\n'), '');
  const sections = script.sections.length > 1;
  for (const section of script.sections) {
    if (sections) out.push(`# ${section.title || 'Untitled'}`, '');
    for (const scene of section.scenes) {
      let numbered = false;
      const els = scene.elements;
      for (let i = 0; i < els.length; i++) {
        const e = els[i]!;
        const text = e.text.trim();
        switch (e.type) {
          case 'sceneHeading': {
            const line = text.toUpperCase();
            const mark = scene.number && !numbered ? ` #${scene.number}#` : '';
            numbered = true;
            out.push(`${looksLikeHeading(line) ? '' : '.'}${line}${mark}`, '');
            break;
          }
          case 'action':
            // A lone all-caps line (or one that looks like a heading or transition) would be misread: force it.
            out.push(`${isUpperLine(text) && !text.includes('\n') ? '!' : looksLikeHeading(text) ? '!' : ''}${text}`, '');
            break;
          case 'transition': {
            const line = text.toUpperCase();
            out.push(`${/TO:$/.test(line) ? '' : '> '}${line}`, '');
            break;
          }
          case 'character': {
            const name = text.toUpperCase();
            const lines = [`${isUpperLine(text) ? '' : '@'}${name}${e.dual ? ' ^' : ''}`];
            while (els[i + 1] && (els[i + 1]!.type === 'dialogue' || els[i + 1]!.type === 'parenthetical')) {
              const next = els[++i]!;
              const t = next.text.trim();
              lines.push(next.type === 'parenthetical' ? (t.startsWith('(') ? t : `(${t})`) : t);
            }
            out.push(lines.join('\n'), '');
            break;
          }
          case 'parenthetical':
          case 'dialogue':
            // A line with no one speaking it: keep it, as action.
            out.push(text, '');
            break;
        }
      }
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// ── Reading ──

const stripMarkup = (text: string) =>
  text
    .replace(/\\\*/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(//g, '*');

/** Fountain text as a title page and sections of scenes. */
export function fromFountain(source: string): FountainScript {
  let text = source.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
  const lines = text.split('\n');
  const titlePage = emptyTitlePage();
  titlePage.credit = '';
  let start = 0;

  // A title page: "Key: value" lines (values may run on, indented) up to the first blank line.
  if (/^[A-Za-z][A-Za-z ]*:/.test(lines[0] ?? '')) {
    let key: keyof TitlePage | null = null;
    let i = 0;
    for (; i < lines.length && lines[i]!.trim(); i++) {
      const line = lines[i]!;
      const pair = line.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/);
      if (pair && !/^\s/.test(line)) {
        key = TITLE_KEYS[pair[1]!.toLowerCase()] ?? null;
        if (key && pair[2]) titlePage[key] = titlePage[key] ? `${titlePage[key]}\n${pair[2]}` : pair[2];
      } else if (key) {
        titlePage[key] = titlePage[key] ? `${titlePage[key]}\n${line.trim()}` : line.trim();
      }
    }
    start = i + 1;
    for (const k of Object.keys(titlePage) as (keyof TitlePage)[]) titlePage[k] = stripMarkup(titlePage[k]);
  }
  if (!titlePage.credit) titlePage.credit = 'Written by';

  const sections: FountainSection[] = [{ title: '', scenes: [] }];
  const section = () => sections.at(-1)!;
  const scene = () => {
    if (!section().scenes.length) section().scenes.push({ elements: [] });
    return section().scenes.at(-1)!;
  };
  const push = (e: ScriptElement) => scene().elements.push(e);

  const blankAt = (i: number) => i < start || i >= lines.length || !lines[i]!.trim();
  let action: string[] = [];
  const flushAction = () => {
    if (action.length) push({ type: 'action', text: stripMarkup(action.join('\n')).trim() });
    action = [];
  };

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line) {
      flushAction();
      continue;
    }
    const before = blankAt(i - 1);
    const after = blankAt(i + 1);
    // Sections and synopses; page breaks.
    if (/^#+/.test(line)) {
      flushAction();
      const title = line.replace(/^#+\s*/, '');
      if (section().scenes.length || section().title) sections.push({ title, scenes: [] });
      else section().title = title;
      continue;
    }
    if (/^=(?!=)/.test(line) || /^={3,}$/.test(line)) continue;
    // A scene heading.
    if (before && ((line.startsWith('.') && !line.startsWith('..')) || looksLikeHeading(line))) {
      flushAction();
      let heading = line.replace(/^\./, '');
      const number = heading.match(/\s*#([^#]+)#\s*$/);
      if (number) heading = heading.slice(0, number.index).trim();
      section().scenes.push({ ...(number ? { number: number[1]!.trim() } : {}), elements: [{ type: 'sceneHeading', text: stripMarkup(heading).toUpperCase() }] });
      continue;
    }
    // A transition.
    if (before && after && ((line.startsWith('>') && !line.endsWith('<')) || (isUpperLine(line) && /TO:$/.test(line)))) {
      flushAction();
      push({ type: 'transition', text: stripMarkup(line.replace(/^>\s*/, '')).toUpperCase() });
      continue;
    }
    // A character, then what they say.
    const forcedCue = line.startsWith('@');
    if (before && !after && !line.startsWith('!') && (forcedCue || (isUpperLine(line.replace(/\^$/, '').replace(/\([^)]*\)/g, '')) && /\p{L}/u.test(line)))) {
      flushAction();
      const dual = /\^\s*$/.test(line);
      const name = line.replace(/^@/, '').replace(/\s*\^\s*$/, '').trim();
      push({ type: 'character', text: name.toUpperCase(), ...(dual ? { dual: true } : {}) });
      let said: string[] = [];
      const flushSaid = () => {
        if (said.length) push({ type: 'dialogue', text: stripMarkup(said.join(' ')).trim() });
        said = [];
      };
      while (i + 1 < lines.length && lines[i + 1]!.trim()) {
        const next = lines[++i]!.trim();
        if (next.startsWith('(') && next.endsWith(')')) {
          flushSaid();
          push({ type: 'parenthetical', text: next });
        } else said.push(next.replace(/^~\s*/, ''));
      }
      flushSaid();
      continue;
    }
    // Centered text and forced action read as action.
    action.push(line.replace(/^!/, '').replace(/^>\s*(.*?)\s*<$/, '$1'));
  }
  flushAction();
  return { titlePage, sections: sections.filter((s) => s.scenes.length || s.title) };
}

