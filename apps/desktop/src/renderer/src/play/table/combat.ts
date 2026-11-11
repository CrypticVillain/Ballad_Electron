import type { CardRoll, CardTarget, RollCard } from '../sheet/rolls';

/**
 * Play → the table's sums for targets and damage (pure, with tests beside
 * it): whether an attack hit a target's AC, how much of a roll's damage a
 * target takes (full, half, double, or half on a save it made), and a
 * concentration save's DC.
 */

/** A card's attack roll: its to hit, or a spell's attack. */
export const attackRollOf = (card: RollCard): CardRoll | undefined => card.rolls.find((r) => /^To Hit|Spell Attack/.test(r.label));

/** Against an AC: a natural 20 always hits (a crit), a natural 1 always misses; else the total against it. Null without an AC. */
export function hitOrMiss(attack: CardRoll, ac: number | null): 'crit' | 'hit' | 'miss' | null {
  if (attack.natural === 20) return 'crit';
  if (attack.natural === 1) return 'miss';
  if (ac === null) return null;
  return attack.total >= ac ? 'hit' : 'miss';
}

/** How Apply puts a roll on its targets: all of it, half, double, half to those that made the save, or as healing. */
export type ApplyHow = 'full' | 'half' | 'double' | 'saves' | 'heal';

/** What one target takes from a roll's total (rounded down, as 5e rounds). */
export function amountFor(total: number, how: ApplyHow, target?: Pick<CardTarget, 'save'>): number {
  const n = Math.max(0, total);
  if (how === 'half' || (how === 'saves' && target?.save?.success)) return Math.floor(n / 2);
  if (how === 'double') return n * 2;
  return n;
}

/**
 * A damage or healing roll Apply is for: not an attack roll, a check or a
 * save, and not on a card whose healing the sheet took already (a hit die,
 * a potion drunk).
 */
export const appliable = (card: RollCard, r: CardRoll) => !['hitdie', 'item', 'death', 'concentration'].includes(card.kind) && Boolean(r.heal || r.type !== undefined || /Damage/.test(r.label));

/** Concentration's save after damage: DC 10, or half the damage if that's more. */
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2));

/** A card worth aiming (it carries the targets you have): an attack, a spell, a creature's action, damage or healing. */
export const aims = (card: RollCard) => ['attack', 'spell', 'action', 'item', 'feature', 'roll'].includes(card.kind) && (card.rolls.length > 0 || Boolean(card.save));
