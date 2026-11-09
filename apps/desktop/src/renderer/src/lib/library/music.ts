/**
 * The Library's free music: tracks bundled with Ballad (public/library/music),
 * each in the public domain (CC0: no credit needed, though it's given), to add
 * to your Music in a click and attach to encounters and Play's scenes. All
 * by RandomMind, from OpenGameArt.
 */
export type FreeTrack = {
  id: string;
  /** The bundled file (public/library/music). */
  file: string;
  name: string;
  /** What it's for at the table. */
  mood: string;
  by: string;
  /** Where it came from. */
  source: string;
};

const OGA = 'opengameart.org/content/';

export const FREE_MUSIC: FreeTrack[] = [
  { id: 'medieval-exploration', file: 'medieval-exploration.mp3', name: 'Exploration', mood: 'The road, a journey, a menu', by: 'RandomMind', source: `${OGA}medieval-exploration` },
  { id: 'medieval-battle', file: 'medieval-battle.mp3', name: 'Battle', mood: 'A fight', by: 'RandomMind', source: `${OGA}medieval-battle` },
  { id: 'the-old-tower-inn', file: 'the-old-tower-inn.mp3', name: 'The Old Tower Inn', mood: 'A tavern, calm', by: 'RandomMind', source: `${OGA}medieval-the-old-tower-inn` },
  { id: 'kings-feast', file: 'kings-feast.mp3', name: 'King’s Feast', mood: 'A hall, a feast', by: 'RandomMind', source: `${OGA}medieval-kings-feast` },
  { id: 'the-bards-tale', file: 'the-bards-tale.mp3', name: 'The Bard’s Tale', mood: 'A story by the fire', by: 'RandomMind', source: `${OGA}medieval-the-bards-tale` },
  { id: 'minstrel-dance', file: 'minstrel-dance.mp3', name: 'Minstrel Dance', mood: 'A town, a festival', by: 'RandomMind', source: `${OGA}medieval-minstrel-dance` },
];

export const freeTrack = (id: string) => FREE_MUSIC.find((t) => t.id === id)!;
