import { create } from 'zustand';

/**
 * Play → Scenes: what the Play window shows (not saved): the scene the GM
 * has open (players see the started one), the settings panel, the New Scene
 * dialog, Music, the Library or the scratchpad in place of the board (the GM's, in Play's
 * window), the handout open in the board's place, and which scenes show
 * their objects in the sidebar. The board's own picks (tool, tokens) are
 * tabletop/battlemap's.
 */
type PlayUi = {
  sceneId: string | null;
  /** Opens a scene (and leaves the Library, Music or a handout for it). */
  setSceneId: (id: string | null) => void;
  /** A handout open in the board's place (its scene's). */
  handoutId: string | null;
  setHandoutId: (id: string | null) => void;
  /** Scenes whose objects (tokens, handouts, marks) the sidebar shows or folds away; unset, the open scene's show. */
  expanded: Record<string, boolean>;
  setExpanded: (sceneId: string, open: boolean) => void;
  page: 'library' | 'music' | 'scratchpad' | null;
  setPage: (page: 'library' | 'music' | 'scratchpad' | null) => void;
  panel: boolean;
  setPanel: (open: boolean) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
  /** The table's log beside the board (Play's window). */
  log: boolean;
  setLog: (open: boolean) => void;
  /** The sheet beside the board (Play's window): rolls into the chat. */
  sheet: boolean;
  setSheet: (open: boolean) => void;
};

export const usePlayUi = create<PlayUi>((set) => ({
  sceneId: null,
  setSceneId: (sceneId) => set({ sceneId, page: null, handoutId: null }),
  handoutId: null,
  setHandoutId: (handoutId) => set({ handoutId, page: null }),
  expanded: {},
  setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
  page: null,
  setPage: (page) => set({ page }),
  panel: true,
  setPanel: (panel) => set({ panel }),
  creating: false,
  setCreating: (creating) => set({ creating }),
  log: false,
  setLog: (log) => set({ log }),
  sheet: false,
  setSheet: (sheet) => set({ sheet }),
}));
