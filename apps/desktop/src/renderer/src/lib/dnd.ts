/**
 * dnd.ts — the D&D section's rules math and dice. Only the game's mechanics
 * (ability modifiers, proficiency, the eighteen skills, conditions), as in the
 * System Reference Document (SRD 5.1, CC-BY-4.0); no rules text or
 * creatures ship with the app. Tests beside it.
 */
import type { Abilities, Ability, Book, Coin, DndRole, Feature, Item, PlayerCharacter } from './model';

export const ABILITY_NAME: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

export const SKILLS: { name: string; ability: Ability }[] = [
  { name: 'Acrobatics', ability: 'dex' },
  { name: 'Animal Handling', ability: 'wis' },
  { name: 'Arcana', ability: 'int' },
  { name: 'Athletics', ability: 'str' },
  { name: 'Deception', ability: 'cha' },
  { name: 'History', ability: 'int' },
  { name: 'Insight', ability: 'wis' },
  { name: 'Intimidation', ability: 'cha' },
  { name: 'Investigation', ability: 'int' },
  { name: 'Medicine', ability: 'wis' },
  { name: 'Nature', ability: 'int' },
  { name: 'Perception', ability: 'wis' },
  { name: 'Performance', ability: 'cha' },
  { name: 'Persuasion', ability: 'cha' },
  { name: 'Religion', ability: 'int' },
  { name: 'Sleight of Hand', ability: 'dex' },
  { name: 'Stealth', ability: 'dex' },
  { name: 'Survival', ability: 'wis' },
];

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

/** What each condition does, in short (the SRD 5.1's rules). */
export const CONDITION_TEXT: Record<string, string> = {
  Blinded: 'Can’t see: automatically fails checks that need sight. Attacks against it have advantage; its attacks have disadvantage.',
  Charmed: 'Can’t attack the charmer or target them with harmful abilities or magic. The charmer has advantage on social checks with it.',
  Deafened: 'Can’t hear: automatically fails checks that need hearing.',
  Exhaustion:
    'Levels add up. 1: disadvantage on ability checks. 2: speed halved. 3: disadvantage on attacks and saves. 4: hit point maximum halved. 5: speed 0. 6: death. A long rest (with food and drink) removes one level.',
  Frightened: 'Disadvantage on checks and attacks while the source of fear is in sight; can’t willingly move closer to it.',
  Grappled: 'Speed 0, and no bonus to speed. Ends if the grappler is incapacitated or it’s moved out of reach.',
  Incapacitated: 'Can’t take actions or reactions.',
  Invisible: 'Can’t be seen without magic or a special sense; counts as heavily obscured for hiding. Attacks against it have disadvantage; its attacks have advantage.',
  Paralyzed: 'Incapacitated; can’t move or speak. Fails Strength and Dexterity saves. Attacks against it have advantage, and a hit from within 5 feet is a critical hit.',
  Petrified: 'Turned to stone with what it wears and carries: incapacitated, can’t move or speak, unaware. Attacks against it have advantage; fails Strength and Dexterity saves; resists all damage; immune to poison and disease.',
  Poisoned: 'Disadvantage on attack rolls and ability checks.',
  Prone: 'Can only crawl unless it stands (half its speed). Disadvantage on its attacks. Attacks against it have advantage within 5 feet, disadvantage from farther away.',
  Restrained: 'Speed 0. Attacks against it have advantage; its attacks have disadvantage. Disadvantage on Dexterity saves.',
  Stunned: 'Incapacitated; can’t move; can speak only falteringly. Fails Strength and Dexterity saves. Attacks against it have advantage.',
  Unconscious: 'Incapacitated; can’t move or speak; unaware; drops what it holds and falls prone. Fails Strength and Dexterity saves. Attacks against it have advantage, and a hit from within 5 feet is a critical hit.',
};

export const DEFAULT_ABILITIES: Abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/** 15 → +2, 8 → -1. */
export const modifier = (score: number) => Math.floor((score - 10) / 2);

/** +2 at levels 1-4, +3 at 5-8 … +6 at 17-20. */
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);

/** "+3", "-1", "+0". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function saveBonus(pc: Pick<PlayerCharacter, 'abilities' | 'saves' | 'level'>, ability: Ability): number {
  return modifier(pc.abilities[ability]) + (pc.saves.includes(ability) ? proficiencyBonus(pc.level) : 0);
}

export function skillBonus(pc: Pick<PlayerCharacter, 'abilities' | 'skills' | 'expertise' | 'level'>, skill: string): number {
  const ability = SKILLS.find((s) => s.name === skill)?.ability ?? 'str';
  const prof = pc.expertise.includes(skill) ? 2 : pc.skills.includes(skill) ? 1 : 0;
  return modifier(pc.abilities[ability]) + prof * proficiencyBonus(pc.level);
}

export const initiative = (pc: Pick<PlayerCharacter, 'abilities' | 'initiativeBonus'>) => modifier(pc.abilities.dex) + pc.initiativeBonus;

/** 10 + Perception. */
export const passivePerception = (pc: Pick<PlayerCharacter, 'abilities' | 'skills' | 'expertise' | 'level'>) => 10 + skillBonus(pc, 'Perception');

/** 10 + a skill: what the DM checks against without a roll (Perception, Investigation, Insight). */
export const passive = (pc: Pick<PlayerCharacter, 'abilities' | 'skills' | 'expertise' | 'level'>, skill: string) => 10 + skillBonus(pc, skill);

/** The spell save DC (8 + proficiency + the casting ability's modifier), or null if they don't cast. */
export function spellSaveDc(pc: Pick<PlayerCharacter, 'abilities' | 'level' | 'spellcasting'>): number | null {
  return pc.spellcasting ? 8 + proficiencyBonus(pc.level) + modifier(pc.abilities[pc.spellcasting]) : null;
}

/** The spell attack bonus (proficiency + the casting ability's modifier), or null. */
export function spellAttack(pc: Pick<PlayerCharacter, 'abilities' | 'level' | 'spellcasting'>): number | null {
  return pc.spellcasting ? proficiencyBonus(pc.level) + modifier(pc.abilities[pc.spellcasting]) : null;
}

/** What anyone can do on their turn, for the Actions list, each with what it does (the SRD's rules, in short). */
export const COMBAT_ACTIONS: { name: string; kind: 'action' | 'bonus' | 'reaction' | 'free'; text: string }[] = [
  { name: 'Attack', kind: 'action', text: 'Make one melee or ranged attack (more with Extra Attack). In place of an attack you can grapple or shove.' },
  { name: 'Cast a Spell', kind: 'action', text: 'Cast a spell with a casting time of 1 action. If you cast a spell as a bonus action, the only other spell you can cast that turn is a cantrip.' },
  { name: 'Dash', kind: 'action', text: 'Gain extra movement equal to your speed (after modifiers) for this turn.' },
  { name: 'Disengage', kind: 'action', text: 'Your movement doesn’t provoke opportunity attacks for the rest of the turn.' },
  { name: 'Dodge', kind: 'action', text: 'Until your next turn, attacks against you have disadvantage if you can see the attacker, and you make Dexterity saves with advantage. Lost if you’re incapacitated or your speed drops to 0.' },
  { name: 'Help', kind: 'action', text: 'Give an ally advantage on their next check for a task you help with, or on their next attack against a creature within 5 feet of you, before your next turn.' },
  { name: 'Hide', kind: 'action', text: 'Make a Dexterity (Stealth) check against the passive Perception of anyone looking. You can’t hide from a creature that can see you clearly.' },
  { name: 'Ready', kind: 'action', text: 'Pick a trigger and an action (or a move). When it happens before your next turn, use your reaction to do it. A readied spell needs concentration.' },
  { name: 'Search', kind: 'action', text: 'Look for something: a Wisdom (Perception) or Intelligence (Investigation) check, as the DM decides.' },
  { name: 'Use an Object', kind: 'action', text: 'Use an object that takes your action: drink a potion, light a lamp, pull a lever.' },
  { name: 'Grapple', kind: 'action', text: 'In place of one attack: Strength (Athletics) against the target’s Athletics or Acrobatics. If you win, its speed is 0 until it escapes or you let go.' },
  { name: 'Shove', kind: 'action', text: 'In place of one attack: Strength (Athletics) against the target’s Athletics or Acrobatics. If you win, knock it prone or push it 5 feet away.' },
  { name: 'Two-Weapon Fighting', kind: 'bonus', text: 'After attacking with a light melee weapon in one hand, attack with a different light melee weapon in the other. Don’t add your ability modifier to its damage unless it’s negative.' },
  { name: 'Opportunity Attack', kind: 'reaction', text: 'When a creature you can see leaves your reach, make one melee attack against it. Disengaging, or being moved without using its own movement, doesn’t provoke one.' },
  { name: 'Move', kind: 'free', text: 'Move up to your speed, before and after your action as you like. Standing up from prone costs half your speed; difficult terrain costs double.' },
  { name: 'Interact', kind: 'free', text: 'One free interaction with an object each turn: draw or sheathe a weapon, open a door, pick something up. A second one takes your action.' },
];

// ── Inventory ───────────────────────────────────────────────────────────

/** How much they can carry: Strength × 15 lb. */
export const carryingCapacity = (strength: number) => strength * 15;

/** The weight of everything carried, in pounds (to a tenth). */
export const carriedWeight = (items: Item[]) => Math.round(items.reduce((sum, item) => sum + item.qty * (item.weight ?? 0), 0) * 10) / 10;

/** A character can be attuned to three magic items at once. */
export const ATTUNEMENT_SLOTS = 3;

export const COIN_NAME: Record<Coin, string> = { cp: 'Copper', sp: 'Silver', ep: 'Electrum', gp: 'Gold', pp: 'Platinum' };
const COIN_GP: Record<Coin, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** Coins' worth in gold pieces (to a hundredth). */
export const coinsInGold = (currency: Partial<Record<Coin, number>> = {}) =>
  Math.round(Object.entries(currency).reduce((sum, [coin, n]) => sum + (n ?? 0) * COIN_GP[coin as Coin], 0) * 100) / 100;

// ── Hit points ──────────────────────────────────────────────────────────

export type HitPoints = { max: number; current: number; temp: number };

/** Damage comes off temporary hit points first, then current; never below 0. */
export function damage(hp: HitPoints, amount: number): HitPoints {
  const hit = Math.max(0, Math.floor(amount));
  const fromTemp = Math.min(hp.temp, hit);
  return { ...hp, temp: hp.temp - fromTemp, current: Math.max(0, hp.current - (hit - fromTemp)) };
}

/** Healing raises current hit points up to the max (temporary ones aren't healed). */
export function heal(hp: HitPoints, amount: number): HitPoints {
  return { ...hp, current: Math.min(hp.max, hp.current + Math.max(0, Math.floor(amount))) };
}

/**
 * A long rest: hit points back to full (temporary ones gone), every spell
 * slot back, death saves cleared, every feature's uses back.
 */
export function longRest(pc: Pick<PlayerCharacter, 'hp' | 'slots'> & { traits?: Feature[] }): Pick<PlayerCharacter, 'hp' | 'slots' | 'deathSaves' | 'traits'> {
  return {
    hp: { ...pc.hp, current: pc.hp.max, temp: 0 },
    slots: pc.slots.map(([max]) => [max, 0] as [number, number]),
    deathSaves: { successes: 0, failures: 0 },
    traits: restoreUses(pc.traits, ['short', 'long']),
  };
}

/** A short rest: the uses of features that come back on one (hit points are spent from hit dice by hand). */
export function shortRest(pc: { traits?: Feature[] }): Pick<PlayerCharacter, 'traits'> {
  return { traits: restoreUses(pc.traits, ['short']) };
}

const restoreUses = (traits: Feature[] = [], resets: string[]) => traits.map((f) => (f.uses && resets.includes(f.uses.reset) ? { ...f, uses: { ...f.uses, used: 0 } } : f));

/** How a feature is used in a turn, from its text ("as a bonus action", "use your reaction"). */
export function actionKind(text: string): NonNullable<Feature['action']> {
  const t = text.toLowerCase();
  if (/\bbonus action\b/.test(t)) return 'bonus';
  if (/\b(use your|use a|as a|your) reaction\b/.test(t)) return 'reaction';
  if (/\b(as an|use an|use your|take the) action\b|\byour action\b/.test(t)) return 'action';
  return 'passive';
}

/** A limited feature's uses as its text says: once, back on a short or a long rest. */
export function usesFromText(text: string): Feature['uses'] {
  const t = text.toLowerCase().replace(/’/g, "'");
  // Only a feature that's spent ("once you use it", "can't use it again until"), not one that mentions a rest.
  if (!/once you use|can't (use|do) (it|so|this feature) again|before you can (use|do) (it|so|this feature) again/.test(t)) return null;
  if (/finish a short or long rest/.test(t)) return { max: 1, used: 0, reset: 'short' };
  if (/finish a long rest/.test(t)) return { max: 1, used: 0, reset: 'long' };
  return null;
}

// ── Building a character ────────────────────────────────────────────────

/** The standard array: six scores to hand out. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Point buy: what a score from 8 to 15 costs, out of 27 points. */
export const POINT_BUY: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const pointBuyCost = (scores: Abilities) => Object.values(scores).reduce((sum, s) => sum + (POINT_BUY[s] ?? 99), 0);

/** Hit points at 1st level: the hit die's most, plus CON (at least 1). */
export const firstLevelHp = (hitDie: number, con: number) => Math.max(1, hitDie + modifier(con));

/** A level's hit points taken as the average: half the die plus one, plus CON (at least 1). */
export const averageLevelHp = (hitDie: number, con: number) => Math.max(1, hitDie / 2 + 1 + modifier(con));

/** Ability score improvements: +1 for each pick (pick one twice for +2), none past 20. */
export function improve(scores: Abilities, picks: Ability[]): Abilities {
  const next = { ...scores };
  for (const a of picks) next[a] = Math.min(20, next[a] + 1);
  return next;
}

/** Armor Class from what they wear: compendium armor stats ("AC 14 + Dex (max 2)", a shield's "AC +2"), else 10 + DEX. */
export function armorClass(dex: number, armor: string[]): number {
  const mod = modifier(dex);
  let body: number | null = null;
  let shield = 0;
  for (const stats of armor) {
    const plus = /^AC \+(\d+)/.exec(stats);
    if (plus) {
      shield = Math.max(shield, Number(plus[1]));
      continue;
    }
    const m = /^AC (\d+)( \+ Dex)?(?: \(max (\d+)\))?/.exec(stats);
    if (m) body = Math.max(body ?? 0, Number(m[1]) + (m[2] ? Math.min(mod, m[3] ? Number(m[3]) : 99) : 0));
  }
  return (body ?? 10 + mod) + shield;
}

// ── DM and Player ───────────────────────────────────────────────────────

/** Whether a view sees a book: the DM their session log, a player their journal. */
export const seesBook = (book: Pick<Book, 'audience'>, role: DndRole) => (book.audience === 'player') === (role === 'player');

// ── Dice ────────────────────────────────────────────────────────────────

export type DieGroup = { notation: string; rolls: number[]; kept: number[]; sign: 1 | -1 };
export type Roll = { expression: string; total: number; groups: DieGroup[]; constant: number; label?: string };

/**
 * Rolls a dice expression: terms of NdM (N defaults to 1), NdMkhK / NdMklK
 * (keep the highest / lowest K: 2d20kh1 is advantage) and plain numbers,
 * joined by + and -. "d20+5", "2d6 + 1d4 - 1", "4d6kh3". Null if it isn't
 * one. `random` returns [0, 1) (Math.random by default; tests pass their own).
 */
export function roll(expression: string, random: () => number = Math.random, label?: string): Roll | null {
  const source = expression.replace(/\s+/g, '').toLowerCase();
  if (!source || !/^[+-]?(\d*d\d+(k[hl]\d+)?|\d+)([+-](\d*d\d+(k[hl]\d+)?|\d+))*$/.test(source)) return null;
  const groups: DieGroup[] = [];
  let constant = 0;
  for (const match of source.matchAll(/([+-]?)(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/g)) {
    const sign = match[1] === '-' ? -1 : 1;
    if (match[6] !== undefined) {
      constant += sign * Number(match[6]);
      continue;
    }
    const count = Math.min(match[2] ? Number(match[2]) : 1, 100);
    const sides = Number(match[3]);
    if (count < 1 || sides < 1 || sides > 1000) return null;
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
    let kept = rolls;
    if (match[4]) {
      const keep = Math.min(Number(match[5]), count);
      const sorted = [...rolls].sort((a, b) => (match[4] === 'h' ? b - a : a - b));
      kept = sorted.slice(0, keep);
    }
    groups.push({ notation: `${count}d${sides}${match[4] ? `k${match[4]}${match[5]}` : ''}`, rolls, kept, sign });
  }
  const total = groups.reduce((sum, g) => sum + g.sign * g.kept.reduce((a, b) => a + b, 0), 0) + constant;
  return { expression: expression.trim(), total, groups, constant, label };
}

/** A d20 check with a modifier: "d20+5" (or with advantage / disadvantage). */
export const checkExpression = (bonus: number, mode: 'normal' | 'advantage' | 'disadvantage' = 'normal') =>
  `${mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : 'd20'}${bonus ? signed(bonus) : ''}`;

/** The sides of a group's dice: "2d20kh1" → 20. */
export const sidesOf = (notation: string) => Number(/d(\d+)/.exec(notation)?.[1] ?? 6);

/** Which of a group's rolls were kept (advantage drops one): one flag per roll, the first of equal values kept first. */
export function keptFlags(rolls: number[], kept: number[]): boolean[] {
  const pool = [...kept];
  return rolls.map((value) => {
    const at = pool.indexOf(value);
    if (at < 0) return false;
    pool.splice(at, 1);
    return true;
  });
}

/** A natural 20 or 1 on a single d20 roll. */
export function natural(result: Roll): 20 | 1 | null {
  const d20 = result.groups.find((g) => g.notation.includes('d20'));
  const value = d20?.kept[0];
  return d20 && d20.kept.length === 1 ? (value === 20 ? 20 : value === 1 ? 1 : null) : null;
}
