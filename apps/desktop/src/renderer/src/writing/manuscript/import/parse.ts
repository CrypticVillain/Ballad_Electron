import type { Para, ParaKind, Run } from '../export/document';

/**
 * Writing → Import A Book (pure): a manuscript from another app as a book of
 * acts and scenes. Markdown and plain text, a Word document (.docx: its
 * document.xml) and a Scrivener project (its .scrivx binder and each
 * document's RTF). Campfire and most other apps export to one of these.
 *
 * Every format is first read as a flat list of headings, paragraphs and
 * scene breaks; then the headings make the acts and scenes: with two levels
 * of headings, the first is the act and the second the scene; with one,
 * each heading is a scene of one act; with none, scene breaks (* * *, #)
 * split the text into scenes. A single heading above all the others (or a
 * Word "Title") is the book's title.
 */

export type ImportScene = { title: string; paras: Para[] };
export type ImportPart = { title: string; scenes: ImportScene[] };
export type ImportBook = { title: string; parts: ImportPart[] };

/** A run's look, with only the styles it has. */
const styled = (text: string, look: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }): Run => ({
  text,
  ...(look.bold ? { bold: true } : {}),
  ...(look.italic ? { italic: true } : {}),
  ...(look.underline ? { underline: true } : {}),
  ...(look.strike ? { strike: true } : {}),
});
const sameLook = (a: Run, b: Run) => Boolean(a.bold) === Boolean(b.bold) && Boolean(a.italic) === Boolean(b.italic) && Boolean(a.underline) === Boolean(b.underline) && Boolean(a.strike) === Boolean(b.strike);

type Line = { heading: number; text: string } | { para: Para } | { brk: true } | { title: string };

const BREAK = /^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,}|#|~+|(?:•\s*){3,})\s*$/;

/** Headings, paragraphs and breaks as a book: see above. */
export function structure(lines: Line[], fallbackTitle: string): ImportBook {
  let title = '';
  const body: Exclude<Line, { title: string }>[] = [];
  for (const line of lines) {
    if ('title' in line) title ||= line.title.trim();
    else body.push(line);
  }
  let headings = body.filter((l): l is { heading: number; text: string } => 'heading' in l);
  // One heading above every other one, and first: the book's title.
  if (!title && headings.length > 1) {
    const top = Math.min(...headings.map((h) => h.heading));
    const tops = headings.filter((h) => h.heading === top);
    if (tops.length === 1 && body.find((l) => 'heading' in l) === tops[0]) {
      title = tops[0]!.text.trim();
      body.splice(body.indexOf(tops[0]!), 1);
      headings = headings.filter((h) => h !== tops[0]);
    }
  }
  const levels = [...new Set(headings.map((h) => h.heading))].sort((a, b) => a - b);
  const partLevel = levels.length >= 2 ? levels[0]! : null;
  const sceneLevel = levels.length >= 2 ? levels[1]! : (levels[0] ?? null);

  const parts: ImportPart[] = [];
  let part: ImportPart | null = null;
  let scene: ImportScene | null = null;
  const ensurePart = () => {
    if (!part) parts.push((part = { title: '', scenes: [] }));
    return part;
  };
  const ensureScene = () => {
    if (!scene) ensurePart().scenes.push((scene = { title: '', paras: [] }));
    return scene;
  };
  for (const line of body) {
    if ('heading' in line) {
      if (line.heading === partLevel) {
        parts.push((part = { title: line.text.trim(), scenes: [] }));
        scene = null;
      } else if (line.heading === sceneLevel) {
        ensurePart().scenes.push((scene = { title: line.text.trim(), paras: [] }));
      } else ensureScene().paras.push({ kind: 'h3', runs: [{ text: line.text.trim() }] });
    } else if ('brk' in line) {
      // A break starts the next scene, once this one has something in it.
      if (scene && scene.paras.length) scene = null;
    } else ensureScene().paras.push(line.para);
  }
  if (!parts.length) parts.push({ title: '', scenes: [] });
  for (const p of parts) if (!p.scenes.length) p.scenes.push({ title: '', paras: [] });
  return { title: title || fallbackTitle, parts };
}

// ── Markdown and plain text ───────────────────────────────────────────────

/** **bold**, *italic* (or _italic_), ***both***, ~~struck~~, and \\-escapes, as runs. */
export function inlineMarkdown(text: string): Run[] {
  const runs: Run[] = [];
  const re = /\\([\\*_~`#])|\*\*\*(.+?)\*\*\*|(\*\*|__)(.+?)\3|(\*|_)(?=\S)(.+?)(?<=\S)\5(?![\w*])|~~(.+?)~~/g;
  let at = 0;
  const plainText = (t: string) => t && runs.push({ text: t });
  for (let m = re.exec(text); m; m = re.exec(text)) {
    plainText(text.slice(at, m.index));
    if (m[1] !== undefined) plainText(m[1]);
    else if (m[2] !== undefined) runs.push({ text: m[2], bold: true, italic: true });
    else if (m[4] !== undefined) runs.push(...inlineMarkdown(m[4]).map((r) => ({ ...r, bold: true })));
    else if (m[6] !== undefined) runs.push(...inlineMarkdown(m[6]).map((r) => ({ ...r, italic: true })));
    else if (m[7] !== undefined) runs.push({ text: m[7], strike: true });
    at = m.index + m[0].length;
  }
  plainText(text.slice(at));
  // Neighbors with the same look become one run.
  return runs.reduce<Run[]>((out, r) => {
    const last = out.at(-1);
    if (last && sameLook(last, r)) last.text += r.text;
    else out.push({ ...r });
    return out;
  }, []);
}

/**
 * Markdown (or, with `plain`, a text file: no headings or styles, and each
 * line its own paragraph) as lines. Paragraphs are lines between blank ones.
 */
export function markdownLines(text: string, plain = false): Line[] {
  const out: Line[] = [];
  let buffer: string[] = [];
  let kind: ParaKind = 'p';
  const flush = () => {
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) out.push({ para: { kind, runs: plain ? [{ text: joined }] : inlineMarkdown(joined) } });
    buffer = [];
    kind = 'p';
  };
  const source = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, '\n');
  // Front matter (--- … --- at the very top) isn't the book.
  const body = !plain && source.startsWith('---\n') && source.indexOf('\n---', 4) > 0 ? source.slice(source.indexOf('\n---', 4) + 4) : source;
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (BREAK.test(line)) {
      flush();
      out.push({ brk: true });
      continue;
    }
    const heading = plain ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      out.push({ heading: heading[1]!.length, text: heading[2]!.replace(/[*_]/g, '') });
      continue;
    }
    const quote = plain ? null : /^\s*>\s?(.*)$/.exec(line);
    const bullet = plain ? null : /^\s*[-*+]\s+(.*)$/.exec(line);
    const number = plain ? null : /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || number) {
      flush();
      kind = bullet ? 'bullet' : 'number';
      buffer.push((bullet ?? number)![1]!);
      flush();
      continue;
    }
    if (quote) {
      if (kind !== 'quote') flush();
      kind = 'quote';
      buffer.push(quote[1]!);
      continue;
    }
    if (kind === 'quote') flush();
    buffer.push(line.trim());
    if (plain) flush();
  }
  flush();
  return out;
}

// ── Word (.docx) ──────────────────────────────────────────────────────────

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** A toggle in a run's properties (<w:b/>, <w:i w:val="0"/>): on, unless its value says off. */
const flag = (props: string, tag: string) => {
  const m = new RegExp(`<w:${tag}(?:\\s+w:val="([^"]*)")?\\s*/>`).exec(props);
  return Boolean(m) && !['0', 'false', 'none'].includes(m![1] ?? '');
};

/** A Word document's paragraphs (word/document.xml) as lines; styles.xml says which styles are headings and the title. */
export function docxLines(documentXml: string, stylesXml = ''): Line[] {
  const names = new Map<string, string>();
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = /<w:name\s+w:val="([^"]+)"/.exec(m[2]!)?.[1];
    if (name) names.set(m[1]!, name.toLowerCase());
  }
  const out: Line[] = [];
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml)?.[1] ?? documentXml;
  for (const p of body.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const inner = p[1]!;
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(inner)?.[1] ?? '';
    const styleId = /<w:pStyle\s+w:val="([^"]+)"/.exec(pPr)?.[1] ?? '';
    const style = names.get(styleId) ?? styleId.toLowerCase();
    const runs: Run[] = [];
    for (const r of inner.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)) {
      const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r[1]!)?.[1] ?? '';
      let text = '';
      for (const piece of r[1]!.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) text += piece[1] !== undefined ? decodeXml(piece[1]) : ' ';
      if (!text) continue;
      const run = styled(text, { bold: flag(rPr, 'b'), italic: flag(rPr, 'i'), underline: /<w:u\s+w:val="(?!none)/.test(rPr), strike: flag(rPr, 'strike') });
      const last = runs.at(-1);
      if (last && sameLook(last, run)) last.text += text;
      else runs.push(run);
    }
    const text = runs.map((r) => r.text).join('');
    if (!text.trim()) continue;
    const outline = /<w:outlineLvl\s+w:val="(\d)"/.exec(pPr)?.[1];
    const level = /^heading\s*(\d)$/.exec(style)?.[1] ?? /^heading(\d)$/.exec(style)?.[1] ?? (outline !== undefined ? String(Number(outline) + 1) : undefined);
    if (style === 'title') out.push({ title: text });
    else if (level) out.push({ heading: Number(level), text: text.trim() });
    else if (BREAK.test(text)) out.push({ brk: true });
    else {
      const kind: ParaKind = /<w:numPr>/.test(pPr) ? 'bullet' : /quote/.test(style) ? 'quote' : 'p';
      out.push({ para: { kind, runs: trimRuns(runs) } });
    }
  }
  return out;
}

/** Runs without the paragraph's leading and trailing spaces. */
function trimRuns(runs: Run[]): Run[] {
  const out = runs.map((r) => ({ ...r }));
  if (out[0]) out[0].text = out[0].text.trimStart();
  if (out.at(-1)) out.at(-1)!.text = out.at(-1)!.text.trimEnd();
  return out.filter((r) => r.text);
}

// ── Scrivener (.scrivx and RTF) ───────────────────────────────────────────

/** Destinations that hold no text of the document. */
const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf', 'fldinst', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'pgdsctbl', 'expandedcolortbl', 'filetbl', 'revtbl', 'object', 'nonshppict', 'shppict', 'bkmkstart', 'bkmkend', 'annotation', 'atnid', 'atnauthor']);

/** An RTF document's text as paragraphs, with bold, italic, underline and strike. */
export function rtfToParas(rtf: string): Para[] {
  type State = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; skip: boolean; uc: number };
  let state: State = { bold: false, italic: false, underline: false, strike: false, skip: false, uc: 1 };
  const stack: State[] = [];
  const paras: Para[] = [];
  let runs: Run[] = [];
  let skipChars = 0;
  const cp1252 = new TextDecoder('windows-1252');
  const add = (text: string) => {
    if (state.skip) return;
    if (skipChars > 0) {
      skipChars--;
      return;
    }
    const run = styled(text, state);
    const last = runs.at(-1);
    if (last && sameLook(last, run)) last.text += text;
    else runs.push(run);
  };
  const par = () => {
    if (state.skip) return;
    const trimmed = trimRuns(runs);
    if (trimmed.some((r) => r.text.trim())) paras.push({ kind: 'p', runs: trimmed });
    runs = [];
  };
  let i = 0;
  let groupStart = false;
  while (i < rtf.length) {
    const c = rtf[i]!;
    if (c === '{') {
      stack.push(state);
      state = { ...state };
      groupStart = true;
      i++;
      continue;
    }
    if (c === '}') {
      state = stack.pop() ?? state;
      groupStart = false;
      i++;
      continue;
    }
    if (c === '\\') {
      const next = rtf[i + 1] ?? '';
      if (next === '\\' || next === '{' || next === '}') {
        add(next);
        i += 2;
      } else if (next === "'") {
        add(cp1252.decode(new Uint8Array([Number.parseInt(rtf.slice(i + 2, i + 4), 16) || 32])));
        i += 4;
      } else if (next === '*') {
        state.skip = true;
        i += 2;
      } else if (next === '~') {
        add(' ');
        i += 2;
      } else if (next === '\n' || next === '\r') {
        par();
        i += 2;
      } else if (/[a-z]/i.test(next)) {
        const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40))!;
        const word = m[1]!;
        const param = m[2] === undefined ? null : Number(m[2]);
        i += m[0].length;
        if (groupStart && SKIP.has(word)) state.skip = true;
        else if (word === 'par' || word === 'sect' || word === 'page') par();
        else if (word === 'line' || word === 'tab' || word === 'emspace' || word === 'enspace') add(' ');
        else if (word === 'emdash') add('—');
        else if (word === 'endash') add('–');
        else if (word === 'lquote') add('‘');
        else if (word === 'rquote') add('’');
        else if (word === 'ldblquote') add('“');
        else if (word === 'rdblquote') add('”');
        else if (word === 'bullet') add('•');
        else if (word === 'b') state.bold = param !== 0;
        else if (word === 'i') state.italic = param !== 0;
        else if (word === 'ul') state.underline = param !== 0;
        else if (word === 'ulnone') state.underline = false;
        else if (word === 'strike') state.strike = param !== 0;
        else if (word === 'plain') Object.assign(state, { bold: false, italic: false, underline: false, strike: false });
        else if (word === 'uc') state.uc = param ?? 1;
        else if (word === 'u' && param !== null) {
          add(String.fromCharCode(param < 0 ? param + 65536 : param));
          skipChars = state.uc;
        }
      } else i += 2;
      groupStart = false;
      continue;
    }
    if (c === '\n' || c === '\r') {
      i++;
      continue;
    }
    groupStart = false;
    add(c);
    i++;
  }
  par();
  return paras;
}

type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

/** A small XML reader: elements, attributes and text (enough for a Scrivener binder). */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(re)) {
    const top = stack.at(-1)!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[6] !== undefined) top.text += decodeXml(m[6]);
    else if (m[3]) {
      if (m[2]) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attrs: Record<string, string> = {};
      for (const a of (m[4] ?? '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]!] = decodeXml(a[2] ?? a[3] ?? '');
      const node: XmlNode = { name: m[3], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    }
  }
  return root;
}

const child = (node: XmlNode | undefined, name: string) => node?.children.find((c) => c.name === name);
const kids = (node: XmlNode | undefined, name: string) => node?.children.filter((c) => c.name === name) ?? [];

/**
 * A Scrivener project's Draft (the Manuscript) as a book: its folders are
 * acts and its documents scenes (a folder inside a folder adds its
 * documents to the act); documents loose in the Draft make acts of their
 * own. `docs` holds each document's RTF by its UUID (Scrivener 3) or ID
 * (Scrivener 2).
 */
export function scrivenerBook(scrivx: string, docs: Record<string, string>, fallbackTitle: string): ImportBook {
  const project = parseXml(scrivx).children.find((c) => c.name === 'ScrivenerProject');
  const binder = child(project, 'Binder');
  const items = kids(binder, 'BinderItem');
  const draft = items.find((i) => i.attrs.Type === 'DraftFolder') ?? items[0];
  const id = (item: XmlNode) => item.attrs.UUID ?? item.attrs.ID ?? '';
  const title = (item: XmlNode) => (child(item, 'Title')?.text ?? '').trim();
  const childrenOf = (item: XmlNode) => kids(child(item, 'Children'), 'BinderItem');
  const content = (item: XmlNode) => (docs[id(item)] ? rtfToParas(docs[id(item)]!) : []);
  /** A folder's scenes: its own text (if any), then its documents, folders within folded in. */
  const scenesOf = (folder: XmlNode): ImportScene[] =>
    childrenOf(folder).flatMap((item) => {
      const own = content(item);
      if (item.attrs.Type === 'Folder') return [...(own.length ? [{ title: title(item), paras: own }] : []), ...scenesOf(item)];
      return [{ title: title(item), paras: own }];
    });

  const parts: ImportPart[] = [];
  let loose: ImportPart | null = null;
  for (const item of draft ? childrenOf(draft) : []) {
    if (item.attrs.Type === 'Folder') {
      loose = null;
      const own = content(item);
      parts.push({ title: title(item), scenes: [...(own.length ? [{ title: '', paras: own }] : []), ...scenesOf(item)] });
    } else {
      if (!loose) parts.push((loose = { title: '', scenes: [] }));
      loose.scenes.push({ title: title(item), paras: content(item) });
    }
  }
  if (!parts.length) parts.push({ title: '', scenes: [] });
  for (const p of parts) if (!p.scenes.length) p.scenes.push({ title: '', paras: [] });
  return { title: fallbackTitle, parts };
}

/** A file's name without its folder and extension: the book's title when the file has none. */
export const baseName = (name: string) => name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim() || 'Imported Book';

/** Counts for the toast: "2 acts, 14 scenes". */
export const importSummary = (book: ImportBook) => {
  const scenes = book.parts.reduce((n, p) => n + p.scenes.length, 0);
  return `${book.parts.length} ${book.parts.length === 1 ? 'act' : 'acts'}, ${scenes} ${scenes === 1 ? 'scene' : 'scenes'}`;
};
