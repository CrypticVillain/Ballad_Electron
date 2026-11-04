import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { escapeXml, type ExportBook, type ExportOptions, type Para, type Run } from './document';

/**
 * Writing → Manuscript export: a book (export/document) as HTML (for PDF), a
 * Word document, an EPUB, or Markdown. Laid out like a manuscript: acts on
 * new pages, scene breaks as a centered * * *, first lines indented.
 */

const BREAK = '* * *';

// ── HTML (printed to PDF by the main process; EPUB chapters reuse it) ──

const runHtml = (r: Run) => {
  let t = escapeXml(r.text);
  if (r.bold) t = `<strong>${t}</strong>`;
  if (r.italic) t = `<em>${t}</em>`;
  if (r.underline) t = `<u>${t}</u>`;
  if (r.strike) t = `<s>${t}</s>`;
  return t;
};
const parasHtml = (paras: Para[]) => {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  for (const p of paras) {
    const want = p.kind === 'bullet' ? 'ul' : p.kind === 'number' ? 'ol' : null;
    if (list && want !== list) {
      out.push(`</${list}>`);
      list = null;
    }
    if (want && !list) {
      out.push(`<${want}>`);
      list = want;
    }
    const body = p.runs.map(runHtml).join('');
    if (want) out.push(`<li>${body}</li>`);
    else if (p.kind === 'quote') out.push(`<blockquote><p>${body}</p></blockquote>`);
    else if (p.kind === 'p') out.push(`<p>${body}</p>`);
    else out.push(`<${p.kind === 'h1' ? 'h3' : p.kind === 'h2' ? 'h4' : 'h5'}>${body}</${p.kind === 'h1' ? 'h3' : p.kind === 'h2' ? 'h4' : 'h5'}>`);
  }
  if (list) out.push(`</${list}>`);
  return out.join('\n');
};

/** One part's scenes, scene breaks between them. */
const partBody = (part: ExportBook['parts'][number], options: ExportOptions) =>
  part.scenes
    .map((scene, i) => [i > 0 ? `<p class="break">${BREAK}</p>` : '', options.sceneTitles && scene.title ? `<h3 class="scene">${escapeXml(scene.title)}</h3>` : '', parasHtml(scene.paras)].filter(Boolean).join('\n'))
    .join('\n');

const STYLE = `
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #111; margin: 0; }
  h1.title { font-size: 26pt; text-align: center; margin: 30% 0 0.4em; font-weight: normal; letter-spacing: 0.04em; }
  p.byline { text-align: center; font-style: italic; margin: 0; }
  h2 { font-size: 16pt; text-align: center; font-weight: normal; margin: 3em 0 1.5em; letter-spacing: 0.06em; }
  h3.scene { font-size: 12pt; text-align: center; font-style: italic; font-weight: normal; margin: 1.5em 0 1em; }
  h3, h4, h5 { font-weight: bold; margin: 1em 0 0.4em; }
  p { margin: 0; text-indent: 1.5em; }
  h2 + p, h3 + p, p.break + p, blockquote + p { text-indent: 0; }
  p.break { text-align: center; text-indent: 0; margin: 1.2em 0; letter-spacing: 0.3em; }
  blockquote { margin: 0.8em 2em; font-style: italic; }
  blockquote p { text-indent: 0; }
  .part { page-break-before: always; break-before: page; }
`;

/** The whole book as one HTML page, for printing to PDF. */
export function toHtml(book: ExportBook, options: ExportOptions): string {
  const parts = book.parts
    .map((part) => `<section class="part">${options.partHeadings ? `<h2>${escapeXml(part.heading)}</h2>` : ''}\n${partBody(part, options)}</section>`)
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(book.title)}</title><style>${STYLE}</style></head><body><h1 class="title">${escapeXml(book.title)}</h1>${book.byline ? `<p class="byline">${escapeXml(book.byline)}</p>` : ''}\n${parts}</body></html>`;
}

// ── Markdown ──

const runMd = (r: Run) => {
  if (!r.text.trim()) return r.text;
  let t = r.text;
  if (r.bold && r.italic) t = `***${t}***`;
  else if (r.bold) t = `**${t}**`;
  else if (r.italic) t = `*${t}*`;
  if (r.strike) t = `~~${t}~~`;
  return t;
};

export function toMarkdown(book: ExportBook, options: ExportOptions): string {
  const out = [`# ${book.title}`, ''];
  if (book.byline) out.push(`*${book.byline}*`, '');
  for (const part of book.parts) {
    if (options.partHeadings) out.push(`## ${part.heading}`, '');
    part.scenes.forEach((scene, i) => {
      if (i > 0) out.push(BREAK, '');
      if (options.sceneTitles && scene.title) out.push(`### ${scene.title}`, '');
      let n = 0;
      for (const p of scene.paras) {
        const body = p.runs.map(runMd).join('');
        n = p.kind === 'number' ? n + 1 : 0;
        out.push(p.kind === 'bullet' ? `- ${body}` : p.kind === 'number' ? `${n}. ${body}` : p.kind === 'quote' ? `> ${body}` : p.kind === 'p' ? body : `${'#'.repeat(Number(p.kind[1]) + 3)} ${body}`, '');
      }
    });
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ── Word ──

const docxRuns = (runs: Run[]) => runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined, strike: r.strike }));

export async function toDocx(book: ExportBook, options: ExportOptions): Promise<Uint8Array> {
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000, after: 200 }, children: [new TextRun({ text: book.title, size: 52 })] }),
    ...(book.byline ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: book.byline, italics: true })] })] : []),
  ];
  for (const part of book.parts) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    if (options.partHeadings) body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 600, after: 400 }, children: [new TextRun(part.heading)] }));
    part.scenes.forEach((scene, i) => {
      if (i > 0) body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, children: [new TextRun(BREAK)] }));
      if (options.sceneTitles && scene.title) body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, children: [new TextRun({ text: scene.title, italics: true })] }));
      let n = 0;
      scene.paras.forEach((p, j) => {
        const first = j === 0;
        n = p.kind === 'number' ? n + 1 : 0;
        if (p.kind === 'bullet') body.push(new Paragraph({ bullet: { level: 0 }, children: docxRuns(p.runs) }));
        else if (p.kind === 'number') body.push(new Paragraph({ indent: { left: 360 }, children: docxRuns([{ text: `${n}. ` }, ...p.runs]) }));
        else if (p.kind === 'quote') body.push(new Paragraph({ indent: { left: 720, right: 720 }, children: docxRuns(p.runs.map((r) => ({ ...r, italic: true }))) }));
        else if (p.kind !== 'p') body.push(new Paragraph({ heading: p.kind === 'h1' ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4, children: docxRuns(p.runs) }));
        else body.push(new Paragraph({ indent: first ? undefined : { firstLine: 360 }, spacing: { line: 360 }, children: docxRuns(p.runs) }));
      });
    });
  }
  const doc = new Document({
    creator: book.byline || 'Ballad',
    title: book.title,
    styles: { default: { document: { run: { font: 'Georgia', size: 24 } } } },
    sections: [{ children: body }],
  });
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
}

// ── EPUB ──

const xhtml = (title: string, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;

/** An EPUB 3: a title page, one chapter per part, a table of contents. */
export async function toEpub(book: ExportBook, options: ExportOptions, id: string, modified = new Date()): Promise<Uint8Array> {
  const zip = new JSZip();
  // The mimetype comes first, uncompressed, as the format requires.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('OEBPS/style.css', STYLE.replace(/page-break-before: always; break-before: page;/, '') + '\nh1.title { margin-top: 30%; }');
  zip.file('OEBPS/title.xhtml', xhtml(book.title, `<h1 class="title">${escapeXml(book.title)}</h1>${book.byline ? `<p class="byline">${escapeXml(book.byline)}</p>` : ''}`));
  const chapters = book.parts.map((part, i) => ({ id: `part${i + 1}`, file: `part${i + 1}.xhtml`, title: part.heading }));
  book.parts.forEach((part, i) => zip.file(`OEBPS/${chapters[i]!.file}`, xhtml(part.heading, `${options.partHeadings ? `<h2>${escapeXml(part.heading)}</h2>` : ''}${partBody(part, options)}`)));
  zip.file(
    'OEBPS/nav.xhtml',
    xhtml('Contents', `<nav epub:type="toc" id="toc"><h2>Contents</h2><ol>${chapters.map((c) => `<li><a href="${c.file}">${escapeXml(c.title)}</a></li>`).join('')}</ol></nav>`),
  );
  const stamp = modified.toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${escapeXml(id)}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:language>en</dc:language>${book.byline ? `<dc:creator>${escapeXml(book.byline)}</dc:creator>` : ''}<meta property="dcterms:modified">${stamp}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${chapters.map((c) => `<item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="title"/>${chapters.map((c) => `<itemref idref="${c.id}"/>`).join('')}</spine></package>`,
  );
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}

/** A short plain summary for the toast ("3 acts, 9 scenes"). */
export const summary = (book: ExportBook) => {
  const scenes = book.parts.reduce((n, p) => n + p.scenes.length, 0);
  return `${book.parts.length} ${book.parts.length === 1 ? 'part' : 'parts'}, ${scenes} ${scenes === 1 ? 'scene' : 'scenes'}`;
};

