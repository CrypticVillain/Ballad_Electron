import { EyeIcon, EyeOffIcon, Redo2Icon, SaveIcon, SnowflakeIcon, Undo2Icon, XIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import type { Speaker } from './actions';
import { eventText, redoable, seesEvent, undoable } from './events';
import { eventsOf, redo, saveRewind, showEvent, undo, useFrozen } from './history';
import { accountColor } from './logic';

/**
 * Play → the game log, beside the board (its button sits right of Chat):
 * everything that happened at the table, newest at the bottom. Everyone
 * sees it: a player what their character would know (or the GM showed
 * them), the GM everything, with Show To The Players on what's theirs
 * alone. The GM's Undo and Redo are here; undoing freezes the board until
 * Save (keep it as rewound) or Redo back to now.
 */
export function GameLog({ speaker, gm, onClose }: { speaker: Speaker; gm: boolean; onClose: () => void }) {
  const log = useVault((s) => s.vault.gameLog);
  const all = useMemo(() => eventsOf(speaker.worldId, log), [log, speaker.worldId]);
  const events = useMemo(() => all.filter((e) => seesEvent(e, speaker.accountId, gm)).slice(-300), [all, speaker.accountId, gm]);
  const frozen = useFrozen(speaker.worldId);
  const list = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [events.length]);
  return (
    <aside aria-label="Game log" className="flex w-[300px] min-w-[200px] shrink flex-col overflow-hidden border-l bg-sidebar">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <span className="font-display text-lg font-black tracking-wide uppercase">Log</span>
        <span className="flex-1" />
        {gm && <UndoRedo worldId={speaker.worldId} />}
        <Button variant="ghost" size="icon-sm" aria-label="Close the log" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      {frozen && (
        <div role="status" aria-label="Board frozen" className="flex flex-col gap-2 border-b bg-sky-500/10 px-3 py-2.5 text-[12.5px]">
          <span className="flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
            <SnowflakeIcon className="size-3.5" /> The board is frozen
          </span>
          <span className="text-muted-foreground">{gm ? 'You’ve rewound the game. Undo or Redo more, then Save to keep the board as it is now (or Redo back to where it was).' : 'The GM is rewinding the game. Nothing on the board moves till they’re done.'}</span>
          {gm && (
            <Button size="sm" className="self-start" onClick={() => saveRewind(speaker.worldId)}>
              <SaveIcon /> Save
            </Button>
          )}
        </div>
      )}
      <ol ref={list} aria-label="Events" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {events.length ? (
          events.map((e) => {
            const secret = e.playerText === null && !e.to;
            return (
              <li key={e.id} data-event data-undone={e.undone ? '' : undefined} className={cn('group/event flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-[12.5px] leading-snug', e.undone ? 'opacity-50' : 'bg-background')}>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <b style={{ color: accountColor(e.accountId) }}>{e.who}</b>
                  {gm && secret && (
                    <span title={e.shown ? 'Shown to the players' : 'Only you see this'} className="flex items-center gap-0.5 text-muted-foreground">
                      {e.shown ? <EyeIcon className="size-3" /> : <EyeOffIcon className="size-3" />} {e.shown ? 'shown' : 'GM only'}
                    </span>
                  )}
                  {e.undone && <span className="rounded bg-muted px-1 font-mono text-[9.5px] text-muted-foreground uppercase">Undone</span>}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                <span className={cn(e.undone && 'line-through')}>{eventText(e, gm)}</span>
                {gm && secret && (
                  <button type="button" onClick={() => showEvent(e, !e.shown)} className="self-start text-[11px] text-muted-foreground opacity-0 group-hover/event:opacity-100 hover:text-foreground focus-visible:opacity-100">
                    {e.shown ? 'Hide From The Players' : 'Show To The Players'}
                  </button>
                )}
              </li>
            );
          })
        ) : (
          <li className="py-8 text-center text-[13px] text-muted-foreground">What happens at the table shows here: moves, damage, conditions, rolls, scenes and turns.</li>
        )}
      </ol>
    </aside>
  );
}

/** The GM's Undo and Redo (the log's header, and Play's). */
export function UndoRedo({ worldId }: { worldId: string }) {
  const log = useVault((s) => s.vault.gameLog);
  const events = useMemo(() => eventsOf(worldId, log), [log, worldId]);
  const back = undoable(events);
  const forward = redoable(events);
  return (
    <>
      <Hint label={back ? `Undo: ${back.text}` : 'Nothing to undo'}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!back}
          onClick={() => {
            const e = undo(worldId);
            if (e) toast('Undone', { description: `${e.text} The board is frozen till you Save or Redo.` });
          }}
        >
          <Undo2Icon />
        </Button>
      </Hint>
      <Hint label={forward ? `Redo: ${forward.text}` : 'Nothing to redo'}>
        <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!forward} onClick={() => redo(worldId)}>
          <Redo2Icon />
        </Button>
      </Hint>
    </>
  );
}
