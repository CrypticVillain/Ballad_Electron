/**
 * diceLooks.ts — the dice styles you can pick (Settings → Dice, the dice
 * tray): Ballad's own dot matrix, then looks after popular dice sets, by
 * genre. How each is painted and lit is components/tabletop/dice3d/looks.ts; add
 * a look in both places.
 */
export const DICE_LOOK_IDS = ['display-dark', 'display', 'ivory', 'obsidian', 'ruby', 'sapphire', 'jade', 'nebula', 'oak', 'steel', 'bone', 'neon', 'phosphor', 'chrome'] as const;
export type DiceLook = (typeof DICE_LOOK_IDS)[number];

export const DICE_GENRES = ['Ballad', 'Classic', 'Gemstone', 'Fantasy', 'Horror', 'Cyberpunk & Sci-Fi'] as const;
export type DiceGenre = (typeof DICE_GENRES)[number];

export const DICE_LOOK_INFO: Record<DiceLook, { name: string; genre: DiceGenre; note: string }> = {
  display: { name: 'Dot Matrix Light', genre: 'Ballad', note: 'Bright white, black dot-matrix numerals, a ring of orange dots' },
  'display-dark': { name: 'Dot Matrix Dark', genre: 'Ballad', note: 'Matte black, numerals and an orange ring lit like a display' },
  ivory: { name: 'Classic Ivory', genre: 'Classic', note: 'The set every table has: glossy ivory, crisp black numbers' },
  obsidian: { name: 'Obsidian & Gold', genre: 'Classic', note: 'Glossy black stone, gold leaf numbers that catch the light' },
  ruby: { name: 'Dragon’s Ruby', genre: 'Gemstone', note: 'A deep red gem lit from inside, gold numbers' },
  sapphire: { name: 'Frost Sapphire', genre: 'Gemstone', note: 'Icy blue gem, silver numbers' },
  jade: { name: 'Jade Marble', genre: 'Gemstone', note: 'Veined green stone, gold numbers' },
  nebula: { name: 'Arcane Nebula', genre: 'Fantasy', note: 'A galaxy in a die: violet and teal clouds, stars, glowing numbers' },
  oak: { name: 'Oak & Ember', genre: 'Fantasy', note: 'Carved oak, numbers burned in, still smouldering' },
  steel: { name: 'Dwarven Steel', genre: 'Fantasy', note: 'Heavy brushed steel, brass numbers' },
  bone: { name: 'Grave Bone', genre: 'Horror', note: 'Yellowed, cracked bone, dried-blood numbers' },
  neon: { name: 'Neon Grid', genre: 'Cyberpunk & Sci-Fi', note: 'Black glass on a magenta grid, cyan numbers that glow' },
  phosphor: { name: 'Phosphor Terminal', genre: 'Cyberpunk & Sci-Fi', note: 'An old CRT: scanlines and green phosphor numbers' },
  chrome: { name: 'Mirror Chrome', genre: 'Cyberpunk & Sci-Fi', note: 'Polished chrome that mirrors the room, black numbers' },
};
