/**
 * encounterMath — how hard a fight is, and building one to order, by the SRD
 * 5.2's combat encounter rules: each character's level gives an XP budget
 * (Low, Moderate or High); a fight's difficulty is its creatures' XP against
 * the party's total budget. No multipliers for numbers, as in the 2024 rules.
 */

export const DIFFICULTIES = ['low', 'moderate', 'high'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** Below Low's floor it's a warm-up; past High it's beyond the rules' scale. */
export type Rating = 'trivial' | Difficulty | 'beyond';

/** XP for each challenge rating (SRD 5.2). CR 0 counts as 10: a creature that can still hurt you. */
export const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

/** XP budget per character, by level 1–20: [Low, Moderate, High] (SRD 5.2). */
export const XP_BUDGET: readonly (readonly [number, number, number])[] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800],
  [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
];

export const crXp = (cr: string) => CR_XP[cr] ?? 0;
export const crValue = (cr: string) => (cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr) || 0);
const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.round(level) || 1));

/** The party's total budget for each difficulty: every character's own, added up. */
export function partyBudget(levels: number[]): Record<Difficulty, number> {
  const total = { low: 0, moderate: 0, high: 0 };
  for (const level of levels) {
    const [low, moderate, high] = XP_BUDGET[clampLevel(level) - 1]!;
    total.low += low;
    total.moderate += moderate;
    total.high += high;
  }
  return total;
}

/** The difficulty a fight of `xp` is for a party with this budget. */
export function rate(xp: number, budget: Record<Difficulty, number>): Rating {
  if (xp > budget.high) return 'beyond';
  if (xp > budget.moderate) return 'high';
  if (xp > budget.low) return 'moderate';
  return xp < budget.low / 2 ? 'trivial' : 'low';
}

export const RATING_LABEL: Record<Rating, string> = { trivial: 'Trivial', low: 'Low', moderate: 'Moderate', high: 'High', beyond: 'Beyond High' };

export type Pick = { id: string; count: number };
export type Candidate = { id: string; cr: string };
export type Built = { picks: Pick[]; xp: number };

export const xpOf = (picks: Pick[], crOf: (id: string) => string | undefined) => picks.reduce((sum, p) => sum + crXp(crOf(p.id) ?? '0') * p.count, 0);

/**
 * Builds a fight from `pool` that lands on `difficulty` for these levels: as
 * much of the budget as it can use without going over, and more than the tier
 * below's (half of Low, for Low). One of four shapes, at random: a lone
 * creature, a pack of one kind, a leader with followers, or two kinds side by
 * side. Leaves out creatures with a CR above the party's highest level (the
 * rules' "troublesome" creatures). Null if the pool can't make one.
 */
export function buildEncounter(pool: Candidate[], levels: number[], difficulty: Difficulty, rng: () => number = Math.random): Built | null {
  if (!levels.length) return null;
  const budget = partyBudget(levels);
  const top = budget[difficulty];
  const floor = difficulty === 'low' ? top / 2 : budget[DIFFICULTIES[DIFFICULTIES.indexOf(difficulty) - 1]!];
  const maxCr = Math.max(...levels.map(clampLevel));
  const maxCount = Math.min(12, Math.max(4, levels.length * 2));
  const usable = pool.map((c) => ({ ...c, xp: crXp(c.cr) })).filter((c) => c.xp > 0 && c.xp <= top && crValue(c.cr) <= maxCr);
  if (!usable.length) return null;

  const pickIn = (min: number, max: number) => {
    const fits = usable.filter((c) => c.xp >= min && c.xp <= max);
    return fits.length ? fits[Math.floor(rng() * fits.length)]! : null;
  };
  const shapes: (() => Pick[] | null)[] = [
    // A lone creature.
    () => {
      const one = pickIn(floor, top);
      return one && [{ id: one.id, count: 1 }];
    },
    // A pack of one kind.
    () => {
      const count = 2 + Math.floor(rng() * (maxCount - 1));
      const one = pickIn(floor / count, top / count);
      return one && [{ id: one.id, count }];
    },
    // A leader and followers of another kind.
    () => {
      const leader = pickIn(top * 0.35, top * 0.7);
      if (!leader) return null;
      const left = top - leader.xp;
      const count = 2 + Math.floor(rng() * (maxCount - 2));
      const follower = usable.filter((c) => c.id !== leader.id && c.xp * count <= left && c.xp < leader.xp);
      const pick = follower.length ? follower[Math.floor(rng() * follower.length)]! : null;
      return pick && [{ id: leader.id, count: 1 }, { id: pick.id, count: Math.max(1, Math.min(count, Math.floor(left / pick.xp))) }];
    },
    // Two kinds, side by side.
    () => {
      const a = pickIn(floor / 4, top / 2);
      if (!a) return null;
      const b = pickIn(1, top - a.xp);
      if (!b || b.id === a.id) return null;
      return [{ id: a.id, count: 1 }, { id: b.id, count: Math.max(1, Math.min(maxCount - 1, Math.floor((top - a.xp) / b.xp))) }];
    },
  ];

  const xpFor = (picks: Pick[]) => picks.reduce((sum, p) => sum + usable.find((c) => c.id === p.id)!.xp * p.count, 0);
  let best: Built | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const picks = shapes[Math.floor(rng() * shapes.length)]!();
    if (!picks) continue;
    const xp = xpFor(picks);
    if (xp > top) continue;
    if (xp > floor) return { picks, xp };
    if (!best || xp > best.xp) best = { picks, xp };
  }
  return best && best.xp > 0 ? best : null;
}
