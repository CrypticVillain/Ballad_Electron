import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TableEntry, TurnOrder } from './model';
import { accountColor, activeToken, ordered, seesEntry, stepTurn, templateOutline, templateSize, withoutTokens } from './logic';

test('a whisper: the GM, its writer and who it’s to see it; everything else, everyone', () => {
  const said = { accountId: 'ana', kind: 'chat', text: 'psst' } as TableEntry;
  assert.ok(seesEntry(said, 'bo', false));
  const whisper = { ...said, to: ['cy'] };
  assert.ok(seesEntry(whisper, 'ana', false) && seesEntry(whisper, 'cy', false) && seesEntry(whisper, 'gm', true));
  assert.ok(!seesEntry(whisper, 'bo', false));
});

test('the order: highest first, ties as they joined; turns step on into the next round and back', () => {
  const order: TurnOrder = { round: 1, turn: 0, entries: [{ tokenId: 'a', initiative: 12 }, { tokenId: 'b', initiative: null }, { tokenId: 'c', initiative: 18 }, { tokenId: 'd', initiative: 12 }] };
  assert.deepEqual(ordered(order).map((e) => e.tokenId), ['c', 'a', 'd', 'b']);
  assert.equal(activeToken(order), 'c');
  assert.deepEqual(stepTurn(order, -1), order);
  const last = { ...order, turn: 3 };
  assert.deepEqual(stepTurn(last, 1), { ...order, turn: 0, round: 2 });
  assert.deepEqual(stepTurn({ ...order, round: 2 }, -1), { ...order, round: 1, turn: 3 });
  // a's turn; a leaves: d's (who was next).
  const aTurn = { ...order, turn: 1 };
  assert.equal(activeToken(withoutTokens(aTurn, ['a'])), 'd');
  // c leaves during a's turn: still a's.
  assert.equal(activeToken(withoutTokens(aTurn, ['c'])), 'a');
});

test('templates: a cone as wide as it is long, a line so wide, a square from its near edge', () => {
  const round = (ps: { x: number; y: number }[]) => ps.map((p) => [Math.round(p.x) + 0, Math.round(p.y) + 0]);
  assert.deepEqual(round(templateOutline({ shape: 'cone', x: 0, y: 0, angle: 0, length: 100 }, 70)), [[0, 0], [100, -50], [100, 50]]);
  assert.deepEqual(round(templateOutline({ shape: 'line', x: 0, y: 0, angle: 0, length: 300 }, 70)), [[0, 35], [300, 35], [300, -35], [0, -35]]);
  assert.deepEqual(round(templateOutline({ shape: 'square', x: 0, y: 0, angle: Math.PI / 2, length: 140 }, 70)), [[-70, 0], [-70, 140], [70, 140], [70, 0]]);
  assert.deepEqual(round(templateOutline({ shape: 'circle', x: 5, y: 5, angle: 0, length: 20 }, 70)), [[5, 5], [25, 5]]);
  assert.equal(templateSize(280, 70, 5, 'ft'), '20 ft');
  assert.equal(accountColor('ana'), accountColor('ana'));
});
