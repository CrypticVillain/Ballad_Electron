/**
 * seedSections.ts — the starter production (Filmmaking) and campaign (Tabletop),
 * made alongside the starter world on first run (seed.ts). All original;
 * everything marked `sample`.
 */
import {
  addRelationship,
  combatant,
  createBook,
  createBudgetLine,
  createEncounter,
  createEntry,
  createEvent,
  createMap,
  createMonster,
  createPart,
  createPc,
  createNote,
  createScene,
  createShootDay,
  createShot,
  createStoryline,
} from '@/lib/actions';
import { addDays, today } from '@/lib/dates';
import { live, newId, now, type Abilities, type Entry, type Scene, type SceneStatus, type WorldSection, type World } from '@/lib/model';
import { tabletopDefaults, filmDefaults, JOURNAL } from '@/lib/sections';
import { useVault } from '@/stores/vault';
import { srdBuild } from './compendium/classes';
import { block, p } from './seed';
import { SALTREACH_SIZE, saltreachMap } from './seedMap';
import { shareItems } from '@/lib/shared';

const sample = { sample: true };

function putWorld(section: WorldSection, input: Partial<World>): World {
  const t = now();
  const order = Object.values(useVault.getState().vault.worlds).length;
  const world: World = { id: newId(), createdAt: t, updatedAt: t, deletedAt: null, section, name: '', genre: '', era: '', summary: '', order, ...input, ...sample };
  useVault.getState().put('worlds', world);
  return world;
}

const specs = (rows: [string, string][]) => rows.map(([label, value]) => ({ label, value }));

/** "How Glass Is Made": a twelve-minute YouTube documentary, in pre-production. */
export function seedProduction(): World {
  const film = filmDefaults();
  const world = putWorld('film', {
    name: 'How Glass Is Made',
    genre: 'Documentary',
    summary: 'A master glassblower shows a first-timer how sand becomes a vase in one afternoon, and why it nearly never works.',
    film: {
      ...film,
      format: 'YouTube Video',
      stage: 'preProduction',
      targetMinutes: 12,
      releaseDate: addDays(today(), 30),
      releaseTitle: 'How Glass Is Made (I Tried It In One Afternoon)',
      releaseDescription: 'We spent a day at Lumen Glassworks learning to blow glass from scratch.\n\n00:00 The furnace\n02:10 Gathering\n05:40 The first blow\n09:30 What went wrong\n\nThanks to Lumen Glassworks for having us.',
      tags: 'glassblowing, documentary, how it’s made, craft',
      checklist: film.checklist.map((c, i) => ({ ...c, done: i < 2 })),
    },
  });
  const w = world.id;

  const cast = (name: string, tagline: string, group: string, rows: [string, string][]) => createEntry(w, 'character', { name, tagline, group, specs: specs(rows), ...sample });
  const mara = cast('Mara Lin', 'Host, the first-timer', 'Lead', [['Plays', 'Herself'], ['Contact', 'mara@example.com'], ['Day Rate', '$0 (channel owner)'], ['Availability', 'Weekends']]);
  const theo = cast('Theo Ruiz', 'Master glassblower', 'Lead', [['Plays', 'Himself'], ['Contact', 'Lumen Glassworks front desk'], ['Day Rate', '$250'], ['Availability', 'Tue, Thu']]);
  const crew = (name: string, tagline: string, group: string, rows: [string, string][]) => createEntry(w, 'crew', { name, tagline, group, specs: specs(rows), ...sample });
  crew('Jonah Park', 'Director of Photography', 'Camera', [['Role', 'DP, A-camera'], ['Day Rate', '$400'], ['Kit', 'FX3, 24-70, 50mm, gimbal']]);
  crew('Ada Osei', 'Sound', 'Sound', [['Role', 'Sound recordist'], ['Day Rate', '$300'], ['Kit', 'Lav kit, boom, recorder']]);
  const studio = createEntry(w, 'place', { name: 'Lumen Glassworks', tagline: 'The hot shop', group: 'Locations', specs: specs([['Address', '14 Kiln Street'], ['Contact', 'Theo Ruiz'], ['Permit', 'Not needed (private)'], ['Cost Per Day', '$150'], ['Power & Parking', 'Plenty; furnace noise all day']]), ...sample });
  const desk = createEntry(w, 'place', { name: 'Mara’s Studio', tagline: 'Talking-head corner', group: 'Locations', specs: specs([['Address', 'Home'], ['Cost Per Day', '$0']]), ...sample });

  // The script: screenplay elements, with @ mentions of the cast.
  const book = createBook(w, { title: 'Script', partNoun: 'Sequence', targetWords: 0, ...sample });
  const scene = (partId: string, title: string, status: SceneStatus, placeId: string, when: string, blocks: ReturnType<typeof block>[]) =>
    createScene(book.id, partId, { title, status, placeId, when, content: blocks, targetWords: 0, ...sample });
  const open = createPart(book.id, { title: 'Cold Open', ...sample });
  const s1 = scene(open.id, 'The Furnace', 'done', studio.id, 'Day', [
    block('sceneHeading', 'INT. LUMEN GLASSWORKS - DAY'),
    block('action', 'A furnace door swings open. Orange light floods the lens. ', theo, ' reaches in with a steel pipe and turns it, slowly, like winding a clock.'),
    block('character', 'MARA (V.O.)'),
    block('dialogue', 'This furnace hasn’t been turned off in eleven years. Today it’s going to teach me something.'),
    block('transition', 'SMASH CUT TO:'),
  ]);
  const s2 = scene(open.id, 'Title', 'done', desk.id, 'Day', [
    block('sceneHeading', 'INT. MARA’S STUDIO - DAY'),
    block('action', mara, ' sits in front of a shelf of glass she didn’t make.'),
    block('character', 'MARA'),
    block('dialogue', 'I have bought a lot of glass. I have never made any. Let’s fix that.'),
  ]);
  const main = createPart(book.id, { title: 'The Lesson', ...sample });
  const s3 = scene(main.id, 'Gathering', 'draft', studio.id, 'Day', [
    block('sceneHeading', 'INT. LUMEN GLASSWORKS - DAY'),
    block('action', theo, ' hands ', mara, ' a pipe. It’s heavier than it looks.'),
    block('character', 'THEO'),
    block('parenthetical', '(over the roar)'),
    block('dialogue', 'Keep it turning. The second you stop, gravity wins.'),
    block('character', 'MARA'),
    block('dialogue', 'How long do I keep it turning?'),
    block('character', 'THEO'),
    block('dialogue', 'Until it’s done. Or until it’s on the floor.'),
  ]);
  const s4 = scene(main.id, 'The First Blow', 'outline', studio.id, 'Day', [
    block('sceneHeading', 'INT. LUMEN GLASSWORKS - BENCH - DAY'),
    block('action', 'Mara blows into the pipe. Nothing happens. She blows harder. A bubble, the size of a grape, appears in the glass.'),
  ]);
  const end = createPart(book.id, { title: 'Outro', ...sample });
  scene(end.id, 'What Went Wrong', 'idea', desk.id, 'Day', [block('sceneHeading', 'INT. MARA’S STUDIO - DAY'), block('action', 'Mara holds up the finished vase. It leans.')]);

  const shot = (sceneId: string, size: string, move: string, lens: string, description: string, seconds: number, status: 'planned' | 'shot' = 'planned') =>
    createShot(w, sceneId, { size, move, lens, description, seconds, status, ...sample });
  shot(s1.id, 'ECU', 'Static', '100mm macro', 'Furnace door opens; light floods the lens', 4, 'shot');
  shot(s1.id, 'MS', 'Handheld', '35mm', 'Theo gathers glass from the furnace', 8, 'shot');
  shot(s1.id, 'Insert', 'Static', '100mm macro', 'Glass turning on the pipe', 5);
  shot(s2.id, 'MCU', 'Static', '50mm', 'Mara to camera, the glass shelf behind', 20);
  shot(s3.id, 'WS', 'Gimbal', '24mm', 'Theo hands Mara the pipe; the whole shop', 10);
  shot(s3.id, 'CU', 'Handheld', '50mm', 'Mara’s hands, turning', 6);
  shot(s3.id, 'OTS', 'Static', '35mm', 'Over Theo, on Mara: “How long do I keep it turning?”', 8);
  shot(s4.id, 'ECU', 'Static', '100mm macro', 'The bubble appears', 5);

  createShootDay(w, { date: addDays(today(), 6), call: '08:00', placeId: studio.id, sceneIds: [s1.id, s3.id, s4.id], notes: 'Hot shop: everyone in natural fibers, closed shoes. Furnace noise: lavs on both.', ...sample });
  createShootDay(w, { date: addDays(today(), 8), call: '10:00', placeId: desk.id, sceneIds: [s2.id], notes: 'Talking heads. Bring the finished vase.', ...sample });

  const cost = (category: string, item: string, estimate: number, actual = 0) => createBudgetLine(w, 'cost', { category, item, estimate, actual, ...sample });
  cost('Locations', 'Lumen Glassworks, 1 day', 150, 150);
  cost('Cast', 'Theo Ruiz, 1 day', 250);
  cost('Crew', 'Jonah Park (DP), 2 days', 800);
  cost('Crew', 'Ada Osei (sound), 1 day', 300);
  cost('Equipment', 'Macro lens rental', 60, 72);
  cost('Post-Production', 'Color grade', 200);
  cost('Music & Licensing', 'Music license, 1 track', 50);
  const income = (category: string, item: string, estimate: number, actual = 0) => createBudgetLine(w, 'income', { category, item, estimate, actual, ...sample });
  income('Sponsorship', 'Sponsor read: Kilnworks Supply', 1200);
  income('Ad Revenue', 'First 90 days (estimate)', 650);
  return world;
}

/** "The Sunken Lantern": a level-3 coastal campaign, three sessions in. */
export function seedCampaign(): World {
  const world = putWorld('tabletop', {
    name: 'The Sunken Lantern',
    genre: 'Coastal Horror',
    summary: 'The lighthouse off Saltreach went dark a hundred years ago. Last week it lit up again, and ships started coming in without their crews.',
    tabletop: { ...tabletopDefaults(), ruleset: '5e', nextSession: addDays(today(), 4), sessionTime: '19:00' },
  });
  const w = world.id;

  const npc = (name: string, tagline: string, group: string, rows: [string, string][], about: string, secret = false) =>
    createEntry(w, 'character', { name, tagline, group, specs: specs(rows), about, secret, ...sample });
  const quill = npc('Harbormaster Quill', 'Counts every ship in and out', 'Townsfolk', [['Species', 'Human'], ['Role', 'Harbormaster'], ['Found At', 'The harbor office'], ['Voice', 'Clipped, nautical'], ['Wants', 'The light out again']], 'Keeps a ledger of every ship that came in empty. The numbers frighten him more than the ghosts.');
  const nessa = npc('Nessa Coil', 'Smuggler with a boat and no questions', 'Allies', [['Species', 'Half-elf'], ['Role', 'Smuggler'], ['Found At', 'The Gull & Anchor'], ['Wants', 'Paying passengers']], 'Will row the party out to the lighthouse, for a price, and only at low tide.');
  const abbot = npc('The Drowned Abbot', 'Keeper of the Lantern, a century dead', 'Villains', [['Species', 'Undead'], ['Role', 'The Lantern’s keeper'], ['Found At', 'The lamp room'], ['Wants', 'One more soul to finish the oath']], 'Swore the Lantern Oath to keep ships safe, and kept it past death by taking their crews instead.', true);
  const saltreach = createEntry(w, 'place', { name: 'Saltreach', tagline: 'A fishing town that stopped fishing', group: 'Places', specs: specs([['Region', 'The Grey Coast'], ['Ruler', 'Harbor council'], ['Notable For', 'Smoked eel, bad luck']]), about: 'Everyone in Saltreach can see the lighthouse from their window. Most have nailed the shutters closed.', ...sample });
  const lantern = createEntry(w, 'place', { name: 'The Sunken Lantern', tagline: 'A lighthouse half under the sea', group: 'Places', specs: specs([['Region', 'A mile offshore'], ['Notable For', 'Its light, again']]), about: 'Reachable on foot along the breakwater at the lowest tide, for about an hour.', ...sample });
  const oath = createEntry(w, 'lore', { name: 'The Lantern Oath', tagline: 'Keep the light, whatever it costs', group: 'Lore', specs: specs([['Category', 'Religion'], ['Known To', 'The Abbot, and now the party?']]), about: 'The keepers’ vow. The Abbot’s version adds a line the others didn’t.', secret: true, ...sample });
  addRelationship(w, nessa.id, quill.id, 'Owes him harbor fees', sample);
  addRelationship(w, abbot.id, lantern.id, 'Bound to it', sample);

  const abilities = (str: number, dex: number, con: number, int: number, wis: number, cha: number): Abilities => ({ str, dex, con, int, wis, cha });
  const noSlots = () => Array.from({ length: 9 }, () => [0, 0] as [number, number]);
  const slots = (...levels: number[]) => noSlots().map((s, i) => (levels[i] !== undefined ? ([levels[i]!, 0] as [number, number]) : s));
  const brin = createPc(w, {
    name: 'Brin Ashvale', player: 'Sam', species: 'Halfling', className: 'Rogue', subclass: 'Thief', background: 'Urchin', level: 3,
    abilities: abilities(8, 17, 12, 13, 12, 14), saves: ['dex', 'int'], skills: ['Acrobatics', 'Sleight of Hand', 'Stealth', 'Perception', 'Deception'], expertise: ['Stealth', 'Sleight of Hand'],
    hp: { max: 21, current: 21, temp: 0 }, ac: 14, speed: 25,
    attacks: [{ name: 'Shortsword', bonus: 5, damage: '1d6+3' }, { name: 'Shortbow', bonus: 5, damage: '1d6+3' }, { name: 'Sneak Attack', bonus: 0, damage: '2d6' }],
    inventory: [
      { name: 'Leather armor', qty: 1, weight: 10, equipped: true },
      { name: 'Shortsword', qty: 1, weight: 2, equipped: true },
      { name: 'Shortbow', qty: 1, weight: 2, equipped: true },
      { name: 'Arrows', qty: 20, weight: 0.05 },
      { name: 'Thieves’ tools', qty: 1, weight: 1 },
      { name: 'Rope, 50 ft.', qty: 1, weight: 10 },
    ],
    currency: { cp: 8, sp: 14, ep: 0, gp: 37, pp: 0 },
    proficiencies: 'Light armor. Simple weapons, hand crossbows, longswords, rapiers, shortswords. Thieves’ tools. Common, Halfling, Thieves’ Cant.',
    features: '', ...srdBuild('halfling', 'lightfoot-halfling', 'rogue', 3, abilities(8, 17, 12, 13, 12, 14), true), ...sample,
  });
  // Kael is yours (Player view): the character you play in this campaign.
  const kael = createPc(w, {
    mine: true,
    name: 'Kael Thorn', player: 'Priya', species: 'Human', className: 'Fighter', subclass: 'Champion', background: 'Sailor', level: 3,
    abilities: abilities(16, 13, 15, 10, 12, 9), saves: ['str', 'con'], skills: ['Athletics', 'Perception', 'Intimidation', 'Survival'], expertise: [],
    hp: { max: 31, current: 24, temp: 0 }, ac: 18, speed: 30,
    attacks: [{ name: 'Longsword', bonus: 5, damage: '1d8+3' }, { name: 'Javelin', bonus: 5, damage: '1d6+3' }],
    inventory: [
      { name: 'Chain mail', qty: 1, weight: 55, equipped: true },
      { name: 'Shield', qty: 1, weight: 6, equipped: true },
      { name: 'Longsword', qty: 1, weight: 3, equipped: true },
      { name: 'Javelins', qty: 4, weight: 2 },
      { name: 'Gull-feather cloak', qty: 1, weight: 1, equipped: true, attuned: true, notes: 'Found on the breakwater. Never gets wet.' },
      { name: 'Backpack', qty: 1, weight: 5 },
      { name: 'Bedroll', qty: 1, weight: 7 },
      { name: 'Rations (1 day)', qty: 5, weight: 2 },
      { name: 'Rope, 50 ft.', qty: 1, weight: 10 },
      { name: 'Waterskin', qty: 1, weight: 5 },
      { name: 'Keeper’s badge', qty: 1, notes: 'Stamped with the words of the Oath.' },
    ],
    currency: { cp: 14, sp: 30, ep: 0, gp: 12, pp: 0 },
    proficiencies: 'All armor and shields. Simple and martial weapons. Navigator’s tools, water vehicles. Common, Aquan.',
    features: 'Fighting Style: Defense (+1 AC in armor).', ...srdBuild('human', null, 'fighter', 3, abilities(16, 13, 15, 10, 12, 9), true), ...sample,
  });
  const odile = createPc(w, {
    name: 'Odile Vance', player: 'Jordan', species: 'Tiefling', className: 'Warlock', subclass: 'The Fathomless', background: 'Haunted One', level: 3,
    abilities: abilities(8, 14, 13, 12, 10, 16), saves: ['wis', 'cha'], skills: ['Arcana', 'Deception', 'Investigation', 'Religion'], expertise: [],
    hp: { max: 24, current: 24, temp: 0 }, ac: 12, speed: 30, slots: slots(0, 2),
    attacks: [{ name: 'Eldritch Blast', bonus: 5, damage: '1d10+3' }],
    spellcasting: 'cha',
    currency: { cp: 0, sp: 6, ep: 0, gp: 21, pp: 0 },
    proficiencies: 'Light armor. Simple weapons. Common, Infernal, Primordial.',
    spells: [{ name: 'Eldritch Blast', level: 0, prepared: true }, { name: 'Minor Illusion', level: 0, prepared: true }, { name: 'Hex', level: 1, prepared: true }, { name: 'Misty Step', level: 2, prepared: true }],
    inventory: [{ name: 'Arcane focus (a drowned bell)', qty: 1, weight: 1, equipped: true }, { name: 'Leather armor', qty: 1, weight: 10, equipped: true }, { name: 'Dagger', qty: 2, weight: 1 }],
    features: 'Eldritch Invocations: Agonizing Blast, Devil’s Sight. Pact of the Tome. The Fathomless: Tentacle of the Deeps.', ...srdBuild('tiefling', null, 'warlock', 3, abilities(8, 14, 13, 12, 10, 16), false), ...sample,
  });
  const tamsin = createPc(w, {
    name: 'Tamsin Reed', player: 'Alex', species: 'Dwarf', className: 'Cleric', subclass: 'Light Domain', background: 'Acolyte', level: 3,
    abilities: abilities(12, 10, 14, 10, 16, 13), saves: ['wis', 'cha'], skills: ['Insight', 'Medicine', 'Religion', 'History'], expertise: [],
    hp: { max: 27, current: 27, temp: 0 }, ac: 16, speed: 25, slots: slots(4, 2),
    attacks: [{ name: 'Mace', bonus: 3, damage: '1d6+1' }, { name: 'Sacred Flame', bonus: 0, damage: '1d8' }],
    spellcasting: 'wis',
    currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
    proficiencies: 'Light, medium and heavy armor, shields. Simple weapons. Common, Dwarvish.',
    spells: [{ name: 'Sacred Flame', level: 0, prepared: true }, { name: 'Light', level: 0, prepared: true }, { name: 'Cure Wounds', level: 1, prepared: true }, { name: 'Guiding Bolt', level: 1, prepared: true }, { name: 'Spiritual Weapon', level: 2, prepared: true }],
    inventory: [{ name: 'Chain mail', qty: 1, weight: 55, equipped: true }, { name: 'Shield', qty: 1, weight: 6, equipped: true }, { name: 'Mace', qty: 1, weight: 4, equipped: true }, { name: 'Holy symbol', qty: 1, weight: 1, equipped: true }, { name: 'Healer’s kit', qty: 1, weight: 3 }],
    features: 'Light Domain: Warding Flare, Channel Divinity: Radiance of the Dawn.', ...srdBuild('dwarf', 'hill-dwarf', 'cleric', 3, abilities(12, 10, 14, 10, 16, 13), false), ...sample,
  });

  // Another of yours, in no campaign yet: a character needn't be in one.
  createPc(null, {
    mine: true, name: 'Wren Ashdown', player: 'You', species: 'Elf', className: 'Wizard', subclass: '', background: 'Sage', level: 1,
    abilities: abilities(8, 14, 13, 16, 12, 10), saves: ['int', 'wis'], skills: ['Arcana', 'History', 'Investigation', 'Perception'], expertise: [],
    hp: { max: 7, current: 7, temp: 0 }, ac: 12, speed: 30, slots: slots(2), spellcasting: 'int',
    attacks: [{ name: 'Fire Bolt', bonus: 5, damage: '1d10' }, { name: 'Dagger', bonus: 4, damage: '1d4+2' }],
    spells: [{ name: 'Fire Bolt', level: 0, prepared: true }, { name: 'Mage Hand', level: 0, prepared: true }, { name: 'Light', level: 0, prepared: true }, { name: 'Magic Missile', level: 1, prepared: true }, { name: 'Shield', level: 1, prepared: true }, { name: 'Find Familiar', level: 1, prepared: false }],
    inventory: [{ name: 'Spellbook', qty: 1, weight: 3, equipped: true }, { name: 'Dagger', qty: 1, weight: 1, equipped: true }, { name: 'Component pouch', qty: 1, weight: 2, equipped: true }, { name: 'Ink and quills', qty: 1, weight: 1 }, { name: 'Scholar’s pack', qty: 1, weight: 10 }],
    currency: { cp: 0, sp: 5, ep: 0, gp: 10, pp: 0 },
    proficiencies: 'Daggers, darts, slings, quarterstaffs, light crossbows. Common, Elvish, Draconic, Dwarvish.',
    features: '', ...srdBuild('elf', 'high-elf', 'wizard', 1, abilities(8, 14, 13, 16, 12, 10), false), notes: 'Looking for a table. Left the Archive with a stolen index card and no plan.', ...sample,
  });

  const ghoul = createMonster(w, {
    name: 'Brine Ghoul', kind: 'Medium undead, chaotic evil', ac: 12, hp: 22, hpDice: '5d8', speed: '30 ft., swim 30 ft.', cr: '1',
    abilities: abilities(13, 15, 10, 7, 10, 6),
    traits: 'Darkvision 60 ft. Smells of low tide. Can hold its breath forever.',
    actions: [{ name: 'Claws', text: 'Melee attack: +4 to hit, reach 5 ft. Hit: 2d4 + 2 slashing. A creature hit must succeed on a DC 10 Constitution save or be poisoned until the end of its next turn.' }], ...sample,
  });
  const wisp = createMonster(w, {
    name: 'Lantern Wisp', kind: 'Tiny undead, neutral evil', ac: 15, hp: 13, hpDice: '3d4+6', speed: 'fly 40 ft. (hover)', cr: '1/2',
    abilities: abilities(1, 20, 14, 10, 12, 11),
    traits: 'Sheds bright light in 15 ft. Flickers out (becomes invisible) as a bonus action.',
    actions: [{ name: 'Beckon', text: 'One creature it can see within 60 ft. makes a DC 11 Wisdom save or uses its movement to walk toward the wisp.' }], ...sample,
  });
  createMonster(w, {
    name: 'Drowned Acolyte', kind: 'Medium undead, lawful evil', ac: 11, hp: 13, hpDice: '3d8', speed: '30 ft.', cr: '1/4',
    abilities: abilities(12, 10, 12, 8, 12, 8), traits: 'Recites the Lantern Oath without stopping.', actions: [{ name: 'Rusted Censer', text: 'Melee attack: +3 to hit. Hit: 1d6 + 1 bludgeoning.' }], ...sample,
  });

  const ambush = createEncounter(w, {
    name: 'Ambush At The Breakwater',
    notes: 'Low tide, slick stones, fog. The ghouls climb out of the water on round 2; the wisp tries to lure someone off the edge.',
    combatants: [
      ...[brin, kael, odile, tamsin].map((pc) => combatant({ kind: 'pc', refId: pc.id, name: pc.name, initiative: null, ac: pc.ac, hp: pc.hp.current, maxHp: pc.hp.max, conditions: [] })),
      combatant({ kind: 'monster', refId: ghoul.id, name: 'Brine Ghoul 1', initiative: null, ac: ghoul.ac, hp: ghoul.hp, maxHp: ghoul.hp, conditions: [] }),
      combatant({ kind: 'monster', refId: ghoul.id, name: 'Brine Ghoul 2', initiative: null, ac: ghoul.ac, hp: ghoul.hp, maxHp: ghoul.hp, conditions: [] }),
      combatant({ kind: 'monster', refId: wisp.id, name: 'Lantern Wisp', initiative: null, ac: wisp.ac, hp: wisp.hp, maxHp: wisp.hp, conditions: [] }),
    ],
    ...sample,
  });

  // The session log: what happened, with @ mentions.
  const book = createBook(w, { title: 'Session Log', partNoun: 'Arc', targetWords: 0, ...sample });
  const arc = createPart(book.id, { title: 'Saltreach', ...sample });
  const session = (title: string, status: SceneStatus, when: string, blocks: ReturnType<typeof p>[], note = '', placeId: string | null = saltreach.id, extra: Partial<Scene> = {}) =>
    createScene(book.id, arc.id, { title, status, when, content: blocks, note, placeId, targetWords: 0, ...extra, ...sample });
  const check = (...items: string[]) => items.map((text, i) => ({ id: newId(), text, done: i === 0 }));
  session('Session 1 · Arrival In Saltreach', 'done', addDays(today(), -10), [
    p('The party came in on the evening coach and found every shutter in ', saltreach, ' nailed shut. ', quill, ' showed them his ledger: nine ships in a month, every one of them empty.'),
    p('At the Gull & Anchor they met ', nessa, ', who will row them out at low tide for ten gold a head.'),
  ]);
  session('Session 2 · The Breakwater', 'done', addDays(today(), -3), [
    p('Walking the breakwater at dawn, the party saw the light in ', lantern, ' blink: three short, one long. Kael recognized it as a harbor signal for “safe to enter”.'),
    p('Brin found a keeper’s badge in the weed, stamped with the words of ', oath, '.'),
  ]);
  session('Session 3 · Into The Lantern', 'outline', addDays(today(), 4), [], 'Run Ambush At The Breakwater on the way out. Inside: the keepers’ log (the Oath’s extra line), then the stairs. The Abbot only appears if someone reads the log aloud.', lantern.id, {
    encounterIds: [ambush.id],
    checklist: check('The light is a keepers’ signal, still in use', 'Quill’s ledger was forged: the ships left full', 'Nessa rowed someone out the night before the first ship vanished', 'The Oath has an extra line no living keeper swore'),
  });

  // A player's journal (Player view, playing Kael): their own notes, kept with Kael, apart from the GM's log.
  const journal = createBook('', { ...JOURNAL, characterId: kael.id, ...sample });
  const notes = createPart(journal.id, { title: 'Saltreach', ...sample });
  createScene(journal.id, notes.id, {
    title: 'Session 2 · What Kael Saw',
    status: 'done',
    when: addDays(today(), -3),
    content: [
      p('Three short, one long: the old harbor signal for “safe to enter”. Somebody in ', lantern, ' still knows the keepers’ codes.'),
      p('Ask ', nessa, ' who she rowed out there before us. She knew the tide tables too well.'),
    ],
    placeId: lantern.id,
    targetWords: 0,
    checklist: [{ id: newId(), text: 'Ask Nessa who she rowed out before us', done: false }],
    ...sample,
  });
  // And notes of their own, apart from the sessions.
  createNote(journal.id, {
    title: 'The Empty Ships',
    category: 'quest',
    pinned: true,
    content: [p('Harbormaster Quill pays 200 gold if we find out what happened to the nine ships. Half up front, already spent on rope.')],
    tagged: [quill.id],
    checklist: [
      { id: newId(), text: 'Walk the breakwater at dawn', done: true },
      { id: newId(), text: 'Get inside the Sunken Lantern', done: false },
      { id: newId(), text: 'Bring proof back to Quill', done: false },
    ],
    ...sample,
  });
  createNote(journal.id, {
    title: 'Keeper’s Badge',
    category: 'clue',
    content: [p('Brin found it in the weed off the breakwater, stamped with a keepers’ vow. Whose was it, and why throw it away?')],
    tagged: [lantern.id],
    ...sample,
  });

  // The GM's map of the coast, shared with the players (the crypt pin is the GM's alone).
  createMap({
    worldId: w, characterId: null, name: 'Saltreach & The Breakwater', image: saltreachMap(), ...SALTREACH_SIZE, ...sample,
    pins: [
      { id: newId(), x: 0.76, y: 0.37, label: 'Saltreach', note: 'Every shutter nailed shut. Harbormaster Quill keeps the ledger of empty ships.', tone: 'place' },
      { id: newId(), x: 0.6, y: 0.52, label: 'Gull & Anchor', note: 'Nessa Coil rows out at low tide, ten gold a head.', tone: 'note' },
      { id: newId(), x: 0.79, y: 0.44, label: 'The Party', note: 'Rooms above the Gull & Anchor.', tone: 'party' },
      { id: newId(), x: 0.42, y: 0.46, label: 'Ambush Point', note: 'Brine ghouls climb the breakwater as the tide turns.', tone: 'danger', gmOnly: true },
      { id: newId(), x: 0.19, y: 0.43, label: 'The Sunken Lantern', note: 'Three short, one long: safe to enter.', tone: 'place' },
      { id: newId(), x: 0.2, y: 0.5, label: 'The Abbot’s Crypt', note: 'Under the lower floors. Only if someone reads the log aloud.', tone: 'danger', gmOnly: true },
    ],
  });

  const party = createStoryline(w, { name: 'The Party', ...sample });
  const keepers = createStoryline(w, { name: 'The Keepers', ...sample });
  const event = (storylineId: string, year: number, title: string, summary: string, links: Entry[]) => createEvent(w, storylineId, { year, title, summary, links: links.map((e) => e.id), ...sample });
  event(keepers.id, 1, 'The Lantern is lit', 'The Abbot and his keepers swear the Oath.', [abbot, oath, lantern]);
  event(keepers.id, 2, 'The Lantern goes dark', 'A storm takes the lower floors. The keepers are never found.', [lantern]);
  event(keepers.id, 101, 'The light returns', 'A hundred years later, the Lantern lights again.', [lantern]);
  event(party.id, 101, 'The party arrives', 'Hired by the harbor council, three weeks after the light returned.', [saltreach, quill]);

  // Shared with the whole party: everything but the GM's secrets, the NPCs in their groups (the structure, shared too).
  const everyone = [brin.id, kael.id, odile.id, tamsin.id];
  const shown = live(useVault.getState().vault.entries).filter((e) => e.worldId === w && !e.secret);
  shareItems({ worldId: w, collection: 'entries', ids: shown.map((e) => e.id), recipients: everyone, mode: 'add', places: Object.fromEntries(shown.map((e) => [e.id, { space: e.group }])) });
  shareItems({ worldId: w, collection: 'maps', ids: live(useVault.getState().vault.maps).filter((m) => m.worldId === w && !m.characterId).map((m) => m.id), recipients: everyone, mode: 'add' });
  for (const share of live(useVault.getState().vault.shares)) if (share.worldId === w) useVault.getState().patch('shares', share.id, { sample: true });
  return world;
}
