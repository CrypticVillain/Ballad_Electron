import { DicesIcon, PinIcon, PinOffIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Label } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { keptFlags, natural } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { DiceLookSelect } from './DiceLookSelect';
import { Die, DIE_SIDES, useDiceLook } from './Die';
import { rollAndShow } from './rolling';

/**
 * DiceTray (Ctrl+D, D&D) — roll any dice: a die and a count, a modifier,
 * advantage or disadvantage on a d20, or any expression ("2d6+1d4+3",
 * "4d6kh3"). The dice are drawn in the look you pick here (or in Settings →
 * Dice) and thrown across the screen. Every roll this session is listed,
 * sheets' clicks included, with the dice that were dropped struck through.
 *
 * It pops out from the right; pin it and it docks there instead
 * (DockedDiceTray, beside the screen in AppShell), so you can keep rolling
 * while you click through a sheet or run an encounter. Pinned, it stays open
 * across screens and next time; X (or Ctrl+D) hides it until you want it.
 */
export function DiceTray() {
  const open = useUi((s) => s.dice);
  const pinned = usePreferences((s) => s.dicePinned);
  return (
    <Sheet open={open && !pinned} onOpenChange={(o) => useUi.getState().setDice(o)}>
      <SheetContent side="right" className="flex w-[380px] flex-col gap-0 p-0 sm:max-w-[380px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <DicesIcon className="size-5" /> Dice
          </SheetTitle>
          <SheetDescription>Pick a die, or type any roll. Rolls from character sheets land here too.</SheetDescription>
        </SheetHeader>
        <PinButton pinned={false} className="absolute top-3 right-11" />
        <TrayBody />
      </SheetContent>
    </Sheet>
  );
}

/** The dice tray pinned: docked at the window's right edge, beside the screen, without covering it. */
export function DockedDiceTray() {
  return (
    <aside aria-label="Dice" className="flex w-[340px] shrink-0 flex-col border-l bg-background">
      <div className="flex items-center gap-2 border-b py-3 pr-3 pl-5">
        <DicesIcon className="size-5" />
        <span className="flex-1 font-display text-xl font-black uppercase">Dice</span>
        <PinButton pinned />
        <Hint label="Close (Ctrl+D)">
          <Button variant="ghost" size="icon-sm" aria-label="Close dice" onClick={() => useUi.getState().setDice(false)}>
            <XIcon />
          </Button>
        </Hint>
      </div>
      <TrayBody />
    </aside>
  );
}

function PinButton({ pinned, className }: { pinned: boolean; className?: string }) {
  return (
    <Hint label={pinned ? 'Unpin: pop out over the screen again' : 'Pin: dock beside the screen and keep it open'}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={pinned ? 'Unpin dice' : 'Pin dice'}
        aria-pressed={pinned}
        className={cn(pinned && 'text-primary hover:text-primary', className)}
        onClick={() => usePreferences.getState().setPreference('dicePinned', !pinned)}
      >
        {pinned ? <PinOffIcon /> : <PinIcon />}
      </Button>
    </Hint>
  );
}

/** What the tray holds, popped out or pinned: the dice, the style, count and modifier, advantage, any expression, the history. */
function TrayBody() {
  const rolls = useUi((s) => s.rolls);
  const look = useDiceLook();
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [expression, setExpression] = useState('');
  const mod = modifier ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';

  return (
    <>
    <div className="flex flex-col gap-4 border-b px-5 py-4">
      <div className="grid grid-cols-7 gap-1">
        {DIE_SIDES.map((sides) => (
          <button
            key={sides}
            type="button"
            aria-label={`Roll ${count}d${sides}${mod}`}
            onClick={() => rollAndShow(`${count}d${sides}${mod}`)}
            className="flex flex-col items-center gap-1 rounded-lg py-1.5 transition-transform hover:-translate-y-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Die sides={sides} value={sides} look={look} size={36} />
            <span className="font-mono text-[10.5px] text-muted-foreground">d{sides}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase">Style</span>
        <DiceLookSelect compact className="flex-1" />
      </div>
      <div className="flex items-center gap-4 font-mono text-xs">
        <Stepper label="Dice" value={count} min={1} max={20} onChange={setCount} />
        <Stepper label="Modifier" value={modifier} min={-20} max={20} onChange={setModifier} signed />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => rollAndShow(`2d20kh1${mod}`, 'Advantage')}>
          d20 Advantage
        </Button>
        <Button variant="outline" size="sm" onClick={() => rollAndShow(`2d20kl1${mod}`, 'Disadvantage')}>
          d20 Disadvantage
        </Button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (rollAndShow(expression)) setExpression('');
        }}
      >
        <Input aria-label="Dice expression" value={expression} placeholder="2d6 + 1d4 + 3" onChange={(e) => setExpression(e.target.value)} className={cn(FIELD, 'font-mono text-[13px]')} />
        <Button type="submit" disabled={!expression.trim()}>
          Roll
        </Button>
      </form>
    </div>
    <div className="flex items-center justify-between px-5 pt-3">
      <Label>History</Label>
      {rolls.length > 0 && (
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => useUi.setState({ rolls: [] })}>
          <Trash2Icon /> Clear
        </Button>
      )}
    </div>
    <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5" data-selectable>
      {rolls.map((r, i) => {
        const nat = natural(r);
        return (
          <li key={rolls.length - i} className={cn('flex items-center gap-3 border-t border-border/60 py-2.5 first:border-t-0', i === 0 && 'pt-3')}>
            <span className={cn('w-14 shrink-0 text-center font-display text-[26px] leading-none font-black', nat === 20 && 'text-online', nat === 1 && 'text-destructive')}>{r.total}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium">{r.label || r.expression}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {r.groups.map((g, j) => (
                  <span key={j}>
                    {j > 0 && (g.sign < 0 ? ' − ' : ' + ')}
                    {g.notation} [
                    {g.rolls.map((v, k) => {
                      const dropped = !keptFlags(g.rolls, g.kept)[k];
                      return (
                        <span key={k} className={cn(dropped && 'line-through opacity-50')}>
                          {k > 0 && ' '}
                          {v}
                        </span>
                      );
                    })}
                    ]
                  </span>
                ))}
                {r.constant !== 0 && ` ${r.constant < 0 ? '−' : '+'} ${Math.abs(r.constant)}`}
              </span>
            </span>
          </li>
        );
      })}
      {!rolls.length && <li className="py-6 text-center text-[13px] text-muted-foreground">No rolls yet.</li>}
    </ol>
    </>
  );
}

function Stepper({ label, value, min, max, onChange, signed }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; signed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Button variant="outline" size="icon-xs" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </Button>
      <span className="w-7 text-center tabular-nums">{signed && value > 0 ? `+${value}` : value}</span>
      <Button variant="outline" size="icon-xs" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </Button>
    </span>
  );
}
