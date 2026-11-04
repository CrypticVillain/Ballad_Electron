import { isNight, type Heading } from '@/film/script/elements';

/**
 * Filmmaking → Stripboard: moving scenes between shoot days, strip colors,
 * and the Day Out Of Days (pure).
 */

export type DayScenes = { id: string; sceneIds: string[] };

/** Moves a scene to a day (null: back to unscheduled) at an index there. Gives back each changed day's new scenes. */
export function moveStrip(days: DayScenes[], sceneId: string, toDay: string | null, index: number): Record<string, string[]> {
  const changed: Record<string, string[]> = {};
  for (const day of days) {
    if (day.sceneIds.includes(sceneId)) changed[day.id] = day.sceneIds.filter((id) => id !== sceneId);
  }
  if (toDay) {
    const base = changed[toDay] ?? days.find((d) => d.id === toDay)?.sceneIds ?? [];
    const was = days.find((d) => d.id === toDay)?.sceneIds.indexOf(sceneId) ?? -1;
    // Moving down within the same day: the index counted the strip itself.
    const at = Math.max(0, Math.min(base.length, was >= 0 && was < index ? index - 1 : index));
    changed[toDay] = [...base.slice(0, at), sceneId, ...base.slice(at)];
  }
  for (const day of days) {
    const next = changed[day.id];
    if (next && next.length === day.sceneIds.length && next.every((id, i) => id === day.sceneIds[i])) delete changed[day.id];
  }
  return changed;
}

/** A strip's color, as stripboards have them: interior day white, exterior day yellow, interior night blue, exterior night green. */
export type StripTone = 'intDay' | 'extDay' | 'intNight' | 'extNight';
export const stripTone = (h: Heading): StripTone => {
  const night = isNight(h.time);
  const ext = h.ie === 'EXT';
  return ext ? (night ? 'extNight' : 'extDay') : night ? 'intNight' : 'intDay';
};

export type DoodCell = '' | 'SW' | 'W' | 'WF' | 'SWF' | 'H';
export type DoodRow = { castId: string; cells: DoodCell[]; work: number; hold: number; start: number; finish: number };

/**
 * Day Out Of Days: for each cast member, each shoot day (in order) as SW
 * (starts work), W (works), WF (finishes), SWF (their only day), H (on hold,
 * between work days) or nothing. Cast who never work are left out.
 */
export function dayOutOfDays(days: DayScenes[], castOf: (sceneId: string) => string[], cast: string[]): DoodRow[] {
  const rows: DoodRow[] = [];
  for (const castId of cast) {
    const works = days.map((d) => d.sceneIds.some((s) => castOf(s).includes(castId)));
    const first = works.indexOf(true);
    if (first < 0) continue;
    const last = works.lastIndexOf(true);
    const cells: DoodCell[] = works.map((w, i) => (i < first || i > last ? '' : !w ? 'H' : first === last ? 'SWF' : i === first ? 'SW' : i === last ? 'WF' : 'W'));
    rows.push({ castId, cells, work: works.filter(Boolean).length, hold: cells.filter((c) => c === 'H').length, start: first, finish: last });
  }
  return rows;
}
