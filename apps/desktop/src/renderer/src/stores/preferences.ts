import { create } from 'zustand';
import { DICE_LOOK_IDS, type DiceLook } from '@/lib/diceLooks';
import { SECTIONS, type DndRole, type Section } from '@/lib/model';
import type { ThemeSource } from '../../../shared/ipc';
import { systemClock, type Clock } from '@/lib/dates';

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
  /** The section that's open in each account (by account id; none: Writing). */
  sections: Record<string, Section>;
  /** The world that's open in each account and section (worldKey(); none: the section's first world). */
  worldIds: Record<string, string>;
  manuscriptFont: ManuscriptFont;
  /** Words a day, for the week's meter and the status bar. */
  dailyGoal: number;
  /** The status bar shows words: today's against the goal (and a book's total in Writing). */
  statusWords: boolean;
  /** The status bar counts journal entries (Player) or sessions played (DM). */
  statusEntries: boolean;
  /** The status bar shows keyboard shortcuts (Ctrl K Search…) at its right. */
  statusShortcuts: boolean;
  /** Times as "7:00 PM" (12) or "19:00" (24). To start, the computer's own. */
  clock: Clock;
  /** D&D: whether you're the DM or a player, in each account (by account id; none: DM). Yours, not a campaign's. */
  dndRoles: Record<string, DndRole>;
  /** D&D Player view: the character you're playing, in each account (none: your first). */
  characterIds: Record<string, string>;
  /** The dice's look (lib/diceLooks.ts). */
  diceLook: DiceLook;
  /** You picked the dice's look yourself (else it follows the default, so a new default reaches you). */
  diceLookChosen: boolean;
  /** Rolls tumble across the screen (off: just the toast). */
  diceAnimation: boolean;
  /** The dice tray is pinned: a panel docked at the window's right edge (and open again next time), not a pop-out. */
  dicePinned: boolean;
  /** The dice tray was open when you left (it opens again with the app). */
  diceOpen: boolean;
  /** How the character lists group your characters: by campaign, or by your folders. */
  characterGrouping: 'campaign' | 'folder';
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  themeAt: 0,
  style: 'display',
  sections: {},
  worldIds: {},
  manuscriptFont: 'serif',
  dailyGoal: 1000,
  statusWords: true,
  statusEntries: true,
  statusShortcuts: true,
  clock: systemClock(),
  dndRoles: {},
  characterIds: {},
  diceLook: 'display-dark',
  diceLookChosen: false,
  diceAnimation: true,
  dicePinned: false,
  diceOpen: false,
  characterGrouping: 'campaign',
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
  if (saved.worldIds && typeof saved.worldIds === 'object') {
    prefs.worldIds = Object.fromEntries(Object.entries(saved.worldIds).filter(([, id]) => typeof id === 'string')) as Record<string, string>;
  }
  if (saved.sections && typeof saved.sections === 'object') {
    prefs.sections = Object.fromEntries(Object.entries(saved.sections).filter(([, s]) => SECTIONS.includes(s as Section))) as Record<string, Section>;
  }
  // Before accounts: one open world, the first account's.
  if (typeof saved.worldId === 'string') prefs.worldIds.default ??= saved.worldId;
  if (MANUSCRIPT_FONTS.includes(saved.manuscriptFont as ManuscriptFont)) prefs.manuscriptFont = saved.manuscriptFont as ManuscriptFont;
  if (typeof saved.dailyGoal === 'number' && saved.dailyGoal >= 0) prefs.dailyGoal = saved.dailyGoal;
  if (typeof saved.statusWords === 'boolean') prefs.statusWords = saved.statusWords;
  if (typeof saved.statusEntries === 'boolean') prefs.statusEntries = saved.statusEntries;
  if (typeof saved.statusShortcuts === 'boolean') prefs.statusShortcuts = saved.statusShortcuts;
  if (saved.clock === '12' || saved.clock === '24') prefs.clock = saved.clock;
  if (saved.dndRoles && typeof saved.dndRoles === 'object') {
    prefs.dndRoles = Object.fromEntries(Object.entries(saved.dndRoles).filter(([, r]) => r === 'dm' || r === 'player')) as Record<string, DndRole>;
  }
  if (saved.characterIds && typeof saved.characterIds === 'object') {
    prefs.characterIds = Object.fromEntries(Object.entries(saved.characterIds).filter(([, id]) => typeof id === 'string')) as Record<string, string>;
  }
  // Only a look you picked is kept: one saved along with other settings was the default then. An old pick
  // from when the looks matched the app's styles ("match", "chassis"…) falls back to the default.
  if (saved.diceLookChosen === true && DICE_LOOK_IDS.includes(saved.diceLook as DiceLook)) {
    prefs.diceLook = saved.diceLook as DiceLook;
    prefs.diceLookChosen = true;
  }
  if (typeof saved.diceAnimation === 'boolean') prefs.diceAnimation = saved.diceAnimation;
  if (typeof saved.dicePinned === 'boolean') prefs.dicePinned = saved.dicePinned;
  // Before diceOpen, a pinned tray opened with the app and a loose one didn't.
  prefs.diceOpen = typeof saved.diceOpen === 'boolean' ? saved.diceOpen : prefs.dicePinned;
  if (saved.characterGrouping === 'campaign' || saved.characterGrouping === 'folder') prefs.characterGrouping = saved.characterGrouping;
}

/** The open account (main/accounts.ts). Switching accounts reloads the app, so it's fixed for a session. */
export const currentAccountId = (): string => window.api?.config?.registry?.activeId ?? 'default';

/** The open section of the open account (read outside React). */
export const currentSection = (): Section => usePreferences.getState().sections[currentAccountId()] ?? 'writing';

/** DM or Player, in the open account (read outside React). */
export const currentRole = (): DndRole => usePreferences.getState().dndRoles[currentAccountId()] ?? 'dm';

/** Where the open world of an account's section is kept in worldIds (Writing's under the bare account id, as before sections). */
export const worldKey = (accountId: string, section: Section) => (section === 'writing' ? accountId : `${accountId}/${section}`);

type PreferencesState = Preferences & {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...load(),
  setPreference: (key, value) => {
    set({ [key]: value, ...(key === 'theme' ? { themeAt: Date.now() } : {}), ...(key === 'diceLook' ? { diceLookChosen: true } : {}) } as Partial<Preferences>);
    const { setPreference: _omit, ...prefs } = get();
    save(prefs);
  },
}));
