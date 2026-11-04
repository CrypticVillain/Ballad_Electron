// Trims Open5e's open-licensed data (github.com/open5e/open5e-api, data/v2) into the Library's files: monsters and NPCs,
// spells, items, feats, backgrounds, species, classes and subclasses, rules and conditions, each tagged with the document
// it comes from; and sources.json: every document's publisher, authors, licenses, credit line, counts, and how much of it
// overlaps the app's own SRD 5.1 data (lib/compendium) or other documents.
// node scripts/library-convert.mjs <open5e-api/data/v2> src/renderer/src/lib/compendium src/renderer/src/lib/library
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [src, compendium, out] = process.argv.slice(2);

// ── Reading ──────────────────────────────────────────────────────────────

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json')) files.push(p);
  }
})(src);
const load = (model) => files.filter((f) => basename(f) === `${model}.json`).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const byParent = (rows) => {
  const map = new Map();
  for (const r of rows) {
    const p = r.fields.parent;
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(r);
  }
  return map;
};

const documents = load('Document');
const publishers = load('Publisher');
const licenses = load('License');
// Wizards' SRD 5.1 is already the app's own (lib/compendium, from 5e-bits); its Open5e copy would only repeat it.
const SKIP_DOCS = new Set(['srd-2014', 'core', 'elderberry-inn-icons']);
const docOf = (r) => r.fields.document ?? r.pk.split('_')[0];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const title = (s) => (s ?? '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const clean = (s) => (s ?? '').replace(/\r\n/g, '\n').trim();

// ── Monsters ─────────────────────────────────────────────────────────────

const ABIL = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const SKILLS = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'];
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const cr = (v) => {
  const n = Number(v);
  if (n === 0.125) return '1/8';
  if (n === 0.25) return '1/4';
  if (n === 0.5) return '1/2';
  return String(Math.round(n * 100) / 100);
};
// The app has no monsters of its own, so SRD 5.1's come from here too.
const creatures = load('Creature').filter((r) => !SKIP_DOCS.has(docOf(r)) || docOf(r) === 'srd-2014');
const actions = byParent(load('CreatureAction'));
const traits = byParent(load('CreatureTrait'));
const usesLabel = (a) => {
  const { uses_type: t, uses_param: p, legendary_action_cost: cost } = a.fields;
  const parts = [];
  if (t === 'RECHARGE_ON_ROLL') parts.push(p && p < 6 ? `Recharge ${p}–6` : 'Recharge 6');
  if (t === 'PER_DAY') parts.push(`${p ?? 1}/Day`);
  if (t === 'RECHARGE_AFTER_REST') parts.push('Recharges after a Short or Long Rest');
  if (t === 'RECHARGE') parts.push('Recharge');
  if (cost && cost > 1) parts.push(`Costs ${cost} Actions`);
  return parts.length ? `${a.fields.name} (${parts.join('; ')})` : a.fields.name;
};
const outMonsters = creatures.map((c) => {
  const f = c.fields;
  const unit = f.unit ?? 'ft.';
  const speed = [f.walk != null ? `${f.walk} ft.` : null, f.fly ? `fly ${f.fly} ft.${f.hover ? ' (hover)' : ''}` : null, f.swim ? `swim ${f.swim} ft.` : null, f.climb ? `climb ${f.climb} ft.` : null, f.burrow ? `burrow ${f.burrow} ft.` : null].filter(Boolean).join(', ') || '30 ft.';
  const senses = [
    f.blindsight_range && `blindsight ${f.blindsight_range} ft.`,
    f.darkvision_range && `darkvision ${f.darkvision_range} ft.`,
    f.tremorsense_range && `tremorsense ${f.tremorsense_range} ft.`,
    f.truesight_range && `truesight ${f.truesight_range} ft.`,
    f.passive_perception != null && `passive Perception ${f.passive_perception}`,
  ].filter(Boolean).join(', ');
  const acts = (actions.get(c.pk) ?? []).sort((a, b) => (a.fields.order_in_statblock ?? 0) - (b.fields.order_in_statblock ?? 0));
  const pick = (type) => acts.filter((a) => a.fields.action_type === type).map((a) => ({ name: usesLabel(a), text: clean(a.fields.desc) }));
  void unit;
  return {
    id: c.pk,
    src: docOf(c),
    name: f.name,
    size: cap(f.size),
    type: cap(f.type) + (f.subcategory ? ` (${f.subcategory})` : ''),
    alignment: f.alignment ?? '',
    ac: f.armor_class,
    acNote: f.armor_detail ?? '',
    hp: f.hit_points,
    hpDice: f.hit_dice ?? '',
    speed,
    abilities: ABIL.map((a) => f[`ability_score_${a}`] ?? 10),
    saves: ABIL.filter((a) => f[`saving_throw_${a}`] != null).map((a) => `${cap(a.slice(0, 3))} ${signed(f[`saving_throw_${a}`])}`).join(', '),
    skills: SKILLS.filter((s) => f[`skill_bonus_${s}`] != null).map((s) => `${title(s)} ${signed(f[`skill_bonus_${s}`])}`).join(', '),
    vulnerable: f.damage_vulnerabilities_display ?? '',
    resist: f.damage_resistances_display ?? '',
    immune: f.damage_immunities_display ?? '',
    conditionImmune: f.condition_immunities_display ?? '',
    senses,
    languages: f.languages_desc ?? '',
    cr: cr(f.challenge_rating),
    xp: f.experience_points_integer ?? null,
    traits: (traits.get(c.pk) ?? []).map((t) => ({ name: t.fields.name, text: clean(t.fields.desc) })),
    actions: pick('ACTION'),
    bonus: pick('BONUS_ACTION'),
    reactions: pick('REACTION'),
    legendary: pick('LEGENDARY_ACTION'),
    environments: (f.environments ?? []).map((e) => title(e.replace(/^srd_/, ''))),
  };
});

// ── Spells ───────────────────────────────────────────────────────────────

const CAST = { action: '1 action', 'bonus-action': '1 bonus action', reaction: '1 reaction', round: '1 round', turn: '1 turn' };
const castingTime = (v) => CAST[v] ?? v.replace(/^(\d+)([a-z]+)$/, (_, n, u) => `${n} ${u}`);
const spellClass = (id) => title(id.replace(/^[^_]+_/, ''));
const outSpells = load('Spell')
  .filter((r) => !SKIP_DOCS.has(docOf(r)))
  .map((s) => {
    const f = s.fields;
    return {
      id: s.pk,
      src: docOf(s),
      name: f.name,
      level: f.level,
      school: cap(f.school === 'transformation' ? 'transmutation' : f.school),
      castingTime: castingTime(f.casting_time) + (f.casting_time === 'reaction' && f.reaction_condition ? `, ${f.reaction_condition}` : ''),
      range: f.range_text || (f.range ? `${f.range} ${f.range_unit ?? 'feet'}` : 'Self'),
      components: [f.verbal && 'V', f.somatic && 'S', f.material && 'M'].filter(Boolean).join(', ') + (f.material && f.material_specified ? ` (${f.material_specified.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())})` : ''),
      duration: cap(f.duration ?? ''),
      concentration: Boolean(f.concentration),
      ritual: Boolean(f.ritual),
      classes: (f.classes ?? []).map(spellClass),
      text: clean(f.desc),
      higher: clean(f.higher_level),
    };
  });

// ── Items ────────────────────────────────────────────────────────────────

const weapons = new Map(load('Weapon').map((w) => [w.pk, w.fields]));
const armors = new Map(load('Armor').map((a) => [a.pk, a.fields]));
const props = new Map(load('WeaponProperty').map((p) => [p.pk, p.fields.name]));
const assigned = new Map();
for (const a of load('WeaponPropertyAssignment')) {
  const list = assigned.get(a.fields.weapon) ?? [];
  list.push(props.get(a.fields.property) + (a.fields.detail ? ` (${a.fields.detail})` : ''));
  assigned.set(a.fields.weapon, list);
}
const gp = (cost) => {
  const n = Number(cost);
  if (!n) return '';
  if (n >= 1) return `${Math.round(n * 100) / 100} gp`;
  if (n >= 0.1) return `${Math.round(n * 10)} sp`;
  return `${Math.round(n * 100)} cp`;
};
const rarity = (r) => title(r ?? '');
const MUNDANE = { weapon: 'Weapon', ammunition: 'Weapon', armor: 'Armor', shield: 'Armor', tools: 'Tools', mount: 'Mounts & Vehicles', 'land-vehicle': 'Mounts & Vehicles', 'waterborne-vehicle': 'Mounts & Vehicles' };
const stats = (f) => {
  const w = f.weapon && weapons.get(f.weapon);
  const a = f.armor && armors.get(f.armor);
  if (w) return [`${w.damage_dice} ${w.damage_type}`, (assigned.get(f.weapon) ?? []).join(', '), w.range ? `Range ${w.range}/${w.long_range}` : ''].filter(Boolean).join(' · ');
  if (a) return [a.ac_base ? `AC ${a.ac_base}${a.ac_add_dexmod ? (a.ac_cap_dexmod ? ` + Dex (max ${a.ac_cap_dexmod})` : ' + Dex') : ''}` : '', a.strength_score_required ? `Str ${a.strength_score_required}` : '', a.grants_stealth_disadvantage ? 'Stealth disadvantage' : ''].filter(Boolean).join(' · ');
  return '';
};
const outItems = [
  ...load('MagicItem')
    .filter((r) => !SKIP_DOCS.has(docOf(r)))
    .map((m) => ({
      id: m.pk,
      src: docOf(m),
      name: m.fields.name,
      category: 'Magic Item',
      type: `${cap(title(m.fields.category).toLowerCase())}, ${rarity(m.fields.rarity).toLowerCase()}`,
      rarity: rarity(m.fields.rarity),
      attunement: Boolean(m.fields.requires_attunement),
      cost: gp(m.fields.cost),
      weight: Number(m.fields.weight) || 0,
      stats: stats(m.fields),
      text: clean(m.fields.desc),
    })),
  ...load('Item')
    .filter((r) => !SKIP_DOCS.has(docOf(r)))
    .map((m) => ({
      id: m.pk,
      src: docOf(m),
      name: m.fields.name,
      category: MUNDANE[m.fields.category] ?? 'Gear',
      type: title(m.fields.category),
      rarity: '',
      attunement: false,
      cost: gp(m.fields.cost),
      weight: Number(m.fields.weight) || 0,
      stats: stats(m.fields),
      text: clean(m.fields.desc),
    })),
];

// ── Feats, backgrounds, species ──────────────────────────────────────────

const withBenefits = (model, benefitModel, extra = () => ({})) => {
  const benefits = byParent(load(benefitModel));
  return load(model)
    .filter((r) => !SKIP_DOCS.has(docOf(r)) || model === 'Feat' || model === 'Background')
    .map((r) => ({
      id: r.pk,
      src: docOf(r),
      name: r.fields.name,
      text: clean(r.fields.desc),
      benefits: (benefits.get(r.pk) ?? []).sort((a, b) => (a.fields.order ?? 0) - (b.fields.order ?? 0)).map((b) => ({ name: b.fields.name, text: clean(b.fields.desc) })),
      ...extra(r),
    }));
};
const outFeats = withBenefits('Feat', 'FeatBenefit', (r) => ({ prerequisite: r.fields.prerequisite ?? '', kind: title(r.fields.type ?? '') }));
const outBackgrounds = withBenefits('Background', 'BackgroundBenefit');
const speciesRows = load('Species');
const outSpecies = withBenefits('Species', 'SpeciesTrait', (r) => ({ parent: r.fields.subspecies_of ? (speciesRows.find((s) => s.pk === r.fields.subspecies_of)?.fields.name ?? null) : null }));

// ── Classes and subclasses ───────────────────────────────────────────────

const classRows = load('CharacterClass');
const featureLevels = new Map();
for (const i of load('ClassFeatureItem')) {
  const list = featureLevels.get(i.fields.parent) ?? [];
  list.push(i.fields.level);
  featureLevels.set(i.fields.parent, list);
}
const classFeatures = byParent(load('ClassFeature'));
const outClasses = classRows
  .filter((r) => !SKIP_DOCS.has(docOf(r)))
  .map((c) => ({
    id: c.pk,
    src: docOf(c),
    name: c.fields.name,
    parent: c.fields.subclass_of ? title((classRows.find((x) => x.pk === c.fields.subclass_of)?.fields.name ?? c.fields.subclass_of.replace(/^[^_]+_/, ''))) : null,
    hitDie: c.fields.hit_dice ?? '',
    saves: (c.fields.saving_throws ?? []).map((s) => title(s)),
    text: clean(c.fields.desc),
    features: (classFeatures.get(c.pk) ?? [])
      .filter((f) => f.fields.desc && !/^(PROFICIENCY_BONUS|SPELL_SLOTS|CLASS_TABLE_DATA|CLASS_LEVEL_FEATURE)$/.test(f.fields.feature_type ?? ''))
      .map((f) => ({ name: f.fields.name, level: Math.min(...(featureLevels.get(f.pk) ?? [1])), text: clean(f.fields.desc) }))
      .sort((a, b) => a.level - b.level),
  }));

// ── Rules and conditions ─────────────────────────────────────────────────

const ruleSets = load('RuleSet').filter((r) => !SKIP_DOCS.has(docOf(r)) || docOf(r) === 'srd-2014');
const rules = byParent(load('Rule').map((r) => ({ ...r, fields: { ...r.fields, parent: r.fields.ruleset } })));
const outRules = [
  ...ruleSets.map((s) => ({
    id: s.pk,
    src: docOf(s),
    name: s.fields.name,
    text: [clean(s.fields.desc), ...(rules.get(s.pk) ?? []).sort((a, b) => (a.fields.index ?? 0) - (b.fields.index ?? 0)).map((r) => `## ${r.fields.name}\n\n${clean(r.fields.desc)}`)].filter(Boolean).join('\n\n'),
  })),
  ...load('ConditionDescription').map((c) => ({ id: c.pk, src: docOf(c), name: `Condition: ${title(c.fields.describes)}`, text: clean(c.fields.desc) })),
];

// ── Overlap ──────────────────────────────────────────────────────────────

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const own = {
  spells: new Set(JSON.parse(readFileSync(join(compendium, 'srd-spells.json'), 'utf8')).map((s) => norm(s.name))),
  items: new Set(JSON.parse(readFileSync(join(compendium, 'srd-items.json'), 'utf8')).map((s) => norm(s.name))),
  classes: new Set(JSON.parse(readFileSync(join(compendium, 'srd-classes.json'), 'utf8')).classes.map((c) => norm(c.name))),
  species: new Set(JSON.parse(readFileSync(join(compendium, 'srd-classes.json'), 'utf8')).species.flatMap((s) => [s.name, ...s.subraces.map((x) => x.name)]).map(norm)),
};
const kinds = { monsters: outMonsters, spells: outSpells, items: outItems, feats: outFeats, backgrounds: outBackgrounds, species: outSpecies, classes: outClasses, rules: outRules };
const namesBy = (list) => {
  const m = new Map();
  for (const x of list) {
    const set = m.get(x.src) ?? new Set();
    set.add(norm(x.name));
    m.set(x.src, set);
  }
  return m;
};

const sources = documents
  .filter((d) => !['core', 'elderberry-inn-icons'].includes(d.pk))
  .map((d) => {
    const f = d.fields;
    const publisher = publishers.find((p) => p.pk === f.publisher)?.fields.name ?? title(f.publisher);
    const year = (f.publication_date ?? '').slice(0, 4);
    const counts = {};
    const overlap = {};
    for (const [kind, list] of Object.entries(kinds)) {
      const mine = list.filter((x) => x.src === d.pk);
      if (!mine.length) continue;
      counts[kind] = mine.length;
      const names = mine.map((x) => norm(x.name));
      const others = [...namesBy(list).entries()].filter(([doc]) => doc !== d.pk);
      overlap[kind] = {
        app: own[kind] ? names.filter((n) => own[kind].has(n)).length : 0,
        others: Object.fromEntries(others.map(([doc, set]) => [doc, names.filter((n) => set.has(n)).length]).filter(([, n]) => n > 0)),
      };
    }
    const ogl = f.licenses.includes('ogl-10a');
    return {
      key: d.pk,
      name: f.name,
      publisher,
      authors: f.author ?? '',
      year,
      licenses: f.licenses,
      url: f.permalink ?? '',
      about: clean(f.desc),
      // OGL 1.0a Section 15 asks for each source's copyright notice; this is the usual form, built from the document's details.
      credit: `${f.name}${year ? `. Copyright ${year}` : ''}, ${publisher}${f.author ? `; Authors ${f.author}` : ''}.`,
      ogl,
      included: !SKIP_DOCS.has(d.pk) || d.pk === 'srd-2014',
      counts,
      overlap,
    };
  });

const write = (name, data) => {
  writeFileSync(join(out, name), JSON.stringify(data));
  console.log(name.padEnd(26), String(Array.isArray(data) ? data.length : '').padStart(5), `${Math.round(statSync(join(out, name)).size / 1024)} KB`);
};
write('open5e-monsters.json', outMonsters);
write('open5e-spells.json', outSpells);
write('open5e-items.json', outItems);
write('open5e-feats.json', outFeats);
write('open5e-backgrounds.json', outBackgrounds);
write('open5e-species.json', outSpecies);
write('open5e-classes.json', outClasses);
write('open5e-rules.json', outRules);
write('open5e-sources.json', sources);
write('licenses.json', licenses.map((l) => ({ key: l.pk, name: l.fields.name, text: clean(l.fields.desc) })));
