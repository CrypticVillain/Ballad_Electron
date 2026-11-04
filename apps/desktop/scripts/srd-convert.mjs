// Trims the 5e-bits SRD 5.1 JSON (spells, equipment, magic items) into the app's compact compendium files.
// node scripts/srd-convert.mjs <5e-database/src/2014/en> src/renderer/src/lib/compendium   (lib/compendium/index.ts says how the data is used)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
const load = (f) => JSON.parse(readFileSync(join(src, f), 'utf8'));
const spells = load('5e-SRD-Spells.json');
const equipment = load('5e-SRD-Equipment.json');
const magic = load('5e-SRD-Magic-Items.json');

const text = (desc) => (Array.isArray(desc) ? desc : desc ? [desc] : []).map((p) => p.trim()).filter(Boolean).join('\n\n');
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

const outSpells = spells.map((s) => ({
  id: `srd:${s.index}`,
  name: s.name,
  level: s.level,
  school: s.school.name,
  castingTime: s.casting_time,
  range: s.range,
  components: s.components.join(', ') + (s.material ? ` (${lowerFirst(s.material.replace(/\.$/, ''))})` : ''),
  duration: s.duration,
  concentration: Boolean(s.concentration),
  ritual: Boolean(s.ritual),
  classes: s.classes.map((c) => c.name),
  text: text(s.desc),
  higher: text(s.higher_level),
}));

const cost = (c) => (c ? `${c.quantity.toLocaleString('en-US')} ${c.unit}` : '');
const CATEGORY = { Weapon: 'Weapon', Armor: 'Armor', 'Adventuring Gear': 'Gear', Tools: 'Tools', 'Mounts and Vehicles': 'Mounts & Vehicles' };

function mundane(e) {
  const cat = CATEGORY[e.equipment_category.name];
  let type;
  const stats = [];
  if (cat === 'Weapon') {
    type = `${e.category_range} Weapon`;
    if (e.damage) stats.push(`${e.damage.damage_dice} ${e.damage.damage_type.name.toLowerCase()}`);
    const props = (e.properties ?? []).filter((p) => p.index !== 'monk').map((p) => {
      if (p.index === 'versatile' && e.two_handed_damage) return `Versatile (${e.two_handed_damage.damage_dice})`;
      if ((p.index === 'thrown' || p.index === 'ammunition') && e.throw_range) return `${p.name} (${e.throw_range.normal}/${e.throw_range.long})`;
      if (p.index === 'ammunition' && e.range?.long) return `Ammunition (${e.range.normal}/${e.range.long})`;
      return p.name;
    });
    if (e.weapon_range === 'Ranged' && e.range?.long && !props.some((p) => p.startsWith('Ammunition'))) props.push(`Range (${e.range.normal}/${e.range.long})`);
    if (props.length) stats.push(props.join(', '));
  } else if (cat === 'Armor') {
    type = e.armor_category === 'Shield' ? 'Shield' : `${e.armor_category} Armor`;
    const ac = e.armor_class;
    stats.push(e.armor_category === 'Shield' ? `AC +${ac.base}` : `AC ${ac.base}${ac.dex_bonus ? (ac.max_bonus ? ` + Dex (max ${ac.max_bonus})` : ' + Dex') : ''}`);
    if (e.str_minimum) stats.push(`Str ${e.str_minimum}`);
    if (e.stealth_disadvantage) stats.push('Stealth disadvantage');
  } else if (cat === 'Gear') {
    type = e.gear_category?.name ?? 'Adventuring Gear';
  } else if (cat === 'Tools') {
    type = e.tool_category ?? 'Tools';
  } else {
    type = e.vehicle_category ?? 'Mounts and Vehicles';
    if (e.speed) stats.push(`Speed ${e.speed.quantity} ${e.speed.unit}`);
    if (e.capacity) stats.push(`Carries ${e.capacity}`);
  }
  const contents = e.contents?.length ? `Contains: ${e.contents.map((c) => `${c.item.name}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`).join(', ')}.` : '';
  return {
    id: `srd:${e.index}`,
    name: e.name,
    category: cat,
    type,
    rarity: '',
    attunement: false,
    cost: cost(e.cost),
    weight: e.weight ?? 0,
    stats: stats.join(' · '),
    text: [text(e.desc), contents].filter(Boolean).join('\n\n'),
  };
}

// A magic item with variants (Armor, +1, +2 or +3) is listed by its variants, each with the whole text.
const variantParents = new Set(magic.filter((m) => m.variants?.length).map((m) => m.index));
const outMagic = magic
  .filter((m) => !variantParents.has(m.index))
  .map((m) => {
    const [head = '', ...rest] = m.desc;
    return {
      id: equipment.some((e) => e.index === m.index) ? `srd:${m.index}-magic` : `srd:${m.index}`,
      name: m.name,
      category: 'Magic Item',
      type: head
        .replace(/^Wond[a-z]* items?/i, 'Wondrous item').replace(/\s*\(requires attunement[^)]*\)/i, '').replace(/^./, (c) => c.toUpperCase()),
      rarity: m.rarity?.name ?? '',
      attunement: /requires attunement/i.test(head),
      cost: '',
      weight: 0,
      stats: (/\((requires attunement[^)]*)\)/i.exec(head)?.[1] ?? '').replace(/^./, (c) => c.toUpperCase()),
      text: text(rest),
    };
  });

const outItems = [...equipment.map(mundane), ...outMagic].sort((a, b) => a.name.localeCompare(b.name));
outSpells.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(out, 'srd-spells.json'), JSON.stringify(outSpells));
writeFileSync(join(out, 'srd-items.json'), JSON.stringify(outItems));
console.log('spells', outSpells.length, 'items', outItems.length, '(magic', outMagic.length, 'dropped parents', variantParents.size, ')');
// Ids are unique within each list (a spell and an item may share one: Shield).
for (const list of [outSpells, outItems]) {
  const ids = new Set();
  for (const x of list) {
    if (ids.has(x.id)) console.log('dup id', x.id);
    ids.add(x.id);
  }
}
