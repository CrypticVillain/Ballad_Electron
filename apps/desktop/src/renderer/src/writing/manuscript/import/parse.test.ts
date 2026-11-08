import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseName, docxLines, importSummary, inlineMarkdown, markdownLines, rtfToParas, scrivenerBook, structure } from './parse';

const shape = (book: ReturnType<typeof structure>) => book.parts.map((p) => [p.title, p.scenes.map((s) => `${s.title}:${s.paras.length}`)]);

test('Markdown: a title above two levels of headings makes acts and scenes', () => {
  const md = '# The Glass Road\n\n## Act One\n\n### Arrival\n\nThe kiln was *cold*.\n\nNobody **came**.\n\n### Night\n\nShe waited.\n\n## Act Two\n\n### Morning\n\nLight.';
  const book = structure(markdownLines(md), 'fallback');
  assert.equal(book.title, 'The Glass Road');
  assert.deepEqual(shape(book), [
    ['Act One', ['Arrival:2', 'Night:1']],
    ['Act Two', ['Morning:1']],
  ]);
  assert.deepEqual(book.parts[0]!.scenes[0]!.paras[0]!.runs, [{ text: 'The kiln was ' }, { text: 'cold', italic: true }, { text: '.' }]);
});

test('Markdown: one level of headings is the scenes of one act; with none, breaks split the scenes', () => {
  assert.deepEqual(shape(structure(markdownLines('## One\n\nA.\n\n## Two\n\nB.'), 'Book')), [['', ['One:1', 'Two:1']]]);
  const book = structure(markdownLines('First.\n\n* * *\n\nSecond.\n\n#\n\nThird.'), 'My Novel');
  assert.equal(book.title, 'My Novel');
  assert.deepEqual(shape(book), [['', [':1', ':1', ':1']]]);
});

test('Markdown: lines join into paragraphs, lists and quotes are their own, styles nest', () => {
  const lines = markdownLines('A line\nwrapped.\n\n- one\n- two\n\n> said\n> she');
  assert.deepEqual(
    lines.map((l) => ('para' in l ? `${l.para.kind}:${l.para.runs.map((r) => r.text).join('')}` : '?')),
    ['p:A line wrapped.', 'bullet:one', 'bullet:two', 'quote:said she'],
  );
  assert.deepEqual(inlineMarkdown('***both*** and \\*not\\*'), [{ text: 'both', bold: true, italic: true }, { text: ' and *not*' }]);
});

test('plain text: each line a paragraph, no headings', () => {
  const book = structure(markdownLines('# not a heading\nSecond line.\n\n***\n\nNext scene.', true), 'Notes');
  assert.deepEqual(shape(book), [['', [':2', ':1']]]);
});

test('Word: Title, Heading 1 and 2, runs with bold and italic, and a break', () => {
  const styles = '<w:styles><w:style w:type="paragraph" w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style></w:styles>';
  const p = (style: string, ...runs: string[]) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}</w:pPr>${runs.join('')}</w:p>`;
  const r = (text: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  const xml = `<w:document><w:body>${[
    p('Title', r('Salt &amp; Glass')),
    p('berschrift1', r('Part One')),
    p('Heading2', r('The Kiln')),
    p('', r('It was '), r('hot', '<w:b/>'), r('.', '<w:i w:val="0"/>')),
    p('', r('* * *')),
    p('', r('Later.')),
  ].join('')}</w:body></w:document>`;
  const book = structure(docxLines(xml, styles), 'file');
  assert.equal(book.title, 'Salt & Glass');
  assert.deepEqual(shape(book), [['Part One', ['The Kiln:1', ':1']]]);
  assert.deepEqual(book.parts[0]!.scenes[0]!.paras[0]!.runs, [{ text: 'It was ' }, { text: 'hot', bold: true }, { text: '.' }]);
});

test('RTF: paragraphs, styles, escapes and Unicode; tables and hidden groups skipped', () => {
  const rtf = "{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\expandedcolortbl;;}\\pard The \\b kiln\\b0  was caf\\'e9 \\u8212? hot.\\par\\par {\\i Night}\\par}";
  const paras = rtfToParas(rtf);
  assert.deepEqual(
    paras.map((p) => p.runs),
    [
      [{ text: 'The ' }, { text: 'kiln', bold: true }, { text: ' was café — hot.' }],
      [{ text: 'Night', italic: true }],
    ],
  );
});

test('Scrivener: the Draft’s folders are acts and its documents scenes; loose documents make an act', () => {
  const item = (id: string, type: string, title: string, children = '') => `<BinderItem UUID="${id}" Type="${type}"><Title>${title}</Title>${children ? `<Children>${children}</Children>` : ''}</BinderItem>`;
  const scrivx = `<?xml version="1.0" encoding="UTF-8"?><ScrivenerProject><Binder>${item(
    'D',
    'DraftFolder',
    'Manuscript',
    item('P', 'Prologue'.length ? 'Text' : '', 'Prologue') + item('F1', 'Folder', 'Act One', item('S1', 'Text', 'Arrival') + item('F2', 'Folder', 'Flashback', item('S2', 'Text', 'Years Ago'))),
  )}${item('R', 'ResearchFolder', 'Research')}</Binder></ScrivenerProject>`;
  const docs = { P: '{\\rtf1 Before.\\par}', S1: '{\\rtf1 One.\\par Two.\\par}', S2: '{\\rtf1 Then.}' };
  const book = scrivenerBook(scrivx, docs, 'Kiln');
  assert.equal(book.title, 'Kiln');
  assert.deepEqual(shape(book), [
    ['', ['Prologue:1']],
    ['Act One', ['Arrival:2', 'Years Ago:1']],
  ]);
  assert.equal(importSummary(book), '2 acts, 3 scenes');
  assert.equal(baseName('C:\\Books\\Kiln.scriv\\Kiln.scrivx'), 'Kiln');
});
