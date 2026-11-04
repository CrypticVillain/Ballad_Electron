import type { Entry, Scene } from '@/lib/model';
import { cueName } from './elements';
import type { ScriptElement } from './model';

/**
 * Filmmaking → Script: who's in a scene (pure). A cast member is in it when
 * the scene names them (@ or tagged) or one of their lines is there: a cue
 * matches the role they play ("Plays", else their own name), whole or by
 * first name. Cast numbers (1 for the lead) go by how many scenes each is in.
 */

/** The role a cast member plays, if it's a role: a documentary's "Herself" or "Himself" isn't one (they're themselves). */
function playsOf(entry: Entry): string {
  const plays = entry.specs.find((s) => s.label.toLowerCase() === 'plays')?.value.trim() ?? '';
  return /^(her|him|them|your|my|one|it)sel(f|ves)$|^self$|^themself$/i.test(plays) ? '' : plays;
}

/** The names a cast member's cues could use: the role they play and their own name, whole and first word, in capitals. */
export function castKeys(entry: Entry): string[] {
  const plays = playsOf(entry);
  const keys = new Set<string>();
  for (const name of [plays, entry.name]) {
    const upper = name.trim().toUpperCase();
    if (!upper) continue;
    keys.add(upper);
    keys.add(upper.split(/\s+/)[0]!);
  }
  return [...keys];
}

/** The role a cast member plays, as a script would name them (their Plays, else their name). */
export const roleOf = (entry: Entry) => playsOf(entry) || entry.name;

/** Who speaks in the scene: each cue's name, once, in order. */
export const speakersOf = (elements: ScriptElement[]) => [...new Set(elements.filter((e) => e.type === 'character').map((e) => cueName(e.text)).filter(Boolean))];

/** The cast in a scene (entry ids, in cast order) and the speakers no cast member matches. */
export function castOfScene(scene: Pick<Scene, 'links' | 'tagged'>, elements: ScriptElement[], cast: Entry[]): { ids: string[]; unmatched: string[] } {
  const ids = new Set<string>();
  const named = new Set([...scene.links, ...(scene.tagged ?? [])]);
  for (const c of cast) if (named.has(c.id)) ids.add(c.id);
  const unmatched: string[] = [];
  for (const speaker of speakersOf(elements)) {
    const match = cast.find((c) => castKeys(c).includes(speaker));
    if (match) ids.add(match.id);
    else unmatched.push(speaker);
  }
  return { ids: cast.filter((c) => ids.has(c.id)).map((c) => c.id), unmatched };
}

/** Cast numbers: most scenes first (ties by name), from 1. */
export function castNumbers(cast: Entry[], sceneCast: string[][]): Map<string, number> {
  const count = new Map<string, number>();
  for (const ids of sceneCast) for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  const ranked = [...cast].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  return new Map(ranked.map((c, i) => [c.id, i + 1]));
}
