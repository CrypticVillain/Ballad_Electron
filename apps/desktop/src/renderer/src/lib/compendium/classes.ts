/**
 * classes.ts — the SRD 5.1's species, classes (every level's features, spell
 * slots and class counts) and background (srd-classes.json, made by
 * scripts/srd-classes.mjs), for the character creator and leveling up; and
 * how a character is built from the creator's picks.
 *
 * The SRD has one background (Acolyte) and one subclass per class; the
 * creator adds a few backgrounds of its own (their two skills only) and a
 * custom choice everywhere, so nothing is out of reach.
 */
import { actionKind, armorClass, averageLevelHp, DEFAULT_ABILITIES, firstLevelHp, modifier, proficiencyBonus, SKILLS, usesFromText } from '@/lib/dnd';
import { ABILITIES, newId, type Abilities, type Ability, type Feature, type Item, type ItemInfo, type PlayerCharacter } from '@/lib/model';
import data from './srd-classes.json';

export type Trait = { name: string; text: string };
export type Species = {
  id: string;
  name: string;
  speed: number;
  size: string;
  bonuses: Partial<Abilities>;
  bonusChoice: { choose: number; from: Ability[] } | null;
  skills: string[];
  skillChoice: { choose: number; from: string[] } | null;
  proficiencies: string[];
  languages: string[];
  about: string;
  traits: Trait[];
  subraces: { id: string; name: string; text: string; bonuses: Partial<Abilities>; traits: Trait[] }[];
};
export type ClassLevel = { level: number; features: Trait[]; asi: boolean; slots: number[] | null; cantrips: number; spellsKnown: number; extra: Record<string, unknown> };
export type CharacterClass = {
  id: string;
  name: string;
  hitDie: number;
  saves: Ability[];
  skillChoice: { choose: number; from: string[] };
  proficiencies: string[];
  spellcasting: Ability | null;
  equipment: { name: string; qty: number }[];
  equipmentChoices: { desc: string; options: { name: string; qty: number }[][] }[];
  subclass: { id: string; name: string; text: string; level: number } | null;
  levels: ClassLevel[];
  subclassLevels: { level: number; features: Trait[] }[];
};
export type Background = { id: string; name: string; skills: string[]; equipment: { name: string; qty: number }[]; gold: number; feature: Trait | null; srd: boolean };

// Skill Versatility ("two skills of your choice") isn't in the data as a choice: it's any two.
export const SPECIES = (data.species as unknown as Species[]).map((s) =>
  !s.skillChoice && s.traits.some((t) => t.name === 'Skill Versatility') ? { ...s, skillChoice: { choose: 2, from: SKILLS.map((k) => k.name) } } : s,
);
export const CLASSES = data.classes as unknown as CharacterClass[];
export const BACKGROUNDS: Background[] = [
  ...(data.backgrounds as unknown as Omit<Background, 'srd'>[]).map((b) => ({ ...b, srd: true })),
  ...(
    [
      ['Criminal', 'Deception', 'Stealth'],
      ['Entertainer', 'Acrobatics', 'Performance'],
      ['Folk Hero', 'Animal Handling', 'Survival'],
      ['Guild Artisan', 'Insight', 'Persuasion'],
      ['Hermit', 'Medicine', 'Religion'],
      ['Noble', 'History', 'Persuasion'],
      ['Outlander', 'Athletics', 'Survival'],
      ['Sage', 'Arcana', 'History'],
      ['Sailor', 'Athletics', 'Perception'],
      ['Soldier', 'Athletics', 'Intimidation'],
      ['Urchin', 'Sleight of Hand', 'Stealth'],
    ] as const
  ).map(([name, ...skills]) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, skills: [...skills], equipment: [], gold: 10, feature: null, srd: false })),
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A character's class from the SRD: by the id it was built with, else by the class name on the sheet. */
export const classOf = (pc: Pick<PlayerCharacter, 'classId' | 'className'>) => CLASSES.find((c) => c.id === pc.classId) ?? CLASSES.find((c) => same(c.name, pc.className));

/** The ability a class leans on most (its first save is close enough for the creator's hints). */
export const PRIMARY: Record<string, Ability> = { barbarian: 'str', bard: 'cha', cleric: 'wis', druid: 'wis', fighter: 'str', monk: 'dex', paladin: 'str', ranger: 'dex', rogue: 'dex', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };

// ── Features ────────────────────────────────────────────────────────────

/**
 * A feature's uses, roll and action, for the ones the SRD counts (Rage,
 * Second Wind, Bardic Inspiration, Ki, Sneak Attack…) at a level; the rest
 * read from their text ("finish a short or long rest", "as a bonus action").
 */
export function mechanics(name: string, text: string, cls: CharacterClass | undefined, level: number, scores: Abilities): Pick<Feature, 'uses' | 'roll' | 'action'> {
  const extra = (cls?.levels[Math.min(20, Math.max(1, level)) - 1]?.extra ?? {}) as Record<string, number | undefined> & { martial_arts?: { dice_value: number }; sneak_attack?: { dice_count: number } };
  const mod = (a: Ability) => modifier(scores[a]);
  const uses = (max: number, reset: 'short' | 'long') => (max > 0 ? { max, used: 0, reset } : null);
  const base = { uses: usesFromText(text), action: actionKind(text) } as Pick<Feature, 'uses' | 'roll' | 'action'>;
  // "Bardic Inspiration (d8)", "Action Surge (2 uses)": the same feature, grown.
  const is = (n: string) => name === n || name.startsWith(`${n} (`);
  if (is('Rage')) return { ...base, uses: (extra.rage_count ?? 0) >= 99 ? null : uses(extra.rage_count ?? 2, 'long'), action: 'bonus' };
  if (is('Second Wind')) return { uses: uses(1, 'short'), roll: `1d10+${level}`, action: 'bonus' };
  if (is('Action Surge')) return { uses: uses(extra.action_surges || 1, 'short'), action: 'passive' };
  if (is('Indomitable')) return { uses: uses(extra.indomitable_uses || 1, 'long'), action: 'passive' };
  if (is('Bardic Inspiration')) return { uses: uses(Math.max(1, mod('cha')), level >= 5 ? 'short' : 'long'), roll: `1d${extra.bardic_inspiration_die || 6}`, action: 'bonus' };
  if (is('Channel Divinity')) return { uses: uses(extra.channel_divinity_charges || 1, 'short'), action: 'action' };
  if (is('Wild Shape')) return { uses: uses(2, 'short'), action: 'action' };
  if (is('Ki')) return { uses: uses(extra.ki_points || level, 'short'), action: 'passive' };
  if (is('Martial Arts')) return { uses: null, roll: `1d${extra.martial_arts?.dice_value ?? 4}${signedMod(mod('dex'))}`, action: 'bonus' };
  if (is('Sneak Attack')) return { uses: null, roll: `${extra.sneak_attack?.dice_count ?? 1}d6`, action: 'passive' };
  if (is('Lay on Hands')) return { uses: uses(5 * level, 'long'), action: 'action' };
  if (is('Divine Sense')) return { uses: uses(1 + Math.max(0, mod('cha')), 'long'), action: 'action' };
  if (name === 'Font of Magic' || name === 'Sorcery Points') return { uses: uses(extra.sorcery_points || level, 'long'), action: 'bonus' };
  if (name === 'Arcane Recovery') return { uses: uses(1, 'long'), action: 'passive' };
  if (is('Breath Weapon')) return { uses: uses(1, 'short'), roll: `${level >= 16 ? 5 : level >= 11 ? 4 : level >= 6 ? 3 : 2}d6`, action: 'action' };
  if (is('Relentless Endurance')) return { uses: uses(1, 'long'), action: 'passive' };
  return base;
}

const signedMod = (n: number) => (n ? (n > 0 ? `+${n}` : `${n}`) : '');

/** A feature for the sheet, with its mechanics. Ability Score Improvement and the like are steps, not features. */
export function toFeature(trait: Trait, source: string, cls: CharacterClass | undefined, level: number, scores: Abilities): Feature {
  return { id: newId(), name: trait.name, source, text: trait.text, ...mechanics(trait.name, trait.text, cls, level, scores) };
}

const SKIP = /^Ability Score Improvement|^(Martial Archetype|Primal Path|Bard College|Divine Domain|Druid Circle|Monastic Tradition|Sacred Oath|Ranger Archetype|Roguish Archetype|Sorcerous Origin|Otherworldly Patron|Arcane Tradition)( feature)?$|^Path feature$/;

/** The class (and, past its level, subclass) features gained at a level. */
export function featuresAt(cls: CharacterClass, level: number, withSubclass: boolean): { trait: Trait; source: string }[] {
  const own = (cls.levels[level - 1]?.features ?? []).filter((f) => !SKIP.test(f.name)).map((trait) => ({ trait, source: cls.name }));
  const sub = withSubclass && cls.subclass ? (cls.subclassLevels.find((l) => l.level === level)?.features ?? []).map((trait) => ({ trait, source: cls.subclass!.name })) : [];
  return [...own, ...sub];
}

/**
 * A feature's name without what grows ("Action Surge (2 uses)", "Bardic
 * Inspiration (d8)", "Extra Attack (2)" → the bare name). Others keep theirs:
 * Mystic Arcanum (6th level) and (7th level) are two features.
 */
const baseName = (name: string) => name.replace(/ \((d\d+|\d+|\d+ uses?|\d+\/rest|CR [^)]*)\)$/, '');

/**
 * Adds features to a list; one that grows an earlier one ("Bardic Inspiration
 * (d8)" after "(d6)") takes its place, keeping the uses already spent.
 */
export function mergeFeatures(list: Feature[], added: Feature[]): Feature[] {
  const out = [...list];
  for (const f of added) {
    const at = out.findIndex((x) => x.source === f.source && baseName(x.name) === baseName(f.name) && x.name !== f.name);
    if (at < 0) out.push(f);
    else out[at] = { ...f, id: out[at]!.id, uses: f.uses ? { ...f.uses, used: Math.min(out[at]!.uses?.used ?? 0, f.uses.max) } : f.uses };
  }
  return out;
}

/** Brings counted features (Rage's uses, Sneak Attack's dice…) up to a new level; other features are left as they are. */
export function refreshFeatures(traits: Feature[], cls: CharacterClass | undefined, level: number, scores: Abilities): Feature[] {
  return traits.map((f) => {
    const next = mechanics(f.name, f.text, cls, level, scores);
    if (!next.uses && !next.roll) return f;
    return { ...f, roll: next.roll ?? f.roll, uses: next.uses ? { ...next.uses, used: Math.min(f.uses?.used ?? 0, next.uses.max) } : f.uses };
  });
}

// ── Spells ──────────────────────────────────────────────────────────────

/** A class's spell slots at a level, as the sheet keeps them ([max, used] for levels 1-9). */
export function slotsAt(cls: CharacterClass | undefined, level: number, used: [number, number][] = []): [number, number][] {
  const slots = cls?.levels[level - 1]?.slots;
  return Array.from({ length: 9 }, (_, i) => {
    const max = slots?.[i] ?? used[i]?.[0] ?? 0;
    return [max, Math.min(used[i]?.[1] ?? 0, max)] as [number, number];
  });
}

/**
 * How many spells a caster picks at a level: cantrips known, spells known (or
 * prepared, or a wizard's spellbook), and the highest spell level they can cast.
 */
export function spellCounts(cls: CharacterClass | undefined, level: number, scores: Abilities): { cantrips: number; spells: number; maxLevel: number; prepared: boolean } {
  const row = cls?.levels[level - 1];
  if (!cls?.spellcasting || !row?.slots) return { cantrips: 0, spells: 0, maxLevel: 0, prepared: false };
  const maxLevel = row.slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
  const mod = modifier(scores[cls.spellcasting]);
  let spells = row.spellsKnown;
  let prepared = false;
  if (!spells) {
    prepared = true;
    if (cls.id === 'wizard') spells = 6 + 2 * (level - 1);
    else if (cls.id === 'paladin' || cls.id === 'ranger') spells = level >= 2 ? Math.max(1, mod + Math.floor(level / 2)) : 0;
    else spells = Math.max(1, mod + level);
  }
  return { cantrips: row.cantrips, spells: maxLevel ? spells : 0, maxLevel, prepared };
}

/**
 * The SRD features of a species (and subrace) and class to a level, with the
 * build fields leveling up needs: for sheets made without the creator (the
 * sample party). A subclass that isn't the SRD's adds none of its features.
 */
export function srdBuild(speciesId: string, subraceId: string | null, classId: string, level: number, scores: Abilities, srdSubclass: boolean): Pick<PlayerCharacter, 'traits' | 'speciesId' | 'classId' | 'subclassId' | 'hitDie'> {
  const species = SPECIES.find((s) => s.id === speciesId);
  const sub = species?.subraces.find((s) => s.id === subraceId);
  const cls = CLASSES.find((c) => c.id === classId);
  const withSubclass = Boolean(srdSubclass && cls?.subclass && level >= cls.subclass.level);
  return {
    traits: mergeFeatures([], [
      ...(species?.traits ?? []).map((t) => toFeature(t, species!.name, cls, level, scores)),
      ...(sub?.traits ?? []).map((t) => toFeature(t, sub!.name, cls, level, scores)),
      ...(cls ? Array.from({ length: level }, (_, i) => featuresAt(cls, i + 1, withSubclass)).flat() : []).map(({ trait, source }) => toFeature(trait, source, cls, level, scores)),
    ]),
    speciesId: species?.id,
    classId: cls?.id,
    subclassId: withSubclass ? cls!.subclass!.id : undefined,
    hitDie: cls?.hitDie,
  };
}

// ── The creator ─────────────────────────────────────────────────────────

export type AbilityMethod = 'standard' | 'pointbuy' | 'roll' | 'manual';

/** What the character creator has picked so far (any of it may be unset: Skip builds from what's there). */
export type Draft = {
  name: string;
  player: string;
  worldId: string | null;
  level: number;
  speciesId: string | null;
  subraceId: string | null;
  customSpecies: string;
  /** Abilities picked for a species' "+1 to two others" (Half-Elf). */
  bonusPicks: Ability[];
  speciesSkills: string[];
  classId: string | null;
  customClass: string;
  classSkills: string[];
  backgroundId: string | null;
  customBackground: string;
  backgroundSkills: string[];
  method: AbilityMethod;
  base: Abilities;
  /** The option picked in each of the class's equipment choices. */
  equipment: number[];
  spells: { name: string; level: number }[];
};

export function emptyDraft(worldId: string | null): Draft {
  return {
    name: '',
    player: '',
    worldId,
    level: 1,
    speciesId: null,
    subraceId: null,
    customSpecies: '',
    bonusPicks: [],
    speciesSkills: [],
    classId: null,
    customClass: '',
    classSkills: [],
    backgroundId: null,
    customBackground: '',
    backgroundSkills: [],
    method: 'standard',
    base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    equipment: [],
    spells: [],
  };
}

export const draftSpecies = (d: Draft) => SPECIES.find((s) => s.id === d.speciesId);
export const draftClass = (d: Draft) => CLASSES.find((c) => c.id === d.classId);
export const draftBackground = (d: Draft) => BACKGROUNDS.find((b) => b.id === d.backgroundId);

/** The species' bonuses (the subrace's and any picked ones too), by ability. */
export function speciesBonuses(d: Draft): Abilities {
  const species = draftSpecies(d);
  const sub = species?.subraces.find((s) => s.id === d.subraceId);
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const a of ABILITIES) out[a] = (species?.bonuses[a] ?? 0) + (sub?.bonuses[a] ?? 0) + (d.bonusPicks.includes(a) ? 1 : 0);
  return out;
}

export function finalScores(d: Draft): Abilities {
  const bonus = speciesBonuses(d);
  return Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, d.base[a] + bonus[a])])) as Abilities;
}

/** Every skill the draft is trained in, from species, class and background. */
export function draftSkills(d: Draft): string[] {
  return [...new Set([...(draftSpecies(d)?.skills ?? []), ...d.speciesSkills, ...d.classSkills, ...d.backgroundSkills])];
}

/** The draft's starting gear: the class's own, the options picked, the background's. */
export function draftEquipment(d: Draft): { name: string; qty: number }[] {
  const cls = draftClass(d);
  const picked = (cls?.equipmentChoices ?? []).flatMap((choice, i) => choice.options[d.equipment[i] ?? 0] ?? []);
  const all = [...(cls?.equipment ?? []), ...picked, ...(draftBackground(d)?.equipment ?? [])];
  const merged = new Map<string, { name: string; qty: number }>();
  for (const it of all) merged.set(it.name, { name: it.name, qty: (merged.get(it.name)?.qty ?? 0) + it.qty });
  return [...merged.values()];
}

/**
 * The sheet a draft makes: scores with the species' bonuses, hit points
 * (the die's most at 1st level, the average after), saves and skills, Armor
 * Class and attacks from the gear (`item` finds an item in the compendium),
 * spell slots and spells, and every species, class and background feature up
 * to the starting level.
 */
export function buildCharacter(d: Draft, item: (name: string) => ItemInfo | undefined): Partial<PlayerCharacter> {
  const species = draftSpecies(d);
  const sub = species?.subraces.find((s) => s.id === d.subraceId);
  const cls = draftClass(d);
  const background = draftBackground(d);
  const level = Math.max(1, Math.min(20, d.level));
  const scores = d.speciesId || d.classId ? finalScores(d) : { ...DEFAULT_ABILITIES, ...d.base };
  const con = scores.con;
  const hitDie = cls?.hitDie ?? 8;
  const withSubclass = Boolean(cls?.subclass && level >= cls.subclass.level);

  const traits = mergeFeatures([], [
    ...(species?.traits ?? []).map((t) => toFeature(t, species!.name, cls, level, scores)),
    ...(sub?.traits ?? []).map((t) => toFeature(t, sub!.name, cls, level, scores)),
    ...(cls ? Array.from({ length: level }, (_, i) => featuresAt(cls, i + 1, withSubclass)).flat() : []).map(({ trait, source }) => toFeature(trait, source, cls, level, scores)),
    ...(background?.feature ? [toFeature(background.feature, background.name, cls, level, scores)] : []),
  ]);

  const inventory: Item[] = draftEquipment(d).map((it) => {
    const info = item(it.name);
    return { name: it.name, qty: it.qty, weight: info?.weight || undefined, equipped: info?.category === 'Armor' || info?.category === 'Weapon' ? true : undefined };
  });
  const armor = inventory.map((it) => item(it.name)).filter((info): info is ItemInfo => info?.category === 'Armor').map((info) => info.stats);
  const prof = proficiencyBonus(level);
  const attacks = inventory
    .map((it) => ({ it, info: item(it.name) }))
    .filter(({ info }) => info?.category === 'Weapon')
    .map(({ it, info }) => {
      const dice = /^(\d+d\d+)/.exec(info!.stats)?.[1] ?? '1';
      const finesse = /Finesse/.test(info!.stats);
      const ranged = /Ranged/.test(info!.type);
      const mod = finesse ? Math.max(modifier(scores.str), modifier(scores.dex)) : ranged ? modifier(scores.dex) : modifier(scores.str);
      return { name: it.name, bonus: prof + mod, damage: `${dice}${signedMod(mod)}` };
    });

  const languages = species?.languages.length ? `Languages: ${species.languages.join(', ')}` : '';
  const proficiencies = [cls?.proficiencies.length ? cls.proficiencies.join(', ') : '', species?.proficiencies.join(', ') ?? '', languages].filter(Boolean).join('\n');

  return {
    worldId: d.worldId,
    name: d.name.trim(),
    player: d.player.trim(),
    species: sub?.name ?? species?.name ?? d.customSpecies.trim(),
    className: cls?.name ?? d.customClass.trim(),
    subclass: withSubclass ? cls!.subclass!.name : '',
    background: background?.name ?? d.customBackground.trim(),
    level,
    abilities: scores,
    saves: cls?.saves ?? [],
    skills: draftSkills(d),
    hp: (() => {
      const max = firstLevelHp(hitDie, con) + (level - 1) * averageLevelHp(hitDie, con);
      return { max, current: max, temp: 0 };
    })(),
    ac: armorClass(scores.dex, armor),
    speed: species?.speed ?? 30,
    slots: slotsAt(cls, level),
    spellcasting: cls?.spellcasting ?? null,
    spells: d.spells.map((s) => ({ ...s, prepared: true })),
    attacks,
    inventory,
    currency: { cp: 0, sp: 0, ep: 0, gp: background?.gold ?? 0, pp: 0 },
    proficiencies,
    traits,
    speciesId: species?.id,
    classId: cls?.id,
    subclassId: withSubclass ? cls!.subclass!.id : undefined,
    hitDie,
  };
}

/** Every SRD feature and trait, for picking one onto a sheet: classes' (with the level they come at), subclasses', species', backgrounds'. */
export const ALL_FEATURES: (Trait & { source: string; level?: number; group: 'Class' | 'Subclass' | 'Species' | 'Background' })[] = (() => {
  const out: (Trait & { source: string; level?: number; group: 'Class' | 'Subclass' | 'Species' | 'Background' })[] = [];
  const seen = new Set<string>();
  const add = (trait: Trait, source: string, group: 'Class' | 'Subclass' | 'Species' | 'Background', level?: number) => {
    const key = `${source}|${trait.name}`;
    if (seen.has(key) || SKIP.test(trait.name)) return;
    seen.add(key);
    out.push({ ...trait, source, group, level });
  };
  for (const c of CLASSES) {
    for (const l of c.levels) for (const t of l.features) add(t, c.name, 'Class', l.level);
    for (const l of c.subclassLevels) for (const t of l.features) add(t, c.subclass?.name ?? c.name, 'Subclass', l.level);
  }
  for (const s of SPECIES) {
    for (const t of s.traits) add(t, s.name, 'Species');
    for (const sub of s.subraces) for (const t of sub.traits) add(t, sub.name, 'Species');
  }
  for (const b of BACKGROUNDS) if (b.feature) add(b.feature, b.name, 'Background');
  return out;
})();
