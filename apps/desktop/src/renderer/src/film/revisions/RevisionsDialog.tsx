import { useNavigate } from '@tanstack/react-router';
import { LockIcon, PaletteIcon, UnlockIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLive } from '@/lib/hooks';
import type { Book } from '@/lib/model';
import { cn } from '@/lib/utils';
import { buildScript } from '@/film/script/build';
import { blocksToElements } from '@/film/script/elements';
import { REVISION_COLORS } from '@/film/script/model';
import { lockScript, nextColor, roundSnapshot, startRound, unlockScript } from './actions';
import { sceneChanges } from './diff';

/**
 * Filmmaking → Revisions: lock the script, then revise it a color at a time.
 * Shows the rounds so far and what's changed in this one, scene by scene.
 */

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

export function RevisionsDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const navigate = useNavigate();
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  const snapshots = useLive('scriptSnapshots');
  const lock = book.script?.lock;
  const [label, setLabel] = useState('');
  const snapshot = useMemo(() => roundSnapshot(book), [book, snapshots]); // eslint-disable-line react-hooks/exhaustive-deps
  const built = useMemo(() => buildScript(book, parts, scenes), [book, parts, scenes]);
  const round = lock?.rounds.at(-1);
  const color = round ? REVISION_COLORS[round.color % REVISION_COLORS.length]! : null;
  const next = REVISION_COLORS[nextColor(book)]!;

  // What's changed since this round began.
  const changes = useMemo(() => {
    if (!snapshot) return [];
    const byId = new Map(scenes.map((s) => [s.id, s]));
    return built.scenes
      .map((s) => {
        const scene = byId.get(s.id);
        if (s.omitted || !scene) return snapshot.scenes[s.id] ? { id: s.id, number: s.number, title: 'Omitted', status: 'changed' as const, count: 1, omitted: true } : null;
        return { id: s.id, number: s.number, title: scene.title || 'Untitled Scene', ...sceneChanges(snapshot.scenes[s.id]?.elements, blocksToElements(scene.content)), omitted: false };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null && c.status !== 'same');
  }, [snapshot, built, scenes]);

  const lockIt = () => {
    lockScript(book);
    toast('Script Locked', { description: 'Every scene keeps its number now. New scenes get letters (12A); cut ones stay as OMITTED.' });
  };
  const startIt = () => {
    startRound(book, label.trim());
    setLabel('');
    toast(`${next.name} Revisions Started`, { description: `Changes from now on are marked as ${next.name.toLowerCase()} revisions when you export.` });
  };
  const unlock = () => {
    const undo = unlockScript(book);
    toast('Script Unlocked', { description: 'Scenes number 1, 2, 3 in order again.', action: { label: 'Undo', onClick: undo } });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[min(84vh,720px)] flex-col sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">{lock ? 'Revisions' : 'Lock The Script'}</DialogTitle>
          <DialogDescription>
            {lock
              ? `Locked ${when(lock.lockedAt)}. Scene numbers stay put: a scene put in after 12 is 12A, a cut one stays as OMITTED. Each round of changes gets the next color, marked with asterisks in the margin.`
              : 'When the script goes out to the team, lock it: every scene keeps its number for good, so schedules, shot lists and call sheets never shift. Then revise in rounds, each its own color (Blue, Pink, Yellow…), with what changed marked.'}
          </DialogDescription>
        </DialogHeader>
        {lock ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <Label>Rounds</Label>
              <ol className="flex flex-wrap gap-1.5">
                {lock.rounds.map((r, i) => {
                  const c = REVISION_COLORS[r.color % REVISION_COLORS.length]!;
                  const latest = i === lock.rounds.length - 1;
                  return (
                    <li key={`${r.color}-${r.startedAt}`} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]', latest && 'border-foreground')}>
                      <span className="size-3 rounded-full border border-foreground/30" style={{ background: c.tint }} />
                      <span className="font-medium">{r.color === 0 ? 'White (Locked)' : c.name}</span>
                      <span className="text-muted-foreground">{when(r.startedAt)}</span>
                      {r.label && <span className="text-muted-foreground">· {r.label}</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Changed In {color?.name ?? 'This Round'} · {changes.length} {changes.length === 1 ? 'Scene' : 'Scenes'}
              </Label>
              {changes.length ? (
                <ul className="flex flex-col rounded-xl border">
                  {changes.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={c.omitted}
                        onClick={() => {
                          onClose();
                          void navigate({ to: '/manuscript/$sceneId', params: { sceneId: c.id } });
                        }}
                        className="flex w-full items-center gap-3 border-b px-3.5 py-2 text-left text-[13px] last:border-b-0 hover:bg-muted disabled:hover:bg-transparent"
                      >
                        <span className="w-10 font-mono text-[11.5px] text-link">{c.number}</span>
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{c.omitted ? 'Omitted' : c.status === 'new' ? 'New Scene' : `${c.count} ${c.count === 1 ? 'Change' : 'Changes'}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">{round?.color === 0 ? 'Nothing changed since the lock.' : 'Nothing changed in this round yet.'}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border px-3.5 py-3">
              <span className="flex items-center gap-2 text-[13.5px] font-medium">
                <span className="size-3 rounded-full border border-foreground/30" style={{ background: next.tint }} /> Start {next.name} Revisions
              </span>
              <span className="text-[12.5px] text-muted-foreground">When this round’s pages have gone out. Changes after this are {next.name.toLowerCase()}; scenes added since the lock keep the numbers they have now.</span>
              <div className="flex gap-2 pt-1">
                <Input aria-label="Round label" value={label} placeholder="Label it (optional): Network notes…" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startIt()} className={cn(FIELD, 'flex-1')} />
                <Button onClick={startIt}>
                  <PaletteIcon /> Start {next.name}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border px-3.5 py-3 text-[13px] text-muted-foreground">
            {built.scenes.length} scenes will keep the numbers 1 to {built.scenes.length}.
          </div>
        )}
        <DialogFooter>
          {lock ? (
            <>
              <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={unlock}>
                <UnlockIcon /> Unlock
              </Button>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!built.scenes.length} onClick={lockIt}>
                <LockIcon /> Lock Script
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
