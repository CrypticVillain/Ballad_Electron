import { create } from 'zustand';

/**
 * Tabletop → Play: what's picked on the board, for the page's parts to share
 * (the toolbar, the board, the settings panel). Not saved.
 *
 *   select   pan the map (drag), zoom (wheel)
 *   ruler    measure: drag; Space drops a waypoint
 *   lineup   drag a box over one square of the map to fit the grid to it
 */
export type PlayTool = 'select' | 'ruler' | 'lineup';

type PlayUi = {
  tool: PlayTool;
  setTool: (tool: PlayTool) => void;
  /** The scene settings panel beside the board. */
  panel: boolean;
  setPanel: (open: boolean) => void;
  /** The New Scene dialog. */
  creating: boolean;
  setCreating: (open: boolean) => void;
};

export const usePlayUi = create<PlayUi>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  panel: true,
  setPanel: (panel) => set({ panel }),
  creating: false,
  setCreating: (creating) => set({ creating }),
}));
