/**
 * film.ts — the Filmmaking section's numbers: how long a script runs, what a
 * production costs and earns. Tests beside it.
 */
import type { BudgetLine, Shot } from './model';

/** Spoken words a minute, for a script read aloud (a YouTube video's voice-over or talking head). */
export const SPOKEN_WPM = 150;
/** Words on a screenplay page; a page is about a minute of screen time. */
export const WORDS_PER_PAGE = 180;

/** A script's likely length: pages (screenplay) and minutes (read aloud, or a minute a page). */
export function scriptLength(words: number): { pages: number; spokenMinutes: number; screenMinutes: number } {
  const pages = words / WORDS_PER_PAGE;
  return { pages, spokenMinutes: words / SPOKEN_WPM, screenMinutes: pages };
}

/** "4:30" from seconds; "1:02:05" past an hour. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Shots that will be in the cut: how many, how many are done, and how long they run. */
export function shotTotals(shots: Shot[]): { count: number; done: number; seconds: number } {
  const kept = shots.filter((s) => s.status !== 'cut');
  return { count: kept.length, done: kept.filter((s) => s.status === 'shot').length, seconds: kept.reduce((sum, s) => sum + s.seconds, 0) };
}

export type BudgetTotals = { cost: { estimate: number; actual: number }; income: { estimate: number; actual: number }; net: { estimate: number; actual: number } };

/** Costs and income, estimated and actual, and what's left (income minus cost). */
export function budgetTotals(lines: BudgetLine[]): BudgetTotals {
  const sum = (kind: BudgetLine['kind'], field: 'estimate' | 'actual') => lines.filter((l) => l.kind === kind).reduce((total, l) => total + (Number.isFinite(l[field]) ? l[field] : 0), 0);
  const cost = { estimate: sum('cost', 'estimate'), actual: sum('cost', 'actual') };
  const income = { estimate: sum('income', 'estimate'), actual: sum('income', 'actual') };
  return { cost, income, net: { estimate: income.estimate - cost.estimate, actual: income.actual - cost.actual } };
}

/** "$1,250" (whole dollars; "-$300" when negative). */
export function money(amount: number): string {
  const whole = Math.round(amount);
  return `${whole < 0 ? '-' : ''}$${Math.abs(whole).toLocaleString('en-US')}`;
}
