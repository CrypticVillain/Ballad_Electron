/**
 * Filmmaking → Call Sheets: what a shoot day's call sheet adds to the day
 * itself (its date, general call, location and scenes): everyone's own call,
 * the times of the day, where to go if something goes wrong, and notes.
 */

export type CastCall = {
  /** "HH:mm": picked up / arrives. */
  call?: string;
  /** Into makeup and wardrobe. */
  makeup?: string;
  /** On set, ready. */
  set?: string;
  note?: string;
};

export type CallSheet = {
  /** Camera rolls ("HH:mm"). */
  shooting?: string;
  breakfast?: string;
  lunch?: string;
  /** Estimated wrap. */
  wrap?: string;
  weather?: string;
  sunrise?: string;
  sunset?: string;
  /** Nearest hospital: name, address, phone. */
  hospital?: string;
  /** Where to park, and base camp. */
  parking?: string;
  /** Production office, producer, AD: who to call. */
  contacts?: string;
  /** Safety, notes for the day. */
  notes?: string;
  /** Per cast member (entry id). */
  cast?: Record<string, CastCall>;
  /** Per crew member (entry id): their call ("HH:mm"); off: not needed today. */
  crew?: Record<string, { call?: string; off?: boolean }>;
  /** A line about each scene for the day (entry: scene id). */
  sceneNotes?: Record<string, string>;
};
