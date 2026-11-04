/**
 * dates.ts — local calendar days as "YYYY-MM-DD" keys, and the few date
 * sums the app needs (weeks start on Monday).
 */

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): string {
  return dayKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** Monday of the week that holds `key`. */
export function startOfWeek(key: string): string {
  const date = parseDay(key);
  const offset = (date.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: string): string[] {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The 6 × 7 grid of days a month view shows (Monday first). */
export function monthGrid(key: string): string[] {
  const date = parseDay(key);
  const first = dayKey(new Date(date.getFullYear(), date.getMonth(), 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** ISO week number (for "WEEK 45"). */
export function isoWeek(key: string): number {
  const date = parseDay(key);
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jan" … "Dec". */
export const MONTH_NAMES: readonly string[] = MONTH;

export function weekdayShort(key: string): string {
  return WEEKDAY[parseDay(key).getDay()]!;
}

export function monthShort(key: string): string {
  return MONTH[parseDay(key).getMonth()]!;
}

/** "Nov 6" */
export function shortDate(key: string): string {
  const date = parseDay(key);
  return `${MONTH[date.getMonth()]} ${date.getDate()}`;
}

/** "Sun 01 Nov 2026" */
export function longDate(key: string): string {
  const date = parseDay(key);
  return `${WEEKDAY[date.getDay()]} ${String(date.getDate()).padStart(2, '0')} ${MONTH[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday", a weekday within the next week, else "Nov 6". */
export function relativeDay(key: string, from = today()): string {
  const diff = daysBetween(from, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return weekdayShort(key);
  return shortDate(key);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).valueOf() - parseDay(a).valueOf()) / 86400000);
}

export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function timeFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** How times are shown: "7:00 PM" (12) or "19:00" (24). */
export type Clock = '12' | '24';

/** The clock this computer's language and region use. */
export function systemClock(): Clock {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 === false ? '24' : '12';
  } catch {
    return '12';
  }
}

/** "19:00" → "7:00 PM" (12) or "19:00" (24); anything that isn't a time → ''. */
export function formatTime(time: string, clock: Clock): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return '';
  const h = Number(m[1]);
  if (h > 23) return '';
  return clock === '24' ? `${String(h).padStart(2, '0')}:${m[2]}` : `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function nowTime(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

/** The local day of an ISO timestamp (createdAt, doneAt…). */
export function isoDay(iso: string): string {
  return dayKey(new Date(iso));
}

/** "14 min ago", "3 h ago", "yesterday", "Oct 30". */
export function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  if (minutes < 60 * 48) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
