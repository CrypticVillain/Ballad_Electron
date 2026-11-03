import { create } from 'zustand';
import type { ThemeSource } from '../../../shared/ipc';

/**
 * Preferences store — display & behavior choices (Settings). Saved in this
 * window's localStorage (they're about this computer, not your data, so they
 * stay out of the vault) and loaded when the store is created, so the app
 * opens in the saved theme.
 */

/** The suite's looks (styles/globals.css), each in light and dark: Settings → Appearance. */
export const STYLES = ['display', 'chassis', 'field', 'ledger'] as const;
export type AppStyle = (typeof STYLES)[number];

/** The manuscript's typeface: a book serif (Literata) or the style's own sans. */
export const MANUSCRIPT_FONTS = ['serif', 'sans'] as const;
export type ManuscriptFont = (typeof MANUSCRIPT_FONTS)[number];

export type Preferences = {
  /** Light or dark colors ('system' = follow the OS). */
  theme: ThemeSource;
  /** When the theme was last chosen (ms; here or in the installer), so a newer installer choice can take over. */
  themeAt: number;
  /** The look: Display (dot matrix, the default), Chassis, Field or Ledger. */
  style: AppStyle;
  /** The world that's open (null: the first one). */
  worldId: string | null;
  manuscriptFont: ManuscriptFont;
  /** Words a day, for the week's meter and the status bar. */
  dailyGoal: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  themeAt: 0,
  style: 'display',
  worldId: null,
  manuscriptFont: 'serif',
  dailyGoal: 1000,
};

const KEY = 'ballad.preferences';

function load(): Preferences {
  const prefs = { ...DEFAULT_PREFERENCES };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    applySaved(prefs, saved);
  } catch {
    // unreadable: defaults
  }
  // The installer's Appearance page: its theme wins if it was picked after yours (a first run, or a reinstall).
  const installed = window.api?.config?.installTheme;
  if (installed && installed.at > prefs.themeAt) {
    prefs.theme = installed.theme;
    prefs.themeAt = installed.at;
    save(prefs);
  }
  return prefs;
}

function save(prefs: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // storage full or blocked: the choice still applies for this session
  }
}

/** Copies the valid values of what was saved into `prefs`. */
function applySaved(prefs: Preferences, saved: Record<string, unknown> | null) {
  if (!saved) return;
  if (saved.theme === 'system' || saved.theme === 'light' || saved.theme === 'dark') prefs.theme = saved.theme;
  if (typeof saved.themeAt === 'number') prefs.themeAt = saved.themeAt;
  if (STYLES.includes(saved.style as AppStyle)) prefs.style = saved.style as AppStyle;
  if (typeof saved.worldId === 'string') prefs.worldId = saved.worldId;
  if (MANUSCRIPT_FONTS.includes(saved.manuscriptFont as ManuscriptFont)) prefs.manuscriptFont = saved.manuscriptFont as ManuscriptFont;
  if (typeof saved.dailyGoal === 'number' && saved.dailyGoal >= 0) prefs.dailyGoal = saved.dailyGoal;
}

type PreferencesState = Preferences & {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...load(),
  setPreference: (key, value) => {
    set({ [key]: value, ...(key === 'theme' ? { themeAt: Date.now() } : {}) } as Partial<Preferences>);
    const { setPreference: _omit, ...prefs } = get();
    save(prefs);
  },
}));
