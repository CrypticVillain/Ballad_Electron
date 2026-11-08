import { EyeOffIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import { logRoll, say, type Speaker } from './actions';
import { accountColor, seesEntry } from './logic';
import type { TableEntry } from './model';

/**
 * Play → the table's log, beside the board: everyone's rolls (the dice
 * tray's, as they land), what's said, whispers (to the GM, or to one
 * player: only they, the GM and you see it), and what the table is told
 * (combat starts). The GM can roll hidden: only the GM sees those.
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
        .slice(-200),
    [log, speaker, gm],
  );
  const names = new Map(people.map((p) => [p.accountId, p.name.replace(/ \(GM\)$/, '')]));
  // The newest at the bottom, in view.
  useLayoutEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [entries.length]);
  const others = people.filter((p) => p.accountId !== speaker.accountId);
  const send = () => {
    const words = text.trim();
    if (!words) return;
    say(speaker, words, to === null ? undefined : to === 'gm' ? [] : [to]);
    setText('');
  };
  // The GM's hidden rolls: a roll from now on goes to the log for the GM only.
  useHiddenRolls(gm && hidden);
  return (
    <aside aria-label="Table log" className="flex w-[300px] shrink-0 flex-col border-l bg-sidebar">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="font-display text-lg font-black tracking-wide uppercase">Log</span>
        <span className="flex-1" />
        {gm && (
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground" title="Your rolls show only to you">
            <Checkbox checked={hidden} onCheckedChange={(v) => setHidden(v === true)} aria-label="Roll hidden" /> Roll Hidden
          </label>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close the log" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      <ol ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {entries.length ? entries.map((e) => <Entry key={e.id} entry={e} names={names} />) : <li className="py-8 text-center text-[13px] text-muted-foreground">Rolls and what’s said show here.</li>}
      </ol>
      <form
        className="flex flex-col gap-1.5 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <SelectField
          label="Say to"
          value={to}
          onChange={setTo}
          options={[{ value: null as string | null, label: 'Everyone' }, ...(gm ? [] : [{ value: 'gm' as string | null, label: 'The GM (a whisper)' }]), ...others.filter((p) => !p.name.endsWith('(GM)')).map((p) => ({ value: p.accountId as string | null, label: `${p.name} (a whisper)` }))]}
          className="h-8 text-[12.5px]"
        />
        <div className="flex gap-1.5">
          <input aria-label="Say something" value={text} placeholder={to ? 'Whisper…' : 'Say something…'} onChange={(e) => setText(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-ring" />
          <Button type="submit" size="icon-sm" aria-label="Send" disabled={!text.trim()}>
            <SendIcon />
          </Button>
        </div>
      </form>
    </aside>
  );
}

function Entry({ entry: e, names }: { entry: TableEntry; names: Map<string, string> }) {
  const time = new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (e.kind === 'system') return <li className="text-center text-[12px] text-muted-foreground italic">{e.text}</li>;
  const whisper = e.to ? (e.to.length ? `to ${e.to.map((id) => names.get(id) ?? 'someone').join(', ')}` : 'to the GM') : null;
  return (
    <li className={cn('flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5', e.to ? 'border border-dashed bg-muted/40' : 'bg-background')}>
      <span className="flex items-center gap-1.5 text-[11.5px]">
        <b style={{ color: accountColor(e.accountId) }}>{e.who}</b>
        {whisper && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <EyeOffIcon className="size-3" /> {whisper}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{time}</span>
      </span>
      {e.kind === 'roll' && e.roll ? (
        <span className="flex items-baseline gap-2">
          <span className={cn('font-display text-2xl font-black', e.roll.natural === 20 && 'text-online', e.roll.natural === 1 && 'text-destructive')}>{e.roll.total}</span>
          <span className="min-w-0 flex-1 text-[12px]">
            {e.text && <span className="block truncate font-medium">{e.text}</span>}
            <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
              {e.roll.expression} → {e.roll.detail}
            </span>
          </span>
        </span>
      ) : (
        <span className="text-[13px] leading-snug break-words whitespace-pre-wrap">{e.text}</span>
      )}
    </li>
  );
}

/** Whether the GM's rolls are hidden now (read when a roll lands). */
let rollHidden = false;
function useHiddenRolls(on: boolean) {
  useEffect(() => {
    rollHidden = on;
  }, [on]);
}

/**
 * Every roll in this window (the dice tray's, a sheet's), into the table's
 * log as it's made: hidden (the GM's only) when the GM says so. Mounted once
 * in Play's window.
 */
export function useRollsToLog(speaker: Speaker | null) {
  useEffect(() => {
    if (!speaker) return;
    return useUi.subscribe((s, before) => {
      if (s.lastThrow && s.lastThrow !== before.lastThrow) logRoll(speaker, s.lastThrow.roll, rollHidden ? [] : undefined);
    });
  }, [speaker]);
}
