import { xpForNext } from '@/tabletop/encounters/rewards';
import { MinusIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useEditable } from './CharacterSheet';
import { Portrait, PortraitPicker } from '@/components/shared/Portrait';
import { RollModeToggle } from '@/play/sheet/playMode';

/**
 * CharacterPlate — who a character is, across the top of their sheet: the
 * name, who plays them, species, class, subclass and background, the level
 * and inspiration (in Play Mode, Normal / Adv / Dis above them). Laid out by its own width (the `plate` container), not the
 * window's:
 *
 *   wide      name · the four facts · level and inspiration, one row
 *   narrower  name with level and inspiration beside it; the facts below, four across, then two
 *
 * Nothing is cut to a fixed width: fields take their column, and the name
 * wraps (its size steps down with the plate).
 */
export function CharacterPlate({
  pc,
  set,
  eyebrow,
  onLevelUp,
  inspiration = true,
}: {
  pc: PlayerCharacter;
  set: (changes: Partial<PlayerCharacter>) => void;
  /** Above the name: where they play, and the player. */
  eyebrow?: ReactNode;
  /** Leveling up (the walkthrough); without it, + just raises the number. */
  onLevelUp?: () => void;
  /** Inspiration on the plate (the party sheet has it in its toolbar). */
  inspiration?: boolean;
}) {
  const editable = useEditable();
  // XP toward the next level (an encounter's rewards add it).
  const next = xpForNext(pc.level);
  const ready = next !== null && (pc.xp ?? 0) >= next;
  return (
    <section aria-label="Who they are" className="@container/plate cover-dots rounded-2xl px-5 py-4 text-background @3xl/plate:px-6 @3xl/plate:py-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 gap-y-4 @5xl/plate:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] @5xl/plate:items-end">
        <div className="flex min-w-0 items-center gap-4">
          <PortraitPicker image={pc.image} label={pc.name || 'this character'} editable={editable} onChange={(image) => set({ image })} className="block size-16 shrink-0 rounded-2xl ring-2 ring-background/25 @xl/plate:size-[76px]">
            <Portrait image={pc.image} name={pc.name} className="size-full rounded-2xl bg-background text-foreground" text="font-display text-[26px] font-black" />
          </PortraitPicker>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-mono text-[10px] tracking-[0.16em] uppercase opacity-80">
            {eyebrow}
            <span className="shrink-0">Played By</span>
            <input
              aria-label="Player"
              readOnly={!editable}
              value={pc.player}
              placeholder={editable ? 'Player' : '—'}
              onChange={(e) => set({ player: e.target.value })}
              className="field-sizing-content min-w-[4ch] max-w-full bg-transparent uppercase outline-none placeholder:text-background/50"
            />
          </span>
          <textarea
            aria-label="Character name"
            rows={1}
            readOnly={!editable}
            value={pc.name}
            placeholder="UNNAMED CHARACTER"
            onChange={(e) => set({ name: e.target.value.replace(/\n/g, ' ') })}
            className="field-sizing-content w-full resize-none overflow-hidden bg-transparent font-display text-[28px] leading-[1] font-black break-words uppercase outline-none placeholder:text-background/40 @xl/plate:text-[36px] @5xl/plate:text-[44px]"
          />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 @5xl/plate:order-last">
        {/* Play Mode: how the next roll goes (play/sheet/playMode). */}
        <RollModeToggle pc={pc} />
        <div className="flex items-start gap-1">
          <Badge label="Level">
            <span className="flex items-center gap-0.5">
              {editable && (
                <button type="button" aria-label="Level down" disabled={pc.level <= 1} onClick={() => set({ level: pc.level - 1 })} className="rounded p-1 hover:bg-background/15 disabled:opacity-30">
                  <MinusIcon className="size-3.5" />
                </button>
              )}
              <span className="min-w-[1.2em] text-center font-display text-[30px] leading-none font-black @xl/plate:text-[36px]">{pc.level}</span>
              <button type="button" aria-label="Level up" disabled={pc.level >= 20} onClick={() => (onLevelUp ? onLevelUp() : set({ level: pc.level + 1 }))} className="rounded p-1 hover:bg-background/15 disabled:opacity-30">
                <PlusIcon className="size-3.5" />
              </button>
            </span>
          </Badge>
          <Badge label="XP">
            <span className="flex flex-col items-center leading-none" title={next === null ? 'The highest level' : `${next.toLocaleString('en-US')} XP for level ${pc.level + 1}`}>
              <span className="font-mono text-[15px] font-bold tabular-nums">{(pc.xp ?? 0).toLocaleString('en-US')}</span>
              {next !== null && <span className={cn('mt-1 font-mono text-[10px] tabular-nums opacity-70', ready && 'text-primary opacity-100')}>{ready ? 'Level Up!' : `/ ${next.toLocaleString('en-US')}`}</span>}
            </span>
          </Badge>
          {inspiration && (
            <button type="button" aria-pressed={pc.inspiration} onClick={() => set({ inspiration: !pc.inspiration })} className={cn('rounded-xl hover:bg-background/10', !pc.inspiration && 'opacity-60')}>
              <Badge label="Inspiration">
                <SparklesIcon className={cn('size-7 @xl/plate:size-8', pc.inspiration && 'fill-current')} strokeWidth={1.5} />
              </Badge>
            </button>
          )}
        </div>
        </div>

        <dl className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 @xl/plate:grid-cols-4 @5xl/plate:col-span-1">
          <Fact label="Species" value={pc.species} placeholder="Elf" onChange={(species) => set({ species })} />
          <Fact label="Class" value={pc.className} placeholder="Ranger" onChange={(className) => set({ className })} />
          <Fact label="Subclass" value={pc.subclass} placeholder="Gloom Stalker" onChange={(subclass) => set({ subclass })} />
          <Fact label="Background" value={pc.background} placeholder="Outlander" onChange={(background) => set({ background })} />
        </dl>
      </div>
    </section>
  );
}

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1 px-2 py-1">
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-80">{label}</span>
      {children}
    </span>
  );
}

/** One fact: its name small above, the value its column's full width (wrapping, never cut). */
function Fact({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const editable = useEditable();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-mono text-[9.5px] tracking-[0.16em] uppercase opacity-70">{label}</dt>
      <dd className="min-w-0">
        <textarea
          aria-label={label}
          rows={1}
          readOnly={!editable}
          value={value}
          placeholder={editable ? placeholder : '—'}
          onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
          className="field-sizing-content w-full resize-none overflow-hidden bg-transparent font-mono text-[13px] leading-snug font-semibold break-words uppercase outline-none placeholder:text-background/40"
        />
      </dd>
    </div>
  );
}
