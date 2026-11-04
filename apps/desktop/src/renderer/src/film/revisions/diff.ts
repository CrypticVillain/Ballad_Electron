import type { ScriptElement } from '@/film/script/model';

/**
 * Filmmaking → Revisions: what changed in a scene since a revision round
 * began (pure). Elements are matched in order (longest common run), so a
 * line put in, rewritten or moved is marked, and the rest isn't.
 */

const key = (e: ScriptElement) => `${e.type}|${e.text.replace(/\s+/g, ' ').trim()}${e.dual ? '|dual' : ''}`;

/** For each element now, whether it's new or changed since `before`. */
export function changedSince(before: ScriptElement[], now: ScriptElement[]): boolean[] {
  const a = before.map(key);
  const b = now.map(key);
  // lcs[i][j]: the longest common run of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  }
  const changed = new Array<boolean>(b.length).fill(true);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      changed[j] = false;
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }
  return changed;
}

/** How a scene stands against a round's start: new, changed (about how many lines), or as it was. Lines cut count too. */
export function sceneChanges(before: ScriptElement[] | undefined, now: ScriptElement[]): { status: 'new' | 'changed' | 'same'; count: number } {
  if (!before) return { status: 'new', count: now.length };
  const marks = changedSince(before, now);
  const kept = marks.filter((m) => !m).length;
  // A line rewritten is one change (not one gone and one new): new or changed lines, or lines cut, whichever is more.
  const count = Math.max(marks.filter(Boolean).length, before.length - kept);
  return { status: count ? 'changed' : 'same', count };
}
