/**
 * appearance.ts — how an app looks: its style, light or dark, the text font
 * and effects. Each app keeps its own (Settings › Appearance); "Apply to all
 * Monospace apps" and the setup write the suite's (main/themes/appearanceFile.ts),
 * which every app takes when it's newer than its own last change.
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
import { DEFAULT_STYLE, isStyleId, type StyleId } from './styles';

export type ThemeMode = 'system' | 'light' | 'dark';
/** themed: the style's own faces. body: plain text, themed headings. plain: plain everywhere. */
export type TextFont = 'themed' | 'body' | 'plain';
/** reduced: no scanlines, grain, glow or blinking (also when Windows has animations off). */
export type Effects = 'full' | 'reduced';

/**
 * The kinds of working surface an app marks (data-surface="<kind>" on the
 * element; touches.css). Each can have the style's effects (its patterns,
 * grain, scanlines and glow) on or off: on by default. Paper (data-paper:
 * a doc's page, a slide, a notebook page) is never styled at all.
 */
export const SURFACES = [
  { id: 'page', name: 'Pages', blurb: 'Home pages, lists and other screens.' },
  { id: 'editor', name: 'Editors', blurb: 'Where you write: notes, scenes, code.' },
  { id: 'table', name: 'Tables & sheets', blurb: 'Databases, spreadsheets, budgets.' },
  { id: 'diagram', name: 'Diagrams', blurb: 'Graphs, relationships, corkboards.' },
  { id: 'map', name: 'Maps & boards', blurb: 'Maps, the Play table, whiteboards.' },
  { id: 'calendar', name: 'Calendars & timelines', blurb: 'Calendars, schedules, timelines.' },
  { id: 'chat', name: 'Conversations', blurb: 'Messages and chat.' },
] as const;
export type SurfaceKind = (typeof SURFACES)[number]['id'];
export const SURFACE_KINDS: readonly SurfaceKind[] = SURFACES.map((s) => s.id);

export interface Appearance {
  style: StyleId;
  theme: ThemeMode;
  text: TextFont;
  effects: Effects;
  /** The surfaces whose style effects are off (none, by default: every surface is styled). */
  plainSurfaces: SurfaceKind[];
}

export const DEFAULT_APPEARANCE: Appearance = { style: DEFAULT_STYLE, theme: 'system', text: 'themed', effects: 'full', plainSurfaces: [] };

export const THEME_MODES: readonly { id: ThemeMode; name: string }[] = [
  { id: 'system', name: 'Match Windows' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export const TEXT_FONTS: readonly { id: TextFont; name: string; blurb: string }[] = [
  { id: 'themed', name: 'Themed', blurb: 'The style’s own fonts.' },
  { id: 'body', name: 'Plain text', blurb: 'Plain text, the style’s headings.' },
  { id: 'plain', name: 'Plain everywhere', blurb: 'One plain font for everything.' },
];

/** The suite's appearance, as saved: what, when, and which app saved it. */
export interface SuiteAppearance extends Appearance {
  /** When it was applied (ms since 1970). */
  at: number;
  /** "setup", or an app's id. */
  by: string;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/**
 * Anything → a whole Appearance. What's missing or not understood takes
 * `fallback`'s value; a style this build doesn't know (saved by a newer app)
 * becomes the default style.
 */
export function toAppearance(value: unknown, fallback: Appearance = DEFAULT_APPEARANCE): Appearance {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    style: isStyleId(v.style) ? v.style : v.style === undefined ? fallback.style : DEFAULT_STYLE,
    theme: pick<ThemeMode>(v.theme, ['system', 'light', 'dark'], fallback.theme),
    text: pick<TextFont>(v.text, ['themed', 'body', 'plain'], fallback.text),
    effects: pick<Effects>(v.effects, ['full', 'reduced'], fallback.effects),
    plainSurfaces: Array.isArray(v.plainSurfaces) ? SURFACE_KINDS.filter((k) => (v.plainSurfaces as unknown[]).includes(k)) : [...fallback.plainSurfaces],
  };
}

/** The saved file's contents → the suite's appearance, or null if it isn't one. */
export function toSuiteAppearance(value: unknown): SuiteAppearance | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'number' || !Number.isFinite(v.at)) return null;
  return { ...toAppearance(v), at: v.at, by: typeof v.by === 'string' ? v.by : 'unknown' };
}

/** Whether the suite's appearance replaces an app's own: only when it's newer than the app's last change. */
export function suiteWins(suite: SuiteAppearance | null, ownChangedAt: number): suite is SuiteAppearance {
  return suite !== null && suite.at > ownChangedAt;
}

export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return a.style === b.style && a.theme === b.theme && a.text === b.text && a.effects === b.effects && a.plainSurfaces.join() === b.plainSurfaces.join();
}
