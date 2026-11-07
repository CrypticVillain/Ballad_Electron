import { useMemo } from 'react';
import { useLive, useWorldRecords } from '@/lib/hooks';
import { resolveToken, type TokenView } from './resolve';

/** Tabletop → Battle maps: a map's tokens as the board shows them, bottom to top. */
export function useBoardTokens(boardId: string): TokenView[] {
  const tokens = useLive('tokens');
  const pcs = useWorldRecords('pcs');
  const monsters = useWorldRecords('monsters');
  const entries = useWorldRecords('entries');
  return useMemo(() => {
    const sources = { pcs: new Map(pcs.map((p) => [p.id, p])), monsters: new Map(monsters.map((m) => [m.id, m])), entries: new Map(entries.map((e) => [e.id, e])) };
    return tokens
      .filter((t) => t.sceneId === boardId)
      .sort((a, b) => a.order - b.order)
      .map((t) => resolveToken(t, sources));
  }, [tokens, pcs, monsters, entries, boardId]);
}
