import { ChevronDownIcon, DicesIcon, FootprintsIcon, PencilIcon, PlusIcon, RefreshCwIcon, ShieldIcon, SwordsIcon, Trash2Icon, ZapIcon, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { afterConfirm } from '@/components/shared/Confirm';
import { HoverCard } from '@/components/shared/HoverCard';
import { toast } from 'sonner';
import { rollAndShow } from '@/components/dnd/rolling';
import { RulesText } from '@/components/dnd/RulesText';
import { AREA } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateRecord } from '@/lib/actions';
import { COMBAT_ACTIONS, shortRest } from '@/lib/dnd';
import type { Feature, PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { Card, useEditable } from './CharacterSheet';
import { FeatureDialog } from './SheetDialogs';

/**
 * The sheet's Actions In Combat and Features & Traits panels.
 *
 * Features are one card each: what it does (folded to a few lines until you
 * open it), where it's from, how it's used in a turn, its uses as boxes to tick
 * like spell slots (back on a short or long rest), and its roll. They're added
 * and changed in their dialog (pick one from the SRD or write your own) and
 * removed after a confirmation. Active ones show in Actions In Combat too.
 */

type Kind = NonNullable<Feature['action']>;
const KIND_LABEL: Record<Kind | 'free', string> = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', passive: 'Passive', free: 'Free' };
const RESET_LABEL = { short: 'Short Rest', long: 'Long Rest', none: 'Never' } as const;

const setTraits = (pc: PlayerCharacter, traits: Feature[]) => updateRecord('pcs', pc.id, { traits });
const changeTrait = (pc: PlayerCharacter, id: string, changes: Partial<Feature>) => setTraits(pc, (pc.traits ?? []).map((f) => (f.id === id ? { ...f, ...changes } : f)));

// ── Actions In Combat ───────────────────────────────────────────────────

/**
 * What anyone can do in a round, as small buttons by the action they take
 * (the character's own active features first, tinted); click one for what it
 * does, and for a feature its uses and roll.
 */
export function CombatActions({ pc }: { pc: PlayerCharacter }) {
  const traits = pc.traits ?? [];
  const groups: { kind: Kind | 'free'; title: string; icon: LucideIcon; hint: string }[] = [
    { kind: 'action', title: 'Actions', icon: SwordsIcon, hint: 'One each turn.' },
    { kind: 'bonus', title: 'Bonus Actions', icon: ZapIcon, hint: 'One, only when something gives you one.' },
    { kind: 'reaction', title: 'Reactions', icon: ShieldIcon, hint: 'One each round, even on others’ turns.' },
    { kind: 'free', title: 'Movement & More', icon: FootprintsIcon, hint: `Up to ${pc.speed} ft., split as you like.` },
  ];
  return (
    <Card title="Actions In Combat">
      <div className="flex flex-col gap-3">
        {groups.map(({ kind, title, icon: Icon, hint }) => (
          <section key={kind} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <Icon className="size-3.5 self-center text-muted-foreground" />
              <span className="text-[12.5px] font-semibold">{title}</span>
              <span className="text-[11.5px] text-muted-foreground">{hint}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {traits
                .filter((f) => f.action === kind)
                .map((f) => (
                  <ActionChip key={f.id} name={f.name} own>
                    <span className="text-[11px] text-muted-foreground">{f.source}</span>
                    {f.text ? <RulesText text={f.text} className="gap-1.5 text-[12.5px] leading-normal" /> : <p className="text-[12.5px] text-muted-foreground">No description.</p>}
                    {(f.uses || f.roll) && (
                      <div className="flex items-center gap-2 border-t pt-2">
                        {f.uses && <Uses pc={pc} feature={f} />}
                        {f.roll && <RollButton feature={f} pc={pc} />}
                      </div>
                    )}
                  </ActionChip>
                ))}
              {COMBAT_ACTIONS.filter((a) => a.kind === kind).map((a) => (
                <ActionChip key={a.name} name={a.name}>
                  <p className="text-[12.5px] leading-normal">{a.text}</p>
                </ActionChip>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

/** One action: hover (or focus) for what it does, click to keep it open (a feature's uses and roll can be used from there). */
function ActionChip({ name, own, children }: { name: string; own?: boolean; children: ReactNode }) {
  return (
    <HoverCard
      title={name}
      pin
      trigger={
        <button
          type="button"
          className={cn(
            'flex h-7 items-center rounded-full border px-2.5 text-[12px] hover:border-foreground/30 data-[state=open]:border-primary data-[state=open]:bg-primary/10',
            own && 'border-primary/50 bg-primary/8 font-medium',
          )}
        >
          {name}
        </button>
      }
    >
      {children}
    </HoverCard>
  );
}

// ── Features & Traits ───────────────────────────────────────────────────

type Filter = 'all' | 'limited' | 'active' | 'passive';

export function FeaturesPanel({ pc }: { pc: PlayerCharacter }) {
  const traits = pc.traits ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<{ id?: string } | null>(null);
  const editable = useEditable();
  const shown = traits.filter((f) => filter === 'all' || (filter === 'limited' ? Boolean(f.uses) : filter === 'active' ? f.action && f.action !== 'passive' : !f.action || f.action === 'passive'));
  const sources = [...new Set(shown.map((f) => f.source || 'Other'))];
  const add = () => {
    setFilter('all');
    setDialog({});
  };
  const rest = () => {
    const before = pc.traits;
    updateRecord('pcs', pc.id, shortRest(pc));
    toast('Short Rest', { description: 'Uses that come back on a short rest are back.', action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, { traits: before }) } });
  };

  return (
    <>
      <Card
        title="Features & Traits"
        action={
          <span className="flex items-center gap-1">
            {traits.some((f) => f.uses?.reset === 'short' && f.uses.used > 0) && (
              <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={rest}>
                <RefreshCwIcon /> Short Rest
              </Button>
            )}
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={add}>
              <PlusIcon /> Add Feature
            </Button>
          </span>
        }
      >
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['all', `All · ${traits.length}`],
                ['limited', 'Limited Use'],
                ['active', 'Actions'],
                ['passive', 'Passive'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn('h-7 rounded-full border px-2.5 text-[12px] text-muted-foreground hover:text-foreground', filter === value && 'border-primary bg-primary/12 font-medium text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {traits.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No features yet. The character creator and Level Up add your species’ and class’s for you, or add one by hand: Darkvision, a feat, a blessing.</p>
        )}
        {sources.map((source) => (
          <section key={source} className="flex flex-col gap-2">
            <span className="label pt-1 text-[9.5px]">{source}</span>
            {shown
              .filter((f) => (f.source || 'Other') === source)
              .map((f) => (
                <FeatureCard key={f.id} pc={pc} feature={f} onEdit={() => setDialog({ id: f.id })} />
              ))}
          </section>
        ))}
      </Card>
      {dialog && <FeatureDialog pc={pc} id={dialog.id} onClose={() => setDialog(null)} />}
      <Card title="More Notes">
        <Textarea aria-label="More features and traits" readOnly={!editable} rows={4} value={pc.features} placeholder="Anything else: languages picked up, boons, scars…" onChange={(e) => updateRecord('pcs', pc.id, { features: e.target.value })} className={cn(AREA, 'resize-y text-[13.5px] leading-relaxed')} />
      </Card>
    </>
  );
}

function FeatureCard({ pc, feature, onEdit }: { pc: PlayerCharacter; feature: Feature; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const long = feature.text.length > 220 || feature.text.includes('\n');
  return (
    <article className="group/row flex flex-col gap-1.5 rounded-xl border px-3.5 py-2.5">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="min-w-0 flex-1 text-[14px] font-semibold">{feature.name || 'Unnamed Feature'}</span>
        {feature.action && feature.action !== 'passive' && <span className="rounded-full bg-primary/12 px-2 py-0.5 font-mono text-[10px] text-primary uppercase">{KIND_LABEL[feature.action]}</span>}
        {feature.uses && <Uses pc={pc} feature={feature} />}
        {feature.roll && <RollButton feature={feature} pc={pc} />}
        <span className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
          <Hint label="Edit">
            <Button variant="ghost" size="icon-xs" aria-label={`Edit ${feature.name}`} onClick={onEdit}>
              <PencilIcon />
            </Button>
          </Hint>
          <Hint label="Remove">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${feature.name}`}
              onClick={() => afterConfirm(`Remove ${feature.name || 'This Feature'}?`, `It comes off ${pc.name || 'the character'}’s Features & Traits.`, () => setTraits(pc, (pc.traits ?? []).filter((f) => f.id !== feature.id)))}
            >
              <Trash2Icon />
            </Button>
          </Hint>
        </span>
      </header>
      {feature.text ? (
        <div className={cn('relative', !open && long && 'max-h-[4.6em] overflow-hidden')}>
          <RulesText text={feature.text} className="gap-1.5 text-[13px] leading-normal text-foreground/85" />
          {!open && long && <span aria-hidden className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background" />}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">No description. Edit to write one.</p>
      )}
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 self-start font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground">
          <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} /> {open ? 'Less' : 'More'}
        </button>
      )}
    </article>
  );
}

/** A feature's uses: boxes to tick like spell slots (a count past twelve), and when they come back. */
export function Uses({ pc, feature }: { pc: PlayerCharacter; feature: Feature }) {
  const uses = feature.uses!;
  const left = uses.max - uses.used;
  const set = (used: number) => changeTrait(pc, feature.id, { uses: { ...uses, used: Math.max(0, Math.min(uses.max, used)) } });
  return (
    <Hint label={`${left} of ${uses.max} left · back after a ${uses.reset === 'none' ? '(never)' : RESET_LABEL[uses.reset].toLowerCase()}`}>
      <span className="flex items-center gap-1">
        {uses.max <= 12 ? (
          Array.from({ length: uses.max }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`${feature.name} use ${n + 1}${n < uses.used ? ', spent' : ''}`}
              onClick={() => set(n < uses.used ? n : n + 1)}
              className={cn('size-4 rounded-[4px] border-2 border-primary', n < uses.used ? 'bg-transparent opacity-50' : 'bg-primary')}
            />
          ))
        ) : (
          <span className="flex items-center gap-1 font-mono text-[12px]">
            <button type="button" aria-label="Spend one" onClick={() => set(uses.used + 1)} className="rounded border px-1.5 hover:border-foreground/40">
              −
            </button>
            <span className="tabular-nums">
              {left}/{uses.max}
            </span>
            <button type="button" aria-label="Get one back" onClick={() => set(uses.used - 1)} className="rounded border px-1.5 hover:border-foreground/40">
              +
            </button>
          </span>
        )}
        <span className="ml-0.5 font-mono text-[10px] text-muted-foreground uppercase">{uses.reset === 'short' ? 'SR' : uses.reset === 'long' ? 'LR' : ''}</span>
      </span>
    </Hint>
  );
}

/** Rolls a feature's dice; one with uses spends one too, if any are left. */
function RollButton({ pc, feature }: { pc: PlayerCharacter; feature: Feature }) {
  return (
    <Hint label={`Roll ${feature.roll}${feature.uses ? ' and spend a use' : ''}`}>
      <Button
        variant="outline"
        size="xs"
        className="font-mono"
        onClick={() => {
          const result = rollAndShow(feature.roll!, `${pc.name || 'Character'} · ${feature.name}`);
          if (result && feature.uses && feature.uses.used < feature.uses.max) changeTrait(pc, feature.id, { uses: { ...feature.uses, used: feature.uses.used + 1 } });
        }}
      >
        <DicesIcon /> {feature.roll}
      </Button>
    </Hint>
  );
}
