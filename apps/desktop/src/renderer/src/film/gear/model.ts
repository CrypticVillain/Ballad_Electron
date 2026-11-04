import type { BaseRecord } from '@/lib/model';

/** Filmmaking → Gear: the kit for the shoot, owned, rented or borrowed, and whether it's packed. */

export const GEAR_CATEGORIES = ['Camera', 'Lenses', 'Grip', 'Lighting', 'Sound', 'Power', 'Monitors', 'Media', 'Other'] as const;

export const GEAR_SOURCES = [
  { id: 'owned', label: 'Owned' },
  { id: 'rented', label: 'Rented' },
  { id: 'borrowed', label: 'Borrowed' },
] as const;
export type GearSource = (typeof GEAR_SOURCES)[number]['id'];

export type GearItem = BaseRecord & {
  worldId: string;
  name: string;
  category: string;
  qty: number;
  source: GearSource;
  /** Who it's rented or borrowed from. */
  from: string;
  /** What a day of it costs (rented). */
  dayRate: number;
  /** Days it's needed. */
  days: number;
  notes: string;
  packed: boolean;
  order: number;
};
