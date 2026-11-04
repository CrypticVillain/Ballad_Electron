/**
 * Filmmaking → Post: timecode (pure). "01:02:10:12" (hours, minutes,
 * seconds, frames), "1:02:10" or "2:10" read as seconds; frames at 24 a
 * second unless said otherwise.
 */

export function toSeconds(tc: string, fps = 24): number | null {
  const parts = tc.trim().split(/[:;.]/).filter((p) => p !== '');
  if (!parts.length || parts.length > 4 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  const frames = n.length === 4 ? n.pop()! / fps : 0;
  return n.reduce((total, v) => total * 60 + v, 0) + frames;
}

/** 130 → "2:10"; 3725 → "1:02:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** How long a cue runs, in from out ("" when either can't be read, or out is before in). */
export function cueLength(start: string, end: string, fps = 24): string {
  const a = toSeconds(start, fps);
  const b = toSeconds(end, fps);
  return a === null || b === null || b < a ? '' : clock(b - a);
}
