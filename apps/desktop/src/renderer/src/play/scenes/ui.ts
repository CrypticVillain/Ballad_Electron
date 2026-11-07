import { create } from 'zustand';

/**
 * Play → Scenes: what the Play window shows (not saved): the scene the GM
 * has open (players see the started one), the settings panel, the New Scene
 * dialog, the Library in place of the board (the GM's, in Play's window). The
 * board's own picks (tool, tokens) are tabletop/battlemap's.
 */
type PlayUi = {
  sceneId: string | null;
  /** Opens a scene (and leaves the Library for it). */
  setSceneId: (id: string | null) => void;
  library: boolean;
  setLibrary: (open: boolean) => void;
  panel: boolean;
  setPanel: (open: boolean) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
};

export const usePlayUi = create<PlayUi>((set) => ({
  sceneId: null,
  setSceneId: (sceneId) => set({ sceneId, library: false }),
  library: false,
  setLibrary: (library) => set({ library }),
  panel: true,
  setPanel: (panel) => set({ panel }),
  creating: false,
  setCreating: (creating) => set({ creating }),
}));
