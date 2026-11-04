import { wordCount } from '@/lib/text';
import { cueName, isNight, type Heading } from '@/film/script/elements';
import type { ScriptElement } from '@/film/script/model';

/**
 * Filmmaking → Reports: the script counted (pure). Who speaks how much and
 * where, which sets carry the most pages, and how the scenes split between
 * interior and exterior, day and night.
 */

export type ReportScene = { id: string; number: string; eighths: number; heading: Heading; elements: ScriptElement[] };

export type CharacterRow = { name: string; speeches: number; words: number; scenes: number; eighths: number; first: string };
export type LocationRow = { place: string; scenes: number; eighths: number; ie: string[]; times: string[]; numbers: string[] };
export type SplitRow = { label: string; scenes: number; eighths: number };

export type ScriptReport = {
  characters: CharacterRow[];
  locations: LocationRow[];
  interior: SplitRow[];
  time: SplitRow[];
  totals: { scenes: number; eighths: number; speeches: number; dialogueWords: number; actionWords: number };
};

const add = (rows: Map<string, SplitRow>, label: string, eighths: number) => {
  const row = rows.get(label) ?? { label, scenes: 0, eighths: 0 };
  row.scenes++;
  row.eighths += eighths;
  rows.set(label, row);
};

export function scriptReport(scenes: ReportScene[]): ScriptReport {
  const characters = new Map<string, CharacterRow>();
  const locations = new Map<string, LocationRow>();
  const interior = new Map<string, SplitRow>();
  const time = new Map<string, SplitRow>();
  let speeches = 0;
  let dialogueWords = 0;
  let actionWords = 0;

  for (const s of scenes) {
    const here = new Set<string>();
    let speaker: CharacterRow | null = null;
    for (const e of s.elements) {
      if (e.type === 'character') {
        const name = cueName(e.text);
        if (!name) continue;
        speaker = characters.get(name) ?? { name, speeches: 0, words: 0, scenes: 0, eighths: 0, first: s.number };
        characters.set(name, speaker);
        speaker.speeches++;
        speeches++;
        if (!here.has(name)) {
          here.add(name);
          speaker.scenes++;
          speaker.eighths += s.eighths;
        }
      } else if (e.type === 'dialogue') {
        const words = wordCount(e.text);
        dialogueWords += words;
        if (speaker) speaker.words += words;
      } else if (e.type !== 'parenthetical') {
        speaker = null;
        if (e.type === 'action') actionWords += wordCount(e.text);
      }
    }
    const set = s.heading.place.split(/\s+[-–—]\s+/)[0]!.trim() || 'No Heading';
    const loc = locations.get(set) ?? { place: set, scenes: 0, eighths: 0, ie: [], times: [], numbers: [] };
    loc.scenes++;
    loc.eighths += s.eighths;
    loc.numbers.push(s.number);
    if (s.heading.ie && !loc.ie.includes(s.heading.ie)) loc.ie.push(s.heading.ie);
    if (s.heading.time && !loc.times.includes(s.heading.time)) loc.times.push(s.heading.time);
    locations.set(set, loc);
    add(interior, s.heading.ie === 'INT' ? 'Interior' : s.heading.ie === 'EXT' ? 'Exterior' : s.heading.ie === 'INT/EXT' ? 'Interior / Exterior' : 'Not Marked', s.eighths);
    add(time, !s.heading.time ? 'Not Marked' : isNight(s.heading.time) ? 'Night' : /\b(day|morning|afternoon|dawn|noon)\b/i.test(s.heading.time) ? 'Day' : 'Other', s.eighths);
  }
  const byOrder = (labels: string[]) => (a: SplitRow, b: SplitRow) => labels.indexOf(a.label) - labels.indexOf(b.label);
  return {
    characters: [...characters.values()].sort((a, b) => b.speeches - a.speeches || b.words - a.words || a.name.localeCompare(b.name)),
    locations: [...locations.values()].sort((a, b) => b.eighths - a.eighths || a.place.localeCompare(b.place)),
    interior: [...interior.values()].sort(byOrder(['Interior', 'Exterior', 'Interior / Exterior', 'Not Marked'])),
    time: [...time.values()].sort(byOrder(['Day', 'Night', 'Other', 'Not Marked'])),
    totals: { scenes: scenes.length, eighths: scenes.reduce((n, s) => n + s.eighths, 0), speeches, dialogueWords, actionWords },
  };
}

/** Rows as CSV text (quoted where needed). */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
