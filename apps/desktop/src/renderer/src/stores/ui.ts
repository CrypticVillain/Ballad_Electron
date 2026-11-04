import { create } from 'zustand';
import type { Roll } from '@/lib/dnd';
import type { ShareCollection } from '@/lib/model';
import { usePreferences } from './preferences';

/**
 * UI store — which dialogs and modes are on. Anything can open one (the
 * status bar, shortcuts, a button deep in a screen) without passing props
 * around; components/shared/Dialogs.tsx renders them.
 */

/** The world dialogs (components/dialogs/WorldDialogs.tsx). */
export type WorldDialog = { kind: 'create' } | { kind: 'edit'; id: string } | { kind: 'delete'; id: string } | null;

/** Manage Spaces or Manage Folders (components/dialogs/ManageLayoutDialog.tsx). */
export type ManageDialog = 'spaces' | 'folders' | null;

/** What the Share popup is sharing (components/dnd/Sharing.tsx): one thing, or a space's or folder's. */
export type ShareTarget = { collection: ShareCollection; ids: string[]; title: string };

/** The account dialogs (components/dialogs/AccountDialogs.tsx). */
export type AccountDialog = { kind: 'add' } | { kind: 'settings'; id: string } | { kind: 'signOut'; id: string } | null;

type UiState = {
  search: boolean;
  settings: boolean;
  world: WorldDialog;
  account: AccountDialog;
  manage: ManageDialog;
  share: ShareTarget | null;
  /** The DM's list of everything shared. */
  sharedTracker: boolean;
  /** Focus mode: the manuscript alone, without the binder and the scene panel (Ctrl+Shift+F). */
  focus: boolean;
  /** D&D's dice tray (Ctrl+D). */
  dice: boolean;
  /** Character sheets unlocked: every field typed into in place (locked, lists change through their dialogs). */
  sheetUnlocked: boolean;
  /** The dice rolled this session, newest first (the tray's history; sheets roll into it too). */
  rolls: Roll[];
  /** The latest roll, to throw across the screen (components/dnd/DiceOverlay.tsx); `id` counts throws. */
  lastThrow: { id: number; roll: Roll } | null;
  setSearch: (open: boolean) => void;
  setSettings: (open: boolean) => void;
  openWorldDialog: (dialog: WorldDialog) => void;
  openAccount: (dialog: AccountDialog) => void;
  setManage: (dialog: ManageDialog) => void;
  setShare: (target: ShareTarget | null) => void;
  setSharedTracker: (open: boolean) => void;
  setFocus: (on: boolean) => void;
  setDice: (open: boolean) => void;
  setSheetUnlocked: (on: boolean) => void;
  addRoll: (roll: Roll) => void;
};

export const useUi = create<UiState>((set) => ({
  search: false,
  settings: false,
  world: null,
  account: null,
  manage: null,
  share: null,
  sharedTracker: false,
  focus: false,
  // The tray opens with the app if it was open when you left (pinned or not).
  dice: usePreferences.getState().diceOpen,
  rolls: [],
  lastThrow: null,
  sheetUnlocked: false,
  setSearch: (search) => set({ search }),
  setSettings: (settings) => set({ settings }),
  openWorldDialog: (world) => set({ world }),
  openAccount: (account) => set({ account }),
  setManage: (manage) => set({ manage }),
  setShare: (share) => set({ share }),
  setSharedTracker: (sharedTracker) => set({ sharedTracker }),
  setFocus: (focus) => set({ focus }),
  setDice: (dice) => {
    set({ dice });
    if (usePreferences.getState().diceOpen !== dice) usePreferences.getState().setPreference('diceOpen', dice);
  },
  setSheetUnlocked: (sheetUnlocked) => set({ sheetUnlocked }),
  addRoll: (roll) => set((s) => ({ rolls: [roll, ...s.rolls].slice(0, 30), lastThrow: { id: (s.lastThrow?.id ?? 0) + 1, roll } })),
}));
