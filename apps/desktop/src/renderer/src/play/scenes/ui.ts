import { create } from 'zustand';

/**
 * Play → Scenes: what the Play window shows (not saved): the scene the GM
 * has open (players see the started one), the settings panel, the New Scene
 * dialog, Music or the Library in place of the board (the GM's, in Play's
 * window). The board's own picks (tool, tokens) are tabletop/battlemap's.
 */
type PlayUi = {
  sceneId: string | null;
  /** Opens a scene (and leaves the Library or Music for it). */
  setSceneId: (id: string | null) => void;
  page: 'library' | 'music' | null;
  setPage: (page: 'library' | 'music' | null) => void;
  panel: boolean;
  setPanel: (open: boolean) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
};

export const usePlayUi = create<PlayUi>((set) => ({
  sceneId: null,
  setSceneId: (sceneId) => set({ sceneId, page: null }),
  page: null,
  setPage: (page) => set({ page }),
  panel: true,
  setPanel: (panel) => set({ panel }),
  creating: false,
  setCreating: (creating) => set({ creating }),
}));
