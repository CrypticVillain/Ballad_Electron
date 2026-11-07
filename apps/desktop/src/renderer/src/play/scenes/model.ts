import type { BaseRecord } from '@/lib/model';
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
