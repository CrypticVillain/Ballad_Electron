import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedSince, sceneChanges } from '@/film/revisions/diff';
import { castKeys, castNumbers, castOfScene } from './cast';
import { blocksToElements, cueName, elementsToBlocks, parseHeading, titleCase } from './elements';
import { fromFdx, toFdx } from './fdx';
import { fromFountain, toFountain } from './fountain';
import { eighthsLabel, layoutScript, withContinueds, wrap } from './layout';
import { emptyTitlePage, type ScriptElement } from './model';
import { sceneNumbers } from './numbering';
import type { Entry } from '@/lib/model';

test('headings, cues and title case', () => {
  assert.deepEqual(parseHeading('INT. KITCHEN - NIGHT'), { ie: 'INT', place: 'KITCHEN', time: 'NIGHT' });
  assert.deepEqual(parseHeading('ext./int. old mill — dawn'), { ie: 'INT/EXT', place: 'OLD MILL', time: 'DAWN' });
  assert.deepEqual(parseHeading('EXT. HIGHWAY - BUS - MOVING - DAY'), { ie: 'EXT', place: 'HIGHWAY - BUS - MOVING', time: 'DAY' });
  assert.deepEqual(parseHeading('.FLASHBACK'), { ie: '', place: 'FLASHBACK', time: '' });
  assert.equal(cueName("ines (v.o.) (cont'd)"), 'INES');
  assert.equal(cueName('MRS. HALE ^'), 'MRS. HALE');
  assert.equal(titleCase("THE OLD MILL'S YARD"), "The Old Mill's Yard");
});

test('editor blocks read as elements and back', () => {
  const blocks = [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. KITCHEN - NIGHT' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Ines lights a lamp. ' }, { type: 'mention', props: { name: 'Tomas' } }] },
    { type: 'character', props: { dual: true }, content: [{ type: 'text', text: 'TOMAS' }] },
    { type: 'dialogue', content: [] },
  ];
  const els = blocksToElements(blocks);
  assert.deepEqual(els, [
    { type: 'sceneHeading', text: 'INT. KITCHEN - NIGHT' },
    { type: 'action', text: 'Ines lights a lamp. Tomas' },
    { type: 'character', text: 'TOMAS', dual: true },
  ]);
  let n = 0;
  assert.deepEqual(blocksToElements(elementsToBlocks(els, () => String(n++))), els);
});

test('scene numbers: in order, then as locked (12A, A1, OMITTED)', () => {
  assert.deepEqual(sceneNumbers(['a', 'b']).map((n) => n.number), ['1', '2']);
  const locked: [string, string][] = [['a', '1'], ['b', '2'], ['c', '3']];
  const out = sceneNumbers(['x', 'a', 'y', 'z', 'c'], locked);
  assert.deepEqual(
    out.map((n) => `${n.number}${n.omitted ? '-' : ''}`),
    ['A1', '1', '1A', '1B', '2-', '3'],
  );
  // Numbers already taken are skipped; a scene put in after an inserted one carries on its letters.
  const again = sceneNumbers(['a', 'q', 'b'], [['a', '1'], ['q2', '1A'], ['b', '2']]);
  assert.deepEqual(again.map((n) => `${n.number}${n.omitted ? '-' : ''}`), ['1', '1B', '1A-', '2']);
});

test('wrapping and eighths', () => {
  assert.deepEqual(wrap('one two three', 7), ['one two', 'three']);
  assert.deepEqual(wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrap('a\nb', 10), ['a', 'b']);
  assert.equal(eighthsLabel(11), '1 3/8');
  assert.equal(eighthsLabel(4), '4/8');
  assert.equal(eighthsLabel(16), '2');
});

const speech = (name: string, words: number): ScriptElement[] => [
  { type: 'character', text: name },
  { type: 'dialogue', text: Array.from({ length: words }, (_, i) => `word${i}`).join(' ') },
];

test('pages: a long speech breaks with (MORE) and CONT’D; a heading never ends a page', () => {
  const filler: ScriptElement[] = Array.from({ length: 12 }, () => ({ type: 'action', text: 'Rain on the glass. '.repeat(9) }));
  const layout = layoutScript([{ id: 's1', number: '1', elements: [{ type: 'sceneHeading', text: 'INT. HALL - NIGHT' }, ...filler, ...speech('INES', 120)] }]);
  assert.ok(layout.pages.length >= 2);
  const lines = (p: number) => layout.pages[p]!.items.flatMap((it) => (it.kind === 'line' ? [it.line] : []));
  const first = lines(0);
  assert.equal(first.at(-1)!.text, '(MORE)');
  assert.equal(lines(1)[0]!.text, "INES (CONT'D)");
  for (const p of layout.pages) assert.ok(p.items.length <= 54);
  // The scene's heading carries its number.
  assert.equal(layout.pages[0]!.items.find((it) => it.kind === 'line' && it.scene)?.kind, 'line');

  // A heading that would land on the last line goes to the next page with what follows.
  const tight = layoutScript([
    { id: 'a', number: '1', elements: [{ type: 'action', text: Array.from({ length: 52 }, () => 'line').join('\n') }] },
    { id: 'b', number: '2', elements: [{ type: 'sceneHeading', text: 'EXT. YARD - DAY' }, { type: 'action', text: 'Wind.' }] },
  ]);
  const heading = tight.pages.findIndex((p) => p.items.some((it) => it.kind === 'line' && it.line.kind === 'sceneHeading'));
  assert.equal(heading, 1);
  assert.equal(tight.scenes.b!.page, 2);
});

test('eighths: a short scene is at least 1/8, a page is 8/8', () => {
  const layout = layoutScript([
    { id: 'a', number: '1', elements: [{ type: 'sceneHeading', text: 'INT. A - DAY' }] },
    { id: 'b', number: '2', elements: [{ type: 'action', text: Array.from({ length: 53 }, () => 'x').join('\n') }] },
  ]);
  assert.equal(layout.scenes.a!.eighths, 1);
  assert.equal(layout.scenes.b!.eighths, 8);
});

test('CONT’D for a speaker who speaks again after action', () => {
  const out = withContinueds<ScriptElement>([
    { type: 'character', text: 'INES' },
    { type: 'dialogue', text: 'Hello.' },
    { type: 'action', text: 'She waits.' },
    { type: 'character', text: 'INES' },
    { type: 'character', text: 'TOMAS' },
    { type: 'sceneHeading', text: 'EXT. YARD' },
    { type: 'character', text: 'TOMAS' },
  ]);
  assert.deepEqual(
    out.filter((e) => e.type === 'character').map((e) => e.text),
    ['INES', "INES (CONT'D)", 'TOMAS', 'TOMAS'],
  );
});

const sample: ScriptElement[] = [
  { type: 'sceneHeading', text: 'INT. KITCHEN - NIGHT' },
  { type: 'action', text: 'Ines lights the last lamp.' },
  { type: 'character', text: 'INES' },
  { type: 'parenthetical', text: '(quietly)' },
  { type: 'dialogue', text: 'Not tonight.' },
  { type: 'character', text: 'TOMAS' },
  { type: 'dialogue', text: 'Every night.' },
  { type: 'character', text: 'MOTHER ASHE', dual: true },
  { type: 'dialogue', text: 'Enough!' },
  { type: 'transition', text: 'CUT TO:' },
];

test('Fountain: written and read back the same', () => {
  const titlePage = { ...emptyTitlePage(), title: 'The Lamplighter', authors: 'M. Pou', contact: 'm@example.com\n555-0100' };
  const text = toFountain({ title: 'x', titlePage, sections: [{ title: 'Act One', scenes: [{ number: '4A', elements: sample }] }] });
  assert.match(text, /^Title: The Lamplighter/);
  assert.match(text, /INT\. KITCHEN - NIGHT #4A#/);
  assert.match(text, /MOTHER ASHE \^/);
  const back = fromFountain(text);
  assert.equal(back.titlePage.title, 'The Lamplighter');
  assert.equal(back.titlePage.contact, 'm@example.com\n555-0100');
  assert.equal(back.sections[0]!.scenes[0]!.number, '4A');
  assert.deepEqual(back.sections[0]!.scenes[0]!.elements, sample);
});

test('Fountain: the usual rules on a hand-written script', () => {
  const read = fromFountain(['# One', '', '.FLASHBACK', '', 'Bang.', 'The door gives.', '', '@McCLANE', 'Yippee.', '', '> FADE OUT.', '', '[[a note]]', 'EXT. ROOF - DAY', '', '!LOUD NOISES', ''].join('\n'));
  const [section] = read.sections;
  assert.equal(section!.title, 'One');
  const all = section!.scenes.flatMap((s) => s.elements);
  assert.deepEqual(all, [
    { type: 'sceneHeading', text: 'FLASHBACK' },
    { type: 'action', text: 'Bang.\nThe door gives.' },
    { type: 'character', text: 'MCCLANE' },
    { type: 'dialogue', text: 'Yippee.' },
    { type: 'transition', text: 'FADE OUT.' },
    { type: 'sceneHeading', text: 'EXT. ROOF - DAY' },
    { type: 'action', text: 'LOUD NOISES' },
  ]);
});

test('Final Draft: written and read back the same', () => {
  const xml = toFdx({ title: 'The Lamplighter', titlePage: { ...emptyTitlePage(), authors: 'M. Pou & <Co>' }, scenes: [{ number: '7', elements: sample }] });
  assert.match(xml, /<Paragraph Type="Scene Heading" Number="7">/);
  assert.match(xml, /<DualDialogue>/);
  const back = fromFdx(xml);
  assert.equal(back.titlePage.title, 'THE LAMPLIGHTER');
  assert.equal(back.titlePage.authors, 'M. Pou & <Co>');
  assert.equal(back.scenes[0]!.number, '7');
  assert.deepEqual(back.scenes[0]!.elements, sample);
});

test('revisions: what changed since a round began', () => {
  const before = sample.slice(0, 5);
  const now: ScriptElement[] = [...before.slice(0, 2), { type: 'action', text: 'A new beat.' }, ...before.slice(2, 4), { type: 'dialogue', text: 'Not ever.' }];
  assert.deepEqual(changedSince(before, now), [false, false, true, false, false, true]);
  assert.deepEqual(sceneChanges(before, now), { status: 'changed', count: 2 });
  assert.deepEqual(sceneChanges(before, before.slice(0, 2)), { status: 'changed', count: 3 });
  assert.deepEqual(sceneChanges(before, before), { status: 'same', count: 0 });
  assert.deepEqual(sceneChanges(undefined, before), { status: 'new', count: 5 });
});

const entry = (id: string, name: string, plays = ''): Entry =>
  ({ id, name, kind: 'character', specs: plays ? [{ label: 'Plays', value: plays }] : [], worldId: 'w', tagline: '', group: '', about: '', pinned: false, createdAt: '', updatedAt: '' }) as Entry;

test('cast: cues match the role played, by first name too; numbered by scenes', () => {
  const ines = entry('i', 'Dana Cole', 'Ines Varga');
  const tomas = entry('t', 'Tomas Varga');
  const ashe = entry('a', 'Mother Ashe');
  assert.deepEqual(castKeys(ines), ['INES VARGA', 'INES', 'DANA COLE', 'DANA']);
  const scene = castOfScene({ links: ['a'], tagged: [] }, sample, [ines, tomas, ashe]);
  assert.deepEqual(scene.ids, ['i', 't', 'a']);
  assert.deepEqual(castOfScene({ links: [], tagged: [] }, [{ type: 'character', text: 'STRANGER' }], [ines]).unmatched, ['STRANGER']);
  const numbers = castNumbers([ashe, ines, tomas], [['i', 't'], ['i'], ['a', 'i']]);
  assert.deepEqual([...numbers.entries()], [['i', 1], ['a', 2], ['t', 3]]);
});
