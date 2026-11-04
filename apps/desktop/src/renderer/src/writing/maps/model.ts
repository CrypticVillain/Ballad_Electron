import type { BaseRecord } from '@/lib/model';

/**
 * Writing → Maps: a world's maps, kept apart from D&D's (screens/maps), so
 * the two can grow their own ways. A map is an image with pins; a pin can
 * name a place (or anyone, anything in the world bible) and open another,
 * closer map: a continent's pin opens its city, the city's opens a street.
 */

export const PIN_COLORS = ['accent', 'blue', 'green', 'violet', 'amber', 'gray'] as const;
export type WritingPinColor = (typeof PIN_COLORS)[number];

export type WritingMapPin = {
  id: string;
  /** Where, 0–1 across and down the image. */
  x: number;
  y: number;
  label: string;
  note: string;
  color: WritingPinColor;
  /** The world bible entry it marks (a place, usually), if any. */
  entryId: string | null;
  /** The closer map it opens, if any. */
  mapId: string | null;
};

export type WritingMap = BaseRecord & {
  worldId: string;
  /** The map it's a closer look at (one of whose pins opens it), or none: a top-level map. */
  parentId: string | null;
  name: string;
  /** A file beside the vault (ballad-media://maps/<file>). */
  image: string;
  width: number;
  height: number;
  note: string;
  pins: WritingMapPin[];
  order: number;
};
