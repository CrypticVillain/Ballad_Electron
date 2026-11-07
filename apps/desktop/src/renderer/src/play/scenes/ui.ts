import { create } from 'zustand';

/**
 * Play → Scenes: what the Play window shows (not saved): the scene the GM
 * has open (players see the started one), the settings panel, the New Scene
 * dialog. The board's own picks (tool, tokens) are tabletop/battlemap's.
 */
type PlayUi = {
  sceneId: string | null;
  setSceneId: (id: string | null) => void;
  panel: boolean;
  setPanel: (open: boolean) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
};

export const usePlayUi = create<PlayUi>((set) => ({
  sceneId: null,
  setSceneId: (sceneId) => set({ sceneId }),
  panel: true,
  setPanel: (panel) => set({ panel }),
  creating: false,
  setCreating: (creating) => set({ creating }),
}));
