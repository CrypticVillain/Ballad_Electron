/**
 * The name generator (Writing and D&D): names for people, places, taverns and
 * shops, and groups, in a genre's style. Pure: give it a random source (a
 * seeded one in tests) and it gives names back.
 *
 * Each genre makes people and places its own way: from syllables (Elvish,
 * Space Opera), from lists of given names and surnames (Norse, Contemporary,
 * Wild West), or both; with patronymics, clan names or epithets where the
 * genre has them. Taverns, shops and groups follow the genre's family
 * (fantasy, historical, modern, science fiction, horror) unless the genre has
 * its own.
 */

export type Rng = () => number;
export type NameKind = 'person' | 'place' | 'tavern' | 'group';
export type Gender = 'any' | 'feminine' | 'masculine';
export type Family = 'fantasy' | 'peoples' | 'historical' | 'modern' | 'scifi' | 'horror';

export type Genre = {
  id: string;
  label: string;
  family: Family;
  /** One line on what its names sound like. */
  blurb: string;
  person: (rng: Rng, gender: Gender) => string;
  place: (rng: Rng) => string;
  tavern?: (rng: Rng) => string;
  group?: (rng: Rng) => string;
};

export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'peoples', label: 'Fantasy Peoples' },
  { id: 'historical', label: 'Historical' },
  { id: 'modern', label: 'Modern' },
  { id: 'scifi', label: 'Science Fiction' },
  { id: 'horror', label: 'Horror' },
];

export const KINDS: { id: NameKind; label: string; one: string }[] = [
  { id: 'person', label: 'People', one: 'Person' },
  { id: 'place', label: 'Places', one: 'Place' },
  { id: 'tavern', label: 'Taverns & Shops', one: 'Tavern Or Shop' },
  { id: 'group', label: 'Groups', one: 'Group' },
];

// ── Random helpers ──────────────────────────────────────────────────────

/** A seeded random source (mulberry32): the same seed gives the same names. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
const chance = (rng: Rng, p: number) => rng() < p;
const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
/** Feminine or masculine, as asked (any: either). */
const side = (rng: Rng, gender: Gender): 'f' | 'm' => (gender === 'feminine' ? 'f' : gender === 'masculine' ? 'm' : chance(rng, 0.5) ? 'f' : 'm');

/** Tidies a made-up word: no letter three times running, no doubled apostrophes, capitalized. */
function tidy(word: string): string {
  return cap(
    word
      .toLowerCase()
      .replace(/([a-z])\1\1+/g, '$1$1')
      .replace(/([aiu])\1/g, '$1')
      .replace(/'+/g, "'")
      .replace(/^'|'$/g, ''),
  );
}

type Sounds = {
  start: readonly string[];
  middle: readonly string[];
  /** Endings by side; `n` fits either. */
  f: readonly string[];
  m: readonly string[];
  n?: readonly string[];
  /** How many middle syllables: [min, max]. */
  middles?: [number, number];
};

/** A word from a genre's sounds: a start, some middles, an ending (by side). */
function word(rng: Rng, sounds: Sounds, gender: Gender = 'any'): string {
  const [min, max] = sounds.middles ?? [0, 1];
  let out = pick(rng, sounds.start);
  for (let i = between(rng, min, max); i > 0; i--) out += pick(rng, sounds.middle);
  const s = side(rng, gender);
  const endings = sounds.n && chance(rng, 0.25) ? sounds.n : s === 'f' ? sounds.f : sounds.m;
  return tidy(out + pick(rng, endings));
}

const compound = (rng: Rng, first: readonly string[], second: readonly string[]) => {
  const a = pick(rng, first);
  let b = pick(rng, second);
  for (let i = 0; i < 5 && b.trim().toLowerCase() === a.trim().toLowerCase(); i++) b = pick(rng, second);
  return cap(a + b);
};

/** Two different picks from a list ("The Fox & Thistle", not "The Stag & Stag"). */
const two = (rng: Rng, list: readonly string[]): [string, string] => {
  const a = pick(rng, list);
  let b = pick(rng, list);
  for (let i = 0; i < 5 && b === a; i++) b = pick(rng, list);
  return [a, b];
};

/** English plurals for the group nouns ("Wolves", "Keys"). */
const plural = (noun: string) => (/f$/.test(noun) ? noun.replace(/f$/, 'ves') : /(s|x|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`);
const given = (rng: Rng, gender: Gender, names: { f: readonly string[]; m: readonly string[] }) => pick(rng, side(rng, gender) === 'f' ? names.f : names.m);

// ── Shared word lists ───────────────────────────────────────────────────

const ENGLISH_PLACE_A = ['Ash', 'Black', 'Bright', 'Cold', 'Elder', 'Fair', 'Frost', 'Gold', 'Green', 'Grey', 'High', 'Iron', 'Mist', 'Oak', 'Raven', 'Red', 'Salt', 'Silver', 'Stone', 'Storm', 'Thorn', 'Wolf', 'Winter', 'Amber', 'Briar', 'Dun', 'Hollow', 'Mill', 'Rook', 'Swan'];
const ENGLISH_PLACE_B = ['barrow', 'bridge', 'brook', 'burg', 'crest', 'dale', 'fall', 'fell', 'ford', 'gate', 'haven', 'hold', 'hollow', 'keep', 'march', 'mere', 'moor', 'mouth', 'reach', 'shire', 'stead', 'vale', 'watch', 'wick', 'wood', 'combe', 'ley', 'ton', 'field', 'hithe'];

const TAVERN_ADJ = ['Gilded', 'Rusty', 'Drunken', 'Sleeping', 'Laughing', 'Crooked', 'Wandering', 'Silver', 'Hungry', 'Black', 'Merry', 'Salty', 'Golden', 'Lonely', 'Howling', 'Wounded', 'Painted', 'Blind', 'Jolly', 'Last', 'Broken', 'Green', 'Copper', 'Bashful'];
const TAVERN_NOUN = ['Griffin', 'Stag', 'Lantern', 'Barrel', 'Dragon', 'Goose', 'Anchor', 'Tankard', 'Owl', 'Boar', 'Kettle', 'Crown', 'Mermaid', 'Fox', 'Raven', 'Hound', 'Wyvern', 'Candle', 'Hare', 'Badger', 'Flagon', 'Shield', 'Bell', 'Thistle'];
const SHOP_TRADE = ['Curios', 'Provisions', 'Smithy', 'Apothecary', 'Books & Scrolls', 'Tailoring', 'Cartography', 'Fine Blades', 'Candles', 'Remedies', 'Oddments', 'Bakery'];
const ORDER = ['Order', 'Brotherhood', 'Sisterhood', 'Circle', 'Company', 'Guild', 'Covenant', 'Hand', 'Watch', 'Council', 'Fellowship', 'Conclave', 'League'];
const ORDER_ADJ = ['Crimson', 'Silent', 'Gilded', 'Ashen', 'Iron', 'Hidden', 'Silver', 'Broken', 'Eternal', 'Pale', 'Burning', 'Last', 'Black', 'Seventh', 'Unseen'];
const ORDER_NOUN = ['Rose', 'Blade', 'Lantern', 'Crown', 'Serpent', 'Star', 'Key', 'Eye', 'Flame', 'Raven', 'Thorn', 'Chalice', 'Wolf', 'Veil', 'Hammer', 'Moon'];

const fantasyTavern = (rng: Rng) => {
  const roll = rng();
  if (roll < 0.55) return `The ${pick(rng, TAVERN_ADJ)} ${pick(rng, TAVERN_NOUN)}${chance(rng, 0.3) ? pick(rng, [' Inn', ' Tavern', ' Alehouse']) : ''}`;
  if (roll < 0.75) return `The ${two(rng, TAVERN_NOUN).join(' & ')}`;
  return `${pick(rng, LOW_FANTASY.f.concat(LOW_FANTASY.m))}’s ${pick(rng, SHOP_TRADE)}`;
};
const fantasyGroup = (rng: Rng) =>
  chance(rng, 0.5) ? `The ${pick(rng, ORDER)} of the ${pick(rng, ORDER_ADJ)} ${pick(rng, ORDER_NOUN)}` : `The ${pick(rng, ORDER_ADJ)} ${plural(pick(rng, ORDER_NOUN))}`;

// ── Fantasy ─────────────────────────────────────────────────────────────

const HIGH: Sounds = {
  start: ['Aer', 'Al', 'Ar', 'Bel', 'Cael', 'Cor', 'Dar', 'El', 'Ev', 'Fal', 'Gal', 'Is', 'Ith', 'Kal', 'Lor', 'Lys', 'Mar', 'Mer', 'Nim', 'Or', 'Per', 'Ser', 'Syl', 'Tal', 'Thal', 'Val', 'Vel', 'Ys'],
  middle: ['a', 'e', 'i', 'o', 'an', 'ar', 'el', 'en', 'il', 'or', 'ri', 'ra', 'the', 'va', 'ly'],
  f: ['a', 'ia', 'iel', 'ine', 'ira', 'wen', 'yne', 'elle', 'is', 'ara', 'issa', 'ea'],
  m: ['ian', 'or', 'as', 'en', 'ion', 'ric', 'dor', 'ius', 'an', 'ard', 'rin', 'oth'],
  n: ['ys', 'en', 'el'],
};
const LOW_FANTASY = {
  f: ['Agnes', 'Alys', 'Beatrix', 'Cecily', 'Edith', 'Elspeth', 'Godiva', 'Isolde', 'Joan', 'Mabel', 'Matilda', 'Maud', 'Odile', 'Rowena', 'Sybil', 'Wynne', 'Avelina', 'Emmeline', 'Ysolde', 'Marjorie', 'Hawise', 'Clemence'],
  m: ['Aldric', 'Bertram', 'Cedric', 'Edmund', 'Edwin', 'Gareth', 'Godric', 'Hugh', 'Osric', 'Oswin', 'Roland', 'Tristan', 'Walter', 'Wulfric', 'Alaric', 'Baldwin', 'Corwin', 'Geoffrey', 'Ranulf', 'Tobias', 'Merrick', 'Anselm'],
};
const OCCUPATION = ['Thatcher', 'Cooper', 'Fletcher', 'Mason', 'Tanner', 'Chandler', 'Fuller', 'Wainwright', 'Carter', 'Draper', 'Fowler', 'Sawyer', 'Webber', 'Brewer', 'Archer', 'Smith', 'Miller', 'Baker', 'Shepherd', 'Turner'];
const FANTASY_SURNAME_A = ['Ash', 'Dawn', 'Silver', 'Raven', 'Storm', 'Bright', 'Moon', 'Star', 'Gold', 'Oak', 'Thorn', 'Wind', 'Frost', 'Fair', 'High', 'Swift', 'Lion', 'Rose', 'Sun', 'Even'];
const FANTASY_SURNAME_B = ['wood', 'mere', 'brook', 'ford', 'vale', 'crest', 'wind', 'song', 'shield', 'heart', 'helm', 'water', 'field', 'blade', 'hold', 'fall', 'light', 'shade', 'bourne', 'star'];
const EPITHET = ['the Pale', 'the Red', 'the Unbowed', 'Ninefingers', 'the Hollow', 'Grimjaw', 'the Faithless', 'Blackhand', 'the Thrice-Burned', 'Oathbreaker', 'the Quiet', 'Ashborn', 'the Hanged', 'Crowsong', 'the Widow', 'Half-Blind'];

const DARK: Sounds = {
  start: ['Mor', 'Vex', 'Kael', 'Drav', 'Ul', 'Sar', 'Grim', 'Mal', 'Nyx', 'Rav', 'Skar', 'Thra', 'Vor', 'Zar', 'Ves', 'Kor', 'Ash', 'Bal', 'Cyr', 'Dre'],
  middle: ['a', 'e', 'o', 'u', 'ra', 'ze', 'ka', 'ul', 'ith', 'or', 'ag'],
  f: ['a', 'ys', 'ith', 'ara', 'ine', 'ova', 'yra', 'esse', 'eth'],
  m: ['an', 'ek', 'oth', 'us', 'ar', 'ul', 'ax', 'en', 'rik', 'orn'],
};

const FEY: Sounds = {
  start: ['Bri', 'Lil', 'Fen', 'Wy', 'Pip', 'Tam', 'Elo', 'Sil', 'Thi', 'Mo', 'Cob', 'Dew', 'Fay', 'Nim', 'Quil', 'Ro', 'Twi', 'Wil'],
  middle: ['a', 'i', 'e', 'lo', 'mi', 'ri', 'li', 'nel'],
  f: ['ette', 'bell', 'wen', 'ly', 'sy', 'ra', 'ina', 'ie', 'lyn'],
  m: ['wick', 'kin', 'ling', 'mot', 'by', 'win', 'ro', 'nip', 'dell'],
  n: ['thistle', 'ling', 'moth'],
};
const FEY_WORDS = ['Thistle', 'Moth', 'Bramble', 'Dew', 'Willow', 'Hazel', 'Puck', 'Clover', 'Nettle', 'Fern', 'Sorrel', 'Briar', 'Wisp', 'Acorn', 'Moss', 'Rue'];
const FEY_AFTER = ['down', 'whistle', 'gleam', 'foot', 'song', 'wing', 'glimmer', 'dew', 'bloom', 'shade'];

// ── Fantasy peoples ─────────────────────────────────────────────────────

const ELVISH: Sounds = {
  start: ['Ae', 'Ela', 'Il', 'Sy', 'Tha', 'Ara', 'Cae', 'Eli', 'Fae', 'Gala', 'Ilu', 'Lae', 'Mira', 'Nae', 'Qui', 'Rho', 'Sae', 'Thae', 'Vae', 'Ya'],
  middle: ['l', 'r', 'th', 'n', 'ri', 'la', 'le', 'ndr', 'ss', 'v'],
  f: ['iel', 'wyn', 'ith', 'ara', 'ielle', 'is', 'aea', 'ira', 'enna', 'ye'],
  m: ['ion', 'or', 'as', 'ar', 'eth', 'ian', 'il', 'orn', 'iar', 'en'],
  middles: [1, 1],
};
const ELVEN_SURNAME_A = ['Moon', 'Star', 'Leaf', 'Silver', 'Dawn', 'Mist', 'Night', 'Sun', 'Wind', 'Dew', 'Gold', 'Amber', 'Willow', 'Morning', 'Shadow'];
const ELVEN_SURNAME_B = ['whisper', 'leaf', 'song', 'bough', 'glade', 'shadow', 'fall', 'brook', 'petal', 'light', 'veil', 'thorn', 'wander', 'bloom', 'river'];

const DWARVISH: Sounds = {
  start: ['Bal', 'Dur', 'Gim', 'Thor', 'Kar', 'Brom', 'Dag', 'Har', 'Mor', 'Rur', 'Tor', 'Vond', 'Bel', 'Dis', 'Gun', 'Hild', 'Ilde', 'Kath', 'Ris', 'Brot'],
  middle: ['a', 'i', 'o', 'u'],
  f: ['a', 'ild', 'ra', 'ia', 'dis', 'una', 'eth', 'grid'],
  m: ['in', 'ur', 'ek', 'or', 'im', 'ar', 'ok', 'gar', 'rik', 'dun'],
};
const CLAN_A = ['Iron', 'Stone', 'Deep', 'Forge', 'Gold', 'Granite', 'Anvil', 'Coal', 'Battle', 'Bronze', 'Ember', 'Rock', 'Hammer', 'Black', 'Copper'];
const CLAN_B = ['fist', 'beard', 'delver', 'hammer', 'shield', 'brow', 'mantle', 'forge', 'breaker', 'helm', 'vein', 'heart', 'axe', 'braid', 'born'];

const HALFLING = {
  f: ['Rosie', 'Tilly', 'Cora', 'Lavinia', 'Petunia', 'Daisy', 'Marigold', 'Poppy', 'Hazel', 'Jessamine', 'Wren', 'Clover', 'Bree', 'Myrtle', 'Ivy', 'Pansy'],
  m: ['Pip', 'Milo', 'Wendel', 'Finnan', 'Osborn', 'Hob', 'Bertram', 'Tobin', 'Cade', 'Jasper', 'Barnaby', 'Roscoe', 'Merric', 'Tolman', 'Wilber', 'Ned'],
};
const HALFLING_A = ['Tea', 'Under', 'Good', 'Thistle', 'Tall', 'Brush', 'High', 'Apple', 'Honey', 'Green', 'Quick', 'Mug', 'Hill', 'Butter', 'Bramble'];
const HALFLING_B = ['leaf', 'bough', 'barrel', 'down', 'foot', 'gather', 'hill', 'bottle', 'wick', 'bottom', 'kettle', 'pot', 'brook', 'burrow', 'cake'];

const ORCISH: Sounds = {
  start: ['Gr', 'Ur', 'Mog', 'Thrak', 'Gash', 'Kr', 'Bol', 'Dru', 'Gul', 'Har', 'Lug', 'Mur', 'Rag', 'Sha', 'Vog', 'Zug', 'Bag', 'Yar'],
  middle: ['a', 'o', 'u', 'ga', 'ro', 'uk', 'th'],
  f: ['a', 'ka', 'ha', 'gra', 'ruh', 'ka', 'ura', 'ish'],
  m: ['ak', 'uk', 'ash', 'og', 'nar', 'gul', 'rok', 'ush', 'mak', 'ror'],
};
const ORC_CLAN_A = ['Blood', 'Bone', 'Skull', 'Iron', 'Black', 'Red', 'Broken', 'Grim', 'Rot', 'War', 'Ash', 'Storm'];
const ORC_CLAN_B = ['tusk', 'gnaw', 'fang', 'maw', 'hand', 'eye', 'splitter', 'crusher', 'tooth', 'claw', 'hide', 'howl'];

const DRACONIC: Sounds = {
  start: ['Ar', 'Bal', 'Kri', 'Ses', 'Thar', 'Dra', 'Gha', 'Ker', 'Med', 'Nal', 'Rho', 'Sor', 'Tor', 'Vys', 'Zor', 'Hesk', 'Ixa', 'Kav'],
  middle: ['a', 'e', 'i', 'o', 'ra', 'ka', 'sha', 'tha', 'va', 're'],
  f: ['ax', 'ix', 'yth', 'ira', 'esh', 'anna', 'ra', 'ys', 'thys'],
  m: ['ax', 'ix', 'orn', 'yth', 'ash', 'ar', 'esh', 'or', 'uth'],
  middles: [1, 2],
};
const INFERNAL: Sounds = {
  start: ['Ak', 'Ba', 'Mal', 'Zar', 'Kri', 'Ny', 'Ori', 'Ska', 'Leu', 'Mor', 'Dam', 'Ekh', 'Ia', 'Kal', 'Ran', 'Vel'],
  middle: ['a', 'e', 'i', 'ro', 'ze', 'th', 'ka', 'ly'],
  f: ['ia', 'ys', 'ka', 'eth', 'ira', 'ari', 'issa', 'ne'],
  m: ['ath', 'os', 'akos', 'ius', 'oth', 'ek', 'emon', 'ias'],
};
const VIRTUES = ['Hope', 'Sorrow', 'Ember', 'Reverie', 'Torment', 'Temperance', 'Glory', 'Mercy', 'Despair', 'Ideal', 'Quest', 'Song', 'Vigil', 'Wander', 'Fear', 'Faith', 'Nowhere', 'Patience', 'Valor', 'Solace', 'Ruin'];

// ── Historical ──────────────────────────────────────────────────────────

const NORSE = {
  f: ['Astrid', 'Sigrid', 'Freydis', 'Ingrid', 'Gunnhild', 'Ragnhild', 'Thyra', 'Solveig', 'Hilda', 'Ylva', 'Runa', 'Alfhild', 'Gudrun', 'Thora', 'Svanhild', 'Ase', 'Brynja', 'Eira'],
  m: ['Bjorn', 'Leif', 'Ivar', 'Gunnar', 'Ulf', 'Halvar', 'Sigurd', 'Eirik', 'Harald', 'Torsten', 'Arne', 'Knut', 'Rolf', 'Sten', 'Thorvald', 'Vidar', 'Orm', 'Hakon', 'Asger', 'Ketil'],
};
const NORSE_EPITHET = ['the Red', 'Ironside', 'the Fair', 'Bloodaxe', 'the Wanderer', 'Fork-Beard', 'the Silent', 'Sea-Wolf', 'the Tall', 'Skull-Splitter', 'the Lucky', 'Raven-Feeder'];
const NORSE_PLACE_A = ['Hrafn', 'Skog', 'Ulf', 'Fjall', 'Sval', 'Grim', 'Thor', 'Kald', 'Hvit', 'Sand', 'Birk', 'Jarn'];
const NORSE_PLACE_B = ['heim', 'vik', 'fjord', 'stad', 'holt', 'dal', 'nes', 'by', 'gard', 'havn'];

const CELTIC = {
  f: ['Aoife', 'Brigid', 'Niamh', 'Siobhan', 'Maeve', 'Eithne', 'Gwen', 'Morwenna', 'Tegan', 'Ailsa', 'Rhiannon', 'Deirdre', 'Fiona', 'Isolt', 'Branwen', 'Orla', 'Cerys', 'Saoirse'],
  m: ['Fionn', 'Cormac', 'Ciaran', 'Declan', 'Bran', 'Oisin', 'Rhys', 'Cathal', 'Eoin', 'Lorcan', 'Tadhg', 'Dafydd', 'Owain', 'Aed', 'Niall', 'Conall', 'Emrys', 'Kieran'],
};
const CELTIC_SURNAMES = ['Brennan', 'Doyle', 'Kearney', 'Llewellyn', 'Pryce', 'Gallagher', 'Morgan', 'Connolly', 'Quinlan', 'Rourke', 'Madoc', 'Cadogan', 'Flanagan', 'Tierney', 'Vaughan'];
const CELTIC_PLACE_A = ['Kil', 'Dun', 'Bally', 'Glen', 'Inis', 'Aber', 'Llan', 'Tre', 'Pen', 'Ard', 'Caer', 'Ros'];
const CELTIC_PLACE_B = ['more', 'carrig', 'gowan', 'dare', 'avon', 'teg', 'wyn', 'lough', 'rath', 'dale', 'owen', 'fern'];

const CLASSICAL = {
  f: ['Livia', 'Aurelia', 'Cassia', 'Helena', 'Octavia', 'Thalia', 'Corvina', 'Drusilla', 'Junia', 'Lucilla', 'Penelope', 'Phoebe', 'Valeria', 'Xanthe', 'Daphne', 'Claudia'],
  m: ['Lucius', 'Marcus', 'Cassius', 'Titus', 'Lysander', 'Theron', 'Philon', 'Quintus', 'Gaius', 'Decimus', 'Leander', 'Nikias', 'Septimus', 'Aurelian', 'Damon', 'Felix'],
};
const CLASSICAL_SURNAMES = ['Varro', 'Aquila', 'Severus', 'Corvinus', 'Flavius', 'Maximus', 'Agrippa', 'Albinus', 'Crispus', 'Galba', 'Lepidus', 'Paullus', 'Sabinus', 'Vitellius', 'Nerva', 'Rufus'];
const CLASSICAL_PLACE = { start: ['Aqu', 'Cor', 'Lyr', 'Myr', 'Ner', 'Pel', 'Sal', 'Tar', 'Thes', 'Val', 'Ves', 'Ost'], middle: ['a', 'i', 'o', 'en', 'ar'], f: ['ia', 'os', 'ae', 'um', 'polis', 'ium'], m: ['ia', 'os', 'ae', 'um', 'polis', 'ium'] };

const VICTORIAN = {
  f: ['Ada', 'Beatrice', 'Clara', 'Edith', 'Florence', 'Harriet', 'Lavinia', 'Mabel', 'Ophelia', 'Theodora', 'Winifred', 'Euphemia', 'Henrietta', 'Constance', 'Violet', 'Imogen', 'Lydia', 'Prudence'],
  m: ['Ambrose', 'Barnaby', 'Cornelius', 'Edmund', 'Horace', 'Jasper', 'Silas', 'Thaddeus', 'Percival', 'Augustus', 'Bartholomew', 'Algernon', 'Ezra', 'Montague', 'Reginald', 'Septimus', 'Lucian', 'Rupert'],
};
const VICTORIAN_SURNAMES = ['Ashcombe', 'Blackwood', 'Crane', 'Ellsworth', 'Hargreave', 'Pemberton', 'Thorne', 'Whitlock', 'Vane', 'Grimsby', 'Fairfax', 'Holloway', 'Lockwood', 'Marchbanks', 'Ravenscroft', 'Sutherland', 'Wexley', 'Carrow'];
const VICTORIAN_PLACE_A = ['Black', 'Raven', 'Ash', 'Thorn', 'Grey', 'Wych', 'Crow', 'Mourn', 'Hol', 'Fog', 'Elm', 'Lamp'];
const VICTORIAN_PLACE_B = [' Hall', ' Manor', ' Abbey', ' Lane', ' Court', ' House', 'wick', 'combe', 'ley', ' Street', ' Square', ' Grange'];

const WESTERN = {
  f: ['Annie', 'Clementine', 'Josephine', 'Mae', 'Pearl', 'Ruby', 'Sadie', 'Eliza', 'Hattie', 'Lottie', 'Opal', 'Belle', 'Ida', 'Etta', 'Della', 'Nell'],
  m: ['Wyatt', 'Jesse', 'Cody', 'Eli', 'Hank', 'Silas', 'Virgil', 'Clay', 'Boone', 'Cole', 'Amos', 'Ike', 'Jeb', 'Luther', 'Rufus', 'Tom', 'Walt', 'Zeke'],
};
const WESTERN_SURNAMES = ['Callahan', 'Dawson', 'Garrett', 'Holt', 'McCready', 'Rourke', 'Shaw', 'Tate', 'Burnett', 'Colby', 'Harlan', 'Maddox', 'Pruitt', 'Reyes', 'Stockton', 'Yates', 'Whitaker', 'Lowry'];
const NICKNAMES = ['Dusty', 'Lucky', 'Two-Bit', 'Doc', 'Kid', 'Slim', 'Red', 'Whiskey', 'Deadeye', 'Sunday', 'Preacher', 'Smokey'];
const WESTERN_PLACE_A = ['Dry', 'Dead', 'Lone', 'Red', 'Sweet', 'Silver', 'Copper', 'Dust', 'Rattle', 'Broken', 'Coyote', 'Buzzard', 'Sundown', 'Tumble'];
const WESTERN_PLACE_B = [' Gulch', ' Creek', ' Springs', ' Butte', ' Flats', ' Rock', ' Junction', ' Mesa', ' Crossing', ' Wells', ' Bend', ' Canyon'];

const PIRATE = {
  f: ['Anne', 'Grace', 'Mary', 'Bess', 'Molly', 'Jenny', 'Kate', 'Nan', 'Peg', 'Rosa', 'Sally', 'Lucinda'],
  m: ['Jack', 'Will', 'Edward', 'Bart', 'Ned', 'Silas', 'Benjamin', 'Hector', 'Jonah', 'Thomas', 'Bastian', 'Cormac'],
};
const PIRATE_EPITHET = ['Blackheart', 'One-Eye', 'the Drowned', 'Saltbeard', 'Redcoat', 'Gunpowder', 'Half-Hand', 'the Gull', 'Barnacle', 'Long-Shot', 'Rumbelly', 'Bilgewater', 'the Kraken', 'Cutlass'];
const SHIPS_A = ['Black', 'Crimson', 'Sea', 'Storm', 'Salt', 'Silver', 'Widow’s', 'Devil’s', 'Mermaid’s', 'Golden', 'Ghost', 'Queen’s'];
const SHIPS_B = ['Revenge', 'Kiss', 'Fortune', 'Serpent', 'Gale', 'Lady', 'Dagger', 'Wake', 'Folly', 'Siren', 'Tide', 'Wrath'];

// ── Modern ──────────────────────────────────────────────────────────────

const CONTEMPORARY = {
  f: ['Maya', 'Zoe', 'Priya', 'Amara', 'Sofia', 'Leila', 'Mei', 'Hana', 'Chloe', 'Nadia', 'Isabel', 'Ava', 'Grace', 'Imani', 'Lucia', 'Naomi', 'Rosa', 'Sasha', 'Tessa', 'Yara', 'Ingrid', 'Keiko', 'Olivia', 'Marisol'],
  m: ['Liam', 'Noah', 'Mateo', 'Ethan', 'Omar', 'Kai', 'Ravi', 'Daniel', 'Theo', 'Malik', 'Jonah', 'Diego', 'Felix', 'Hugo', 'Ezra', 'Sam', 'Arjun', 'Lucas', 'Kenji', 'Tomas', 'Andre', 'Elias', 'Kofi', 'Owen'],
};
const CONTEMPORARY_SURNAMES = ['Alvarez', 'Bennett', 'Chen', 'Diaz', 'Fischer', 'Gallagher', 'Hughes', 'Kim', 'Kowalski', 'Lindqvist', 'Morales', 'Nakamura', 'Okafor', 'Patel', 'Quinn', 'Reyes', 'Sato', 'Sullivan', 'Torres', 'Walsh', 'Yilmaz', 'Zhang', 'Novak', 'Haddad', 'Mensah', 'Brooks', 'Carter', 'Ferreira', 'Iqbal', 'Larsen'];
const TOWN_A = ['Cedar', 'Maple', 'Willow', 'Pine', 'River', 'Lake', 'Spring', 'Fair', 'Oak', 'Elm', 'Green', 'Clear', 'Harbor', 'Silver', 'Stone', 'Brook'];
const TOWN_B = [' Falls', ' Grove', 'ville', 'ton', ' Springs', ' Hollow', ' Heights', ' Creek', 'field', ' Park', ' Point', ' Bay', 'dale', ' Ridge'];
const MODERN_VENUE = ['Diner', 'Bar & Grill', 'Coffee', 'Books', 'Pub', 'Bakery', 'Records', 'Hardware', 'Laundromat', 'Pizza', 'Florist', 'Motel'];
const COMPANY = ['Holdings', 'Group', 'Partners', 'Industries', 'Analytics', 'Labs', 'Media', 'Capital', 'Logistics', 'Studios', 'Collective'];
const COMPANY_WORD = ['Northwind', 'Bluefield', 'Keystone', 'Meridian', 'Halcyon', 'Ironbridge', 'Lumen', 'Summit', 'Brightwater', 'Granite', 'Parallel', 'Harbor'];

const NOIR = {
  f: ['Vera', 'Dolores', 'Rita', 'Lola', 'Veronica', 'Ida', 'Marlene', 'Gloria', 'Ruth', 'Bette', 'Lana', 'Mona', 'Velma', 'Hazel', 'June', 'Faye'],
  m: ['Nick', 'Frank', 'Sal', 'Vincent', 'Lou', 'Eddie', 'Max', 'Rocco', 'Joe', 'Leo', 'Augie', 'Benny', 'Carmine', 'Dutch', 'Harry', 'Mickey'],
};
const NOIR_SURNAMES = ['Malone', 'Delaney', 'Moretti', 'Costello', 'Sharkey', 'Brannigan', 'Falco', 'Mulligan', 'Kovac', 'Rinaldi', 'Callaway', 'Doyle', 'Lombardi', 'Novak', 'Quill', 'Sloane', 'Vance', 'Keogh'];
const NOIR_NICK = ['Lucky', 'the Knife', 'Fingers', 'Ace', 'Smiles', 'Bugsy', 'the Priest', 'Babyface', 'Two-Tone', 'Velvet'];
const STREETS = ['Mercy', 'Canal', 'Union', 'Harbor', 'Fulton', 'Grand', 'Bleecker', 'Water', 'Mulberry', 'Ninth', 'Delancey', 'Rivera'];
const NOIR_PLACE_B = [' Street', ' Avenue', ' Docks', ' Heights', ' Station', ' Pier', ' Row', ' Hotel', ' Club', ' Arms'];

// ── Science fiction ─────────────────────────────────────────────────────

const SPACE: Sounds = {
  start: ['Ka', 'Zan', 'Ve', 'Or', 'Tal', 'Ix', 'Ny', 'Sol', 'Ry', 'Cas', 'Dex', 'Ela', 'Jax', 'Kor', 'Lyr', 'Mae', 'Nova', 'Qua', 'Sev', 'Tor', 'Vex', 'Zeph'],
  middle: ['a', 'e', 'i', 'o', 'ra', 'ri', 'tan', 'lo', 'x', 'ne'],
  f: ['ra', 'ys', 'ia', 'ane', 'ix', 'a', 'eth', 'ira', 'elle'],
  m: ['on', 'ix', 'ar', 'us', 'en', 'or', 'ek', 'an', 'ius'],
  n: ['ix', 'en', 'is'],
};
const SPACE_PLACE_B = [' Prime', ' IV', ' VII', ' Station', ' Reach', ' Drift', ' Outpost', ' Minor', ' Gate', ' Belt', ' Colony', ' Expanse'];
const SPACE_BAR_A = ['Broken', 'Ninth', 'Rusty', 'Zero-G', 'Blue', 'Last', 'Wandering', 'Red-Shift', 'Silent', 'Lucky'];
const SPACE_BAR_B = ['Orbit', 'Comet', 'Satellite', 'Dock', 'Nebula', 'Airlock', 'Moon', 'Thruster', 'Beacon', 'Asteroid'];
const CORP_B = ['Dynamics', 'Systems', 'Corp', 'Industries', 'Biotech', 'Aerospace', 'Combine', 'Holdings', 'Consortium', 'Tek'];

const CYBER = {
  f: ['Nova', 'Kira', 'Echo', 'Lux', 'Ivy', 'Rhea', 'Zara', 'Mika', 'Juno', 'Sable', 'Vee', 'Nyx'],
  m: ['Jax', 'Rook', 'Vex', 'Zed', 'Cass', 'Dex', 'Kade', 'Ryo', 'Silas', 'Taz', 'Wire', 'Ozzy'],
};
const HANDLES = ['Glitch', 'Neon', 'Static', 'Cipher', 'Chrome', 'Patch', 'Zero', 'Spark', 'Ghost', 'Hex', 'Byte', 'Razor', 'Fuse', 'Proxy', 'Null', 'Vandal'];
const CYBER_PLACE_A = ['Neon', 'Chrome', 'Rust', 'Glass', 'Zero', 'Ghost', 'Static', 'Black', 'Vapor', 'Signal', 'Lower', 'Upper'];
const CYBER_PLACE_B = [' Row', ' Stacks', ' Sprawl', ' Market', ' Strip', ' Arcology', ' Heights', ' Docks', ' Canyon', ' Block'];

const WASTELAND = {
  f: ['Ash', 'Wren', 'Ivy', 'Sparrow', 'Dusty', 'Junebug', 'Rae', 'Scout', 'Tallow', 'Echo', 'Lark', 'Penny'],
  m: ['Rust', 'Tank', 'Flint', 'Bolt', 'Dutch', 'Grit', 'Hawk', 'Jinx', 'Moss', 'Rook', 'Tinker', 'Gauge'],
};
const WASTELAND_SURNAMES = ['Ninefingers', 'Saltwater', 'Mile-Twelve', 'Coldiron', 'Gasoline', 'Two-Roads', 'Bonedry', 'Sixgun', 'Rainmaker', 'Scrapper', 'Longhaul', 'Ironlung'];
const WASTE_PLACE_A = ['Rust', 'Ash', 'Bone', 'Scrap', 'Dust', 'Glass', 'Salt', 'Dead', 'Tin', 'Cinder', 'Last', 'Hollow'];
const WASTE_PLACE_B = [' Hollow', 'town', ' Pit', ' Yard', ' Flats', ' Sprawl', ' Haven', ' Crater', ' Dam', ' Mile'];

// ── Horror ──────────────────────────────────────────────────────────────

const PURITAN = {
  f: ['Abigail', 'Mercy', 'Prudence', 'Hester', 'Temperance', 'Charity', 'Patience', 'Constance', 'Jerusha', 'Thankful', 'Remember', 'Silence'],
  m: ['Obadiah', 'Ezekiel', 'Jedediah', 'Josiah', 'Elias', 'Nathaniel', 'Gideon', 'Ichabod', 'Zebulon', 'Asa', 'Enoch', 'Malachi'],
};
const PURITAN_SURNAMES = ['Thorne', 'Hawthorne', 'Blackmoor', 'Winthrop', 'Pell', 'Cobb', 'Larkin', 'Ward', 'Ashby', 'Corwin', 'Danforth', 'Gale', 'Hale', 'Mather', 'Sewall', 'Fenn'];
const HORROR_PLACE_A = ['Black', 'Gray', 'Salt', 'Drown', 'Hollow', 'Dread', 'Raven', 'Mourn', 'Fog', 'Wither', 'Shroud', 'Grave'];
const HORROR_PLACE_B = ['mouth', 'ham', 'wick', 'port', ' Hollow', 'mere', 'marsh', ' Point', 'bury', ' Falls'];
const ELDRITCH: Sounds = {
  start: ["Ny'", "Xul'", 'Yth', "Zha'", 'Gol', "K'th", 'Ulth', "Ia'", 'Shub', 'Vor', "Tsa'", 'Ghaa'],
  middle: ['a', 'o', 'u', 'ag', 'ul', 'ra', 'lo', 'go'],
  f: ['oth', 'ath', 'ul', 'ys', 'ogg', 'ah', 'ith'],
  m: ['oth', 'ath', 'ul', 'ys', 'ogg', 'ah', 'ith'],
  middles: [1, 2],
};

// ── The genres ──────────────────────────────────────────────────────────

/** "Given Surname", with the genre's way of making surnames. */
const full = (first: string, last: string) => `${first} ${last}`;

export const GENRES: Genre[] = [
  // Fantasy
  {
    id: 'high-fantasy',
    label: 'High Fantasy',
    family: 'fantasy',
    blurb: 'Melodic, heroic names for kingdoms and legends: Seraphine Dawnmere, Calidor Starshield.',
    person: (rng, g) => full(word(rng, HIGH, g), compound(rng, FANTASY_SURNAME_A, FANTASY_SURNAME_B)),
    place: (rng) => (chance(rng, 0.5) ? compound(rng, ENGLISH_PLACE_A, ENGLISH_PLACE_B) : word(rng, HIGH)),
  },
  {
    id: 'low-fantasy',
    label: 'Low Fantasy & Medieval',
    family: 'fantasy',
    blurb: 'Grounded, old-English names for villages and mud: Maud Thatcher, Osric of Millford.',
    person: (rng, g) => (chance(rng, 0.25) ? `${given(rng, g, LOW_FANTASY)} of ${compound(rng, ENGLISH_PLACE_A, ENGLISH_PLACE_B)}` : full(given(rng, g, LOW_FANTASY), pick(rng, OCCUPATION))),
    place: (rng) => compound(rng, ENGLISH_PLACE_A, ENGLISH_PLACE_B),
  },
  {
    id: 'dark-fantasy',
    label: 'Dark Fantasy',
    family: 'fantasy',
    blurb: 'Harsh sounds and grim epithets: Vexara the Hollow, Morrik Blackhand.',
    person: (rng, g) => full(word(rng, DARK, g), chance(rng, 0.6) ? pick(rng, EPITHET) : compound(rng, ['Grave', 'Ash', 'Blood', 'Crow', 'Gall', 'Rot', 'Hollow', 'Ember'], ['mourn', 'thorn', 'hand', 'wake', 'gloom', 'bane', 'scar'])),
    place: (rng) => compound(rng, ['Grave', 'Ash', 'Blood', 'Crow', 'Dread', 'Mourn', 'Rot', 'Hollow', 'Black', 'Wither', 'Gallows', 'Bone'], ENGLISH_PLACE_B),
    group: (rng) => (chance(rng, 0.5) ? `The ${pick(rng, ['Ashen', 'Hollow', 'Black', 'Drowned', 'Hanged', 'Pale', 'Last'])} ${pick(rng, ['Company', 'Choir', 'Host', 'Court', 'Brotherhood', 'Covenant'])}` : fantasyGroup(rng)),
  },
  {
    id: 'fey',
    label: 'Fey & Faerie',
    family: 'fantasy',
    blurb: 'Light, whimsical names of the hedge and the wild: Briarwen Thistledown, Cobwick.',
    person: (rng, g) => (chance(rng, 0.6) ? full(word(rng, FEY, g), compound(rng, FEY_WORDS, FEY_AFTER)) : word(rng, FEY, g)),
    place: (rng) => `${compound(rng, FEY_WORDS, FEY_AFTER)} ${pick(rng, ['Glen', 'Hollow', 'Ring', 'Dell', 'Wood', 'Mound', 'Glade'])}`,
    tavern: (rng) => `The ${pick(rng, ['Dewdrop', 'Toadstool', 'Acorn', 'Moonlit', 'Thimble', 'Bumblebee', 'Willow'])} ${pick(rng, ['Cup', 'Tea House', 'Hollow', 'Nook', 'Larder', 'Burrow'])}`,
    group: (rng) => `The ${pick(rng, ['Seelie', 'Unseelie', 'Gloaming', 'Summer', 'Winter', 'Thorn', 'Twilight'])} ${pick(rng, ['Court', 'Revel', 'Circle', 'Ring', 'Host'])}`,
  },
  // Fantasy peoples
  {
    id: 'elvish',
    label: 'Elvish',
    family: 'peoples',
    blurb: 'Flowing names with a sense of age: Ilythriel Moonwhisper, Caelorn Leafsong.',
    person: (rng, g) => full(word(rng, ELVISH, g), compound(rng, ELVEN_SURNAME_A, ELVEN_SURNAME_B)),
    place: (rng) => word(rng, { ...ELVISH, f: ['thil', 'wen', 'lith', 'ara', 'ndor', 'elle', 'oria'], m: ['thil', 'wen', 'lith', 'ara', 'mir', 'oria'] }),
    tavern: (rng) => `The ${pick(rng, ['Starlit', 'Silver', 'Moonlit', 'Whispering', 'Evergreen'])} ${pick(rng, ['Bough', 'Fountain', 'Harp', 'Glade', 'Lantern'])}`,
  },
  {
    id: 'dwarvish',
    label: 'Dwarvish',
    family: 'peoples',
    blurb: 'Hard consonants and clan names from the deep halls: Brommek Ironfist, Hilda Deepdelver.',
    person: (rng, g) => full(word(rng, DWARVISH, g), compound(rng, CLAN_A, CLAN_B)),
    place: (rng) => (chance(rng, 0.5) ? `${word(rng, DWARVISH, 'masculine')}${pick(rng, [' Deep', ' Hold', ' Halls', ' Delve', ' Forge', ' Mount'])}` : compound(rng, CLAN_A, ['deep', 'hold', 'hall', 'delve', 'gate', 'peak'])),
    tavern: (rng) => `The ${pick(rng, ['Iron', 'Stone', 'Rusty', 'Foaming', 'Broken'])} ${pick(rng, ['Anvil', 'Pick', 'Tankard', 'Keg', 'Hammer', 'Bellows'])}`,
    group: (rng) => `Clan ${compound(rng, CLAN_A, CLAN_B)}`,
  },
  {
    id: 'halfling',
    label: 'Halfling',
    family: 'peoples',
    blurb: 'Cosy, homely names with a full pantry: Poppy Underbough, Milo Goodbarrel.',
    person: (rng, g) => full(given(rng, g, HALFLING), compound(rng, HALFLING_A, HALFLING_B)),
    place: (rng) => `${compound(rng, HALFLING_A, HALFLING_B)} ${pick(rng, ['End', 'Green', 'Hill', 'Bottom', 'Row', 'Meadow'])}`,
    tavern: (rng) => `The ${pick(rng, ['Plump', 'Sleepy', 'Golden', 'Hungry', 'Merry'])} ${pick(rng, ['Pie', 'Teapot', 'Hen', 'Pantry', 'Pig', 'Sausage'])}`,
  },
  {
    id: 'orcish',
    label: 'Orcish',
    family: 'peoples',
    blurb: 'Guttural names and clan marks: Thrakkash Bloodtusk, Grukha of the Bonegnaw.',
    person: (rng, g) => (chance(rng, 0.5) ? full(word(rng, ORCISH, g), compound(rng, ORC_CLAN_A, ORC_CLAN_B)) : `${word(rng, ORCISH, g)} of the ${compound(rng, ORC_CLAN_A, ORC_CLAN_B)}`),
    place: (rng) => `${word(rng, ORCISH, 'masculine')}${pick(rng, [' Gorge', ' Camp', ' Spire', ' Wastes', ' Pit', ' Hold'])}`,
    group: (rng) => `The ${compound(rng, ORC_CLAN_A, ORC_CLAN_B)} ${pick(rng, ['Clan', 'Horde', 'Tribe', 'Warband'])}`,
  },
  {
    id: 'draconic',
    label: 'Draconic',
    family: 'peoples',
    blurb: 'Hissing, ancient names for dragons and dragonborn: Kriseshax, Tharavyth of clan Sorrash.',
    person: (rng, g) => (chance(rng, 0.6) ? `${word(rng, DRACONIC, g)} of clan ${word(rng, DRACONIC, 'masculine')}` : word(rng, DRACONIC, g)),
    place: (rng) => `${word(rng, DRACONIC)}${pick(rng, [' Peak', ' Caldera', ' Spire', ' Lair', ' Aerie'])}`,
  },
  {
    id: 'infernal',
    label: 'Infernal & Tiefling',
    family: 'peoples',
    blurb: 'Infernal names, or a virtue taken as a name: Akmenos, Zarethia, Reverie, Ember.',
    person: (rng, g) => (chance(rng, 0.4) ? pick(rng, VIRTUES) : word(rng, INFERNAL, g)),
    place: (rng) => `${word(rng, INFERNAL)}${pick(rng, [' Pits', ' Gate', ' Abyss', ' Throne', ' Furnace', ' Reach'])}`,
    group: (rng) => `The ${pick(rng, ['Ninth', 'Brass', 'Burning', 'Silver-Tongued', 'Chained'])} ${pick(rng, ['Pact', 'Contract', 'Court', 'Choir', 'Legion'])}`,
  },
  // Historical
  {
    id: 'norse',
    label: 'Norse',
    family: 'historical',
    blurb: 'Saga names with a patronymic or an epithet: Astrid Bjornsdottir, Ivar the Lucky.',
    person: (rng, g) => {
      const s = side(rng, g);
      const name = pick(rng, s === 'f' ? NORSE.f : NORSE.m);
      if (chance(rng, 0.3)) return `${name} ${pick(rng, NORSE_EPITHET)}`;
      return `${name} ${pick(rng, NORSE.m)}${s === 'f' ? 'sdottir' : 'sson'}`;
    },
    place: (rng) => compound(rng, NORSE_PLACE_A, NORSE_PLACE_B),
    tavern: (rng) => `The ${pick(rng, ['Mead', 'Long', 'Ale', 'Feast', 'Wolf'])} ${pick(rng, ['Hall', 'Horn', 'House', 'Hearth'])}`,
    group: (rng) => `The ${pick(rng, ['Sea', 'Raven', 'Iron', 'Storm', 'Bear'])} ${pick(rng, ['Raiders', 'Wolves', 'Shields', 'Jarls', 'Brothers'])}`,
  },
  {
    id: 'celtic',
    label: 'Celtic',
    family: 'historical',
    blurb: 'Irish, Scottish and Welsh-inspired names: Aoife Mac Conall, Rhys Llewellyn.',
    person: (rng, g) => {
      const name = given(rng, g, CELTIC);
      const roll = rng();
      if (roll < 0.35) return `${name} ${pick(rng, ['Mac ', 'O’'])}${pick(rng, CELTIC.m)}`;
      return full(name, pick(rng, CELTIC_SURNAMES));
    },
    place: (rng) => compound(rng, CELTIC_PLACE_A, CELTIC_PLACE_B),
  },
  {
    id: 'classical',
    label: 'Greco-Roman',
    family: 'historical',
    blurb: 'Names of the forum and the agora: Livia Aquila, Lysander Severus.',
    person: (rng, g) => full(given(rng, g, CLASSICAL), pick(rng, CLASSICAL_SURNAMES)),
    place: (rng) => word(rng, CLASSICAL_PLACE),
    tavern: (rng) => `The ${pick(rng, ['Laurel', 'Amphora', 'Golden Vine', 'Olive', 'Bronze Bull'])}${chance(rng, 0.4) ? ' Taberna' : ''}`,
    group: (rng) => `The ${pick(rng, ['Ninth', 'Twelfth', 'Silver', 'Golden', 'Iron'])} ${pick(rng, ['Legion', 'Senate', 'Cohort', 'Guild', 'Order'])}`,
  },
  {
    id: 'victorian',
    label: 'Victorian & Gothic',
    family: 'historical',
    blurb: 'Gaslit, buttoned-up names: Ophelia Ravenscroft, Thaddeus Pemberton.',
    person: (rng, g) => full(given(rng, g, VICTORIAN), pick(rng, VICTORIAN_SURNAMES)),
    place: (rng) => compound(rng, VICTORIAN_PLACE_A, VICTORIAN_PLACE_B),
    tavern: (rng) => `The ${pick(rng, ['Black', 'Red', 'White', 'Old', 'Gaslit', 'Crooked', 'Drowsy', 'Gentleman’s', 'Lamplighter’s', 'Royal'])} ${pick(rng, ['Swan', 'Lion', 'Bell', 'Crown', 'Rest', 'Arms', 'Hart', 'Lamp', 'Whistle', 'Raven'])}`,
    group: (rng) => `The ${pick(rng, ['Royal', 'Midnight', 'Antiquarian', 'Hermetic', 'Gentlemen’s'])} ${pick(rng, ['Society', 'Club', 'Order', 'Institute', 'Circle'])}`,
  },
  {
    id: 'western',
    label: 'Wild West',
    family: 'historical',
    blurb: 'Frontier names, sometimes with a nickname: Clementine “Lucky” Shaw, Wyatt Holt.',
    person: (rng, g) => {
      const name = given(rng, g, WESTERN);
      const last = pick(rng, WESTERN_SURNAMES);
      return chance(rng, 0.3) ? `${name} “${pick(rng, NICKNAMES)}” ${last}` : full(name, last);
    },
    place: (rng) => compound(rng, WESTERN_PLACE_A, WESTERN_PLACE_B),
    tavern: (rng) => `The ${pick(rng, ['Golden', 'Dusty', 'Lucky', 'Rusty', 'Last Chance'])} ${pick(rng, ['Spur', 'Nugget', 'Horseshoe', 'Saloon', 'Mule'])}`,
    group: (rng) => `The ${pick(rng, WESTERN_SURNAMES)} ${pick(rng, ['Gang', 'Boys', 'Outfit', 'Posse'])}`,
  },
  {
    id: 'pirate',
    label: 'Pirates & High Seas',
    family: 'historical',
    blurb: 'Salt-stained names and the ships they sail: Grace Saltbeard, the Widow’s Revenge.',
    person: (rng, g) => `${given(rng, g, PIRATE)} ${pick(rng, PIRATE_EPITHET)}`,
    place: (rng) => `${pick(rng, ['Skull', 'Smuggler’s', 'Dead Man’s', 'Parrot', 'Rum', 'Siren', 'Shipwreck', 'Cutthroat'])} ${pick(rng, ['Cove', 'Isle', 'Bay', 'Reef', 'Key', 'Point'])}`,
    tavern: (rng) => `The ${pick(rng, ['Salty', 'Drowned', 'Jolly', 'Rum-Soaked', 'Leaky'])} ${pick(rng, ['Barnacle', 'Parrot', 'Cask', 'Keel', 'Mermaid', 'Anchor'])}`,
    group: (rng) => `The ${compound(rng, SHIPS_A.map((a) => `${a} `), SHIPS_B)}`,
  },
  // Modern
  {
    id: 'contemporary',
    label: 'Contemporary',
    family: 'modern',
    blurb: 'Everyday names from around today’s world: Priya Gallagher, Mateo Lindqvist.',
    person: (rng, g) => full(given(rng, g, CONTEMPORARY), pick(rng, CONTEMPORARY_SURNAMES)),
    place: (rng) => compound(rng, TOWN_A, TOWN_B),
    tavern: (rng) => `${pick(rng, CONTEMPORARY_SURNAMES)}’s ${pick(rng, MODERN_VENUE)}`,
    group: (rng) => (chance(rng, 0.4) ? `${pick(rng, CONTEMPORARY_SURNAMES)} & ${pick(rng, CONTEMPORARY_SURNAMES)}` : `${pick(rng, COMPANY_WORD)} ${pick(rng, COMPANY)}`),
  },
  {
    id: 'noir',
    label: 'Noir & Crime',
    family: 'modern',
    blurb: 'Rain-slicked city names: Vera Moretti, Sal “the Knife” Costello.',
    person: (rng, g) => {
      const name = given(rng, g, NOIR);
      const last = pick(rng, NOIR_SURNAMES);
      return chance(rng, 0.25) ? `${name} “${pick(rng, NOIR_NICK)}” ${last}` : full(name, last);
    },
    place: (rng) => `${pick(rng, STREETS)}${pick(rng, NOIR_PLACE_B)}`,
    tavern: (rng) => `The ${pick(rng, ['Blue', 'Velvet', 'Copper', 'Midnight', 'Black Cat', 'Lucky Seven'])} ${pick(rng, ['Room', 'Lounge', 'Club', 'Bar', 'Diner'])}`,
    group: (rng) => (chance(rng, 0.5) ? `The ${pick(rng, NOIR_SURNAMES)} Family` : `The ${pick(rng, STREETS)} Street ${pick(rng, ['Boys', 'Crew', 'Syndicate'])}`),
  },
  // Science fiction
  {
    id: 'space-opera',
    label: 'Space Opera',
    family: 'scifi',
    blurb: 'Star-spanning names for captains and colonies: Zephra Kor-Talon, Vexon of Lyra Prime.',
    person: (rng, g) => full(word(rng, SPACE, g), chance(rng, 0.3) ? `${word(rng, SPACE)}-${word(rng, SPACE)}` : word(rng, SPACE)),
    place: (rng) => `${word(rng, SPACE)}${pick(rng, SPACE_PLACE_B)}`,
    tavern: (rng) => `The ${pick(rng, SPACE_BAR_A)} ${pick(rng, SPACE_BAR_B)}${chance(rng, 0.4) ? ' Cantina' : ''}`,
    group: (rng) => (chance(rng, 0.5) ? `${word(rng, SPACE)} ${pick(rng, CORP_B)}` : `The ${pick(rng, ['Free', 'Outer', 'Solar', 'Galactic', 'Stellar'])} ${pick(rng, ['Alliance', 'Fleet', 'Syndicate', 'Collective', 'Accord'])}`),
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    family: 'scifi',
    blurb: 'Street handles and corporate cities: Kira “Glitch” Nakamura, Neon Row.',
    person: (rng, g) => {
      const name = given(rng, g, CYBER);
      const roll = rng();
      if (roll < 0.25) return pick(rng, HANDLES);
      if (roll < 0.6) return `${name} “${pick(rng, HANDLES)}” ${pick(rng, CONTEMPORARY_SURNAMES)}`;
      return full(name, pick(rng, CONTEMPORARY_SURNAMES));
    },
    place: (rng) => (chance(rng, 0.25) ? `Sector ${between(rng, 2, 99)}` : compound(rng, CYBER_PLACE_A, CYBER_PLACE_B)),
    tavern: (rng) => `The ${pick(rng, ['Neon', 'Chrome', 'Static', 'Afterglow', 'Black Ice', 'Overclock'])} ${pick(rng, ['Lounge', 'Den', 'Bar', 'Club', 'Noodle Shop'])}`,
    group: (rng) => (chance(rng, 0.5) ? `${pick(rng, ['Tessera', 'Helix', 'Kronos', 'Vanta', 'Obsidian', 'Synapse', 'Nexus'])}${pick(rng, [' Corp', '-Tek', ' Dynamics', ' Biotech'])}` : `The ${pick(rng, HANDLES)} ${pick(rng, ['Runners', 'Kings', 'Saints', 'Ghosts', 'Collective'])}`),
  },
  {
    id: 'post-apocalyptic',
    label: 'Post-Apocalyptic',
    family: 'scifi',
    blurb: 'Names scavenged from what’s left: Sparrow Mile-Twelve, Rust Hollow.',
    person: (rng, g) => full(given(rng, g, WASTELAND), pick(rng, WASTELAND_SURNAMES)),
    place: (rng) => compound(rng, WASTE_PLACE_A, WASTE_PLACE_B),
    tavern: (rng) => `The ${pick(rng, ['Last', 'Rusty', 'Radiant', 'Dusty', 'Junk'])} ${pick(rng, ['Drop', 'Pump', 'Barrel', 'Trading Post', 'Still'])}`,
    group: (rng) => `The ${pick(rng, ['Road', 'Rust', 'Bone', 'Ash', 'Iron'])} ${pick(rng, ['Raiders', 'Caravan', 'Saints', 'Kings', 'Tribe'])}`,
  },
  // Horror
  {
    id: 'cosmic-horror',
    label: 'Cosmic Horror',
    family: 'horror',
    blurb: 'Old New England names and things best not named: Obadiah Danforth, Xul’gorath.',
    person: (rng, g) => (chance(rng, 0.15) ? word(rng, ELDRITCH, g) : full(given(rng, g, PURITAN), pick(rng, PURITAN_SURNAMES))),
    place: (rng) => compound(rng, HORROR_PLACE_A, HORROR_PLACE_B),
    tavern: (rng) => `The ${pick(rng, ['Drowned', 'Gray', 'Gibbous', 'Hanged', 'Silent'])} ${pick(rng, ['Lantern', 'Gull', 'Moon', 'Net', 'Bell'])}`,
    group: (rng) => `The ${pick(rng, ['Esoteric', 'Starry', 'Silent', 'Deep', 'Hidden'])} ${pick(rng, ['Order', 'Lodge', 'Congregation', 'Fellowship', 'Society'])} of ${word(rng, ELDRITCH)}`,
  },
];

/** What taverns, shops and groups sound like, by family, for genres without their own. */
const BY_FAMILY: Record<Family, { tavern: (rng: Rng) => string; group: (rng: Rng) => string }> = {
  fantasy: { tavern: fantasyTavern, group: fantasyGroup },
  peoples: { tavern: fantasyTavern, group: fantasyGroup },
  historical: { tavern: fantasyTavern, group: fantasyGroup },
  modern: { tavern: (rng) => `${pick(rng, CONTEMPORARY_SURNAMES)}’s ${pick(rng, MODERN_VENUE)}`, group: (rng) => `${pick(rng, COMPANY_WORD)} ${pick(rng, COMPANY)}` },
  scifi: { tavern: (rng) => `The ${pick(rng, SPACE_BAR_A)} ${pick(rng, SPACE_BAR_B)}`, group: (rng) => `${pick(rng, COMPANY_WORD)} ${pick(rng, CORP_B)}` },
  horror: { tavern: fantasyTavern, group: fantasyGroup },
};

export const genreById = (id: string): Genre => GENRES.find((g) => g.id === id) ?? GENRES[0]!;

/** One name of a kind, in a genre. */
export function generateName(genre: Genre, kind: NameKind, rng: Rng, gender: Gender = 'any'): string {
  switch (kind) {
    case 'person':
      return genre.person(rng, gender);
    case 'place':
      return genre.place(rng);
    case 'tavern':
      return (genre.tavern ?? BY_FAMILY[genre.family].tavern)(rng);
    case 'group':
      return (genre.group ?? BY_FAMILY[genre.family].group)(rng);
  }
}

/** `count` different names (fewer only if the genre can't make that many). */
export function generateNames(genre: Genre, kind: NameKind, count: number, rng: Rng = Math.random, gender: Gender = 'any'): string[] {
  const out = new Set<string>();
  for (let tries = 0; out.size < count && tries < count * 25; tries++) out.add(generateName(genre, kind, rng, gender));
  return [...out];
}

/**
 * The genre that fits a world's own genre ("Low Fantasy", "Space Western",
 * "Literary Thriller"…), or null when nothing matches.
 */
export function genreForWorld(text: string | undefined): string | null {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return null;
  const rules: [RegExp, string][] = [
    [/cyber/, 'cyberpunk'],
    [/space|sci-?fi|science|star|galac/, 'space-opera'],
    [/apocal|wasteland|dystop/, 'post-apocalyptic'],
    [/western|frontier|cowboy/, 'western'],
    [/pirate|nautical|seafar/, 'pirate'],
    [/cosmic|eldritch|lovecraft|horror/, 'cosmic-horror'],
    [/gothic|victorian|steampunk|regency/, 'victorian'],
    [/noir|crime|detective|thriller|mystery/, 'noir'],
    [/viking|norse|saga/, 'norse'],
    [/celt|irish|scot|welsh/, 'celtic'],
    [/\broman\b|rome|greek|classical|myth/, 'classical'],
    [/grimdark|dark fantasy/, 'dark-fantasy'],
    [/fae|fair(y|ie)|fey/, 'fey'],
    [/low fantasy|medieval|historical fantasy/, 'low-fantasy'],
    [/fantasy|epic|sword/, 'high-fantasy'],
    [/contemporary|literary|romance|modern|drama|comedy|family|young adult|ya\b/, 'contemporary'],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? null;
}
