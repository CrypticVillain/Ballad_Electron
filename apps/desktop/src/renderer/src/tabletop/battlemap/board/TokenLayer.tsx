import { EyeOffIcon } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { mediaSrc } from '@/components/shared/Portrait';
import { CONDITION_TEXT } from '@/lib/tabletop';
import { initials } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { Point } from '../geometry/grid';
import { tokenWidth } from '../geometry/tokens';
import type { GridSettings } from '../model';
import { hpState, KIND_TONE, type TokenView } from '../tokens/resolve';

/**
 * Tabletop → Battle maps: the tokens, drawn on the scene (they zoom with the map).
 * Each is a round picture (or initials) in its kind's color, a hit point bar
 * above when it has them, its conditions as markers, its name below; a
 * hidden one is faded with a dashed ring, a selected one ringed. Auras are
 * drawn first, under every token. Names, bars and markers are sized against
 * the zoom so they read the same at any zoom.
 */

const BAR: Record<ReturnType<typeof hpState>, string> = { fine: 'bg-online', hurt: 'bg-amber-500', bloodied: 'bg-destructive', down: 'bg-zinc-500' };

export function TokenLayer({
  views,
  grid,
  zoom,
  rotation = 0,
  selected,
  moving,
  onPointerDown,
}: {
  views: TokenView[];
  grid: GridSettings;
  zoom: number;
  /** The view's turn: tokens turn back so they stay upright. */
  rotation?: number;
  selected: Set<string>;
  /** Where tokens being dragged are now (not yet saved). */
  moving: Map<string, Point>;
  onPointerDown: (e: ReactPointerEvent, id: string) => void;
}) {
  const k = 1 / zoom;
  const at = (v: TokenView) => moving.get(v.token.id) ?? v.token;
  return (
    <>
      {views.map((v) => {
        const { radius, color } = v.token.aura;
        if (!radius) return null;
        const p = at(v);
        const r = tokenWidth(grid, v.token.size) / 2 + (radius / grid.distance) * grid.size;
        return <div key={`aura-${v.token.id}`} aria-hidden className="pointer-events-none absolute rounded-full" style={{ left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, background: `${color}26`, border: `${2 * k}px solid ${color}aa` }} />;
      })}
      {views.map((v) => {
        const t = v.token;
        const p = at(v);
        const w = tokenWidth(grid, t.size);
        const on = selected.has(t.id);
        const ring = KIND_TONE[t.kind];
        const label = `${v.name}${v.hp ? `, ${v.hp.current} of ${v.hp.max} hit points` : ''}${v.conditions.length ? `, ${v.conditions.join(', ')}` : ''}${t.hidden ? ', hidden' : ''}`;
        return (
          <div
            key={t.id}
            role="button"
            aria-label={label}
            aria-pressed={on}
            data-token={t.id}
            onPointerDown={(e) => onPointerDown(e, t.id)}
            className="absolute"
            style={{ left: p.x - w / 2, top: p.y - w / 2, width: w, height: w, cursor: 'move', transform: rotation ? `rotate(${-rotation}deg)` : undefined }}
          >
            {on && <div aria-hidden className="absolute rounded-full" style={{ inset: -4 * k, border: `${3 * k}px solid var(--primary)`, boxShadow: `0 0 ${10 * k}px var(--primary)` }} />}
            <div
              className={cn('relative size-full overflow-hidden rounded-full bg-zinc-800 shadow-md', t.hidden && 'opacity-50')}
              style={{ border: `${Math.max(2, w * 0.05)}px ${t.hidden ? 'dashed' : 'solid'} ${ring}` }}
            >
              {v.image ? (
                <img src={mediaSrc(v.image)} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center font-bold text-white select-none" style={{ fontSize: w * 0.36 }}>
                  {initials(v.name)}
                </span>
              )}
              {v.hp && v.hp.current <= 0 && <span aria-hidden className="absolute inset-0 bg-black/55" />}
            </div>
            {v.hp && v.hp.max > 0 && (
              <div aria-hidden className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-full bg-black/60" style={{ top: -9 * k, width: Math.max(w, 40 * k), height: 5 * k }}>
                <div className={cn('h-full', BAR[hpState(v.hp)])} style={{ width: `${Math.max(0, Math.min(1, v.hp.current / v.hp.max)) * 100}%` }} />
              </div>
            )}
            {v.conditions.length > 0 && (
              <div className="absolute flex flex-wrap justify-end" style={{ right: -4 * k, bottom: -4 * k, gap: 2 * k, maxWidth: w }}>
                {v.conditions.slice(0, 4).map((c) => (
                  <span key={c} title={`${c}: ${CONDITION_TEXT[c] ?? ''}`} className="flex items-center justify-center rounded-full bg-amber-400 font-bold text-black shadow" style={{ width: 16 * k, height: 16 * k, fontSize: 9 * k }}>
                    {c.slice(0, 2)}
                  </span>
                ))}
                {v.conditions.length > 4 && (
                  <span className="flex items-center justify-center rounded-full bg-amber-400 font-bold text-black" style={{ width: 16 * k, height: 16 * k, fontSize: 9 * k }}>
                    +{v.conditions.length - 4}
                  </span>
                )}
              </div>
            )}
            {t.hidden && (
              <span aria-hidden className="absolute flex items-center justify-center rounded-full bg-black/70 text-white" style={{ left: -4 * k, top: -4 * k, width: 18 * k, height: 18 * k }}>
                <EyeOffIcon style={{ width: 11 * k, height: 11 * k }} />
              </span>
            )}
            <span
              aria-hidden
              className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 truncate rounded-full bg-black/65 text-center font-medium whitespace-nowrap text-white', v.missing && 'line-through')}
              style={{ top: w + 3 * k, fontSize: 11 * k, padding: `${1 * k}px ${6 * k}px`, maxWidth: Math.max(w * 2, 140 * k) }}
            >
              {v.name}
            </span>
          </div>
        );
      })}
    </>
  );
}
