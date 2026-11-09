import type { Ability, SpellInfo } from '@/lib/model';
import { natural, roll, type Roll } from '@/lib/tabletop';

/**
 * Play → the sheet's rolls (pure, with tests beside it), as the table's
 * chat shows them: a card for what was rolled or sent (a check, an attack,
 * a spell, a feature, an item), its rolls (to hit, damage, healing), what
 * to know (the save's DC, the range) and its text. Spells' and creatures'
 * dice are read from their text ("8d6 fire damage", "+4 to hit"), with
 * upcasting, cantrips' growth by level, and a natural 20 doubling the
 * damage dice.
 */

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export type CardRoll = {
  label: string;
  expression: string;
  total: number;
  detail: string;
  /** A d20's natural 20 or 1. */
  natural?: 20 | 1 | null;
  /** Damage or healing: its type ("fire"); a crit's dice were doubled. */
  type?: string;
  crit?: boolean;
  heal?: boolean;
};

export type CardKind = 'check' | 'save' | 'skill' | 'initiative' | 'attack' | 'spell' | 'feature' | 'item' | 'action' | 'death' | 'hitdie' | 'roll' | 'trait';

export type RollCard = {
  kind: CardKind;
  title: string;
  /** "Level 3 Evocation · cast at level 4", "Dexterity Save". */
  subtitle?: string;
  rolls: CardRoll[];
  /** What to know: the save and its DC, the range, the casting time. */
  facts?: { label: string; value: string }[];
  /** Its words (a spell's, a feature's, an item's), shown under the rolls. */
  text?: string;
};

const DAMAGE_TYPES = 'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';
const ABILITIES: Record<string, Ability> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

/** A dice expression tidied for the roller: "1d4 + 1" → "1d4+1", "−" → "-". */
export const tidy = (dice: string) => dice.replace(/[−–]/g, '-').replace(/\s+/g, '');

/** A crit's damage: every die rolled twice over ("2d6+3" → "4d6+3"). */
export const critDice = (dice: string) => tidy(dice).replace(/(\d*)d(\d+)/g, (_, n: string, s: string) => `${(Number(n) || 1) * 2}d${s}`);

/** More dice of a kind: "8d6" plus 2 × "1d6" → "10d6"; another kind is added on ("8d6" + "1d8" → "8d6+1d8"). */
export function addDice(dice: string, extra: string, times = 1): string {
  if (times <= 0 || !extra) return tidy(dice);
  const e = /^(\d*)d(\d+)$/.exec(tidy(extra));
  if (!e) return `${tidy(dice)}+${tidy(extra)}`;
  const count = (Number(e[1]) || 1) * times;
  const base = tidy(dice);
  const same = new RegExp(`(^|[+-])(\\d*)d${e[2]}(?!\\d)`);
  if (same.test(base)) return base.replace(same, (_, sign: string, n: string) => `${sign}${(Number(n) || 1) + count}d${e[2]}`);
  return `${base}+${count}d${e[2]}`;
}

/** A damage line from a sheet ("1d8+3 slashing", "2d6"): its dice and its type. */
export function splitDamage(text: string): { dice: string; type: string } {
  const m = /^\s*([\dd+\-−\s]+?)\s*([a-z][a-z ]*)?$/i.exec(text.trim());
  return m ? { dice: tidy(m[1]!), type: (m[2] ?? '').trim().toLowerCase() } : { dice: tidy(text), type: '' };
}

/** What a spell does when cast, read from its text: its save or attack roll, its damage or healing, and how it grows. */
export type SpellEffect = {
  save?: Ability;
  attack?: 'melee' | 'ranged';
  damage: { dice: string; type: string }[];
  healing?: { dice: string; addModifier: boolean };
  /** At Higher Levels: these dice more for each slot above `from`. */
  perSlot?: { dice: string; from: number };
};

export function parseSpell(spell: Pick<SpellInfo, 'text' | 'higher' | 'level'>): SpellEffect {
  const text = spell.text;
  const save = /\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i.exec(text)?.[1];
  const attack = /\b(melee|ranged) spell attack/i.exec(text)?.[1];
  const damage: SpellEffect['damage'] = [];
  for (const m of text.matchAll(new RegExp(`(\\d+d\\d+(?:\\s*[+−-]\\s*\\d+)?)\\s+(${DAMAGE_TYPES})\\s+damage`, 'gi'))) {
    const d = { dice: tidy(m[1]!), type: m[2]!.toLowerCase() };
    if (!damage.some((x) => x.dice === d.dice && x.type === d.type)) damage.push(d);
  }
  const heal = /regains?\s+(?:a number of\s+)?hit points equal to\s+(\d+d\d+)(\s*\+\s*your spellcasting ability modifier)?/i.exec(text) ?? /regains?\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+hit points/i.exec(text);
  const up = /increases by (\d+d\d+) for each (?:slot )?level above (\d)/i.exec(spell.higher);
  return {
    ...(save ? { save: ABILITIES[save.toLowerCase()]! } : {}),
    ...(attack ? { attack: attack.toLowerCase() as 'melee' | 'ranged' } : {}),
    damage,
    ...(heal ? { healing: { dice: tidy(heal[1]!), addModifier: Boolean(heal[2]) } } : {}),
    ...(up ? { perSlot: { dice: up[1]!, from: Number(up[2]) } } : {}),
  };
}

/** A cantrip's dice at a character's level: twice at 5th, three times at 11th, four at 17th. */
export const cantripTimes = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);

/** A spell's damage (or healing) dice as cast: grown by the slot (or, a cantrip, by the caster's level). */
export function castDice(dice: string, spell: Pick<SpellInfo, 'level'>, effect: SpellEffect, slot: number, casterLevel: number): string {
  if (spell.level === 0) {
    const m = /^(\d*)d(\d+)(.*)$/.exec(tidy(dice));
    if (!m) return tidy(dice);
    return `${(Number(m[1]) || 1) * cantripTimes(casterLevel)}d${m[2]}${m[3]}`;
  }
  if (effect.perSlot && slot > effect.perSlot.from) return addDice(dice, effect.perSlot.dice, slot - effect.perSlot.from);
  return tidy(dice);
}

/** A creature's action, read from its text: "+4 to hit", "Hit: 2d4 + 2 slashing", "DC 10 Constitution save". */
export function parseAction(text: string): { toHit?: number; damage: { dice: string; type: string }[]; save?: { dc: number; ability: string } } {
  const hit = /([+-]\d+)\s+to hit/i.exec(text);
  const damage: { dice: string; type: string }[] = [];
  for (const m of text.matchAll(new RegExp(`(\\d+d\\d+(?:\\s*[+−-]\\s*\\d+)?)\\)?\\s*(${DAMAGE_TYPES})`, 'gi'))) damage.push({ dice: tidy(m[1]!), type: m[2]!.toLowerCase() });
  const save = /DC\s*(\d+)\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)/i.exec(text);
  return { ...(hit ? { toHit: Number(hit[1]) } : {}), damage, ...(save ? { save: { dc: Number(save[1]), ability: save[2]![0]!.toUpperCase() + save[2]!.slice(1).toLowerCase() } } : {}) };
}

/** Healing a potion or the like gives, from its text: "regain 2d4 + 2 hit points". */
export const itemHealing = (text: string) => {
  const m = /regains?\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+hit points/i.exec(text);
  return m ? tidy(m[1]!) : null;
};

/** A d20 roll with a bonus (and extra, like Bless's +1d4), in a mode. */
export function d20Expression(bonus: number, mode: RollMode, extra = ''): string {
  const die = mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : '1d20';
  const b = bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';
  const x = tidy(extra);
  return `${die}${b}${x ? (/^[+-]/.test(x) ? x : `+${x}`) : ''}`;
}

/** "1d20 (14) + 5": each group's kept dice, then the constant (as the dice tray says it). */
function breakdown(result: Roll): string {
  const parts = result.groups.map((g, i) => `${i === 0 ? (g.sign < 0 ? '-' : '') : g.sign < 0 ? ' - ' : ' + '}${g.notation} (${g.kept.join(', ')})`);
  if (result.constant) parts.push(` ${result.constant < 0 ? '-' : '+'} ${Math.abs(result.constant)}`);
  return parts.join('');
}

/** Rolls an expression into a card's roll (null if it isn't dice). */
export function cardRoll(label: string, expression: string, extras: Partial<CardRoll> = {}, random: () => number = Math.random): CardRoll | null {
  const r: Roll | null = roll(expression, random);
  if (!r) return null;
  return { label, expression: r.expression, total: r.total, detail: breakdown(r), ...(expression.includes('d20') ? { natural: natural(r) } : {}), ...extras };
}

/** Damage rolls for each part, doubled dice on a crit; extra damage (Hunter's Mark's 1d6) added to the first. */
export function damageRolls(parts: { dice: string; type: string }[], crit: boolean, extra = '', random: () => number = Math.random): CardRoll[] {
  return parts
    .map((p, i) => {
      const x = i === 0 && tidy(extra) ? (/^[+-]/.test(tidy(extra)) ? tidy(extra) : `+${tidy(extra)}`) : '';
      const dice = `${crit ? critDice(p.dice) : tidy(p.dice)}${crit && x ? critDice(x) : x}`;
      return cardRoll(crit ? 'Critical Damage' : 'Damage', dice, { type: p.type, crit }, random);
    })
    .filter((r): r is CardRoll => r !== null);
}
