import type { MouseEvent } from 'react';
import { toast } from 'sonner';
import { checkExpression, natural, roll, type Roll } from '@/lib/dnd';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';

/** "1d20 (14) + 5" — each group's kept dice, then the constant. Dropped dice (advantage) are shown struck in the tray, not here. */
export function breakdown(result: Roll): string {
  const parts = result.groups.map((g, i) => `${i === 0 ? (g.sign < 0 ? '-' : '') : g.sign < 0 ? ' - ' : ' + '}${g.notation} (${g.kept.join(', ')})`);
  if (result.constant) parts.push(` ${result.constant < 0 ? '-' : '+'} ${Math.abs(result.constant)}`);
  return parts.join('');
}

/**
 * Rolls, throws the dice across the screen (DiceOverlay; with the animation
 * off, a toast says the result) and keeps it in the dice tray's history.
 * Returns null (and says so) if the expression isn't dice.
 */
export function rollAndShow(expression: string, label?: string): Roll | null {
  const result = roll(expression, Math.random, label);
  if (!result) {
    toast.error('That isn’t a roll', { description: 'Try d20+5, 2d6+3 or 4d6kh3.' });
    return null;
  }
  useUi.getState().addRoll(result);
  if (!usePreferences.getState().diceAnimation) toastRoll(result);
  return result;
}

/** The result as a toast: with the throw off, or where the 3D table can't run. */
export function toastRoll(result: Roll) {
  const nat = natural(result);
  toast(`${result.label ? `${result.label}: ` : ''}${result.total}${nat === 20 ? ' · Natural 20!' : nat === 1 ? ' · Natural 1' : ''}`, { description: `${result.expression} → ${breakdown(result)}` });
}

/**
 * A d20 check from a click on a bonus: Shift rolls with advantage, Alt with
 * disadvantage (as on D&D Beyond's sheets, where the roll mode is a click away).
 */
export function rollCheck(bonus: number, label: string, event?: MouseEvent) {
  const mode = event?.shiftKey ? 'advantage' : event?.altKey ? 'disadvantage' : 'normal';
  return rollAndShow(checkExpression(bonus, mode), `${label}${mode === 'advantage' ? ' (Adv)' : mode === 'disadvantage' ? ' (Dis)' : ''}`);
}

export const ROLL_HINT = 'Click to roll · Shift: advantage · Alt: disadvantage';

