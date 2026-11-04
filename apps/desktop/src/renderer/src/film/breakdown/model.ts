import type { BaseRecord } from '@/lib/model';

/**
 * Filmmaking → Breakdown: what each scene needs besides its cast (which
 * comes from the script): props, wardrobe, vehicles, effects… An element is
 * one thing ("the red coat") and the scenes that need it.
 */

export const BREAKDOWN_CATEGORIES = [
  { id: 'extras', label: 'Background', note: 'Extras and stand-ins', hex: '#16a34a', chip: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-300', dot: 'bg-green-600' },
  { id: 'stunts', label: 'Stunts', note: 'Stunt performers and gags', hex: '#ea580c', chip: 'border-orange-600/30 bg-orange-600/10 text-orange-700 dark:text-orange-300', dot: 'bg-orange-600' },
  { id: 'props', label: 'Props', note: 'Anything an actor handles', hex: '#7c3aed', chip: 'border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-300', dot: 'bg-violet-600' },
  { id: 'wardrobe', label: 'Wardrobe', note: 'Costumes, by character', hex: '#0284c7', chip: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-300', dot: 'bg-sky-600' },
  { id: 'makeup', label: 'Makeup & Hair', note: 'Looks, wounds, wigs, aging', hex: '#db2777', chip: 'border-pink-600/30 bg-pink-600/10 text-pink-700 dark:text-pink-300', dot: 'bg-pink-600' },
  { id: 'vehicles', label: 'Vehicles', note: 'Picture cars, boats, bikes', hex: '#e11d48', chip: 'border-rose-600/30 bg-rose-600/10 text-rose-700 dark:text-rose-300', dot: 'bg-rose-600' },
  { id: 'animals', label: 'Animals', note: 'And their handlers', hex: '#65a30d', chip: 'border-lime-600/30 bg-lime-600/10 text-lime-700 dark:text-lime-300', dot: 'bg-lime-600' },
  { id: 'sfx', label: 'Special Effects', note: 'Practical: rain, smoke, fire, squibs', hex: '#2563eb', chip: 'border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-300', dot: 'bg-blue-600' },
  { id: 'vfx', label: 'Visual Effects', note: 'Done in post: screens, skies, clean-up', hex: '#4f46e5', chip: 'border-indigo-600/30 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-600' },
  { id: 'setDressing', label: 'Set Dressing', note: 'What fills the set', hex: '#d97706', chip: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-600' },
  { id: 'equipment', label: 'Special Equipment', note: 'Cranes, rigs, underwater housings', hex: '#57534e', chip: 'border-stone-600/30 bg-stone-600/10 text-stone-700 dark:text-stone-300', dot: 'bg-stone-600' },
  { id: 'sound', label: 'Sound & Music', note: 'Playback, live music, effects on set', hex: '#ca8a04', chip: 'border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-600' },
  { id: 'notes', label: 'Notes', note: 'Anything else to plan for', hex: '#71717a', chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300', dot: 'bg-zinc-500' },
] as const;

export type BreakdownCategory = (typeof BREAKDOWN_CATEGORIES)[number]['id'];

export const categoryInfo = (id: string) => BREAKDOWN_CATEGORIES.find((c) => c.id === id) ?? BREAKDOWN_CATEGORIES.at(-1)!;

export type BreakdownItem = BaseRecord & {
  worldId: string;
  category: BreakdownCategory;
  name: string;
  /** The scenes that need it. */
  sceneIds: string[];
  /** How many (extras: 20 pedestrians). */
  qty: number;
  notes: string;
};
