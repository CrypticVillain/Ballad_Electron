import type { Ability, Feature, Item, ItemInfo, Monster, PlayerCharacter, SpellInfo } from '@/lib/model';
import { ABILITY_NAME, modifier, saveBonus, signed, skillBonus, spellAttack, spellSaveDc, initiative as initiativeBonus } from '@/lib/tabletop';
import { castDice, cardRoll, d20Expression, damageRolls, itemHealing, parseAction, parseSpell, splitDamage, tidy, type CardRoll, type RollCard, type RollMode } from './rolls';

/**
 * Play → what each thing on a sheet sends to the chat (pure: the random
 * number source is passed in by tests): a card, and what it changes on the
 * sheet (a slot spent, a use ticked, a death save marked, hit points back).
 * Every roll can be with advantage or disadvantage and an extra (Bless's
 * 1d4 on d20s, Hunter's Mark's 1d6 on damage); a natural 20 on an attack
 * doubles its damage dice.
 */

export type SheetOptions = { mode: RollMode; d20Extra: string; damageExtra: string };
export type Sent = { card: RollCard; changes?: Partial<PlayerCharacter> };
type Rng = () => number;

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const modeNote = (o: SheetOptions) => (o.mode === 'advantage' ? ' (Advantage)' : o.mode === 'disadvantage' ? ' (Disadvantage)' : '');
const d20 = (label: string, bonus: number, o: SheetOptions, rng: Rng) => cardRoll(`${label}${modeNote(o)}`, d20Expression(bonus, o.mode, o.d20Extra), {}, rng)!;
const ABILITY_OF: Record<string, Ability> = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha' };

export const checkCard = (who: string, ability: Ability, score: number, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'check', title: `${ABILITY_NAME[ability]} Check`, subtitle: who, rolls: [d20('Check', modifier(score), o, rng)] },
});

export const saveCard = (pc: PlayerCharacter, ability: Ability, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'save', title: `${ABILITY_NAME[ability]} Save`, subtitle: pc.name, rolls: [d20('Save', saveBonus(pc, ability), o, rng)] },
});

export const skillCard = (pc: PlayerCharacter, skill: string, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'skill', title: skill, subtitle: pc.name, rolls: [d20('Check', skillBonus(pc, skill), o, rng)] },
});

export const initiativeCard = (who: string, bonus: number, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'initiative', title: 'Initiative', subtitle: who, rolls: [d20('Initiative', bonus, o, rng)] },
});

export const pcInitiative = (pc: PlayerCharacter) => initiativeBonus(pc);

/** An attack: to hit (unless it has no bonus: damage only, like Sneak Attack) and its damage, doubled on a natural 20. */
export function attackCard(who: string, attack: { name: string; bonus: number; damage: string }, o: SheetOptions, rng: Rng = Math.random, text?: string): Sent {
  const rolls: CardRoll[] = [];
  let crit = false;
  if (attack.bonus !== 0) {
    const hit = d20('To Hit', attack.bonus, o, rng);
    crit = hit.natural === 20;
    rolls.push(hit);
  }
  const { dice, type } = splitDamage(attack.damage);
  if (dice) rolls.push(...damageRolls([{ dice, type }], crit, o.damageExtra, rng));
  return { card: { kind: 'attack', title: attack.name || 'Attack', subtitle: who, rolls, ...(text ? { text } : {}) } };
}

/**
 * A spell cast (at `slot`; a cantrip at 0): its attack roll or save DC, its
 * damage or healing as cast, the slot spent, and its text. A spell the
 * compendium doesn't know is sent by name.
 */
export function spellCard(pc: PlayerCharacter, name: string, info: SpellInfo | undefined, slot: number, o: SheetOptions, rng: Rng = Math.random): Sent {
  const level = info?.level ?? 0;
  const facts: { label: string; value: string }[] = [];
  const rolls: CardRoll[] = [];
  const changes: Partial<PlayerCharacter> = {};
  if (slot > 0 && level > 0) {
    const [max, used] = pc.slots[slot - 1] ?? [0, 0];
    if (used < max) changes.slots = pc.slots.map((s, i) => (i === slot - 1 ? [s[0], s[1] + 1] : s));
  }
  if (!info) return { card: { kind: 'spell', title: name, subtitle: `${pc.name} casts it`, rolls }, changes };
  const fx = parseSpell(info);
  const mod = pc.spellcasting ? modifier(pc.abilities[pc.spellcasting]) : 0;
  let crit = false;
  if (fx.attack) {
    const bonus = spellAttack(pc) ?? 0;
    const hit = d20(`${fx.attack === 'melee' ? 'Melee' : 'Ranged'} Spell Attack`, bonus, o, rng);
    crit = hit.natural === 20;
    rolls.push(hit);
  }
  if (fx.save) facts.push({ label: 'Save', value: `DC ${spellSaveDc(pc) ?? '?'} ${ABILITY_NAME[fx.save]}` });
  const cast = level === 0 ? 0 : Math.max(slot, level);
  rolls.push(...damageRolls(fx.damage.map((d) => ({ dice: castDice(d.dice, info, fx, cast, pc.level), type: d.type })), crit, o.damageExtra, rng));
  if (fx.healing) {
    const dice = castDice(fx.healing.dice, info, fx, cast, pc.level);
    const r = cardRoll('Healing', `${dice}${fx.healing.addModifier && mod ? signed(mod) : ''}`, { heal: true }, rng);
    if (r) rolls.push(r);
  }
  facts.push({ label: 'Casting', value: info.castingTime }, { label: 'Range', value: info.range });
  if (info.duration) facts.push({ label: 'Duration', value: `${info.concentration ? 'Concentration, ' : ''}${info.duration}` });
  const subtitle = level === 0 ? `${pc.name} · Cantrip` : `${pc.name} · ${ord(level)}-level ${info.school}${cast > level ? ` · cast at ${ord(cast)} level` : ''}`;
  const dc = spellSaveDc(pc);
  return {
    card: {
      kind: 'spell',
      title: info.name,
      subtitle,
      rolls,
      facts,
      text: [info.text, info.higher && `At Higher Levels. ${info.higher}`].filter(Boolean).join('\n\n'),
      ...(fx.save && dc ? { save: { ability: fx.save, dc } } : {}),
      ...(info.concentration ? { concentration: info.name } : {}),
    },
    changes,
  };
}

/** A feature: its text; used (`use`), a use ticked and its roll (Second Wind's 1d10 + level). */
export function featureCard(pc: PlayerCharacter, feature: Feature, use: boolean, o: SheetOptions, rng: Rng = Math.random): Sent {
  const rolls: CardRoll[] = [];
  let changes: Partial<PlayerCharacter> | undefined;
  if (use && feature.roll) {
    const r = cardRoll(feature.name, tidy(feature.roll), {}, rng);
    if (r) rolls.push(r);
  }
  if (use && feature.uses && feature.uses.used < feature.uses.max) changes = { traits: (pc.traits ?? []).map((t) => (t.id === feature.id ? { ...t, uses: { ...feature.uses!, used: feature.uses!.used + 1 } } : t)) };
  const left = feature.uses ? feature.uses.max - feature.uses.used - (changes ? 1 : 0) : null;
  const facts = [...(feature.action && feature.action !== 'passive' ? [{ label: 'Use', value: { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction' }[feature.action] }] : []), ...(left !== null ? [{ label: 'Uses Left', value: `${left} of ${feature.uses!.max}` }] : [])];
  void o;
  return { card: { kind: 'feature', title: feature.name || 'Feature', subtitle: `${pc.name}${feature.source ? ` · ${feature.source}` : ''}`, rolls, facts, text: feature.text }, ...(changes ? { changes } : {}) };
}

/** An item: what it is and its text; used (`use`), a potion's healing rolled and one fewer carried. */
export function itemCard(pc: PlayerCharacter, item: Item, info: ItemInfo | undefined, use: boolean, rng: Rng = Math.random): Sent {
  const rolls: CardRoll[] = [];
  let changes: Partial<PlayerCharacter> | undefined;
  const healing = info ? itemHealing(info.text) : null;
  if (use && healing) {
    const r = cardRoll('Healing', healing, { heal: true }, rng);
    if (r) rolls.push(r);
    changes = { inventory: pc.inventory.map((i) => (i === item ? { ...i, qty: Math.max(0, i.qty - 1) } : i)).filter((i) => i.qty > 0) };
    // Drunk by whoever carries it: the hit points back (up from 0, the death saves start over).
    if (r && r.total > 0) changes = { ...changes, hp: { ...pc.hp, current: Math.min(pc.hp.max, pc.hp.current + r.total) }, ...(pc.hp.current <= 0 ? { deathSaves: { successes: 0, failures: 0 } } : {}) };
  }
  const facts = [
    ...(info?.type ? [{ label: 'Type', value: info.type }] : []),
    ...(info?.stats ? [{ label: 'Stats', value: info.stats }] : []),
    ...(item.qty > 1 ? [{ label: 'Carried', value: String(item.qty) }] : []),
    ...(item.equipped ? [{ label: 'Equipped', value: 'Yes' }] : []),
  ];
  return { card: { kind: 'item', title: item.name, subtitle: `${pc.name}${use && healing ? ' drinks it' : ''}`, rolls, facts, text: [info?.text, item.notes].filter(Boolean).join('\n\n') }, ...(changes ? { changes } : {}) };
}

/** A death save: 10 or more succeeds, a natural 20 brings them back with 1 HP, a natural 1 is two failures. */
export function deathSaveCard(pc: PlayerCharacter, rng: Rng = Math.random): Sent {
  const r = cardRoll('Death Save', '1d20', {}, rng)!;
  const s = pc.deathSaves;
  let changes: Partial<PlayerCharacter>;
  let outcome: string;
  if (r.natural === 20) {
    changes = { hp: { ...pc.hp, current: 1 }, deathSaves: { successes: 0, failures: 0 } };
    outcome = 'Back up with 1 hit point!';
  } else if (r.total >= 10) {
    changes = { deathSaves: { ...s, successes: Math.min(3, s.successes + 1) } };
    outcome = changes.deathSaves!.successes >= 3 ? 'A success: stable.' : 'A success.';
  } else {
    changes = { deathSaves: { ...s, failures: Math.min(3, s.failures + (r.natural === 1 ? 2 : 1)) } };
    outcome = changes.deathSaves!.failures >= 3 ? 'A failure: dead.' : r.natural === 1 ? 'Two failures.' : 'A failure.';
  }
  return { card: { kind: 'death', title: 'Death Save', subtitle: `${pc.name} · ${outcome}`, rolls: [r] }, changes };
}

/** A hit die spent on a short rest: its roll plus CON, healed. */
export function hitDieCard(pc: PlayerCharacter, rng: Rng = Math.random): Sent {
  const con = modifier(pc.abilities.con);
  const r = cardRoll('Hit Die', `1d${pc.hitDie ?? 8}${con ? signed(con) : ''}`, { heal: true }, rng)!;
  const gained = Math.max(0, r.total);
  return { card: { kind: 'hitdie', title: 'Hit Die', subtitle: `${pc.name} · ${gained} hit points back`, rolls: [r] }, changes: { hp: { ...pc.hp, current: Math.min(pc.hp.max, pc.hp.current + gained) } } };
}

/** Words only (a combat action's rules, a note): sent as a card with no rolls. */
export const textCard = (title: string, subtitle: string, text: string, kind: RollCard['kind'] = 'trait'): Sent => ({ card: { kind, title, subtitle, rolls: [], text } });

// ── Creatures (the GM's) ──

export const monsterSaveCard = (m: Monster, ability: Ability, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'save', title: `${ABILITY_NAME[ability]} Save`, subtitle: m.name, rolls: [d20('Save', modifier(m.abilities[ability]), o, rng)] },
});

/** A creature's action: its attack roll and damage (doubled on a natural 20), its save DC, its text. */
export function monsterActionCard(m: Monster, action: { name: string; text: string }, o: SheetOptions, rng: Rng = Math.random): Sent {
  const fx = parseAction(action.text);
  const rolls: CardRoll[] = [];
  let crit = false;
  if (fx.toHit !== undefined) {
    const hit = d20('To Hit', fx.toHit, o, rng);
    crit = hit.natural === 20;
    rolls.push(hit);
  }
  rolls.push(...damageRolls(fx.damage, crit, o.damageExtra, rng));
  const facts = fx.save ? [{ label: 'Save', value: `DC ${fx.save.dc} ${fx.save.ability}` }] : [];
  const ability = fx.save ? ABILITY_OF[fx.save.ability] : undefined;
  return { card: { kind: 'action', title: action.name, subtitle: m.name, rolls, facts, text: action.text, ...(fx.save && ability ? { save: { ability, dc: fx.save.dc } } : {}) } };
}

export const abilityOf = (name: string) => ABILITY_OF[name];

// ── Tabletop's sheet, in Play Mode ──

/** A d20 with a bonus that has no card of its own (a spell attack, a to-hit alone), titled as the sheet labels it. */
export const bonusCard = (title: string, who: string, bonus: number, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'roll', title, subtitle: who, rolls: [d20('Roll', bonus, o, rng)] },
});

/** An attack's roll to hit alone (damage rolled after, if it hits). */
export const hitCard = (who: string, attack: { name: string; bonus: number }, o: SheetOptions, rng: Rng = Math.random): Sent => ({
  card: { kind: 'attack', title: attack.name || 'Attack', subtitle: `${who} · To Hit`, rolls: [d20('To Hit', attack.bonus, o, rng)], attack: { part: 'hit' } },
});

/** An attack's damage alone (it hit): its dice and type, the extra (Hunter's Mark), doubled on a `crit`. */
export function damageCard(who: string, attack: { name: string; damage: string }, o: SheetOptions, rng: Rng = Math.random, crit = false): Sent {
  const { dice, type } = splitDamage(attack.damage);
  return { card: { kind: 'attack', title: attack.name || 'Attack', subtitle: `${who} · Damage`, rolls: dice ? damageRolls([{ dice, type }], crit, o.damageExtra, rng) : [], attack: { part: 'damage', damage: attack.damage, extra: o.damageExtra } } };
}

/**
 * Dmg after Hit: the damage joins the hit's card (one attack, to hit and
 * damage), its dice doubled if the hit was a natural 20 (rolled again,
 * critically). Null if `hit` isn't that attack's to-hit, still waiting for
 * its damage.
 */
export function pairDamage(hit: RollCard | undefined, damage: RollCard, rng: Rng = Math.random): RollCard | null {
  if (hit?.attack?.part !== 'hit' || damage.attack?.part !== 'damage' || hit.title !== damage.title) return null;
  const crit = hit.rolls[0]?.natural === 20;
  const { dice, type } = splitDamage(damage.attack.damage ?? '');
  const rolls = crit && dice ? damageRolls([{ dice, type }], true, damage.attack.extra ?? '', rng) : damage.rolls;
  return { ...hit, subtitle: (hit.subtitle ?? '').replace(/ · To Hit$/, ''), rolls: [...hit.rolls, ...rolls], attack: { part: 'both' } };
}

/** A weapon (an attack), linked in the chat: its numbers and what the compendium says of it, nothing rolled. */
export function weaponCard(who: string, attack: { name: string; bonus: number; damage: string }, info?: { type: string; stats: string; text: string }): Sent {
  const facts = [{ label: 'To Hit', value: signed(attack.bonus) }, ...(attack.damage ? [{ label: 'Damage', value: attack.damage }] : []), ...(info?.stats ? [{ label: 'Stats', value: info.stats }] : [])];
  return { card: { kind: 'attack', title: attack.name || 'Attack', subtitle: [who, info?.type].filter(Boolean).join(' · '), rolls: [], facts, ...(info?.text ? { text: info.text } : {}) } };
}

/** A spell, linked in the chat: what it is and does, nothing cast (no slot spent). */
export const spellInfoCard = (pc: PlayerCharacter, name: string, info: SpellInfo | undefined): Sent => (info ? { card: { ...spellCard(pc, name, info, 0, { mode: 'normal', d20Extra: '', damageExtra: '' }).card, rolls: [], concentration: undefined } } : textCard(name, pc.name, ''));

// ── The Library, linked in the chat (Play Mode) ──

const levelLine = (s: Pick<SpellInfo, 'level' | 'school' | 'ritual'>) => `${s.level === 0 ? `${s.school} cantrip` : `${ord(s.level)}-level ${s.school}`}${s.ritual ? ' (ritual)' : ''}`;

/** A spell from the Library: what it is, its casting, range and duration, its words. */
export const librarySpellCard = (s: SpellInfo): Sent => ({
  card: {
    kind: 'spell',
    title: s.name,
    subtitle: levelLine(s),
    rolls: [],
    facts: [{ label: 'Casting', value: s.castingTime }, { label: 'Range', value: s.range }, { label: 'Components', value: s.components }, { label: 'Duration', value: `${s.concentration ? 'Concentration, ' : ''}${s.duration}` }].filter((f) => f.value),
    text: [s.text, s.higher && `At Higher Levels. ${s.higher}`].filter(Boolean).join('\n\n'),
  },
});

/** An item from the Library: its type and rarity, stats, cost and weight, its words. */
export const libraryItemCard = (i: ItemInfo): Sent => ({
  card: {
    kind: 'item',
    title: i.name,
    subtitle: [i.type, i.rarity, i.attunement ? 'requires attunement' : ''].filter(Boolean).join(' · '),
    rolls: [],
    facts: [...(i.stats ? [{ label: 'Stats', value: i.stats }] : []), ...(i.cost ? [{ label: 'Cost', value: i.cost }] : []), ...(i.weight ? [{ label: 'Weight', value: `${i.weight} lb` }] : [])],
    text: i.text,
  },
});

/** A creature from the Library: its size and type, AC, HP, speed and CR, and what it can do. */
export function libraryMonsterCard(m: { name: string; size: string; type: string; ac: number; hp: number; hpDice: string; speed: string; cr: string; traits: { name: string; text: string }[]; actions: { name: string; text: string }[] }): Sent {
  const blocks = [...m.traits, ...m.actions].map((b) => `***${b.name}.*** ${b.text}`);
  return {
    card: {
      kind: 'trait',
      title: m.name,
      subtitle: `${m.size} ${m.type}`,
      rolls: [],
      facts: [{ label: 'AC', value: String(m.ac) }, { label: 'HP', value: `${m.hp}${m.hpDice ? ` (${m.hpDice})` : ''}` }, { label: 'Speed', value: m.speed }, { label: 'CR', value: m.cr }],
      text: blocks.join('\n\n'),
    },
  };
}
