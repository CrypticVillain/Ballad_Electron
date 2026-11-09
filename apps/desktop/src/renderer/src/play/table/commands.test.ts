import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand, whisperTarget } from './commands';

test('the chat’s commands: rolls, the GM’s rolls, whispers, emotes', () => {
  assert.deepEqual(parseCommand('hello'), { kind: 'say', text: 'hello' });
  assert.deepEqual(parseCommand('/r 1d20+5 Perception check'), { kind: 'roll', expression: '1d20+5', label: 'Perception check', hidden: false });
  assert.deepEqual(parseCommand('/gmroll 2d6'), { kind: 'roll', expression: '2d6', label: '', hidden: true });
  assert.deepEqual(parseCommand('/em draws his blade'), { kind: 'emote', text: 'draws his blade' });
  assert.equal(parseCommand('/nope').kind, 'error');
  const people = [
    { accountId: 'gm', name: 'Maren Holt (GM)', gm: true },
    { accountId: 'sam', name: 'Sam Rowe' },
    { accountId: 'sammy', name: 'Sammy' },
  ];
  assert.deepEqual(whisperTarget('Sam meet me outside', people), { accountId: 'sam', text: 'meet me outside' });
  assert.deepEqual(whisperTarget('sam rowe hi', people), { accountId: 'sam', text: 'hi' });
  assert.deepEqual(whisperTarget('Sammy hi', people), { accountId: 'sammy', text: 'hi' });
  assert.deepEqual(whisperTarget('gm a secret', people), { accountId: 'gm', text: 'a secret' });
  assert.equal(whisperTarget('Nobody hi', people), null);
});
