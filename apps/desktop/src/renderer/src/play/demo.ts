/**
 * Play → Set Up A Demo Game: a campaign ready to play on this computer, for
 * trying the table out, set up as a real table would be. You're its GM. Four
 * players, each a test account of their own (Riley, Morgan, Casey, Jamie),
 * made their level 5 characters (a fighter, a wizard, a cleric and a rogue,
 * each with attacks, spells, features with uses and potions) and joined: each
 * sheet is in its player's account, and the party has it too. A fifth
 * (Quinn, with a barbarian) has the GM's invite to answer. Creatures from the
 * Library's SRD and one of our own, and two scenes:
 * an ambush on a road (started, in daylight) and a goblin cave (walls, dark,
 * torches and darkvision, a hidden chief). A handout on each, music from
 * the Library's free tracks (exploring on the road, a fight in the cave), a
 * welcome in the chat. All original, around the SRD's creatures.
 */
import { combatant, createEncounter, createEntry, createMonster, createPc } from '@/lib/actions';
import { srdBuild } from '@/lib/compendium/classes';
import { bestiaryInput, loadLibrary } from '@/lib/library';
import { newId, type Abilities, type Monster, type PlayerCharacter, type World } from '@/lib/model';
import { tabletopDefaults } from '@/lib/sections';
import { putWorld } from '@/lib/seedSections';
import { useAccounts } from '@/stores/accounts';
import { useVault } from '@/stores/vault';
import { defaultFog, defaultGrid, type Token } from '@/tabletop/battlemap/model';
import { addToken, type TokenBoard } from '@/tabletop/battlemap/tokens/actions';
import { invitePlayer, setMembers, syncPlayers, testAccount } from '@/tabletop/members/actions';
import { addHandout } from './scenes/handouts';
import { createPlayScene, startScene } from './scenes/actions';
import { say } from './table/actions';
import { freeTrack } from '@/lib/library/music';
import { addLibraryTrack } from '@/tabletop/music/actions';
import type { AttachedMusic, MusicTrack, TrackStart } from '@/tabletop/music/model';

export const DEMO_NAME = 'Demo: The Goblin Road';

const store = () => useVault.getState();
const SQUARE = 70;
/** The middle of a square, by column and row. */
const at = (c: number, r: number) => ({ x: (c + 0.5) * SQUARE, y: (r + 0.5) * SQUARE });
/** A wall through squares' corners. */
const wall = (...corners: [number, number][]) => ({ id: newId(), points: corners.map(([c, r]) => ({ x: c * SQUARE, y: r * SQUARE })) });

const abilities = (str: number, dex: number, con: number, int: number, wis: number, cha: number): Abilities => ({ str, dex, con, int, wis, cha });
/** Spell slots per level, none used. */
const slots = (...levels: number[]) => Array.from({ length: 9 }, (_, i) => [levels[i] ?? 0, 0] as [number, number]);
const spells = (level: number, ...names: string[]) => names.map((name) => ({ name, level, prepared: true }));

/** Quinn's character, level 5, made in their own account (no campaign yet). Made here, then moved there. */
function barbarian(): PlayerCharacter {
  const scores = abilities(17, 14, 16, 8, 12, 10);
  return createPc(null, {
    name: 'Bram Fennick', player: 'Quinn', species: 'Half-Orc', className: 'Barbarian', subclass: 'Path of the Berserker', background: 'Outlander', level: 5, xp: 6500,
    abilities: scores, saves: ['str', 'con'], skills: ['Athletics', 'Intimidation', 'Survival', 'Perception'], expertise: [],
    hp: { max: 55, current: 55, temp: 0 }, ac: 15, speed: 40,
    attacks: [
      { name: 'Greataxe', bonus: 6, damage: '1d12+3 slashing' },
      { name: 'Handaxe', bonus: 6, damage: '1d6+3 slashing' },
    ],
    inventory: [
      { name: 'Greataxe', qty: 1, weight: 7, equipped: true },
      { name: 'Handaxe', qty: 2, weight: 2 },
      { name: 'Explorer’s Pack', qty: 1, weight: 59 },
      { name: 'Potion of Healing', qty: 1, weight: 0.5 },
    ],
    currency: { cp: 0, sp: 5, ep: 0, gp: 10, pp: 0 },
    proficiencies: 'Light and medium armor, shields. Simple and martial weapons. Common, Orc.',
    features: 'Rage (3 a day): advantage on Strength checks and saves, +2 melee damage, resistance to bludgeoning, piercing and slashing. Unarmored Defense. Reckless Attack. Extra Attack.',
    notes: 'Tracked the goblins from the hills; wants a word with their chief.',
    ...srdBuild('half-orc', null, 'barbarian', 5, scores, true),
  });
}

/** The four of the party, level 5, each played by a test account named for its player (theirs: syncPlayers puts each in its player's account). */
function party(w: string): PlayerCharacter[] {
  const garrickScores = abilities(17, 12, 16, 10, 13, 10);
  const garrick = createPc(w, {
    name: 'Garrick Stone', player: 'Riley', species: 'Human', className: 'Fighter', subclass: 'Champion', background: 'Soldier', level: 5, xp: 6500,
    abilities: garrickScores, saves: ['str', 'con'], skills: ['Athletics', 'Intimidation', 'Perception', 'Survival'], expertise: [],
    hp: { max: 49, current: 49, temp: 0 }, ac: 19, speed: 30,
    attacks: [
      { name: 'Longsword', bonus: 6, damage: '1d8+3 slashing' },
      { name: 'Longsword (two hands)', bonus: 6, damage: '1d10+3 slashing' },
      { name: 'Javelin', bonus: 6, damage: '1d6+3 piercing' },
    ],
    inventory: [
      { name: 'Chain Mail', qty: 1, weight: 55, equipped: true },
      { name: 'Shield', qty: 1, weight: 6, equipped: true },
      { name: 'Longsword', qty: 1, weight: 3, equipped: true },
      { name: 'Javelin', qty: 4, weight: 2 },
      { name: 'Potion of Healing', qty: 2, weight: 0.5 },
      { name: 'Torch', qty: 5, weight: 1 },
      { name: 'Rope, hempen (50 feet)', qty: 1, weight: 10 },
    ],
    currency: { cp: 12, sp: 20, ep: 0, gp: 45, pp: 0 },
    proficiencies: 'All armor and shields. Simple and martial weapons. Dice set, vehicles (land). Common, Goblin.',
    features: 'Fighting Style: Defense (+1 AC in armor). Extra Attack: two attacks with the Attack action.',
    notes: 'Carries the torch. Ran guard on Tobin’s wagons before; owes him one.',
    ...srdBuild('human', null, 'fighter', 5, garrickScores, true),
  });
  const ilsaScores = abilities(8, 14, 14, 18, 12, 10);
  const ilsa = createPc(w, {
    name: 'Ilsa Marrow', player: 'Morgan', species: 'Elf', className: 'Wizard', subclass: 'School of Evocation', background: 'Sage', level: 5, xp: 6500,
    abilities: ilsaScores, saves: ['int', 'wis'], skills: ['Arcana', 'History', 'Investigation', 'Perception'], expertise: [],
    hp: { max: 32, current: 32, temp: 0 }, ac: 12, speed: 30, slots: slots(4, 3, 2), spellcasting: 'int',
    attacks: [{ name: 'Dagger', bonus: 5, damage: '1d4+2 piercing' }],
    spells: [
      ...spells(0, 'Fire Bolt', 'Ray of Frost', 'Mage Hand', 'Prestidigitation'),
      ...spells(1, 'Magic Missile', 'Shield', 'Burning Hands', 'Thunderwave', 'Sleep', 'Mage Armor'),
      ...spells(2, 'Misty Step', 'Scorching Ray', 'Hold Person'),
      ...spells(3, 'Fireball', 'Counterspell'),
    ],
    inventory: [
      { name: 'Spellbook', qty: 1, weight: 3, equipped: true },
      { name: 'Component pouch', qty: 1, weight: 2, equipped: true },
      { name: 'Dagger', qty: 1, weight: 1, equipped: true },
      { name: 'Potion of Healing', qty: 1, weight: 0.5 },
      { name: 'Bag of Holding', qty: 1, weight: 15 },
    ],
    currency: { cp: 0, sp: 8, ep: 0, gp: 60, pp: 1 },
    proficiencies: 'Daggers, darts, slings, quarterstaffs, light crossbows. Common, Elvish, Draconic, Goblin.',
    notes: 'Mage Armor takes her AC to 15.',
    ...srdBuild('elf', 'high-elf', 'wizard', 5, ilsaScores, true),
  });
  const hildeScores = abilities(14, 10, 14, 10, 18, 12);
  const hilde = createPc(w, {
    name: 'Hilde Ironbrew', player: 'Casey', species: 'Dwarf', className: 'Cleric', subclass: 'Life Domain', background: 'Acolyte', level: 5, xp: 6500,
    abilities: hildeScores, saves: ['wis', 'cha'], skills: ['Insight', 'Medicine', 'Religion', 'History'], expertise: [],
    // Hurt already, to try healing on.
    hp: { max: 43, current: 31, temp: 0 }, ac: 18, speed: 25, slots: slots(4, 3, 2), spellcasting: 'wis',
    attacks: [{ name: 'Warhammer', bonus: 5, damage: '1d8+2 bludgeoning' }],
    spells: [
      ...spells(0, 'Sacred Flame', 'Guidance', 'Spare the Dying', 'Light'),
      ...spells(1, 'Cure Wounds', 'Healing Word', 'Bless', 'Guiding Bolt', 'Shield of Faith'),
      ...spells(2, 'Spiritual Weapon', 'Lesser Restoration', 'Aid'),
      ...spells(3, 'Spirit Guardians', 'Revivify', 'Mass Healing Word'),
    ],
    inventory: [
      { name: 'Chain Mail', qty: 1, weight: 55, equipped: true },
      { name: 'Shield', qty: 1, weight: 6, equipped: true },
      { name: 'Warhammer', qty: 1, weight: 2, equipped: true },
      { name: 'Holy symbol', qty: 1, weight: 1, equipped: true },
      { name: 'Healer’s Kit', qty: 1, weight: 3 },
      { name: 'Potion of Greater Healing', qty: 1, weight: 0.5 },
    ],
    currency: { cp: 30, sp: 15, ep: 0, gp: 25, pp: 0 },
    proficiencies: 'Light, medium and heavy armor, shields. Simple weapons. Brewer’s supplies. Common, Dwarvish.',
    notes: 'Disciple of Life: her healing spells heal 2 + the spell’s level more.',
    ...srdBuild('dwarf', 'hill-dwarf', 'cleric', 5, hildeScores, true),
  });
  const pipScores = abilities(8, 18, 12, 13, 12, 14);
  const pip = createPc(w, {
    name: 'Pip Thistlewood', player: 'Jamie', species: 'Halfling', className: 'Rogue', subclass: 'Thief', background: 'Urchin', level: 5, xp: 6500,
    abilities: pipScores, saves: ['dex', 'int'], skills: ['Acrobatics', 'Sleight of Hand', 'Stealth', 'Perception', 'Deception', 'Investigation'], expertise: ['Stealth', 'Sleight of Hand'],
    hp: { max: 38, current: 38, temp: 0 }, ac: 16, speed: 25,
    attacks: [
      { name: 'Shortsword', bonus: 7, damage: '1d6+4 piercing' },
      { name: 'Shortbow', bonus: 7, damage: '1d6+4 piercing' },
      { name: 'Sneak Attack', bonus: 0, damage: '3d6' },
    ],
    inventory: [
      { name: 'Studded Leather Armor', qty: 1, weight: 13, equipped: true },
      { name: 'Shortsword', qty: 1, weight: 2, equipped: true },
      { name: 'Shortbow', qty: 1, weight: 2, equipped: true },
      { name: 'Arrow', qty: 20, weight: 0.05 },
      { name: 'Thieves’ Tools', qty: 1, weight: 1 },
      { name: 'Caltrops', qty: 1, weight: 2 },
      { name: 'Potion of Healing', qty: 2, weight: 0.5 },
    ],
    currency: { cp: 40, sp: 11, ep: 0, gp: 18, pp: 0 },
    proficiencies: 'Light armor. Simple weapons, hand crossbows, longswords, rapiers, shortswords. Thieves’ tools. Common, Halfling, Thieves’ Cant.',
    notes: 'Sneak Attack once a turn: with advantage, or an ally next to the target.',
    ...srdBuild('halfling', 'lightfoot-halfling', 'rogue', 5, pipScores, true),
  });
  return [garrick, ilsa, hilde, pip];
}

/** The Library's SRD creatures used (copied into the bestiary), and the chief, our own. */
async function creatures(w: string): Promise<Record<'goblin' | 'wolf' | 'bugbear' | 'hobgoblin' | 'chief', Monster>> {
  const library = await loadLibrary();
  const srd = (name: string, fallback: Partial<Monster>) => {
    const m = library.monsters.find((x) => x.name === name && x.src === 'srd-2014') ?? library.monsters.find((x) => x.name === name);
    return createMonster(w, m ? bestiaryInput(m) : { name, ...fallback });
  };
  return {
    goblin: srd('Goblin', { kind: 'Small humanoid (goblinoid), neutral evil', ac: 15, hp: 7, hpDice: '2d6', speed: '30 ft.', cr: '1/4', abilities: abilities(8, 14, 10, 10, 8, 8), traits: '', actions: [{ name: 'Scimitar', text: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.' }] }),
    wolf: srd('Wolf', { kind: 'Medium beast, unaligned', ac: 13, hp: 11, hpDice: '2d8 + 2', speed: '40 ft.', cr: '1/4', abilities: abilities(12, 15, 12, 3, 12, 6), traits: '', actions: [{ name: 'Bite', text: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.' }] }),
    bugbear: srd('Bugbear', { kind: 'Medium humanoid (goblinoid), chaotic evil', ac: 16, hp: 27, hpDice: '5d8 + 5', speed: '30 ft.', cr: '1', abilities: abilities(15, 14, 13, 8, 11, 9), traits: '', actions: [{ name: 'Morningstar', text: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 11 (2d8 + 2) piercing damage.' }] }),
    hobgoblin: srd('Hobgoblin', { kind: 'Medium humanoid (goblinoid), lawful evil', ac: 18, hp: 11, hpDice: '2d8 + 2', speed: '30 ft.', cr: '1/2', abilities: abilities(13, 12, 12, 10, 10, 9), traits: '', actions: [{ name: 'Longsword', text: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage.' }] }),
    chief: createMonster(w, {
      name: 'Grukk, Goblin Chief',
      kind: 'Medium humanoid (goblinoid), neutral evil',
      ac: 17,
      hp: 45,
      hpDice: '10d8',
      speed: '30 ft.',
      cr: '3',
      abilities: abilities(14, 16, 10, 11, 10, 14),
      traits: 'Senses darkvision 60 ft., passive Perception 10\nLanguages Common, Goblin\nNimble Escape. The chief can take the Disengage or Hide action as a bonus action on each of its turns.\nWears a crown of bent spoons.',
      actions: [
        { name: 'Multiattack', text: 'The chief makes two attacks with its scimitar.' },
        { name: 'Scimitar', text: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.' },
        { name: 'Thunder Pot (Recharge 5–6)', text: 'The chief hurls a clay pot of powder at a point within 30 ft. Each creature in a 10-foot radius must make a DC 13 Dexterity saving throw, taking 10 (3d6) thunder damage on a failed save, or half as much on a successful one.' },
        { name: 'Reaction: Redirect Attack', text: 'When a creature the chief can see targets it with an attack, the chief chooses a goblin within 5 ft. of it. The two swap places, and the goblin becomes the target instead.' },
      ],
    }),
  };
}

/**
 * Makes the demo campaign (owned by the open account: you're its GM), its
 * test players, and starts its first scene. The campaign made.
 */
export async function setUpDemoGame(): Promise<World> {
  const world = putWorld('tabletop', {
    name: DEMO_NAME,
    genre: 'Classic Fantasy',
    summary: 'Old Tobin’s wagon was ambushed on the road to Millbrook. The goblins who did it live in a cave up the hill, and they took his strongbox.',
    tabletop: { ...tabletopDefaults(), ruleset: '5e' },
  });
  const w = world.id;
  const [garrick, ilsa, hilde, pip] = party(w) as [PlayerCharacter, PlayerCharacter, PlayerCharacter, PlayerCharacter];
  const m = await creatures(w);
  const tobin = createEntry(w, 'character', {
    name: 'Old Tobin',
    tagline: 'A merchant who hired the party',
    group: 'Townsfolk',
    specs: [
      { label: 'Species', value: 'Human' },
      { label: 'Role', value: 'Merchant' },
      { label: 'Wants', value: 'His strongbox back' },
    ],
    about: 'Hauls cloth and salt to Millbrook. Hid under the wagon when the arrows started.',
  });

  // The fights, in Tabletop (their rewards to give out after).
  const fighter = (pc: PlayerCharacter) => combatant({ kind: 'pc', refId: pc.id, name: pc.name, initiative: null, ac: pc.ac, hp: pc.hp.current, maxHp: pc.hp.max, conditions: [] });
  const foe = (monster: Monster, name: string) => combatant({ kind: 'monster', refId: monster.id, name, initiative: null, ac: monster.ac, hp: monster.hp, maxHp: monster.hp, conditions: [] });
  const heroes = [garrick, ilsa, hilde, pip];
  const ambush = createEncounter(w, {
    name: 'Ambush On The Goblin Road',
    notes: 'Goblins shoot from the trees on the east side; the wolves circle in from the west on round 2. The bugbear goes for whoever is guarding the wagon.',
    combatants: [...heroes.map(fighter), foe(m.goblin, 'Goblin 1'), foe(m.goblin, 'Goblin 2'), foe(m.goblin, 'Goblin 3'), foe(m.goblin, 'Goblin 4'), foe(m.wolf, 'Wolf 1'), foe(m.wolf, 'Wolf 2'), foe(m.bugbear, 'Bugbear')],
    loot: { items: [{ id: newId(), name: 'Potion of Healing', qty: 2, to: null }, { id: newId(), name: 'Tobin’s ledger (water-stained)', qty: 1, to: null }], coins: { sp: 40, gp: 12 } },
  });
  const cave = createEncounter(w, {
    name: 'The Goblin Cave',
    notes: 'Three goblins dice by the pillar. The chief and its wolf wait in the back room, and hide until someone comes through the passage.',
    combatants: [...heroes.map(fighter), foe(m.goblin, 'Goblin 1'), foe(m.goblin, 'Goblin 2'), foe(m.goblin, 'Goblin 3'), foe(m.hobgoblin, 'Hobgoblin'), foe(m.chief, 'Grukk, Goblin Chief'), foe(m.wolf, 'Wolf')],
    loot: { items: [{ id: newId(), name: 'Tobin’s strongbox', qty: 1, to: null }, { id: newId(), name: 'Cloak of Protection', qty: 1, to: null }, { id: newId(), name: 'Potion of Greater Healing', qty: 1, to: null }], coins: { gp: 150, pp: 5 } },
  });

  // The music: the Library's free tracks (public domain). The road's plays as it starts; the fight's is a click away.
  const exploring = await addLibraryTrack(freeTrack('medieval-exploration'));
  const battle = await addLibraryTrack(freeTrack('medieval-battle'));
  const music = (...tracks: [MusicTrack | null, TrackStart][]): AttachedMusic => ({ tracks: tracks.filter(([t]) => t).map(([t, start]) => ({ trackId: t!.id, start })), loop: true });

  // Scene 1: the road, in daylight. 24 by 14 squares; the road runs across the middle.
  const road = createPlayScene(w, {
    music: music([exploring, 'auto'], [battle, 'manual']),
    name: 'The Goblin Road',
    encounterId: ambush.id,
    width: 24 * SQUARE,
    height: 14 * SQUARE,
    background: '#6f8a4e',
    grid: defaultGrid(),
    fog: defaultFog(),
  });
  const roadBoard: TokenBoard = { id: road.id, worldId: w, grid: road.grid };
  const put = (board: TokenBoard, source: Parameters<typeof addToken>[1], c: number, r: number, input: Partial<Token> = {}) => addToken(board, source, at(c, r), input).token;
  put(roadBoard, { kind: 'other', name: 'Wagon' }, 11, 6, { size: 'large', hp: { current: 30, max: 30, temp: 0 }, ac: 11 });
  put(roadBoard, { kind: 'npc', entry: tobin }, 12, 8);
  put(roadBoard, { kind: 'pc', pc: garrick }, 10, 8);
  put(roadBoard, { kind: 'pc', pc: ilsa }, 9, 7);
  put(roadBoard, { kind: 'pc', pc: hilde }, 10, 5);
  put(roadBoard, { kind: 'pc', pc: pip }, 13, 5);
  for (const [c, r] of [[19, 2], [20, 5], [19, 9], [21, 11]] as const) put(roadBoard, { kind: 'monster', monster: m.goblin }, c, r);
  put(roadBoard, { kind: 'monster', monster: m.bugbear }, 18, 6);
  // The wolves come in from the west on round 2: hidden till then.
  put(roadBoard, { kind: 'monster', monster: m.wolf }, 1, 3, { hidden: true });
  put(roadBoard, { kind: 'monster', monster: m.wolf }, 1, 10, { hidden: true });
  addHandout(road, {
    name: 'Tobin’s Notice',
    text: 'GUARDS WANTED\nFor the road to Millbrook.\n10 gold a day, paid on arrival.\nAsk for Tobin at the Red Lantern.',
    hidden: false,
  });

  // Scene 2: the cave, dark. An entrance tunnel (west), the main chamber with a pillar, a passage, the chief's room (east).
  const den = createPlayScene(w, {
    music: music([battle, 'auto']),
    name: 'The Goblin Cave',
    encounterId: cave.id,
    width: 24 * SQUARE,
    height: 16 * SQUARE,
    background: '#3b2f25',
    grid: defaultGrid(),
    fog: defaultFog(),
    walls: [
      wall([0, 6], [6, 6], [6, 2], [15, 2], [15, 7], [18, 7], [18, 4], [23, 4], [23, 12], [18, 12], [18, 9], [15, 9], [15, 14], [6, 14], [6, 9], [0, 9]),
      wall([10, 7], [11, 7], [11, 8], [10, 8], [10, 7]),
    ],
    vision: { enabled: true, lighting: 'dark' },
  });
  const denBoard: TokenBoard = { id: den.id, worldId: w, grid: den.grid };
  put(denBoard, { kind: 'pc', pc: garrick }, 4, 7, { light: { bright: 20, dim: 20 } });
  put(denBoard, { kind: 'pc', pc: ilsa }, 3, 8, { darkvision: 60 });
  put(denBoard, { kind: 'pc', pc: hilde }, 1, 8, { darkvision: 60 });
  put(denBoard, { kind: 'pc', pc: pip }, 2, 7);
  for (const [c, r] of [[9, 5], [12, 6], [12, 10]] as const) put(denBoard, { kind: 'monster', monster: m.goblin }, c, r, { darkvision: 60 });
  put(denBoard, { kind: 'monster', monster: m.hobgoblin }, 13, 8, { darkvision: 60 });
  put(denBoard, { kind: 'monster', monster: m.chief }, 21, 8, { hidden: true, darkvision: 60, name: 'Grukk, Goblin Chief' });
  put(denBoard, { kind: 'monster', monster: m.wolf }, 20, 6, { hidden: true });
  addHandout(den, {
    name: 'A Goblin’s Map',
    text: 'Scratched on a scrap of hide:\nPast the big rock, through the squeeze.\nThe chief sleeps with the box.\nDon’t wake the dog.',
    hidden: true,
  });

  // The players: an account each (Riley, Morgan, Casey, Jamie) who made their character and joined: their sheet is
  // theirs (in their account, one of their own), and the party's (here), kept the same by the table.
  const members: string[] = [];
  for (const pc of heroes) {
    const id = await testAccount(pc.player);
    members.push(id);
    store().patch('pcs', pc.id, { ownerAccountId: id });
  }
  setMembers(store().vault.worlds[w] ?? world, members);
  // Quinn made a character too, in their own account only, and has the GM's invite: to join, bringing them.
  const quinn = await testAccount('Quinn');
  const bram = barbarian();
  store().purge('pcs', bram.id);
  await window.api.table.seed(quinn, [{ collection: 'pcs', id: bram.id, record: { ...bram, worldId: null, mine: true, ownerAccountId: quinn } }]);
  invitePlayer(store().vault.worlds[w] ?? world, useAccounts.getState().accounts.find((a) => a.id === quinn)!.email);
  await syncPlayers();
  const now = store().vault.worlds[w] ?? world;
  startScene(now, store().vault.playScenes[road.id] ?? road);
  const gm = useAccounts.getState().activeId;
  const speaker = { worldId: w, accountId: gm, who: 'GM' };
  say(speaker, 'Welcome to the demo table. Open Sheet to roll from your character (attacks, spells, checks, potions), and Chat to talk: try /r 1d20+5, /w Garrick hello, /em waves.');
  // For the GM alone.
  say(
    speaker,
    'GM notes: you can roll from anyone’s sheet, and the creatures’ on the scene. Start Combat (on the board) rolls everyone’s initiative; each player ends their own turn. Two wolves wait hidden on the west edge: show them on round 2. The Goblin Cave is the second scene, dark, with walls; the chief and its wolf are hidden in the back room. Quinn has your invite: once they join with Bram, add his token from the party.',
    [],
  );
  return now;
}
