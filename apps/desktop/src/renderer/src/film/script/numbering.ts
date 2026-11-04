/**
 * Filmmaking → Script: scene numbers (pure). Before a lock, scenes number
 * 1, 2, 3 in order. Once locked a scene keeps its number for good: a scene
 * put in after 12 is 12A (then 12B), one put in before the first is A1 (then
 * B1), and a locked scene that's gone is listed as OMITTED in its place.
 */

export type Numbered = { id: string; number: string; omitted?: boolean };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letter = (i: number) => LETTERS[i] ?? `Z${i - 25}`;

/** The next free number after `prev` (null: before the first scene, numbered from `first`). */
function after(prev: string | null, first: string, taken: Set<string>): string {
  let make: (i: number) => string;
  let i: number;
  const prefixed = prev?.match(/^([A-Z])(\d.*)$/);
  if (!prev || prefixed) {
    // Before the first locked scene: A1, B1…
    const root = prefixed ? prefixed[2]! : first;
    i = prefixed ? LETTERS.indexOf(prefixed[1]!) + 1 : 0;
    make = (k) => `${letter(k)}${root}`;
  } else {
    const [, root, suffix] = prev.match(/^(.*?)([A-Z]*)$/)!;
    i = suffix ? LETTERS.indexOf(suffix.at(-1)!) + 1 : 0;
    make = (k) => `${root}${suffix && suffix.length > 1 ? suffix.slice(0, -1) : ''}${letter(k)}`;
  }
  while (taken.has(make(i))) i++;
  return make(i);
}

/** Scene numbers for scenes in `order`, by the lock's numbers (none: 1, 2, 3…). Omitted locked scenes come back in place, marked. */
export function sceneNumbers(order: string[], locked?: [string, string][] | null): Numbered[] {
  if (!locked?.length) return order.map((id, i) => ({ id, number: String(i + 1) }));
  const lockedNumber = new Map(locked);
  const taken = new Set(locked.map(([, n]) => n));
  const first = locked[0]![1].replace(/^[A-Z]+(?=\d)/, '').replace(/[A-Z]+$/, '');
  const out: Numbered[] = [];
  for (const id of order) {
    const own = lockedNumber.get(id);
    const number = own ?? after(out.at(-1)?.number ?? null, first, taken);
    taken.add(number);
    out.push({ id, number });
  }
  // Locked scenes that are gone: OMITTED, after the nearest locked scene before them that's still here (and anything lettered after it).
  const here = new Set(order);
  locked.forEach(([id, number], index) => {
    if (here.has(id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k--) {
      const prior = out.findIndex((n) => n.id === locked[k]![0]);
      if (prior < 0) continue;
      at = prior + 1;
      while (at < out.length && (out[at]!.omitted || !lockedNumber.has(out[at]!.id))) at++;
      break;
    }
    out.splice(at, 0, { id, number, omitted: true });
  });
  return out;
}
