import type { WorldCalendar, WorldDate } from './model';

/**
 * Writing → Calendar: the arithmetic of a world's calendar, pure. Every year
 * is the same length; day 1 of year 1 falls on the first weekday; years
 * before 1 count back the same way.
 */

export const yearLength = (cal: WorldCalendar) => cal.months.reduce((sum, m) => sum + Math.max(0, m.days), 0);

/** Keeps a date inside the calendar: a month that exists, a day that month has. */
export function clampDate(cal: WorldCalendar, date: WorldDate): WorldDate {
  const month = Math.min(Math.max(1, Math.round(date.month)), Math.max(1, cal.months.length));
  const days = cal.months[month - 1]?.days ?? 1;
  return { year: Math.round(date.year), month, day: Math.min(Math.max(1, Math.round(date.day)), Math.max(1, days)) };
}

/** Days since day 1 of year 1 (0 for that day; negative before it). */
export function dayNumber(cal: WorldCalendar, date: WorldDate): number {
  const d = clampDate(cal, date);
  const before = cal.months.slice(0, d.month - 1).reduce((sum, m) => sum + m.days, 0);
  return (d.year - 1) * yearLength(cal) + before + d.day - 1;
}

/** The date a day number falls on. */
export function fromDayNumber(cal: WorldCalendar, n: number): WorldDate {
  const length = yearLength(cal);
  if (!length) return { year: 1, month: 1, day: 1 };
  const year = Math.floor(n / length) + 1;
  let rest = n - (year - 1) * length;
  for (let i = 0; i < cal.months.length; i++) {
    const days = cal.months[i]!.days;
    if (rest < days) return { year, month: i + 1, day: rest + 1 };
    rest -= days;
  }
  return { year, month: cal.months.length, day: cal.months.at(-1)?.days ?? 1 };
}

/** Which day of the week (0-based, into cal.weekdays) a date is. */
export function weekdayOf(cal: WorldCalendar, date: WorldDate): number {
  const week = cal.weekdays.length || 1;
  return ((dayNumber(cal, date) % week) + week) % week;
}

/** "9 Frostfall 402 A.F." (or "Moonday, 9 Frostfall…" with the weekday). */
export function formatDate(cal: WorldCalendar, date: WorldDate, withWeekday = false): string {
  const d = clampDate(cal, date);
  const month = cal.months[d.month - 1]?.name || `Month ${d.month}`;
  const weekday = withWeekday && cal.weekdays.length ? `${cal.weekdays[weekdayOf(cal, d)]}, ` : '';
  return `${weekday}${d.day} ${month} ${d.year}${cal.era ? ` ${cal.era}` : ''}`;
}

/** A month laid out in weeks: each week the weekday columns, null where the month hasn't started or has ended. */
export function monthGrid(cal: WorldCalendar, year: number, month: number): (number | null)[][] {
  const days = cal.months[month - 1]?.days ?? 0;
  const week = cal.weekdays.length || 7;
  const first = weekdayOf(cal, { year, month, day: 1 });
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % week) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += week) weeks.push(cells.slice(i, i + week));
  return weeks;
}

/** The month before or after (stepping over the year's ends). */
export function stepMonth(cal: WorldCalendar, year: number, month: number, by: 1 | -1): { year: number; month: number } {
  const count = Math.max(1, cal.months.length);
  const index = month - 1 + by;
  if (index < 0) return { year: year - 1, month: count };
  if (index >= count) return { year: year + 1, month: 1 };
  return { year, month: index + 1 };
}

/** Calendars to start from. */
export const CALENDAR_PRESETS: { id: string; label: string; note: string; make: () => WorldCalendar }[] = [
  {
    id: 'familiar',
    label: 'Familiar',
    note: 'Twelve months, a seven-day week: rename them',
    make: () => ({
      months: [
        ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
        ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
      ].map(([name, days]) => ({ name: name as string, days: days as number })),
      weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      era: '',
    }),
  },
  {
    id: 'thirteen',
    label: 'Thirteen Moons',
    note: 'Thirteen months of 28 days, four weeks each',
    make: () => ({
      months: Array.from({ length: 13 }, (_, i) => ({ name: `Moon ${i + 1}`, days: 28 })),
      weekdays: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'],
      era: '',
    }),
  },
  {
    id: 'tens',
    label: 'Ten By Ten',
    note: 'Ten months of 36 days, ten-day weeks',
    make: () => ({
      months: Array.from({ length: 10 }, (_, i) => ({ name: `Month ${i + 1}`, days: 36 })),
      weekdays: Array.from({ length: 10 }, (_, i) => `Day ${i + 1}`),
      era: '',
    }),
  },
];
