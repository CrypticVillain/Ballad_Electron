import type { BaseRecord } from '@/lib/model';
import type { RollCard } from '../sheet/rolls';

/**
 * Play → the table's shared things, beside the board (they travel with the
 * campaign like its scenes: main/table.ts):
 *
 *   TableEntry     the table's log: everyone's dice rolls, chat and whispers, the GM's hidden
 *                  rolls, what the table is told (combat starts), and pings on the board
 *   BoardTemplate  a spell's area on a scene: a circle, a cone, a line or a square
 *   TurnOrder      a scene's initiative: who's in the fight, in what order, whose turn, the round
 */

export type TableEntry = BaseRecord & {
  worldId: string;
  /** Who wrote or rolled it (an account). */
  accountId: string;
  /** Their name at the table: the GM's "GM", a player's character (or their account's name). */
  who: string;
  kind: 'chat' | 'roll' | 'system' | 'ping' | 'card' | 'emote';
  /** Chat: what they said; a roll: what it was for ("Longsword"); the table: what happened. */
  text: string;
  roll?: { expression: string; total: number; detail: string; natural?: number | null };
  /** A whisper (or the GM's hidden roll): only these accounts see it, besides the GM and whoever wrote it. Unset: everyone. */
  to?: string[];
  /** A card from a sheet (play/sheet): an attack with its damage, a spell, a feature's or an item's text. */
  card?: RollCard;
  /** A ping: where on which scene (it shows for a few seconds, then goes). */
  ping?: { sceneId: string; x: number; y: number };
};

export const TEMPLATE_SHAPES = ['circle', 'cone', 'line', 'square'] as const;
export type TemplateShape = (typeof TEMPLATE_SHAPES)[number];

/**
 * An area on a scene (a fireball's sphere, a dragon's cone): from a point,
 * in a direction (radians, 0 pointing right), so far (map pixels): a
 * circle's radius, a cone's or a line's length, a square's side. Anyone at
 * the table can lay one; the GM can clear anyone's, a player their own.
 */
export type BoardTemplate = BaseRecord & {
  worldId: string;
  sceneId: string;
  accountId: string;
  shape: TemplateShape;
  x: number;
  y: number;
  angle: number;
  length: number;
  color: string;
};

/** A scene's initiative order: each token in the fight with its initiative; `turn` indexes the order sorted highest first. */
export type TurnOrder = { round: number; turn: number; entries: { tokenId: string; initiative: number | null }[] };
