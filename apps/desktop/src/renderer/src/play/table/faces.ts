import { keptFlags, sidesOf, type DieGroup } from '@/lib/tabletop';

/**
 * Play → a roll's dice as the chat shows them (pure, tested in
 * combat.test.ts): each die with its sides and value, the ones advantage set
 * aside marked, and whether it came up 1 or its highest.
 */

export type Face = { sides: number; value: number; dropped: boolean };

/** A roll's dice, in order: each group's, with the ones it didn't keep (advantage's lower d20) marked. */
export function facesOf(groups: DieGroup[]): Face[] {
  return groups.flatMap((g) => {
    const sides = sidesOf(g.notation);
    const kept = keptFlags(g.rolls, g.kept);
    return g.rolls.map((value, i) => ({ sides, value, dropped: !kept[i] }));
  });
}

/** Whether a die came up 1 (red) or its highest (green). */
export const faceTone = (f: Face): 'low' | 'high' | null => (f.value === 1 ? 'low' : f.value === f.sides ? 'high' : null);
