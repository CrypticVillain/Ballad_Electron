import { CrosshairIcon, DicesIcon, HeartIcon, SwordIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ABILITY_NAME } from '@/lib/tabletop';
import { cn } from '@/lib/utils';
import { canMove, type BoardAccess, type TokenView } from '@/tabletop/battlemap/tokens/resolve';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import type { CardRoll, RollCard } from '../sheet/rolls';
import type { Speaker } from './actions';
import { applyRoll, mayApply, rollConcentration, rollTargetSave } from './apply';
import { amountFor, attackRollOf, hitOrMiss, type ApplyHow } from './combat';
import type { TableEntry } from './model';
import type { TableRules } from './rules';
import { useTargets, viewOf } from './targets';

/**
 * Play → what a card in the chat lets the table do (Table Settings turns
 * each on): its targets (hit or miss, a save to roll for each), Apply on a
 * damage or healing roll, and a concentration save to roll.
 */

export type CardContext = { entry: TableEntry; speaker: Speaker; access: BoardAccess; rules: TableRules };

const HIT_TEXT = { crit: 'Crit', hit: 'Hit', miss: 'Miss' } as const;

/** Who a card was aimed at: an attack's hit or miss against each AC; a save's DC and each target's save (Roll Save for the GM, or a target's own player). */
export function CardTargets({ card, ctx }: { card: RollCard; ctx: CardContext }) {
  const targets = card.targets ?? [];
  if (!targets.length) return null;
  const attack = attackRollOf(card);
  // Table Settings: players see hit or miss, or only the GM does (creatures' AC stays hidden).
  const seesHits = ctx.access.gm || ctx.rules.playersSeeHits;
  return (
    <ul aria-label="Targets" className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2 py-1.5">
      {card.save && (
        <li className="font-mono text-[10.5px] tracking-wide text-muted-foreground uppercase">
          DC {card.save.dc} {ABILITY_NAME[card.save.ability]} Save
        </li>
      )}
      {targets.map((t) => {
        const view = viewOf(t.tokenId);
        const result = attack ? hitOrMiss(attack, t.ac) : null;
        const mine = view ? ctx.access.gm || canMove(ctx.access, view) : false;
        return (
          <li key={t.tokenId} data-target={t.name} className="flex items-center gap-1.5 text-[12px]">
            <CrosshairIcon className="size-3 shrink-0 text-destructive" />
            <span className="min-w-0 flex-1 truncate">
              {t.name}
              {seesHits && t.ac !== null && attack && <span className="text-muted-foreground"> · AC {t.ac}</span>}
            </span>
            {seesHits && result && (
              <span data-hit={result} className={cn('rounded px-1.5 font-mono text-[10px] font-bold uppercase', result === 'miss' ? 'bg-muted text-muted-foreground' : 'bg-online/20 text-online')}>
                {HIT_TEXT[result]}
              </span>
            )}
            {card.save &&
              (t.save ? (
                <span data-save={t.save.success ? 'success' : 'failure'} title={t.save.detail} className={cn('rounded px-1.5 font-mono text-[10px] font-bold uppercase', t.save.success ? 'bg-online/20 text-online' : 'bg-destructive/15 text-destructive')}>
                  {t.save.total} · {t.save.success ? 'Saves' : 'Fails'}
                </span>
              ) : mine ? (
                <Button variant="outline" size="xs" className="h-5 px-1.5 text-[10.5px]" aria-label={`Roll ${t.name}'s save`} onClick={() => rollTargetSave(ctx.entry, t.tokenId)}>
                  <DicesIcon /> Roll Save
                </Button>
              ) : (
                <span className="text-[10.5px] text-muted-foreground">to roll</span>
              ))}
          </li>
        );
      })}
    </ul>
  );
}

/** The tokens Apply would put a roll on: the card's targets, else what's targeted or picked on the board now. */
function useApplyTo(card: RollCard): TokenView[] {
  const targeted = useTargets((s) => s.ids);
  const picked = useBoardUi((s) => s.selected);
  const ids = card.targets?.length ? card.targets.map((t) => t.tokenId) : targeted.length ? targeted : picked;
  return [...new Set(ids)].map(viewOf).filter((v): v is TokenView => Boolean(v));
}

/** Apply, on a damage or healing roll: full, half or double (or half to those that saved) on its targets. */
export function ApplyMenu({ card, roll, index, ctx }: { card: RollCard; roll: CardRoll; index: number; ctx: CardContext }) {
  const all = useApplyTo(card);
  const to = all.filter((v) => mayApply(ctx.access, v, ctx.speaker.worldId));
  const saved = card.save && card.targets?.some((t) => t.save);
  const apply = (how: ApplyHow) => applyRoll(ctx.entry, index, how, to.map((v) => v.token.id), ctx.speaker, ctx.access);
  const item = (how: ApplyHow, label: string) => (
    <DropdownMenuItem onSelect={() => apply(how)} disabled={!to.length}>
      {label}
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{to.length === 1 ? amountFor(roll.total, how, card.targets?.find((t) => t.tokenId === to[0]!.token.id)) : ''}</span>
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="h-5 shrink-0 px-1.5 text-[10.5px]" aria-label={`Apply ${roll.label}`}>
          {roll.heal ? <HeartIcon /> : <SwordIcon />} Apply
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11.5px] font-normal text-muted-foreground">
          {to.length ? `To ${to.map((v) => v.name).join(', ')}` : all.length ? 'Not yours to change: only the GM can.' : 'Target tokens (right-click) or pick them on the board first.'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roll.heal ? (
          item('heal', `Heal ${roll.total}`)
        ) : (
          <>
            {saved && item('saves', 'Full, Half To Those That Saved')}
            {item('full', `Full Damage (${roll.total})`)}
            {item('half', `Half Damage (${Math.floor(roll.total / 2)})`)}
            {item('double', `Double Damage (${roll.total * 2})`)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What's been applied from a card: who took (or got back) how much. */
export function AppliedLine({ card }: { card: RollCard }) {
  if (!card.applied?.length) return null;
  return (
    <span aria-label="Applied" className="text-[11px] text-muted-foreground">
      Applied: {card.applied.map((a, i) => (
        <span key={i} className={a.heal ? 'text-online' : 'text-destructive'}>
          {i > 0 ? ', ' : ''}
          {a.name} {a.heal ? '+' : '−'}
          {a.amount}
        </span>
      ))}
    </span>
  );
}

/** A concentration card: its save to roll (the GM, or the caster's player), or how it went. */
export function ConcentrationCheck({ card, ctx }: { card: RollCard; ctx: CardContext }) {
  const check = card.check;
  if (!check) return null;
  if (check.result)
    return (
      <span data-concentration={check.result.success ? 'kept' : 'lost'} className={cn('text-[12px] font-medium', check.result.success ? 'text-online' : 'text-destructive')}>
        {check.result.success ? `Keeps concentrating on ${check.spell}.` : `Loses concentration: ${check.spell} ends.`}
      </span>
    );
  const view = check.tokenId ? viewOf(check.tokenId) : undefined;
  const mine = ctx.access.gm || (view ? canMove(ctx.access, view) : false);
  return mine ? (
    <Button size="xs" className="self-start" onClick={() => rollConcentration(ctx.entry, ctx.speaker)}>
      <DicesIcon /> Roll Constitution Save
    </Button>
  ) : (
    <span className="text-[12px] text-muted-foreground">Their save is to roll.</span>
  );
}
