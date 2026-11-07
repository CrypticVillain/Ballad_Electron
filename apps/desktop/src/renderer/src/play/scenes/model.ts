import type { BaseRecord, InkStroke } from '@/lib/model';
import type { BattleMap } from '@/tabletop/battlemap/model';
import type { AttachedMusic } from '@/tabletop/music/model';

/**
 * Play → Scenes: where the table plays. A campaign's scenes (the tavern,
 * the crypt, the ship battle): each a battle map (tabletop/battlemap: its
 * picture, grid, fog and tokens) with music to play. Scenes belong to the
 * Tabletop campaign Play is running (worldId).
 */
export type PlayScene = BaseRecord &
  BattleMap & {
    worldId: string;
    name: string;
    order: number;
    /** The encounter it was made from, if any. */
    encounterId?: string;
    /** Its music: tracks from the Library, each started with the scene or by hand. */
    music?: AttachedMusic;
    /** The track playing now (the GM started it), for everyone at the table. */
    nowPlaying?: { trackId: string; startedAt: string } | null;
  };

/**
 * A handout: a picture or a note the GM adds to a scene (a letter, a
 * wanted poster, a riddle), hidden from the players until the GM shows it.
 * The players see the shown ones of the scene the table sees, and can open
 * one and mark it up.
 */
export type Handout = BaseRecord & {
  worldId: string;
  sceneId: string;
  name: string;
  /** A picture beside the vault (maps/), or none: a note. */
  image?: string;
  /** The picture's size, in pixels (a note: 1000 by its height). */
  width: number;
  height: number;
  /** A note's words (a picture's caption). */
  text: string;
  /** A note's handwriting (the GM's, part of the note: 1000 units across). */
  ink?: InkStroke[];
  hidden: boolean;
  order: number;
};
