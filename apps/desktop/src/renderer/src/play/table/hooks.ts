import { useEffect, useMemo, useState } from 'react';
import { useLive } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { accountName, useAccounts } from '@/stores/accounts';
import { useVault } from '@/stores/vault';
import type { BoardTable } from '@/tabletop/battlemap/board/Board';
import type { BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import type { PlayScene } from '../scenes/model';
import { addTemplate, ping, removeTemplates, type Speaker } from './actions';
import { accountColor, activeToken, PING_MS } from './logic';

/** Who this window is at the table: the GM is "GM"; a player goes by their characters' names (else their account's). */
export function useSpeaker(world: World, access: BoardAccess): Speaker {
  const pcs = useLive('pcs');
  const accounts = useAccounts((s) => s.accounts);
  return useMemo(() => {
    if (access.gm) return { worldId: world.id, accountId: access.accountId, who: 'GM' };
    const mine = pcs.filter((pc) => pc.worldId === world.id && pc.ownerAccountId === access.accountId).map((pc) => (pc.name || 'Unnamed').split(' ')[0]!);
    const account = accounts.find((a) => a.id === access.accountId);
    return { worldId: world.id, accountId: access.accountId, who: mine.length ? mine.join(' & ') : account ? accountName(account) : 'A Player' };
  }, [world.id, access, pcs, accounts]);
}

/** Everyone at the table besides you, by account: the GM (the campaign's owner) and its players. */
export function useTablePeople(world: World, ownerId: string): { accountId: string; name: string; aliases: string[] }[] {
  const accounts = useAccounts((s) => s.accounts);
  const pcs = useLive('pcs');
  return useMemo(() => {
    // A player goes by their account's name and their characters' ("Sam (Brin Ashvale)").
    const characters = (id: string) => pcs.filter((p) => p.worldId === world.id && p.ownerAccountId === id && p.name).map((p) => p.name);
    const name = (id: string) => {
      const a = accounts.find((x) => x.id === id);
      const own = characters(id);
      if (!a) return own.join(' & ') || 'A player';
      return own.length ? `${accountName(a)} (${own.join(' & ')})` : accountName(a);
    };
    return [
      { accountId: ownerId, name: `${name(ownerId).replace(/ \(.*\)$/, '')} (GM)`, aliases: [] },
      ...(world.tabletop?.members ?? []).filter((m) => m.accountId !== ownerId).map((m) => ({ accountId: m.accountId, name: name(m.accountId), aliases: characters(m.accountId) })),
    ];
  }, [world, ownerId, accounts, pcs]);
}

/** Re-renders every `ms` while `on`: for what shows only for a while (pings). */
function useTick(on: boolean, ms = 500) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
}

/** Play's table on a scene's board: whose turn, the pings, the areas laid on it, and laying and clearing them. */
export function useBoardTable(scene: PlayScene, speaker: Speaker, access: BoardAccess, overlay?: BoardTable['overlay']): BoardTable {
  const log = useVault((s) => s.vault.tableLog);
  const all = useVault((s) => s.vault.templates);
  const recent = Object.values(log).filter((e) => e.kind === 'ping' && e.ping?.sceneId === scene.id && !e.deletedAt && Date.now() - Date.parse(e.createdAt) < PING_MS);
  useTick(recent.length > 0);
  const templates = useMemo(() => Object.values(all).filter((t) => !t.deletedAt && t.sceneId === scene.id), [all, scene.id]);
  return {
    activeTokenId: activeToken(scene.combat),
    pings: recent.map((e) => ({ id: e.id, x: e.ping!.x, y: e.ping!.y, color: accountColor(e.accountId), who: e.who })),
    onPing: (p) => ping(speaker, scene.id, p.x, p.y),
    templates,
    color: accountColor(access.accountId),
    onTemplate: (t) => addTemplate({ worldId: scene.worldId, sceneId: scene.id, accountId: access.accountId, color: accountColor(access.accountId), ...t }),
    onClearTemplates: () => removeTemplates(templates.filter((t) => access.gm || t.accountId === access.accountId).map((t) => t.id)),
    overlay,
  };
}
