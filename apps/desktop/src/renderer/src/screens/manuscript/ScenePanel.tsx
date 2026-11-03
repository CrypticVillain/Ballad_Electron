import { Link } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { DotMeter, Label } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { Textarea } from '@/components/ui/textarea';
import { updateScene } from '@/lib/actions';
import { useWorldRecords } from '@/lib/hooks';
import { SCENE_STATUSES, type Entry, type Scene } from '@/lib/model';
import { formatWords, initials } from '@/lib/text';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, StatusLed } from './Binder';

const GOALS = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

/**
 * ScenePanel — the scene's details beside the prose (the mock-up's right
 * column): status, point of view, place and when; the word goal as a dot
 * meter; who and what the scene mentions; and a note to yourself.
 */
export function ScenePanel({ scene }: { scene: Scene }) {
  const entries = useWorldRecords('entries');
  const characters = useMemo(() => entries.filter((e) => e.kind === 'character').sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const places = useMemo(() => entries.filter((e) => e.kind === 'place').sort((a, b) => a.name.localeCompare(b.name)), [entries]);

  /** Everyone and everything in the scene: the POV, the place, then whatever the prose mentions. */
  const inScene = useMemo(() => {
    const ids = [scene.povId, scene.placeId, ...scene.links].filter((id): id is string => Boolean(id));
    const order = { character: 0, place: 1, lore: 2 };
    return [...new Set(ids)]
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is Entry => Boolean(e))
      .sort((a, b) => order[a.kind] - order[b.kind]);
  }, [scene.povId, scene.placeId, scene.links, entries]);

  const entryOptions = (list: Entry[]) => [{ value: null, label: 'None' }, ...list.map((e) => ({ value: e.id as string | null, label: e.name || 'Untitled' }))];

  return (
    <aside aria-label="Scene details" className="flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-l bg-sidebar/50 p-5">
      <section className="flex flex-col gap-2.5">
        <Label>Scene</Label>
        <dl className="flex flex-col gap-2">
          <PanelRow label="Status">
            <SelectField
              label="Status"
              variant="inline"
              align="end"
              value={scene.status}
              onChange={(status) => updateScene(scene.id, { status })}
              options={SCENE_STATUSES.map((s) => ({
                value: s,
                label: (
                  <span className="flex items-center gap-1.5">
                    <StatusLed status={s} />
                    {STATUS_LABEL[s]}
                  </span>
                ),
              }))}
            />
          </PanelRow>
          <PanelRow label="POV">
            <SelectField label="Point of view" variant="inline" align="end" value={scene.povId} onChange={(povId) => updateScene(scene.id, { povId })} options={entryOptions(characters)} />
          </PanelRow>
          <PanelRow label="Place">
            <SelectField label="Place" variant="inline" align="end" value={scene.placeId} onChange={(placeId) => updateScene(scene.id, { placeId })} options={entryOptions(places)} />
          </PanelRow>
          <PanelRow label="When">
            <input
              aria-label="When"
              value={scene.when}
              placeholder="Add"
              onChange={(e) => updateScene(scene.id, { when: e.target.value })}
              className="w-full min-w-0 bg-transparent text-right outline-none placeholder:text-muted-foreground/60"
            />
          </PanelRow>
        </dl>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label>Words</Label>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatWords(scene.words)}
            {scene.targetWords > 0 && ` / ${formatWords(scene.targetWords)}`}
          </span>
        </div>
        {scene.targetWords > 0 && <DotMeter value={scene.words / scene.targetWords} total={20} />}
        <div className="flex items-center justify-between gap-2 font-mono text-xs">
          <span className="text-muted-foreground">Goal</span>
          <SelectField
            label="Word goal"
            variant="inline"
            align="end"
            value={scene.targetWords}
            onChange={(targetWords) => updateScene(scene.id, { targetWords })}
            options={GOALS.map((g) => ({ value: g, label: g ? formatWords(g) : 'None' }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <Label>In This Scene</Label>
        {inScene.length ? (
          <div className="flex flex-wrap gap-1.5">
            {inScene.map((entry) => (
              <Link
                key={entry.id}
                to="/bible/$kind/$entryId"
                params={{ kind: entry.kind, entryId: entry.id }}
                className="inline-flex h-[30px] items-center gap-2 rounded-full border bg-background pr-2.5 pl-1 text-[12.5px] hover:border-foreground/30"
              >
                <span
                  className={cn(
                    'flex size-[22px] items-center justify-center rounded-full font-mono text-[9.5px]',
                    entry.id === scene.povId ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background',
                    entry.kind !== 'character' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {initials(entry.name || '?')}
                </span>
                {entry.name || 'Untitled'}
                {entry.id === scene.povId && <span className="font-mono text-[10px] text-muted-foreground">POV</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Pick a POV and a place, or type @ in the scene to name someone.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="scene-note" className="label">
          Scene Note
        </label>
        <Textarea
          id="scene-note"
          rows={5}
          value={scene.note}
          placeholder="What this scene has to do, what to save for later…"
          onChange={(e) => updateScene(scene.id, { note: e.target.value })}
          className={cn(AREA, 'resize-none text-[13px] leading-relaxed')}
        />
      </section>
    </aside>
  );
}

/** A spec row whose value is a control ("POV ····· Ines Varga ▾"). */
function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span aria-hidden className="min-w-3 flex-1 border-b border-dotted border-muted-foreground/50" />
      <dd className="flex max-w-[60%] min-w-0 justify-end">{children}</dd>
    </div>
  );
}
