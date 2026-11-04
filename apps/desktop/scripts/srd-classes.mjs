// Trims the 5e-bits SRD 5.1 species, classes, levels, features and backgrounds into srd-classes.json, for the
// character creator and leveling up.
// node scripts/srd-classes.mjs <5e-database/src/2014/en> src/renderer/src/lib/compendium
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
const load = (f) => JSON.parse(readFileSync(join(src, `5e-SRD-${f}.json`), 'utf8'));
const races = load('Races');
const subraces = load('Subraces');
const traits = load('Traits');
const classes = load('Classes');
const subclasses = load('Subclasses');
const features = load('Features');
const levels = load('Levels');
const backgrounds = load('Backgrounds');

const text = (desc) => (Array.isArray(desc) ? desc : desc ? [desc] : []).map((p) => p.trim()).filter(Boolean).join('\n\n');
const ab = (i) => i.toLowerCase();
const bonuses = (list = []) => Object.fromEntries(list.map((b) => [ab(b.ability_score.index), b.bonus]));
const skillName = (prof) => (prof.name.startsWith('Skill: ') ? prof.name.slice(7) : null);
const trait = (ref) => {
  const t = traits.find((x) => x.index === ref.index);
  return { name: t?.name ?? ref.name, text: text(t?.desc) };
};

const outSpecies = races.map((r) => ({
  id: r.index,
  name: r.name,
  speed: r.speed,
  size: r.size,
  bonuses: bonuses(r.ability_bonuses),
  bonusChoice: r.ability_bonus_options ? { choose: r.ability_bonus_options.choose, from: r.ability_bonus_options.from.options.map((o) => ab(o.ability_score.index)) } : null,
  skills: (r.starting_proficiencies ?? []).map(skillName).filter(Boolean),
  skillChoice: r.starting_proficiency_options
    ? { choose: r.starting_proficiency_options.choose, from: r.starting_proficiency_options.from.options.map((o) => skillName(o.item)).filter(Boolean) }
    : null,
  proficiencies: (r.starting_proficiencies ?? []).filter((p) => !skillName(p)).map((p) => p.name),
  languages: r.languages.map((l) => l.name),
  about: [r.age, r.size_description].filter(Boolean).join(' '),
  traits: r.traits.map(trait),
  subraces: subraces
    .filter((s) => s.race.index === r.index)
    .map((s) => ({ id: s.index, name: s.name, text: s.desc, bonuses: bonuses(s.ability_bonuses), traits: s.racial_traits.map(trait) })),
}));

const feature = (ref) => {
  const f = features.find((x) => x.index === ref.index);
  return { name: f?.name ?? ref.name, text: text(f?.desc) };
};
const slotsOf = (sc) => (sc ? Array.from({ length: 9 }, (_, i) => sc[`spell_slots_level_${i + 1}`] ?? 0) : null);

const outClasses = classes.map((c) => {
  const own = levels.filter((l) => l.class?.index === c.index && !l.subclass).sort((a, b) => a.level - b.level);
  const sub = subclasses.find((s) => s.class.index === c.index);
  const subLevels = sub ? levels.filter((l) => l.subclass?.index === sub.index).sort((a, b) => a.level - b.level) : [];
  const skills = c.proficiency_choices.find((p) => p.desc?.startsWith('Choose') && p.from.options.some((o) => o.item && skillName(o.item)));
  const equipmentOption = (o) => {
    if (o.option_type === 'counted_reference') return [{ name: o.of.name, qty: o.count }];
    if (o.option_type === 'multiple') return o.items.flatMap(equipmentOption);
    if (o.option_type === 'choice') return [{ name: `${o.choice.from.equipment_category?.name ?? 'Item'} (your choice)`, qty: o.choice.choose ?? 1 }];
    return [];
  };
  return {
    id: c.index,
    name: c.name,
    hitDie: c.hit_die,
    saves: c.saving_throws.map((s) => ab(s.index)),
    skillChoice: skills ? { choose: skills.choose, from: skills.from.options.map((o) => skillName(o.item)).filter(Boolean) } : { choose: 0, from: [] },
    proficiencies: c.proficiencies.filter((p) => !p.index.startsWith('saving-throw')).map((p) => p.name),
    spellcasting: c.spellcasting ? ab(c.spellcasting.spellcasting_ability.index) : null,
    equipment: c.starting_equipment.map((e) => ({ name: e.equipment.name, qty: e.quantity })),
    equipmentChoices: (c.starting_equipment_options ?? [])
      .filter((o) => o.from?.options)
      .map((o) => ({ desc: o.desc ?? '', options: o.from.options.map(equipmentOption).filter((x) => x.length) })),
    subclass: sub ? { id: sub.index, name: sub.name, text: text(sub.desc), level: subLevels[0]?.level ?? 3 } : null,
    levels: own.map((l) => ({
      level: l.level,
      features: l.features.map(feature),
      asi: l.features.some((f) => f.name.startsWith('Ability Score Improvement')),
      slots: slotsOf(l.spellcasting),
      cantrips: l.spellcasting?.cantrips_known ?? 0,
      spellsKnown: l.spellcasting?.spells_known ?? 0,
      extra: l.class_specific ?? {},
    })),
    subclassLevels: subLevels.map((l) => ({ level: l.level, features: l.features.map(feature) })),
  };
});

const outBackgrounds = backgrounds.map((b) => ({
  id: b.index,
  name: b.name,
  skills: b.starting_proficiencies.map(skillName).filter(Boolean),
  equipment: b.starting_equipment.map((e) => ({ name: e.equipment.name, qty: e.quantity })),
  gold: b.starting_gold?.quantity ?? 0,
  feature: b.feature ? { name: b.feature.name, text: text(b.feature.desc) } : null,
}));

writeFileSync(join(out, 'srd-classes.json'), JSON.stringify({ species: outSpecies, classes: outClasses, backgrounds: outBackgrounds }));
console.log('species', outSpecies.length, 'classes', outClasses.length, 'backgrounds', outBackgrounds.length);
for (const c of outClasses) console.log(c.name, 'd' + c.hitDie, c.levels.length, 'levels', c.subclass?.name, c.subclass?.level, 'equip choices', c.equipmentChoices.length, 'skills', c.skillChoice.choose);
