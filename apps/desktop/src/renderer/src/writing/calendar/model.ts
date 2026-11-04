/**
 * Writing → Calendar: a world's own calendar, kept on the world. Months of
 * any length and number, a week of any days, an era's name for the years.
 * The year starts on the first weekday of year 1; every year is the same
 * length (no leap years).
 */
export type CalendarMonth = { name: string; days: number };

export type WorldCalendar = {
  months: CalendarMonth[];
  weekdays: string[];
  /** After the year ("402 A.F."), or empty. */
  era: string;
};

/** A day in a world's calendar: year, month (1-based), day (1-based). */
export type WorldDate = { year: number; month: number; day: number };
