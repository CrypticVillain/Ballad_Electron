import { create } from 'zustand';

/**
 * UI store — which dialogs and modes are on. Anything can open one (the
 * status bar, shortcuts, a button deep in a screen) without passing props
 * around; components/shared/Dialogs.tsx renders them.
 */

type UiState = {
  search: boolean;
  settings: boolean;
  /** The New World dialog. */
  newWorld: boolean;
  /** Focus mode: the manuscript alone, without the binder and the scene panel (F11 / Ctrl+Shift+F). */
  focus: boolean;
  setSearch: (open: boolean) => void;
  setSettings: (open: boolean) => void;
  setNewWorld: (open: boolean) => void;
  setFocus: (on: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  search: false,
  settings: false,
  newWorld: false,
  focus: false,
  setSearch: (search) => set({ search }),
  setSettings: (settings) => set({ settings }),
  setNewWorld: (newWorld) => set({ newWorld }),
  setFocus: (focus) => set({ focus }),
}));
