import { create } from 'zustand';

/**
 * Tabletop → Battle maps: what's picked on the board in this window (one
 * board shows at a time: an encounter's map in Tabletop, a scene in Play).
 * Not saved.
 *
 *   select   pick and move tokens; drag the map to pan
 *   ruler    measure: drag; Space drops a waypoint
 *   lineup   drag a box over one square of the map to fit the grid to it
 *   fog      reveal or hide (fogMode) with a box, a shape or a brush (fogShape, brush)
 */
export type BoardTool = 'select' | 'ruler' | 'lineup' | 'fog';

type BoardUi = {
  tool: BoardTool;
  setTool: (tool: BoardTool) => void;
  fogMode: 'reveal' | 'hide';
  setFogMode: (mode: 'reveal' | 'hide') => void;
  fogShape: 'rect' | 'poly' | 'brush';
  setFogShape: (shape: 'rect' | 'poly' | 'brush') => void;
  /** The fog brush's width, in squares. */
  brush: number;
  setBrush: (squares: number) => void;
  /** The picked tokens (the panel beside the board shows them). */
  selected: string[];
  setSelected: (ids: string[]) => void;
  /** The Add Tokens tray over the board. */
  tray: boolean;
  setTray: (open: boolean) => void;
};

export const useBoardUi = create<BoardUi>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  fogMode: 'reveal',
  setFogMode: (fogMode) => set({ fogMode }),
  fogShape: 'rect',
  setFogShape: (fogShape) => set({ fogShape }),
  brush: 2,
  setBrush: (brush) => set({ brush }),
  selected: [],
  setSelected: (selected) => set({ selected }),
  tray: false,
  setTray: (tray) => set({ tray }),
}));
