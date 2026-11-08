import { byOrder, type Era, type Part, type Scene } from '@/lib/model';
import { roman } from '@/lib/text';

/**
 * Story Days (Writing's timeline): a book's scenes by the day of the story
 * they happen on, one lane per point of view. Eras: the timeline's named
 * spans of years. Pure, with tests beside it.
 */

/** A book's scenes in reading order, numbered as the binder numbers them ("II · 3"). */
export function numbered(parts: Part[], scenes: Scene[]): { scene: Scene; label: string }[] {
  return parts
    .slice()
    .sort(byOrder)
    .flatMap((part, p) =>
      scenes
        .filter((s) => s.partId === part.id && s.kind !== 'note')
        .sort(byOrder)
        .map((scene, i) => ({ scene, label: `${roman(p + 1)} · ${i + 1}` })),
    );
}

/** The days to show: from Day 1 (or the earliest) to one past the latest, so there's always an empty day to drop on. */
export function dayRange(scenes: Scene[]): number[] {
  const days = scenes.map((s) => s.storyDay).filter((d): d is number => typeof d === 'number');
  const first = Math.min(1, ...days);
  const last = Math.max(1, ...days) + 1;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** The lanes: one per point of view, in the order they first appear, and "No POV" last if any scene has none. */
export function povLanes(scenes: Scene[]): (string | null)[] {
  const lanes: (string | null)[] = [];
  for (const s of scenes) if (!lanes.includes(s.povId)) lanes.push(s.povId);
  return [...lanes.filter((l) => l !== null), ...(lanes.includes(null) ? [null] : [])];
}

/** Where an era ends on the timeline: its own last year, or (still going) the end of what's shown. */
export const eraEnd = (era: Era, shownTo: number) => era.to ?? shownTo;

/** The years an era covers, as said: "402–480", "402 on". */
export const eraYears = (era: Era) => (era.to === null ? `${era.from} on` : `${era.from}–${era.to}`);
