import { Link } from '@tanstack/react-router';
import { CameraIcon, ListChecksIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Label } from '@/components/shared/bits';
import { duration, scriptLength, shotTotals } from '@/lib/film';
import { useLive, useRecord, useWorldRecords } from '@/lib/hooks';
import type { Scene } from '@/lib/model';
import { cn } from '@/lib/utils';
import { categoryInfo } from '@/film/breakdown/model';
import { roundSnapshot } from '@/film/revisions/actions';
import { sceneChanges } from '@/film/revisions/diff';
import { blocksToElements } from './elements';
import { useProductionScript } from './hooks';
import { eighthsLabel } from './layout';
import { REVISION_COLORS } from './model';

/**
 * Filmmaking → Script, beside a script scene: its number and length (in
 * eighths of a page, from the laid-out script), its shots, what the
 * breakdown says it needs, and what's changed in this revision round.
 */
export function FilmSceneBlocks({ scene }: { scene: Scene }) {
  const script = useProductionScript();
  const shots = useLive('shots');
  const items = useWorldRecords('breakdown');
  const book = useRecord('books', scene.bookId);
  const snapshots = useLive('scriptSnapshots');
  const own = script.byId.get(scene.id);
  const sceneShots = shotTotals(shots.filter((s) => s.sceneId === scene.id));
  const needs = items.filter((i) => i.sceneIds.includes(scene.id));
  const round = book?.script?.lock?.rounds.at(-1);
  const changes = useMemo(() => {
    if (!book || !round || round.color === 0) return null;
    return sceneChanges(roundSnapshot(book)?.scenes[scene.id]?.elements, blocksToElements(scene.content));
    // The snapshot is read from the vault: recheck when snapshots change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, round, scene.content, scene.id, snapshots]);
  const color = round ? REVISION_COLORS[round.color % REVISION_COLORS.length]! : null;
  const eighths = own?.eighths ?? 1;

  return (
    <>
      <Block title={own ? `Scene ${own.number}` : 'Length'} meta={own?.heading.ie ? [own.heading.ie, own.heading.time].filter(Boolean).join(' · ') : undefined}>
        <div className="grid grid-cols-2 gap-1.5">
          <Tile label="Pages">{eighthsLabel(eighths)}</Tile>
          <Tile label="On Screen">≈ {duration(eighths * 7.5)}</Tile>
          <Tile label="Read Aloud">≈ {duration(scriptLength(scene.words).spokenMinutes * 60)}</Tile>
          <Tile label="Shots">{sceneShots.count ? `${sceneShots.done} / ${sceneShots.count} · ${duration(sceneShots.seconds)}` : 'None'}</Tile>
        </div>
        <Link to="/shots" search={{ scene: scene.id }} className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] text-link hover:underline">
          <CameraIcon className="size-3.5" /> Shot List For This Scene
        </Link>
      </Block>
      <Block title="Breakdown" meta={needs.length ? `${needs.length} ${needs.length === 1 ? 'Element' : 'Elements'}` : undefined}>
        {needs.length ? (
          <div className="flex flex-wrap gap-1">
            {needs.map((item) => (
              <span key={item.id} className={cn('inline-flex h-6 items-center rounded-full border px-2 text-[11.5px]', categoryInfo(item.category).chip)} title={categoryInfo(item.category).label}>
                {item.name || 'Untitled'}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Props, wardrobe, effects and more this scene needs.</p>
        )}
        <Link to="/film/breakdown" search={{ scene: scene.id }} className="inline-flex items-center gap-1.5 self-start font-mono text-[11px] text-link hover:underline">
          <ListChecksIcon className="size-3.5" /> Break Down This Scene
        </Link>
      </Block>
      {changes && color && (
        <Block title={`${color.name} Revisions`}>
          <span className="flex items-center gap-2 text-[12.5px]">
            <span className="size-2.5 rounded-full border border-foreground/30" style={{ background: color.tint }} />
            {changes.status === 'new' ? 'New in this round' : changes.status === 'same' ? 'No changes in this round' : `${changes.count} ${changes.count === 1 ? 'change' : 'changes'} in this round`}
          </span>
        </Block>
      )}
    </>
  );
}

function Block({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label>{title}</Label>
        {meta && <span className="truncate font-mono text-[10.5px] text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12.5px]">
      <span className="label text-[9px]">{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}
