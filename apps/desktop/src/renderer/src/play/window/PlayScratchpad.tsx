import { useEffect } from 'react';
import { InkSurface } from '@/components/ink/InkSurface';
import { createInk } from '@/lib/actions';
import { live, type World } from '@/lib/model';
import { useVault } from '@/stores/vault';

/**
 * Play's window → Scratchpad (the GM's, at the foot of the Scenes sidebar,
 * in the board's place): handwriting to jot on during the session
 * (initiative, a name you made up, who owes whom). The campaign's own,
 * kept for next time; only the GM sees it.
 */
export function PlayScratchpad({ world }: { world: World }) {
  const ink = useVault((s) => live(s.vault.inks).find((i) => i.scratchFor === world.id));
  // The first time: a sheet of its own.
  useEffect(() => {
    if (!live(useVault.getState().vault.inks).some((i) => i.scratchFor === world.id)) createInk(null, { scratchFor: world.id, worldId: world.id, background: 'lined', height: 900 });
  }, [world.id]);
  return (
    <main data-surface="page" aria-label="Scratchpad" className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-3 px-8 py-7">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-black uppercase">Scratchpad</h1>
          <p className="text-[13px] text-muted-foreground">Jot during the session: initiative, a name you made up, who owes whom. Only you see it, and it’s here next time.</p>
        </header>
        {ink && <InkSurface ink={ink} editable placeholder="Write or draw here, with a pen, a finger or the mouse." />}
      </div>
    </main>
  );
}
