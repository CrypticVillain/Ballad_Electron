import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocksLinks, blocksToText, formatWords, initials, roman, wordCount } from './text';

const doc = [
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'By the time the tide went out, ' },
      { type: 'mention', props: { entryId: 'ines', name: 'Ines Varga' } },
      { type: 'text', text: ' had counted every lamp twice.' },
    ],
    children: [],
  },
  { type: 'paragraph', content: [], children: [] },
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Across the strait, ' },
      { type: 'mention', props: { entryId: 'ossery', name: 'Port Ossery' } },
      { type: 'text', text: ' burned. ' },
      { type: 'mention', props: { entryId: 'ines', name: 'Ines Varga' } },
    ],
    children: [{ type: 'paragraph', content: [{ type: 'mention', props: { entryId: 'firing', name: 'The Second Firing' } }], children: [] }],
  },
];

test('blocksToText reads mentions as their names, one line per block', () => {
  assert.equal(
    blocksToText(doc),
    'By the time the tide went out, Ines Varga had counted every lamp twice.\n\nAcross the strait, Port Ossery burned. Ines Varga\nThe Second Firing',
  );
});

test('blocksLinks lists each mentioned entry once, in order, nested blocks included', () => {
  assert.deepEqual(blocksLinks(doc), ['ines', 'ossery', 'firing']);
});

test('wordCount keeps contractions and hyphenated words whole', () => {
  assert.equal(wordCount('She didn’t trust the forty-one lamps.'), 6);
  assert.equal(wordCount("You're late with the oil,” said a voice."), 8);
  assert.equal(wordCount('  '), 0);
  assert.equal(wordCount('402 A.F.'), 3);
});

test('formatWords, roman and initials', () => {
  assert.equal(formatWords(41208), '41,208');
  assert.equal(formatWords(41208, true), '41.2k');
  assert.equal(formatWords(950, true), '950');
  assert.deepEqual([1, 2, 4, 9, 14, 40].map(roman), ['I', 'II', 'IV', 'IX', 'XIV', 'XL']);
  assert.equal(initials('Ines Varga'), 'IV');
  assert.equal(initials('Old Wren'), 'OW');
  assert.equal(initials('Saltmarrow'), 'SA');
});
