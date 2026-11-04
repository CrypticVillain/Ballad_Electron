import { useMemo } from 'react';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import { byOrder, type Entry, type Scene } from '@/lib/model';
import { buildScript, type BuiltScript } from './build';
import { castNumbers, castOfScene } from './cast';
import { blocksToElements, type Heading } from './elements';
import type { ScriptElement } from './model';

/**
 * Filmmaking → Script: the open production's scripts, read once for every
 * screen that needs them (shots, schedule, stripboard, call sheets,
 * breakdown, reports): each scene's number, length in eighths, heading,
 * elements and cast.
 */

export type ProductionScene = {
  scene: Scene;
  bookId: string;
  /** "12", "12A": as locked, else in order across the production's scripts. */
  number: string;
  eighths: number;
  heading: Heading;
  elements: ScriptElement[];
  /** Cast entry ids, in cast order. */
  cast: string[];
  /** Speakers no cast member matches. */
  unmatched: string[];
};

export type ProductionScript = {
  scenes: ProductionScene[];
  byId: Map<string, ProductionScene>;
  /** The production's cast entries. */
  cast: Entry[];
  castNumber: Map<string, number>;
  scripts: BuiltScript[];
};

export function useProductionScript(): ProductionScript {
  const books = useBooks();
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  const entries = useWorldRecords('entries');
  return useMemo(() => {
    const cast = entries.filter((e) => e.kind === 'character');
    const out: ProductionScene[] = [];
    const scripts: BuiltScript[] = [];
    let offset = 0;
    for (const book of [...books].sort(byOrder)) {
      const built = buildScript(book, parts, scenes);
      scripts.push(built);
      const locked = Boolean(book.script?.lock);
      const live = built.scenes.filter((s) => !s.omitted);
      live.forEach((s, i) => {
        const scene = scenes.find((x) => x.id === s.id)!;
        const elements = blocksToElements(scene.content);
        const { ids, unmatched } = castOfScene(scene, elements, cast);
        out.push({ scene, bookId: book.id, number: locked ? s.number : String(offset + i + 1), eighths: built.layout.scenes[s.id]?.eighths ?? 1, heading: s.heading, elements, cast: ids, unmatched });
      });
      offset += live.length;
    }
    return { scenes: out, byId: new Map(out.map((s) => [s.scene.id, s])), cast, castNumber: castNumbers(cast, out.map((s) => s.cast)), scripts };
  }, [books, parts, scenes, entries]);
}
