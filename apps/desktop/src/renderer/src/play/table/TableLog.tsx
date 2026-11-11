import { ChevronDownIcon, EyeOffIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DiceLook } from '@/lib/diceLooks';
import type { DieGroup } from '@/lib/tabletop';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import { cardRoll, type RollCard } from '../sheet/rolls';
import { emote, logRoll, postCard, say, type Speaker } from './actions';
import { AppliedLine, ApplyMenu, CardTargets, ConcentrationCheck, type CardContext } from './CardActions';
import { CardDice } from './CardDice';
import { appliable } from './combat';
import { parseCommand, whisperTarget } from './commands';
import { accountColor, seesEntry } from './logic';
import { useTableRules } from './rules';
import type { TableEntry } from './model';

/**
 * Play → the table's chat, beside the board: everyone at the table and the
 * GM talk here; private messages go to one person (only they, the GM and
 * you see them); every roll lands here as it's made (the dice tray's, and
 * the sheet's as cards: an attack with its damage, a spell, a feature's or
 * an item's text); and what the table is told (combat starts). Roll20's
 * commands work: /r, /gr, /w, /em. The GM can roll hidden.
 */
export function TableLog({ speaker, gm, people, onClose }: { speaker: Speaker; gm: boolean; people: { accountId: string; name: string }[]; onClose: () => void }) {
  const log = useVault((s) => s.vault.tableLog);
  const [text, setText] = useState('');
  const [to, setTo] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const entries = useMemo(
    () =>
      Object.values(log)
        .filter((e) => !e.deletedAt && e.worldId === speaker.worldId && e.kind !== 'ping' && seesEntry(e, speaker.accountId, gm))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-300),
    [log, speaker, gm],
  );
  const names = new Map(people.map((p) => [p.accountId, p.name.replace(/ \(GM\)$/, '')]));
  // The newest at the bottom, in view.
  useLayoutEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [entries.length]);
  // Table Settings: players message each other privately, or only the GM.
  const rules = useTableRules(speaker.worldId);
  const access = useMemo(() => ({ gm, accountId: speaker.accountId }), [gm, speaker.accountId]);
  const whispers = rules.playerWhispers || gm;
  const others = people.filter((p) => p.accountId !== speaker.accountId && (whispers || p.name.endsWith('(GM)')));
  const whom = (id: string | null) => (id === null ? undefined : [id]);
  const send = () => {
    const words = text.trim();
    if (!words) return;
    const c = parseCommand(words);
    if (c.kind === 'error') return void toast.error(c.message);
    if (c.kind === 'say') say(speaker, c.text, whom(to));
    else if (c.kind === 'emote') emote(speaker, c.text);
    else if (c.kind === 'roll') {
      const r = cardRoll(c.label || 'Roll', c.expression);
      if (!r) return void toast.error('That isn’t a roll', { description: 'Try /r 1d20+5, /r 2d6+3 or /r 4d6kh3.' });
      postCard(speaker, { kind: 'roll', title: c.label || c.expression, rolls: [r] }, c.hidden || (gm && hidden) ? [] : whom(to));
    } else {
      const target = whisperTarget(c.to, [...others, ...people.filter((p) => p.accountId === speaker.accountId)].map((p) => ({ ...p, gm: p.name.endsWith('(GM)') })));
      if (!target || !target.text) return void toast.error('Whisper to whom?', { description: `Start with their name: /w ${others[0]?.name.split(' ')[0] ?? 'Name'} meet me outside` });
      say(speaker, target.text, [target.accountId]);
    }
    setText('');
  };
  // The GM's hidden rolls: a roll from now on goes to the chat for the GM only.
  useHiddenRolls(gm && hidden);
  const toOptions = [
    { value: null as string | null, label: 'Everyone' },
    ...others.map((p) => ({ value: p.accountId as string | null, label: `${p.name.replace(/ \(GM\)$/, '')}${p.name.endsWith('(GM)') ? ' (the GM)' : ''} · private` })),
  ];
  return (
    <aside aria-label="Chat" className="flex w-[320px] shrink-0 flex-col border-l bg-sidebar">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="font-display text-lg font-black tracking-wide uppercase">Chat</span>
        <span className="flex-1" />
        {gm && (
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground" title="Your rolls show only to you">
            <Checkbox checked={hidden} onCheckedChange={(v) => setHidden(v === true)} aria-label="Roll hidden" /> Roll Hidden
          </label>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close the chat" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      <ol ref={list} aria-label="Messages" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {entries.length ? entries.map((e) => <Entry key={e.id} entry={e} names={names} ctx={{ entry: e, speaker, access, rules }} />) : <li className="py-8 text-center text-[13px] text-muted-foreground">Say something to the table. Rolls show here too.</li>}
      </ol>
      <form
        className="flex flex-col gap-1.5 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">To</span>
          <SelectField label="Send to" value={to} onChange={setTo} options={toOptions} className="h-8 flex-1 text-[12.5px]" />
        </div>
        <div className="flex gap-1.5">
          <input aria-label="Message" value={text} placeholder={to ? 'A private message…' : 'Say something… (/r 1d20 rolls)'} onChange={(e) => setText(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-ring" />
          <Button type="submit" size="icon-sm" aria-label="Send" disabled={!text.trim()}>
            <SendIcon />
          </Button>
        </div>
        <span className="px-0.5 font-mono text-[10px] text-muted-foreground">/r 1d20+5 · /gr 2d6 (the GM only) · /w Name … · /em …</span>
      </form>
    </aside>
  );
}

function Entry({ entry: e, names, ctx }: { entry: TableEntry; names: Map<string, string>; ctx: CardContext }) {
  const time = new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (e.kind === 'system') return <li className="text-center text-[12px] text-muted-foreground italic">{e.text}</li>;
  if (e.kind === 'emote')
    return (
      <li className="px-1 text-[13px] italic">
        <b style={{ color: accountColor(e.accountId) }}>{e.who}</b> {e.text}
      </li>
    );
  const whisper = e.to ? (e.to.length ? `to ${e.to.map((id) => names.get(id) ?? 'someone').join(', ')}` : 'to the GM') : null;
  return (
    <li data-entry={e.kind} className={cn('flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5', e.to ? 'border border-dashed bg-muted/40' : 'bg-background')}>
      <span className="flex items-center gap-1.5 text-[11.5px]">
        <b style={{ color: accountColor(e.accountId) }}>{e.who}</b>
        {whisper && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <EyeOffIcon className="size-3" /> {whisper}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{time}</span>
      </span>
      {e.kind === 'card' && e.card ? (
        <Card card={e.card} ctx={ctx} />
      ) : e.kind === 'roll' && e.roll ? (
        <RollLine label={e.text} total={e.roll.total} expression={e.roll.expression} detail={`${e.roll.expression} → ${e.roll.detail}`} natural={e.roll.natural ?? null} dice={e.roll.dice} look={e.roll.look} />
      ) : (
        <span className="text-[13px] leading-snug break-words whitespace-pre-wrap">{e.text}</span>
      )}
    </li>
  );
}

type LineProps = {
  label: string;
  total: number;
  expression: string;
  detail: string;
  natural?: number | null;
  type?: string;
  crit?: boolean;
  heal?: boolean;
  /** Each die as it fell (shown under it), in the roller's look. */
  dice?: { groups: DieGroup[]; constant: number };
  look?: DiceLook;
  /** Beside its total (Apply). */
  action?: ReactNode;
};

function RollLine({ label, total, expression, detail, natural, type, crit, heal, dice, look, action }: LineProps) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1">
          <RollHead label={label} total={total} detail={dice ? expression : detail} title={detail} natural={natural} type={type} crit={crit} heal={heal} />
        </span>
        {action}
      </span>
      {dice && <CardDice dice={dice} look={look} />}
    </span>
  );
}

function RollHead({ label, total, detail, title, natural, type, crit, heal }: Omit<LineProps, 'expression' | 'dice' | 'look' | 'action'> & { title: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span data-total className={cn('min-w-[2ch] font-display text-2xl font-black', natural === 20 && 'text-online', natural === 1 && 'text-destructive', heal && 'text-online')}>
        {total}
      </span>
      <span className="min-w-0 flex-1 text-[12px]">
        <span className="block truncate font-medium">
          {label}
          {type && <span className="font-normal text-muted-foreground"> · {type}</span>}
          {crit && <span className="ml-1 rounded bg-online/20 px-1 font-mono text-[9.5px] text-online uppercase">Crit</span>}
          {natural === 20 && !crit && <span className="ml-1 rounded bg-online/20 px-1 font-mono text-[9.5px] text-online uppercase">Natural 20</span>}
          {natural === 1 && <span className="ml-1 rounded bg-destructive/15 px-1 font-mono text-[9.5px] text-destructive uppercase">Natural 1</span>}
        </span>
        <span className="block truncate font-mono text-[10.5px] text-muted-foreground" title={title}>
          {detail}
        </span>
      </span>
    </span>
  );
}

/** A sheet's card: its title, what to know, its rolls, and its text (folded when there are rolls). */
function Card({ card, ctx }: { card: RollCard; ctx: CardContext }) {
  const [open, setOpen] = useState(!card.rolls.length);
  return (
    <div data-card={card.kind} className="flex flex-col gap-1">
      <span className="flex flex-col">
        <span className="text-[13.5px] font-semibold">{card.title}</span>
        {card.subtitle && <span className="text-[11px] text-muted-foreground">{card.subtitle}</span>}
      </span>
      {card.facts && card.facts.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {card.facts.map((f) => (
            <span key={f.label} className="rounded-full border px-2 py-px text-[10.5px]">
              <span className="text-muted-foreground">{f.label}</span> {f.value}
            </span>
          ))}
        </span>
      )}
      <CardTargets card={card} ctx={ctx} />
      {card.rolls.map((r, i) => (
        <RollLine
          key={i}
          label={r.label}
          total={r.total}
          expression={r.expression}
          detail={`${r.expression} → ${r.detail}`}
          natural={r.natural}
          type={r.type}
          crit={r.crit}
          heal={r.heal}
          dice={r.dice}
          look={card.look}
          action={ctx.rules.applyFromChat && appliable(card, r) ? <ApplyMenu card={card} roll={r} index={i} ctx={ctx} /> : undefined}
        />
      ))}
      <AppliedLine card={card} />
      <ConcentrationCheck card={card} ctx={ctx} />
      {card.text && (
        <div className="flex flex-col">
          {card.rolls.length > 0 && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground">
              <ChevronDownIcon className={cn('size-3 transition-transform', !open && '-rotate-90')} /> {open ? 'Hide' : 'Show'} The Text
            </button>
          )}
          {open && <p className="max-h-56 overflow-y-auto font-serif text-[12.5px] leading-snug whitespace-pre-wrap text-foreground/90">{card.text}</p>}
        </div>
      )}
    </div>
  );
}

/** Whether the GM's rolls are hidden now (read when a roll lands). */
let rollHidden = false;
export const gmRollsHidden = () => rollHidden;
function useHiddenRolls(on: boolean) {
  useEffect(() => {
    rollHidden = on;
  }, [on]);
}

/**
 * Every roll in this window's dice tray, into the table's chat as it's
 * made: hidden (the GM's only) when the GM says so. Mounted once in Play's
 * window. (The sheet posts its own rolls, as cards.)
 */
export function useRollsToLog(speaker: Speaker | null) {
  useEffect(() => {
    if (!speaker) return;
    return useUi.subscribe((s, before) => {
      // A card's dice thrown again here (a Tabletop sheet's roll) are in the chat already, as the card.
      if (s.lastThrow && s.lastThrow !== before.lastThrow && !s.lastThrow.shown) logRoll(speaker, s.lastThrow.roll, rollHidden ? [] : undefined);
    });
  }, [speaker]);
}
