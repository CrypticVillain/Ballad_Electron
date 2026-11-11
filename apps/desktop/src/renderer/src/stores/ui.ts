import { create } from 'zustand';
import type { Roll } from '@/lib/tabletop';
import type { ShareCollection } from '@/lib/model';
import { usePreferences } from './preferences';

/**
 * UI store — which dialogs and modes are on. Anything can open one (the
 * status bar, shortcuts, a button deep in a screen) without passing props
 * around; components/shared/Dialogs.tsx renders them.
 */

/** The world dialogs (components/dialogs/WorldDialogs.tsx). */
export type WorldDialog = { kind: 'create' } | { kind: 'edit'; id: string } | { kind: 'delete'; id: string } | { kind: 'copy'; id: string } | { kind: 'sequel'; id: string } | null;

/** Manage Spaces or Manage Folders (components/dialogs/ManageLayoutDialog.tsx). */
export type ManageDialog = 'spaces' | 'folders' | null;

/** What the Share popup is sharing (components/tabletop/Sharing.tsx): one thing, or a space's or folder's. */
export type ShareTarget = { collection: ShareCollection; ids: string[]; title: string };

/** What a New button makes, through the New popup (components/dialogs/NewDialog.tsx). */
export type NewKind = 'map' | 'npc' | 'place' | 'item' | 'monster' | 'encounter';

/**
 * The New popup: from the Library first, or your own. `custom` is the
 * opener's own New (for a map, the upload); `opened` shows what the Library
 * made, when the opener has its own way to (else the popup goes to it).
 */
export type NewTarget = { kind: NewKind; custom: () => void; opened?: (id: string) => void };

/** The account dialogs (components/dialogs/AccountDialogs.tsx). */
export type AccountDialog = { kind: 'add' } | { kind: 'settings'; id: string } | { kind: 'signOut'; id: string } | null;

type UiState = {
  search: boolean;
  settings: boolean;
  /** The Help sheet: every shortcut (Shift+/). */
  help: boolean;
  world: WorldDialog;
  account: AccountDialog;
  manage: ManageDialog;
  share: ShareTarget | null;
  newThing: NewTarget | null;
  /** The GM's list of everything shared. */
  sharedTracker: boolean;
  /** The Trash (components/dialogs/TrashDialog). */
  trash: boolean;
  /** Focus mode: the manuscript alone, without the binder and the scene panel (Ctrl+Shift+F). */
  focus: boolean;
  /** Tabletop's dice tray (Ctrl+D). */
  dice: boolean;
  /** Character sheets unlocked: every field typed into in place (locked, lists change through their dialogs). */
  sheetUnlocked: boolean;
  /** The dice rolled this session, newest first (the tray's history; sheets roll into it too). */
  rolls: Roll[];
  /**
   * The latest roll, to throw across the screen (components/tabletop/DiceOverlay.tsx); `id` counts throws.
   * `parts`: a card's rolls thrown together (to hit and damage), each one's total shown when they land.
   */
  lastThrow: { id: number; roll: Roll; parts?: ThrownPart[]; /** Rolled already (a card's): not a roll of this tray's. */ shown?: true } | null;
  setSearch: (open: boolean) => void;
  setSettings: (open: boolean) => void;
  setHelp: (open: boolean) => void;
  openWorldDialog: (dialog: WorldDialog) => void;
  openAccount: (dialog: AccountDialog) => void;
  setManage: (dialog: ManageDialog) => void;
  setShare: (target: ShareTarget | null) => void;
  setNewThing: (target: NewTarget | null) => void;
  setSharedTracker: (open: boolean) => void;
  setTrash: (open: boolean) => void;
  setFocus: (on: boolean) => void;
  setDice: (open: boolean) => void;
  setSheetUnlocked: (on: boolean) => void;
  addRoll: (roll: Roll) => void;
  /** Throws dice already rolled (a card from a sheet), without adding them to the tray's history. */
  showThrow: (roll: Roll, parts?: ThrownPart[]) => void;
};

/** One roll of several thrown together: what it was, its total and how it's made up. */
export type ThrownPart = { label: string; total: number; detail: string; natural?: 20 | 1 | null };

export const useUi = create<UiState>((set) => ({
  search: false,
  settings: false,
  help: false,
  world: null,
  account: null,
  manage: null,
  share: null,
  newThing: null,
  sharedTracker: false,
  trash: false,
  focus: false,
  // The tray opens with the app if it was open when you left (pinned or not).
  dice: usePreferences.getState().diceOpen,
  rolls: [],
  lastThrow: null,
  sheetUnlocked: false,
  setSearch: (search) => set({ search }),
  setSettings: (settings) => set({ settings }),
  setHelp: (help) => set({ help }),
  openWorldDialog: (world) => set({ world }),
  openAccount: (account) => set({ account }),
  setManage: (manage) => set({ manage }),
  setShare: (share) => set({ share }),
  setNewThing: (newThing) => set({ newThing }),
  setSharedTracker: (sharedTracker) => set({ sharedTracker }),
  setTrash: (trash) => set({ trash }),
  setFocus: (focus) => set({ focus }),
  setDice: (dice) => {
    set({ dice });
    if (usePreferences.getState().diceOpen !== dice) usePreferences.getState().setPreference('diceOpen', dice);
  },
  setSheetUnlocked: (sheetUnlocked) => set({ sheetUnlocked }),
  addRoll: (roll) => set((s) => ({ rolls: [roll, ...s.rolls].slice(0, 30), lastThrow: { id: (s.lastThrow?.id ?? 0) + 1, roll } })),
  showThrow: (roll, parts) => set((s) => ({ lastThrow: { id: (s.lastThrow?.id ?? 0) + 1, roll, shown: true, ...(parts ? { parts } : {}) } })),
}));
