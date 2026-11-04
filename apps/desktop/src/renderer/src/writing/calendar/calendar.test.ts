import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CALENDAR_PRESETS, clampDate, dayNumber, formatDate, fromDayNumber, monthGrid, stepMonth, weekdayOf, yearLength } from './calendar';
import type { WorldCalendar } from './model';

const glass: WorldCalendar = {
  months: [
    { name: 'Lampwake', days: 30 },
    { name: 'Frostfall', days: 25 },
    { name: 'Tidecall', days: 35 },
  ],
  weekdays: ['Oilday', 'Wickday', 'Glassday', 'Ashday', 'Restday'],
  era: 'A.F.',
};

test('days count from day 1 of year 1, both ways, and back again', () => {
  assert.equal(yearLength(glass), 90);
  assert.equal(dayNumber(glass, { year: 1, month: 1, day: 1 }), 0);
  assert.equal(dayNumber(glass, { year: 1, month: 2, day: 1 }), 30);
  assert.equal(dayNumber(glass, { year: 2, month: 1, day: 1 }), 90);
  assert.equal(dayNumber(glass, { year: 0, month: 3, day: 35 }), -1);
  for (const n of [0, 29, 30, 89, 90, 4321, -1, -90, -91]) assert.equal(dayNumber(glass, fromDayNumber(glass, n)), n);
});

test('weekdays run on across months and years; formatting', () => {
  assert.equal(weekdayOf(glass, { year: 1, month: 1, day: 1 }), 0);
  assert.equal(weekdayOf(glass, { year: 1, month: 1, day: 6 }), 0);
  assert.equal(weekdayOf(glass, { year: 1, month: 2, day: 1 }), 0);
  assert.equal(weekdayOf(glass, { year: 0, month: 3, day: 35 }), 4);
  assert.equal(formatDate(glass, { year: 402, month: 2, day: 9 }), '9 Frostfall 402 A.F.');
  assert.match(formatDate(glass, { year: 402, month: 2, day: 9 }, true), /^\w+day, 9 Frostfall/);
  assert.deepEqual(clampDate(glass, { year: 3, month: 9, day: 99 }), { year: 3, month: 3, day: 35 });
});

test('a month in weeks, and stepping between months', () => {
  const weeks = monthGrid(glass, 1, 2);
  assert.ok(weeks.every((w) => w.length === 5));
  assert.equal(weeks.flat().filter((d) => d !== null).length, 25);
  assert.equal(weeks[0]![0], 1);
  assert.deepEqual(stepMonth(glass, 5, 3, 1), { year: 6, month: 1 });
  assert.deepEqual(stepMonth(glass, 5, 1, -1), { year: 4, month: 3 });
  for (const preset of CALENDAR_PRESETS) assert.ok(yearLength(preset.make()) > 0, preset.id);
});
