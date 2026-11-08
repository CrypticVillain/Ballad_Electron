import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SquareIcon, SwordsIcon, UserPlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import type { TokenView } from '@/tabletop/battlemap/tokens/resolve';
import type { PlayScene } from '../scenes/model';
import { endCombat, joinCombat, leaveCombat, setCombat, startCombat, type Speaker } from './actions';
import { activeToken, ordered, stepTurn } from './logic';

/**
 * A scene's turn order, over the board's corner: the round, everyone in the
 * fight highest initiative first, whose turn it is (their token ringed on
 * the board). The GM starts the fight (everyone on the scene rolls), steps
 * through turns, changes an initiative, adds the picked tokens or takes one
 * out, and ends it; the players see it (but not the hidden tokens).
 */
export function TurnOrder({ scene, views, gm, speaker }: { scene: PlayScene; views: TokenView[]; gm: boolean; speaker: Speaker }) {
  const [open, setOpen] = useState(true);
  const selected = useBoardUi((s) => s.selected);
  const order = scene.combat;
  const byId = new Map(views.map((v) => [v.token.id, v]));
  if (!order) {
    if (!gm || !views.length) return null;
    return (
      <Button size="sm" variant="outline" className="rounded-full bg-background/95 shadow-md backdrop-blur" onClick={() => startCombat(scene, views, speaker)}>
        <SwordsIcon /> Start Combat
      </Button>
    );
  }
  const active = activeToken(order);
  const rows = ordered(order).filter((e) => byId.has(e.tokenId) && (gm || !byId.get(e.tokenId)!.token.hidden));
  const picked = selected.filter((id) => byId.has(id) && !order.entries.some((e) => e.tokenId === id));
  const setInitiative = (tokenId: string, initiative: number | null) => {
    // Keep the turn on whoever's turn it is.
    const entries = order.entries.map((e) => (e.tokenId === tokenId ? { ...e, initiative } : e));
    const turn = Math.max(0, ordered({ ...order, entries }).findIndex((e) => e.tokenId === active));
    setCombat(scene, { ...order, entries, turn });
  };
  return (
    <section aria-label="Turn order" className="flex w-60 flex-col rounded-xl border bg-background/95 shadow-md backdrop-blur">
      <header className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" aria-label={open ? 'Fold the turn order' : 'Unfold the turn order'} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <ChevronDownIcon className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </button>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
          Round <b className="font-display text-base font-black">{order.round}</b>
        </span>
        <span className="flex-1" />
        {gm && (
          <>
            <Button variant="ghost" size="icon-xs" aria-label="Previous turn" onClick={() => setCombat(scene, stepTurn(order, -1))}>
              <ChevronLeftIcon />
            </Button>
            <Button size="xs" onClick={() => setCombat(scene, stepTurn(order, 1))}>
              Next <ChevronRightIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="End combat" title="End Combat" onClick={() => endCombat(scene, speaker)}>
              <SquareIcon />
            </Button>
          </>
        )}
      </header>
      {open && (
        <ol className="flex max-h-[min(360px,50vh)] flex-col overflow-y-auto border-t p-1">
          {rows.map((e) => {
            const v = byId.get(e.tokenId)!;
            const now = e.tokenId === active;
            return (
              <li key={e.tokenId} aria-current={now ? 'true' : undefined} className={cn('group flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]', now && 'bg-amber-400/20 font-semibold', v.token.hidden && 'opacity-60')}>
                {gm ? (
                  <input
                    aria-label={`${v.name}'s initiative`}
                    inputMode="numeric"
                    value={e.initiative ?? ''}
                    placeholder="–"
                    onChange={(ev) => {
                      const n = Number.parseInt(ev.target.value, 10);
                      setInitiative(e.tokenId, Number.isFinite(n) ? n : null);
                    }}
                    className="h-6 w-8 shrink-0 rounded border bg-background text-center font-mono text-[12px] outline-none focus:border-ring"
                  />
                ) : (
                  <span className="w-8 shrink-0 text-center font-mono text-[12px] text-muted-foreground">{e.initiative ?? '–'}</span>
                )}
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                {v.hp && v.hp.current <= 0 && <span className="font-mono text-[10px] text-muted-foreground uppercase">Down</span>}
                {gm && (
                  <button type="button" aria-label={`Take ${v.name} out of the fight`} onClick={() => leaveCombat(scene, [e.tokenId])} className="invisible rounded p-0.5 text-muted-foreground group-hover:visible hover:text-foreground">
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
          {gm && picked.length > 0 && (
            <li className="p-1">
              <Button variant="outline" size="xs" className="w-full" onClick={() => joinCombat(scene, picked.map((id) => byId.get(id)!))}>
                <UserPlusIcon /> Add {picked.length === 1 ? byId.get(picked[0]!)!.name : `The ${picked.length} Picked`}
              </Button>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
