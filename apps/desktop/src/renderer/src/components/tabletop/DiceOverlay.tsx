import { useEffect, useRef, useState } from 'react';
import { natural } from '@/lib/tabletop';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { DiceStage } from './dice3d/stage';
import { useDiceLook } from './Die';
import { breakdown, toastRoll } from './rolling';

const HOLD_MS = 2600;
const FADE_MS = 450;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * DiceOverlay — every roll (the dice tray, a click on a sheet's bonus, an
 * encounter's initiative) thrown onto a see-through 3D table over the window
 * (dice3d/stage.ts): real dice with weight, tumbling in from the left,
 * knocking about and landing however they land. Once they've settled the
 * total comes up below; the dice that advantage set aside go pale. In the dice
 * look you picked (Settings → Dice). Off in Settings, the result is a toast;
 * with reduced motion the dice appear where they'd have landed.
 */
export function DiceOverlay() {
  const lastThrow = useUi((s) => s.lastThrow);
  const animate = usePreferences((s) => s.diceAnimation);
  const look = useDiceLook();
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<DiceStage | null | undefined>(undefined);
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'settled' | 'leaving'>('idle');

  useEffect(() => {
    if (!lastThrow || !animate || !host.current) return;
    if (stage.current === undefined) {
      try {
        stage.current = new DiceStage(host.current);
      } catch {
        stage.current = null;
      }
    }
    if (!stage.current) {
      // A card's rolls (parts) are in the chat already.
      if (!lastThrow.parts) toastRoll(lastThrow.roll);
      return;
    }
    const table = stage.current;
    const timers: number[] = [];
    let live = true;
    setPhase('rolling');
    void table.throw(lastThrow.roll, look, reducedMotion()).then((landed) => {
      if (!live || !landed) return;
      setPhase('settled');
      timers.push(window.setTimeout(() => setPhase('leaving'), HOLD_MS));
      timers.push(
        window.setTimeout(() => {
          setPhase('idle');
          table.clear();
        }, HOLD_MS + FADE_MS),
      );
    });
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
    // The look is read as the dice are thrown; changing it doesn't rethrow them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastThrow, animate]);

  useEffect(() => () => stage.current?.dispose(), []);

  const roll = lastThrow?.roll;
  const nat = roll ? natural(roll) : null;
  // A card's rolls thrown together: each one's total (to hit, then damage).
  const parts = lastThrow?.parts && lastThrow.parts.length > 1 ? lastThrow.parts : null;

  return (
    <div
      ref={host}
      aria-live="polite"
      className={cn('pointer-events-none fixed inset-0 z-[60] overflow-hidden transition-opacity', phase === 'idle' || phase === 'leaving' ? 'opacity-0' : 'opacity-100')}
      style={{ transitionDuration: `${phase === 'rolling' ? 0 : FADE_MS}ms` }}
    >
      {roll && (phase === 'settled' || phase === 'leaving') && (
        <div className="dice-result absolute bottom-[9%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border bg-popover/95 px-6 py-3 text-popover-foreground shadow-xl backdrop-blur">
          {roll.label && <span className="label">{roll.label}</span>}
          {parts ? (
            <span className="flex items-start gap-6">
              {parts.map((p, i) => (
                <span key={i} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase">{p.label}</span>
                  <span className={cn('font-display text-[40px] leading-none font-black tabular-nums', p.natural === 20 && 'text-online', p.natural === 1 && 'text-destructive')}>{p.total}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.natural === 20 ? 'Natural 20 · ' : p.natural === 1 ? 'Natural 1 · ' : ''}
                    {p.detail}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <>
              <span className={cn('font-display text-[46px] leading-none font-black tabular-nums', nat === 20 && 'text-online', nat === 1 && 'text-destructive')}>{roll.total}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {nat === 20 ? 'Natural 20 · ' : nat === 1 ? 'Natural 1 · ' : ''}
                {breakdown(roll)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
