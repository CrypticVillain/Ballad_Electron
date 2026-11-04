import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import type { Book, Part, Scene } from '@/lib/model';
import { buildBook } from './build';
import { blocksToParas, fileName } from './document';
import { toDocx, toEpub, toHtml, toMarkdown } from './formats';

const t = '2026-01-01T00:00:00.000Z';
const base = { createdAt: t, updatedAt: t, deletedAt: null };
const book = { ...base, id: 'b', worldId: 'w', title: 'The Lamp & The Glass', partNoun: 'Act', order: 0 } as unknown as Book;
const parts = [
  { ...base, id: 'p1', bookId: 'b', title: 'The Causeway', order: 0 },
  { ...base, id: 'p2', bookId: 'b', title: '', order: 1 },
  { ...base, id: 'p3', bookId: 'b', title: 'Empty', order: 2 },
] as unknown as Part[];
const scene = (id: string, partId: string, order: number, content: unknown[], text = '') => ({ ...base, id, bookId: 'b', partId, order, title: `Scene ${id}`, content, text, words: 0 }) as unknown as Scene;
const blocks = [
  { type: 'paragraph', content: [{ type: 'text', text: 'She lit the ', styles: {} }, { type: 'text', text: 'last', styles: { italic: true } }, { type: 'text', text: ' lamp for ', styles: {} }, { type: 'mention', props: { name: 'Corin <Hale>' } }, { type: 'text', text: '.', styles: {} }], children: [] },
  { type: 'paragraph', content: [], children: [] },
  { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'A letter', styles: { bold: true } }], children: [] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'oil', styles: {} }], children: [{ type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'wick', styles: {} }], children: [] }] },
];
const scenes = [scene('a', 'p1', 0, blocks), scene('b', 'p1', 1, [], 'Old text.\n\nSecond line.'), scene('c', 'p2', 0, blocks), { ...scene('n', 'p1', 2, blocks), kind: 'note' } as Scene];
const options = { partHeadings: true, sceneTitles: false };

test('editor blocks become styled paragraphs; mentions become names; empty ones go', () => {
  const paras = blocksToParas(blocks);
  assert.deepEqual(paras.map((p) => p.kind), ['p', 'h2', 'bullet', 'bullet']);
  assert.equal(paras[0]!.runs.map((r) => r.text).join(''), 'She lit the last lamp for Corin <Hale>.');
  assert.equal(paras[0]!.runs[1]!.italic, true);
  assert.equal(paras[3]!.runs[0]!.text, '☑ ');
  assert.equal(fileName('A/B: "C"?', 'pdf'), 'AB C.pdf');
});

test('a book in manuscript order: notes and empty acts left out, old plain text kept', () => {
  const out = buildBook(book, parts, scenes, 'The Glass Archipelago');
  assert.deepEqual(out.parts.map((p) => p.heading), ['Act I: The Causeway', 'Act II']);
  assert.deepEqual(out.parts[0]!.scenes.map((s) => s.title), ['Scene a', 'Scene b']);
  assert.deepEqual(out.parts[0]!.scenes[1]!.paras.map((p) => p.runs[0]!.text), ['Old text.', 'Second line.']);
});

test('HTML and Markdown: escaped, scene breaks between scenes', () => {
  const out = buildBook(book, parts, scenes, '');
  const html = toHtml(out, options);
  assert.ok(html.includes('The Lamp &amp; The Glass'));
  assert.ok(html.includes('Corin &lt;Hale&gt;'));
  assert.ok(html.includes('<em>last</em>'));
  assert.equal(html.match(/class="break"/g)?.length, 1);
  const md = toMarkdown(out, { partHeadings: true, sceneTitles: true });
  assert.ok(md.startsWith('# The Lamp & The Glass'));
  assert.ok(md.includes('### Scene a'));
  assert.ok(md.includes('*last*'));
  assert.ok(md.includes('* * *'));
});

test('EPUB: mimetype first, a chapter per act, a table of contents; Word: a real .docx', async () => {
  const out = buildBook(book, parts, scenes, 'Anon');
  const epub = await toEpub(out, options, 'test-id', new Date(t));
  const zip = await JSZip.loadAsync(epub);
  assert.equal(Object.keys(zip.files)[0], 'mimetype');
  assert.equal(await zip.file('mimetype')!.async('string'), 'application/epub+zip');
  for (const f of ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/part1.xhtml', 'OEBPS/part2.xhtml']) assert.ok(zip.file(f), f);
  const opf = await zip.file('OEBPS/content.opf')!.async('string');
  assert.ok(opf.includes('<dc:title>The Lamp &amp; The Glass</dc:title>'));
  const docx = await toDocx(out, options);
  assert.equal(String.fromCharCode(docx[0]!, docx[1]!), 'PK');
  const word = await JSZip.loadAsync(docx);
  assert.ok((await word.file('word/document.xml')!.async('string')).includes('Corin &lt;Hale&gt;'));
});
