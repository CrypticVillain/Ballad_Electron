import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Die, useDiceLook } from '@/components/tabletop/Die';
import type { DiceLook } from '@/lib/diceLooks';
import type { DieGroup } from '@/lib/tabletop';
import { cn } from '@/lib/utils';
import { facesOf, faceTone } from './faces';

/**
 * Play → a roll's dice, in the chat: each die as it fell, in its own shape
 * (components/tabletop/Die) and the look of whoever rolled it. A 1 is ringed
 * red and a die's highest face green; the dice advantage set aside are
 * faded. More than ten fold away behind Show The Dice.
 */

/** How many dice show before they fold away. */
export const FOLD_AT = 10;

export function CardDice({ dice, look }: { dice: { groups: DieGroup[]; constant: number }; look?: DiceLook }) {
  const mine = useDiceLook();
  const faces = facesOf(dice.groups);
  const [open, setOpen] = useState(faces.length <= FOLD_AT);
  if (!faces.length) return null;
  const constant = dice.constant ? `${dice.constant < 0 ? '−' : '+'} ${Math.abs(dice.constant)}` : '';
  return (
    <span className="flex flex-col gap-1">
      {faces.length > FOLD_AT && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground">
          <ChevronDownIcon className={cn('size-3 transition-transform', !open && '-rotate-90')} /> {open ? 'Hide The Dice' : `Show The Dice (${faces.length})`}
        </button>
      )}
      {open && (
        <span data-dice className="flex flex-wrap items-center gap-1">
          {faces.map((f, i) => {
            const tone = f.dropped ? null : faceTone(f);
            return (
              <span
                key={i}
                data-die={f.sides}
                data-face={tone ?? undefined}
                className={cn('flex rounded-md p-px', tone === 'low' && 'bg-destructive/15 ring-1 ring-destructive', tone === 'high' && 'bg-online/15 ring-1 ring-online')}
                title={`d${f.sides}: ${f.value}${f.dropped ? ' (set aside)' : tone === 'high' ? ' (its highest)' : tone === 'low' ? ' (a 1)' : ''}`}
              >
                <Die sides={f.sides} value={f.value} look={look ?? mine} size={34} dropped={f.dropped} top={tone === 'high'} />
              </span>
            );
          })}
          {constant && <span className="px-0.5 font-mono text-[11px] text-muted-foreground">{constant}</span>}
        </span>
      )}
    </span>
  );
}
