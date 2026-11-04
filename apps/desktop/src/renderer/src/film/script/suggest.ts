/**
 * Filmmaking → Script: what the script editor offers as you type a cue, a
 * scene heading or a transition (pure). Names and sets come from the script
 * so far and the production's cast and locations.
 */

export const EXTENSIONS = ['V.O.', 'O.S.', 'O.C.', "CONT'D", 'PRE-LAP', 'FILTERED', 'INTO PHONE'] as const;
export const PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'EST. '] as const;
export const TIMES = ['DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS LATER', 'SAME TIME'] as const;
export const TRANSITIONS = ['CUT TO:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'FADE TO BLACK.', 'FADE OUT.', 'FADE IN:', 'INTERCUT WITH:'] as const;

const MAX = 6;

const starting = (options: readonly string[], typed: string) => {
  const t = typed.toUpperCase();
  return options.filter((o) => o.toUpperCase().startsWith(t) && o.toUpperCase() !== t);
};

/** For a character cue: names, then (once a "(" is typed) extensions. */
export function suggestCue(typed: string, names: string[]): string[] {
  const open = typed.lastIndexOf('(');
  if (open >= 0 && !typed.slice(open).includes(')')) {
    const name = typed.slice(0, open).trim().toUpperCase();
    const partial = typed.slice(open + 1).trim();
    return starting(EXTENSIONS, partial)
      .map((ext) => `${name} (${ext})`)
      .slice(0, MAX);
  }
  if (!typed.trim()) return [];
  return starting(names, typed.trimStart()).slice(0, MAX);
}

/** For a scene heading: INT./EXT., then a set, then a time of day. */
export function suggestHeading(typed: string, places: string[]): string[] {
  const upper = typed.toUpperCase();
  const prefix = PREFIXES.find((p) => upper.startsWith(p.trim()) && (upper.length === p.trim().length || /\s/.test(upper[p.trim().length] ?? '')));
  if (!prefix) return starting(PREFIXES, typed.trimStart()).slice(0, MAX);
  const rest = typed.slice(prefix.trim().length).replace(/^\s+/, '');
  const dash = rest.search(/\s[-–—]\s?/);
  if (dash >= 0) {
    const place = rest.slice(0, dash).trim().toUpperCase();
    const partial = rest.slice(dash).replace(/^\s*[-–—]\s*/, '');
    return starting(TIMES, partial)
      .map((time) => `${prefix}${place} - ${time}`)
      .slice(0, MAX);
  }
  const typedPlace = rest.toUpperCase();
  const sets = starting(places, rest).map((place) => `${prefix}${place}`);
  // A set typed in full: on to the time of day.
  if (typedPlace && places.some((p) => p.toUpperCase() === typedPlace.trim())) sets.push(...TIMES.slice(0, 3).map((time) => `${prefix}${typedPlace.trim()} - ${time}`));
  return sets.slice(0, MAX);
}

export const suggestTransition = (typed: string) => starting(TRANSITIONS, typed.trimStart()).slice(0, MAX);
