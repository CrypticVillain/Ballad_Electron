import { create } from 'zustand';
import { useVault } from '@/stores/vault';
import { resolveToken, type TokenView } from '@/tabletop/battlemap/tokens/resolve';
import type { CardTarget } from '../sheet/rolls';

/**
 * Play → the tokens you're targeting (Table Settings → Targets): right-click
 * a token on the board to target it, again to stop. Yours alone, in this
 * window, not saved. A card you send while targeting carries them: an attack
 * says hit or miss against each one's AC, a save lists them with its DC,
 * and Apply puts its damage on them.
 */

type Targets = { ids: string[]; toggle: (id: string) => void; clear: () => void };

export const useTargets = create<Targets>((set) => ({
  ids: [],
  toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
  clear: () => set({ ids: [] }),
}));

/** A token as the board shows it now (its sheet's name, AC and hit points for one of the party), or undefined if it's gone. */
export function viewOf(tokenId: string): TokenView | undefined {
  const v = useVault.getState().vault;
  const token = v.tokens[tokenId];
  if (!token || token.deletedAt) return undefined;
  return resolveToken(token, { pcs: new Map(Object.entries(v.pcs)), monsters: new Map(Object.entries(v.monsters)), entries: new Map(Object.entries(v.entries)) });
}

/** What you're targeting now, as a card keeps it: each token's name and AC when the card was sent. */
export function currentTargets(): CardTarget[] {
  return useTargets
    .getState()
    .ids.map(viewOf)
    .filter((t): t is TokenView => Boolean(t))
    .map((t) => ({ tokenId: t.token.id, name: t.name, ac: t.ac }));
}
