import { useNavigate, useSearch } from '@tanstack/react-router';
import { DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode } from 'react';
import { toast } from 'sonner';
import { confirmDelete } from '@/components/dnd/Sharing';
import { Empty, Label, Led } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SIDEBAR_ROW, SIDEBAR_ROW_ON } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AREA } from '@/components/shared/Field';
import { money } from '@/lib/film';
import { useWorldRecords } from '@/lib/hooks';
import { live, type Collection, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { FilmOnly, nextOrder, PILL, stamp } from '@/film/common';
import { toCsv } from '@/film/reports/reports';
import { useProductionScript } from '@/film/script/hooks';
import { CUE_SOURCES, CUE_USES, CUT_STATUSES, LICENSE_STATUSES, VFX_STATUSES, type Cut, type MusicCue, type VfxShot } from './model';
import { cueLength, toSeconds, clock } from './timecode';

/**
 * /film/post?tab=… — after the shoot: the visual effects shots and where
 * each stands (vfx), the music cues as a cue sheet with their clearances
 * (music), and the cuts of the edit with notes from each screening (cuts).
 */
export function PostScreen() {
  return <FilmOnly>{(world) => <Post world={world} />}</FilmOnly>;
}

const store = () => useVault.getState();
type Tab = 'vfx' | 'music' | 'cuts';

function removeRecord(collection: Collection, id: string, noun: string, name: string) {
  confirmDelete({
    noun,
    name,
    area: 'film:post',
    remove: () => {
      store().remove(collection, id);
      return () => store().restore(collection, id);
    },
  });
}

function Post({ world }: { world: World }) {
  const navigate = useNavigate();
  const search = useSearch({ from: '/film/post' });
  const tab: Tab = search.tab ?? 'vfx';
  const vfx = useWorldRecords('vfx').sort((a, b) => a.order - b.order);
  const cues = useWorldRecords('cues').sort((a, b) => a.order - b.order);
  const cuts = useWorldRecords('cuts').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const setTab = (t: Tab) => void navigate({ to: '/film/post', search: t === 'vfx' ? {} : { tab: t }, replace: true });

  const addVfx = () => {
    const n = live(store().vault.vfx).filter((v) => v.worldId === world.id).length + 1;
    store().put('vfx', { ...stamp(), worldId: world.id, code: `VFX_${String(n * 10).padStart(3, '0')}`, sceneId: null, shotId: null, description: '', vendor: '', status: 'todo', due: '', cost: 0, order: nextOrder(vfx.map((v) => v.order)) } satisfies VfxShot);
  };
  const addCue = () => {
    const n = live(store().vault.cues).filter((c) => c.worldId === world.id).length + 1;
    store().put('cues', { ...stamp(), worldId: world.id, code: `1M${n}`, title: '', by: '', sceneId: null, start: '', end: '', use: 'BI', source: 'Score', license: 'none', cost: 0, notes: '', order: nextOrder(cues.map((c) => c.order)) } satisfies MusicCue);
  };
  const addCut = () => {
    const names = ['Assembly', 'Rough Cut', 'Fine Cut', 'Picture Lock'];
    store().put('cuts', { ...stamp(), worldId: world.id, name: names[Math.min(cuts.length, names.length - 1)]!, date: new Date().toISOString().slice(0, 10), length: '', status: 'editing', link: '', notes: '' } satisfies Cut);
  };
  const add = { vfx: addVfx, music: addCue, cuts: addCut }[tab];

  const tabs: { id: Tab; label: string; count: number; meta: string }[] = [
    { id: 'vfx', label: 'Visual Effects', count: vfx.length, meta: `${vfx.filter((v) => v.status === 'final').length} final` },
    { id: 'music', label: 'Music Cues', count: cues.length, meta: `${cues.filter((c) => c.license === 'requested').length} to clear` },
    { id: 'cuts', label: 'Cuts', count: cuts.length, meta: cuts.at(-1)?.name ?? 'None yet' },
  ];

  return (
    <>
      <Sidebar title="Post" addLabel={tab === 'vfx' ? 'New VFX Shot' : tab === 'music' ? 'New Music Cue' : 'New Cut'} onAdd={add}>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn(SIDEBAR_ROW, 'min-h-[44px] flex-col items-start gap-0 py-1.5', tab === t.id && SIDEBAR_ROW_ON)}>
            <span className="flex w-full items-center justify-between">
              {t.label}
              <span className="font-mono text-[11px] text-muted-foreground">{t.count}</span>
            </span>
            <span className="text-[11.5px] text-muted-foreground">{t.meta}</span>
          </button>
        ))}
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Post', tabs.find((t) => t.id === tab)!.label]}>
          {tab === 'music' && cues.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={PILL}
              onClick={async () => {
                const path = await window.api.files.saveText({
                  defaultName: `${world.name || 'Production'} Cue Sheet.csv`,
                  text: toCsv(['Cue', 'Title', 'Composer / Artist', 'In', 'Out', 'Length', 'Use', 'Source', 'License', 'Cost', 'Notes'], cues.map((c) => [c.code, c.title, c.by, c.start, c.end, cueLength(c.start, c.end), c.use, c.source, LICENSE_STATUSES.find((l) => l.id === c.license)?.label ?? '', c.cost, c.notes])),
                  filter: { name: 'CSV', extensions: ['csv'] },
                });
                if (path) toast('Cue Sheet Saved', { description: path });
              }}
            >
              <DownloadIcon /> Cue Sheet
            </Button>
          )}
          <Button size="sm" className={PILL} onClick={add}>
            <PlusIcon /> {tab === 'vfx' ? 'VFX Shot' : tab === 'music' ? 'Music Cue' : 'Cut'}
          </Button>
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          {tab === 'vfx' ? <VfxTable shots={vfx} /> : tab === 'music' ? <CueTable cues={cues} /> : <CutList cuts={cuts} />}
        </div>
      </main>
    </>
  );
}

const CELL = 'border-t px-2 py-1 align-middle';
const INPUT = 'h-8 w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/50';

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="max-w-[1200px] overflow-x-auto rounded-2xl border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left">
            {head.map((h, i) => (
              <th key={i} className="label px-2 pt-2 pb-1 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const statusOptions = <T extends string>(list: readonly { id: T; label: string; tone: string }[]) =>
  list.map((s) => ({
    value: s.id,
    label: (
      <span className="flex items-center gap-1.5">
        <Led tone={s.tone as 'off' | 'accent' | 'online' | 'muted'} />
        {s.label}
      </span>
    ),
  }));

function useSceneOptions() {
  const script = useProductionScript();
  return [{ value: null as string | null, label: '—' }, ...script.scenes.map((s) => ({ value: s.scene.id as string | null, label: `${s.number} · ${s.scene.title || s.heading.place || 'Untitled'}` }))];
}

function VfxTable({ shots }: { shots: VfxShot[] }) {
  const scenes = useSceneOptions();
  const update = (id: string, changes: Partial<VfxShot>) => store().patch('vfx', id, changes);
  if (!shots.length) return <Empty title="No VFX Shots Yet">List each shot that needs work in post: screens to replace, skies, clean-up. Track who’s doing it and where it stands.</Empty>;
  const total = shots.reduce((n, s) => n + s.cost, 0);
  return (
    <div className="flex flex-col gap-2">
      <Table head={['Code', 'Scene', 'What It Needs', 'Vendor', 'Status', 'Due', 'Cost', '']}>
        {shots.map((s) => (
          <tr key={s.id} className="group/row">
            <td className={cn(CELL, 'w-[100px]')}>
              <input aria-label="Code" value={s.code} onChange={(e) => store().patch('vfx', s.id, { code: e.target.value })} className={cn(INPUT, 'font-mono text-[12px]')} />
            </td>
            <td className={cn(CELL, 'w-[170px]')}>
              <SelectField label="Scene" variant="inline" value={s.sceneId} onChange={(sceneId) => update(s.id, { sceneId })} options={scenes} className="max-w-[160px] truncate text-[12.5px]" />
            </td>
            <td className={CELL}>
              <input aria-label="What it needs" value={s.description} placeholder="Replace the phone screen…" onChange={(e) => update(s.id, { description: e.target.value })} className={INPUT} />
            </td>
            <td className={cn(CELL, 'w-[130px]')}>
              <input aria-label="Vendor" value={s.vendor} placeholder="Who" onChange={(e) => update(s.id, { vendor: e.target.value })} className={INPUT} />
            </td>
            <td className={cn(CELL, 'w-[130px]')}>
              <SelectField label="Status" variant="inline" value={s.status} onChange={(status) => update(s.id, { status })} options={statusOptions(VFX_STATUSES)} className="text-[12.5px]" />
            </td>
            <td className={cn(CELL, 'w-[110px]')}>
              <DateField label="Due" variant="bare" value={s.due || null} placeholder="—" onChange={(due) => update(s.id, { due: due ?? '' })} className="text-[12.5px]" />
            </td>
            <td className={cn(CELL, 'w-[90px]')}>
              <input aria-label="Cost" type="number" min={0} value={s.cost} onChange={(e) => update(s.id, { cost: Math.max(0, Number(e.target.value) || 0) })} className={cn(INPUT, 'font-mono text-[12px]')} />
            </td>
            <td className={cn(CELL, 'w-8')}>
              <button type="button" aria-label={`Delete ${s.code}`} onClick={() => removeRecord('vfx', s.id, 'VFX Shot', s.code)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100">
                <Trash2Icon className="size-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <span className="self-end font-mono text-[11.5px] text-muted-foreground">
        {shots.filter((s) => s.status === 'final').length} / {shots.length} final · {money(total)}
      </span>
    </div>
  );
}

function CueTable({ cues }: { cues: MusicCue[] }) {
  const scenes = useSceneOptions();
  const update = (id: string, changes: Partial<MusicCue>) => store().patch('cues', id, changes);
  if (!cues.length) return <Empty title="No Music Cues Yet">Each piece of music in the cut: where it starts and stops, how it’s used, and whether it’s cleared. Saves out as a cue sheet.</Empty>;
  const runtime = cues.reduce((n, c) => {
    const a = toSeconds(c.start);
    const b = toSeconds(c.end);
    return a !== null && b !== null && b > a ? n + (b - a) : n;
  }, 0);
  return (
    <div className="flex flex-col gap-2">
      <Table head={['Cue', 'Title', 'Composer / Artist', 'Scene', 'In', 'Out', 'Length', 'Use', 'Source', 'License', '']}>
        {cues.map((c) => (
          <tr key={c.id} className="group/row">
            <td className={cn(CELL, 'w-[64px]')}>
              <input aria-label="Cue" value={c.code} onChange={(e) => update(c.id, { code: e.target.value })} className={cn(INPUT, 'font-mono text-[12px]')} />
            </td>
            <td className={CELL}>
              <input aria-label="Title" value={c.title} placeholder="Title" onChange={(e) => update(c.id, { title: e.target.value })} className={INPUT} />
            </td>
            <td className={CELL}>
              <input aria-label="Composer or artist" value={c.by} placeholder="Who" onChange={(e) => update(c.id, { by: e.target.value })} className={INPUT} />
            </td>
            <td className={cn(CELL, 'w-[140px]')}>
              <SelectField label="Scene" variant="inline" value={c.sceneId} onChange={(sceneId) => update(c.id, { sceneId })} options={scenes} className="max-w-[130px] truncate text-[12.5px]" />
            </td>
            <td className={cn(CELL, 'w-[96px]')}>
              <input aria-label="In" value={c.start} placeholder="01:02:10:00" onChange={(e) => update(c.id, { start: e.target.value })} className={cn(INPUT, 'font-mono text-[11.5px]')} />
            </td>
            <td className={cn(CELL, 'w-[96px]')}>
              <input aria-label="Out" value={c.end} placeholder="01:03:40:00" onChange={(e) => update(c.id, { end: e.target.value })} className={cn(INPUT, 'font-mono text-[11.5px]')} />
            </td>
            <td className={cn(CELL, 'w-[60px] font-mono text-[12px] tabular-nums')}>{cueLength(c.start, c.end) || '—'}</td>
            <td className={cn(CELL, 'w-[70px]')}>
              <SelectField label="Use" variant="inline" value={c.use} onChange={(use) => update(c.id, { use })} options={CUE_USES.map((u) => ({ value: u.id as string, label: <span title={u.label}>{u.id}</span> }))} className="font-mono text-[12px]" />
            </td>
            <td className={cn(CELL, 'w-[100px]')}>
              <SelectField label="Source" variant="inline" value={c.source} onChange={(source) => update(c.id, { source })} options={CUE_SOURCES.map((s) => ({ value: s as string, label: s }))} className="text-[12.5px]" />
            </td>
            <td className={cn(CELL, 'w-[120px]')}>
              <SelectField label="License" variant="inline" value={c.license} onChange={(license) => update(c.id, { license })} options={statusOptions(LICENSE_STATUSES)} className="text-[12.5px]" />
            </td>
            <td className={cn(CELL, 'w-8')}>
              <button type="button" aria-label={`Delete cue ${c.code}`} onClick={() => removeRecord('cues', c.id, 'Music Cue', c.title || c.code)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100">
                <Trash2Icon className="size-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <span className="self-end font-mono text-[11.5px] text-muted-foreground">
        {cues.length} cues · {clock(runtime)} of music · {cues.filter((c) => c.license === 'cleared').length} cleared
      </span>
    </div>
  );
}

function CutList({ cuts }: { cuts: Cut[] }) {
  const update = (id: string, changes: Partial<Cut>) => store().patch('cuts', id, changes);
  if (!cuts.length) return <Empty title="No Cuts Yet">Each version of the edit: the assembly, rough cuts, the fine cut, picture lock. Note how long it runs and what came out of each screening.</Empty>;
  return (
    <ol className="flex max-w-[900px] flex-col gap-3">
      {cuts.map((c, i) => (
        <li key={c.id} className="group/row flex flex-col gap-2 rounded-2xl border px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-link">V{i + 1}</span>
            <input aria-label="Cut name" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none" />
            <DateField label="Cut date" variant="bare" clearable={false} value={c.date} onChange={(date) => date && update(c.id, { date })} className="text-[12.5px]" />
            <label className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
              Runs
              <input aria-label="Running time" value={c.length} placeholder="1:32:10" onChange={(e) => update(c.id, { length: e.target.value })} className="w-[72px] bg-transparent text-foreground outline-none" />
            </label>
            <SelectField label="Status" variant="chip" value={c.status} onChange={(status) => update(c.id, { status })} options={statusOptions(CUT_STATUSES)} />
            <button type="button" aria-label={`Delete ${c.name}`} onClick={() => removeRecord('cuts', c.id, 'Cut', c.name)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100">
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
          <input aria-label="Where it is" value={c.link} placeholder="Where the export is: a link or a path" onChange={(e) => update(c.id, { link: e.target.value })} className="bg-transparent font-mono text-[12px] text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
          <Label>Screening Notes</Label>
          <Textarea aria-label="Screening notes" rows={3} value={c.notes} placeholder="What worked, what dragged, what to try…" onChange={(e) => update(c.id, { notes: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
        </li>
      ))}
    </ol>
  );
}
