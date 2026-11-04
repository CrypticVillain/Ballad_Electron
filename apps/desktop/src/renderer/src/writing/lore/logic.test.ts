import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gloss, withTypeFields } from './logic';

test('changing a lore type keeps what you wrote and brings the new type’s fields', () => {
  const magic = [
    { label: 'Source', value: 'Glass that never cools' },
    { label: 'Cost', value: '' },
    { label: 'Limits', value: '' },
    { label: 'Smell', value: 'Burnt sugar' },
  ];
  const asReligion = withTypeFields(magic, 'religion');
  assert.deepEqual(
    asReligion.map((s) => s.label),
    ['Source', 'Smell', 'Deities', 'Clergy', 'Holy Places', 'Rites', 'Holy Days', 'Taboos'],
  );
  assert.equal(asReligion[0]!.value, 'Glass that never cools');
  // A field the new type shares isn't doubled, whatever its case.
  assert.equal(withTypeFields([{ label: 'deities', value: 'The Lamp' }], 'religion').filter((s) => s.label.toLowerCase() === 'deities').length, 1);
});

test('glossing a sentence word by word', () => {
  const lexicon = [
    { id: '1', word: 'Vel', meaning: 'light', part: 'noun', notes: '' },
    { id: '2', word: "ka'ru", meaning: 'burns', part: 'verb', notes: '' },
  ];
  assert.deepEqual(gloss("Vel ka'ru, osk!", lexicon), [
    { word: 'Vel', meaning: 'light' },
    { word: "ka'ru,", meaning: 'burns' },
    { word: 'osk!', meaning: null },
  ]);
  assert.deepEqual(gloss('   ', lexicon), []);
});
