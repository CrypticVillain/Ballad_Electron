import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeEvent, type DescribeContext } from './describe';
import { diff, eventText, merge, redoable, seesEvent, undoable } from './events';
import type { GameEvent } from './model';
import type { TableRules } from './rules';

const DEFAULT_TABLE_RULES: TableRules = { applyFromChat: true, playersApply: false, targeting: true, playersSeeHits: true, concentration: true, creatureHpBars: true, secretDeathSaves: false, playerWhispers: true };

const event = (id: string, extra: Partial<GameEvent> = {}): GameEvent => ({ id, createdAt: id, updatedAt: id, deletedAt: null, worldId: 'w', accountId: 'gm', who: 'GM', text: id, changes: [{ collection: 'tokens', id: 't', before: {}, after: {} }], ...extra });

test('a change records only what changed (all of it when a record comes or goes); repeats fold together', () => {
  const before = { id: 't', x: 1, y: 2, name: 'Goblin', updatedAt: 'a' };
  assert.deepEqual(diff({ collection: 'tokens', id: 't', before, after: { ...before, x: 5, updatedAt: 'b' } }), { collection: 'tokens', id: 't', before: { x: 1 }, after: { x: 5 } });
  assert.deepEqual(diff({ collection: 'tokens', id: 't', before, after: { ...before, fate: 'dead' } }).before, { fate: null }, 'a new field was nothing before');
  assert.deepEqual(diff({ collection: 'tokens', id: 't', before: null, after: before }).after, before);
  const folded = merge([
    { collection: 'tokens', id: 't', before: { x: 1 }, after: { x: 2 } },
    { collection: 'tokens', id: 't', before: { x: 2 }, after: { x: 3 } },
  ]);
  assert.deepEqual(folded, [{ collection: 'tokens', id: 't', before: { x: 1 }, after: { x: 3 } }]);
});

test('Undo takes the last thing done; Redo the first undone at the end, till something new happens', () => {
  const log = [event('1'), event('2'), event('3')];
  assert.equal(undoable(log)?.id, '3');
  assert.equal(redoable(log), undefined);
  const undone = [event('1'), event('2', { undone: true }), event('3', { undone: true })];
  assert.equal(undoable(undone)?.id, '1');
  assert.equal(redoable(undone)?.id, '2');
  assert.equal(redoable([...undone, event('4')]), undefined, 'something new: the undone can’t come back');
});

test('who sees an event, and in which words', () => {
  const gmOnly = event('1', { playerText: null });
  assert.equal(seesEvent(gmOnly, 'p1', false), false);
  assert.equal(seesEvent(gmOnly, 'gm', true), true);
  assert.equal(seesEvent({ ...gmOnly, shown: true }, 'p1', false), true);
  assert.equal(seesEvent(event('2', { to: ['p2'] }), 'p1', false), false, 'a whisper’s');
  const hurt = event('3', { text: 'Goblin takes 7 damage (7 → 0 HP).', playerText: 'Goblin is hurt.' });
  assert.equal(eventText(hurt, false), 'Goblin is hurt.');
  assert.equal(eventText(hurt, true), 'Goblin takes 7 damage (7 → 0 HP).');
});

const ctx = (extra: Partial<DescribeContext> = {}): DescribeContext => ({
  worldId: 'w',
  liveSceneId: 's',
  rules: DEFAULT_TABLE_RULES,
  tokenName: (t) => t.name as string,
  tokenNameById: () => 'Goblin',
  sceneName: () => 'The Road',
  trackName: () => 'Battle',
  ...extra,
});
const goblin = { id: 't', worldId: 'w', sceneId: 's', kind: 'monster', name: 'Goblin', x: 0, y: 0, hp: { current: 7, max: 7, temp: 0 }, conditions: [], hidden: false };

test('the log’s words: a creature’s damage (its numbers only if the table shows health), hidden tokens the GM’s alone', () => {
  const hit = { collection: 'tokens' as const, id: 't', before: goblin, after: { ...goblin, hp: { current: 0, max: 7, temp: 0 } } };
  assert.deepEqual(describeEvent([hit], ctx()), { text: 'Goblin takes 7 damage (7 → 0 HP) and drops to 0.', playerText: 'Goblin takes 7 damage (7 → 0 HP) and drops to 0.' });
  assert.equal(describeEvent([hit], ctx({ rules: { ...DEFAULT_TABLE_RULES, creatureHpBars: false } })).playerText, 'Goblin is hurt.');
  const sneaky = { ...goblin, hidden: true };
  assert.equal(describeEvent([{ collection: 'tokens', id: 't', before: sneaky, after: { ...sneaky, x: 70 } }], ctx()).playerText, null);
  assert.equal(describeEvent([{ collection: 'tokens', id: 't', before: sneaky, after: { ...sneaky, hidden: false } }], ctx()).playerText, 'Goblin appears.');
  assert.equal(describeEvent([{ collection: 'tokens', id: 't', before: goblin, after: { ...goblin, fate: 'dead', conditions: ['Prone'] } }], ctx()).text, 'Goblin is Prone, is dead.');
  assert.equal(describeEvent([{ collection: 'tokens', id: 't', before: goblin, after: { ...goblin, x: 70 } }], ctx({ liveSceneId: 'other' })).playerText, null, 'a scene the table can’t see');
});
