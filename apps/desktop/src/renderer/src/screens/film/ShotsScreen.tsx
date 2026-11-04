import { useNavigate, useSearch } from '@tanstack/react-router';
import { CameraIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { Empty, Label, Led, ProgressBar } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SIDEBAR_ROW, SIDEBAR_ROW_ON, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createShot, restore, trash, updateRecord } from '@/lib/actions';
import { confirmDelete } from '@/components/dnd/Sharing';
import { duration, shotTotals } from '@/lib/film';
import { useBooks, useLive, useWorld, useWorldRecords } from '@/lib/hooks';
import { byOrder, SHOT_MOVES, SHOT_SIZES, SHOT_STATUSES, type Scene, type Shot, type ShotStatus } from '@/lib/model';
import { cn } from '@/lib/utils';

const STATUS: Record<ShotStatus, { label: string; tone: 'off' | 'online' | 'muted' }> = {
  planned: { label: 'Planned', tone: 'off' },
  shot: { label: 'Shot', tone: 'online' },
  cut: { label: 'Cut', tone: 'muted' },
};

/** The open production's script scenes in order, numbered across the script ("Scene 4"). */
export function useScriptScenes(): { scene: Scene; number: number }[] {
  const books = useBooks();
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  return useMemo(() => {
    const out: { scene: Scene; number: number }[] = [];
    for (const book of books) {
      for (const part of parts.filter((p) => p.bookId === book.id).sort(byOrder)) {
        for (const scene of scenes.filter((s) => s.partId === part.id).sort(byOrder)) out.push({ scene, number: out.length + 1 });
      }
    }
    return out;
  }, [books, parts, scenes]);
}

/**
 * /shots?scene=… — the shot list: every script scene's shots in order (or
 * one scene's), each with its size, movement, lens, what's in it, how long it
 * runs and whether it's been shot. "4.2" is scene 4's second shot.
 */
export function ShotsScreen() {
  const world = useWorld();
  const navigate = useNavigate();
  const { scene: sceneId } = useSearch({ from: '/shots' });
  const scenes = useScriptScenes();
  const shots = useWorldRecords('shots');
  const totals = shotTotals(shots);
  const shown = sceneId ? scenes.filter((s) => s.scene.id === sceneId) : scenes;

  if (!world) return null;
  const pick = (id: string | undefined) => void navigate({ to: '/shots', search: id ? { scene: id } : {}, replace: true });

  return (
    <>
      <Sidebar title="Shots">
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <div className="flex items-baseline justify-between">
            <Label>Shot</Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {totals.done} / {totals.count}
            </span>
          </div>
          <ProgressBar value={totals.count ? totals.done / totals.count : 0} />
          <span className="font-mono text-[11px] text-muted-foreground">{duration(totals.seconds)} Of Footage Planned</span>
        </div>
        <SidebarSection title="Scenes">
          <button type="button" onClick={() => pick(undefined)} className={cn(SIDEBAR_ROW, !sceneId && SIDEBAR_ROW_ON)}>
            <CameraIcon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1">All Scenes</span>
            <span className="font-mono text-[11px] text-muted-foreground">{totals.count}</span>
          </button>
          {scenes.map(({ scene, number }) => {
            const own = shotTotals(shots.filter((s) => s.sceneId === scene.id));
            return (
              <button key={scene.id} type="button" onClick={() => pick(scene.id)} className={cn(SIDEBAR_ROW, sceneId === scene.id && SIDEBAR_ROW_ON)}>
                <Led tone={own.count && own.done === own.count ? 'online' : own.count ? 'accent' : 'off'} />
                <span className="min-w-0 flex-1 truncate">
                  {number} · {scene.title || 'Untitled Scene'}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{own.count || ''}</span>
              </button>
            );
          })}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Shots', sceneId ? (scenes.find((s) => s.scene.id === sceneId)?.scene.title ?? 'Scene') : 'All Scenes']} />
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          {scenes.length ? (
            <div className="flex max-w-[1180px] flex-col gap-5">
              {shown.map(({ scene, number }) => (
                <SceneShots key={scene.id} scene={scene} number={number} worldId={world.id} shots={shots.filter((s) => s.sceneId === scene.id).sort(byOrder)} />
              ))}
            </div>
          ) : (
            <Empty title="No Scenes Yet">Write the script first: every scene gets its own shot list here.</Empty>
          )}
        </div>
      </main>
    </>
  );
}

const CELL = 'h-8 border-t border-border/60 px-2 align-middle';
const INPUT = 'h-8 w-full bg-transparent outline-none placeholder:text-muted-foreground/50';

function SceneShots({ scene, number, shots, worldId }: { scene: Scene; number: number; shots: Shot[]; worldId: string }) {
  const totals = shotTotals(shots);
  const remove = (shot: Shot) =>
    confirmDelete({
      noun: 'Shot',
      name: shot.description ? `“${shot.description.slice(0, 40)}${shot.description.length > 40 ? '…' : ''}”` : 'this shot',
      area: 'film:shots',
      remove: () => {
        trash('shots', shot.id);
        return () => restore('shots', shot.id);
      },
    });
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[11px] text-link">SCENE {number}</span>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{scene.title || 'Untitled Scene'}</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {totals.done} / {totals.count} Shot · {duration(totals.seconds)}
        </span>
      </div>
      {shots.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                {['#', 'Size', 'Move', 'Lens', 'What We See', 'Secs', 'Status', ''].map((h) => (
                  <th key={h} className="label px-2 pb-1.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shots.map((shot, i) => (
                <tr key={shot.id} className={cn('group/shot', shot.status === 'cut' && 'opacity-50')}>
                  <td className={cn(CELL, 'w-12 font-mono text-[11.5px] text-muted-foreground')}>
                    {number}.{i + 1}
                  </td>
                  <td className={cn(CELL, 'w-[92px]')}>
                    <SelectField label="Shot size" variant="inline" value={shot.size} onChange={(size) => updateRecord('shots', shot.id, { size })} options={SHOT_SIZES.map((s) => ({ value: s as string, label: s }))} className="font-mono text-[12px]" />
                  </td>
                  <td className={cn(CELL, 'w-[110px]')}>
                    <SelectField label="Camera move" variant="inline" value={shot.move} onChange={(move) => updateRecord('shots', shot.id, { move })} options={SHOT_MOVES.map((s) => ({ value: s as string, label: s }))} className="text-[12.5px]" />
                  </td>
                  <td className={cn(CELL, 'w-[80px]')}>
                    <input aria-label="Lens" value={shot.lens} placeholder="35mm" onChange={(e) => updateRecord('shots', shot.id, { lens: e.target.value })} className={cn(INPUT, 'font-mono text-[12px]')} />
                  </td>
                  <td className={CELL}>
                    <input aria-label="What we see" value={shot.description} placeholder="Ines lights the last lamp" onChange={(e) => updateRecord('shots', shot.id, { description: e.target.value })} className={INPUT} />
                  </td>
                  <td className={cn(CELL, 'w-[64px]')}>
                    <input
                      aria-label="Seconds"
                      type="number"
                      min={0}
                      value={shot.seconds}
                      onChange={(e) => updateRecord('shots', shot.id, { seconds: Math.max(0, Number(e.target.value) || 0) })}
                      className={cn(INPUT, 'font-mono text-[12px] tabular-nums')}
                    />
                  </td>
                  <td className={cn(CELL, 'w-[110px]')}>
                    <SelectField
                      label="Status"
                      variant="inline"
                      value={shot.status}
                      onChange={(status) => updateRecord('shots', shot.id, { status })}
                      options={SHOT_STATUSES.map((s) => ({
                        value: s,
                        label: (
                          <span className="flex items-center gap-1.5">
                            <Led tone={STATUS[s].tone} />
                            {STATUS[s].label}
                          </span>
                        ),
                      }))}
                      className="text-[12.5px]"
                    />
                  </td>
                  <td className={cn(CELL, 'w-8')}>
                    <button
                      type="button"
                      aria-label={`Delete shot ${number}.${i + 1}`}
                      onClick={() => remove(shot)}
                      className="rounded p-1 text-muted-foreground opacity-0 group-hover/shot:opacity-100 hover:text-foreground focus-visible:opacity-100"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => createShot(worldId, scene.id, shots.at(-1) ? { size: shots.at(-1)!.size, lens: shots.at(-1)!.lens } : {})}>
        <PlusIcon /> Add Shot
      </Button>
    </section>
  );
}
