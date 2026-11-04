import { Link } from '@tanstack/react-router';
import { FileCheck2Icon, ImagePlusIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { confirmDelete } from '@/components/dnd/Sharing';
import { Empty, Label, Led, ProgressBar } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { mediaSrc, pickPicture } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { today } from '@/lib/dates';
import { useWorldRecords } from '@/lib/hooks';
import { live, type Entry, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { FilmOnly, stamp } from '@/film/common';
import { roleOf } from '@/film/script/cast';
import { RELEASE_KINDS, RELEASE_STATUSES, type ReleaseForm, type ReleaseKind, type ReleaseStatus } from './model';

/**
 * /film/releases — the signed releases: one for each cast member and each
 * location, deal memos for crew, and any others (a crowd, a song, artwork).
 * Mark each needed, sent or signed, with the day it was signed and a picture
 * of the signed form.
 */
export function ReleasesScreen() {
  return <FilmOnly>{(world) => <Releases world={world} />}</FilmOnly>;
}

const store = () => useVault.getState();

/** An entry's release (made the first time it's changed). */
function releaseFor(worldId: string, entry: Entry, kind: ReleaseKind): ReleaseForm {
  const found = live(store().vault.releases).find((r) => r.worldId === worldId && r.entryId === entry.id);
  if (found) return found;
  const made: ReleaseForm = { ...stamp(), worldId, entryId: entry.id, name: '', kind, status: 'needed', signedOn: '', notes: '' };
  store().put('releases', made);
  return made;
}
const update = (id: string, changes: Partial<ReleaseForm>) => store().patch('releases', id, changes);

type Row = { key: string; entry: Entry | null; release: ReleaseForm | null; kind: ReleaseKind };

function Releases({ world }: { world: World }) {
  const entries = useWorldRecords('entries');
  const releases = useWorldRecords('releases');
  const [viewing, setViewing] = useState<string | null>(null);
  const byEntry = new Map(releases.filter((r) => r.entryId).map((r) => [r.entryId!, r]));
  const rows = (kind: 'character' | 'place' | 'crew', release: ReleaseKind): Row[] =>
    entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ key: e.id, entry: e, release: byEntry.get(e.id) ?? null, kind: release }));
  const cast = rows('character', 'talent');
  const places = rows('place', 'location');
  const crew = rows('crew', 'crew');
  const others: Row[] = releases.filter((r) => !r.entryId).map((r) => ({ key: r.id, entry: null, release: r, kind: r.kind }));
  const counted = [...cast, ...places, ...others];
  const signed = counted.filter((r) => r.release?.status === 'signed').length;

  const addOther = () => store().put('releases', { ...stamp(), worldId: world.id, entryId: null, name: '', kind: 'appearance', status: 'needed', signedOn: '', notes: '' } satisfies ReleaseForm);

  return (
    <>
      <Sidebar title="Releases" addLabel="Add Another Release" onAdd={addOther}>
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <div className="flex items-baseline justify-between">
            <Label>Signed</Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {signed} / {counted.length}
            </span>
          </div>
          <ProgressBar value={counted.length ? signed / counted.length : 0} />
          <span className="font-mono text-[11px] text-muted-foreground">Cast, Locations & Others</span>
        </div>
        <SidebarSection title="Still Needed">
          {counted
            .filter((r) => r.release?.status !== 'signed')
            .map((r) => (
              <span key={r.key} className="flex min-h-[28px] items-center gap-2 px-2.5 text-[13px]">
                <Led tone={r.release?.status === 'sent' ? 'accent' : 'off'} />
                <span className="truncate">{r.entry ? (r.entry.kind === 'character' ? roleOf(r.entry) : r.entry.name) || 'Untitled' : r.release?.name || 'Untitled'}</span>
              </span>
            ))}
          {counted.length > 0 && signed === counted.length && <p className="px-2.5 text-[13px] text-muted-foreground">Every release is signed.</p>}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Releases', world.name]} />
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          {!counted.length && !crew.length ? (
            <Empty title="No One To Clear Yet" action={<Button onClick={addOther}>Add A Release</Button>}>
              Add your cast and locations, and each gets a release to track here. Add others (a crowd, a song, artwork) by name.
            </Empty>
          ) : (
            <div className="flex max-w-[1080px] flex-col gap-5">
              <Group title="Cast · Talent Releases" rows={cast} world={world} onView={setViewing} />
              <Group title="Locations · Location Releases" rows={places} world={world} onView={setViewing} />
              <Group title="Others" rows={others} world={world} onView={setViewing} action={<Button variant="ghost" size="xs" className="text-muted-foreground" onClick={addOther}><PlusIcon /> Add</Button>} empty="A crowd, a song, artwork in shot: add a release for it." />
              {crew.length > 0 && <Group title="Crew · Deal Memos" rows={crew} world={world} onView={setViewing} />}
            </div>
          )}
        </div>
      </main>
      {viewing && (
        <Dialog open onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-black uppercase">Signed Form</DialogTitle>
            </DialogHeader>
            <img src={mediaSrc(viewing)} alt="The signed form" className="max-h-[70vh] w-full rounded-lg border object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Group({ title, rows, world, onView, action, empty }: { title: string; rows: Row[]; world: World; onView: (scan: string) => void; action?: ReactNode; empty?: string }) {
  if (!rows.length && !empty) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label>{title}</Label>
        {action}
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border">
          {rows.map((row) => (
            <ReleaseRow key={row.key} row={row} world={world} onView={onView} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function ReleaseRow({ row, world, onView }: { row: Row; world: World; onView: (scan: string) => void }) {
  const r = row.release;
  const ensure = () => r ?? releaseFor(world.id, row.entry!, row.kind);
  const set = (changes: Partial<ReleaseForm>) => update(ensure().id, changes);
  const status: ReleaseStatus = r?.status ?? 'needed';
  const attach = async () => {
    const scan = await pickPicture();
    if (scan) set({ scan, ...(status !== 'signed' ? { status: 'signed', signedOn: r?.signedOn || today() } : {}) });
  };
  const remove = () =>
    confirmDelete({
      noun: 'Release',
      name: r?.name || 'this release',
      area: 'film:releases',
      remove: () => {
        store().remove('releases', r!.id);
        return () => store().restore('releases', r!.id);
      },
    });
  return (
    <div className="group/rel grid grid-cols-[minmax(0,1.3fr)_150px_120px_150px_minmax(0,1fr)_74px] items-center gap-3 border-b px-3.5 py-1.5 text-[13px] last:border-b-0">
      {row.entry ? (
        <Link to="/bible/$kind/$entryId" params={{ kind: row.entry.kind, entryId: row.entry.id }} className="min-w-0 truncate font-medium hover:underline">
          {row.entry.kind === 'character' ? roleOf(row.entry) : row.entry.name || 'Untitled'}
          {row.entry.kind === 'character' && roleOf(row.entry) !== row.entry.name && <span className="font-normal text-muted-foreground"> · {row.entry.name}</span>}
        </Link>
      ) : (
        <input aria-label="Who or what" value={r?.name ?? ''} placeholder="The crowd at the fair, a song…" onChange={(e) => set({ name: e.target.value })} className="h-8 min-w-0 bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/60" />
      )}
      {row.entry ? (
        <span className="text-[12px] text-muted-foreground">{RELEASE_KINDS.find((k) => k.id === row.kind)?.label}</span>
      ) : (
        <SelectField label="Kind" variant="inline" value={r?.kind ?? 'appearance'} onChange={(kind) => set({ kind })} options={RELEASE_KINDS.filter((k) => k.for === 'Others').map((k) => ({ value: k.id as ReleaseKind, label: k.label }))} className="text-[12.5px]" />
      )}
      <SelectField
        label="Status"
        variant="inline"
        value={status}
        onChange={(next) => set({ status: next, ...(next === 'signed' && !r?.signedOn ? { signedOn: today() } : {}) })}
        options={RELEASE_STATUSES.map((s) => ({
          value: s.id,
          label: (
            <span className="flex items-center gap-1.5">
              <Led tone={s.tone} />
              {s.label}
            </span>
          ),
        }))}
        className="text-[12.5px]"
      />
      {status === 'signed' ? <DateField label="Signed on" variant="bare" value={r?.signedOn || null} placeholder="Signed on…" onChange={(day) => set({ signedOn: day ?? '' })} className="text-[12.5px]" /> : <span className="text-[12px] text-muted-foreground">—</span>}
      <input aria-label="Notes" value={r?.notes ?? ''} placeholder="Notes…" onChange={(e) => set({ notes: e.target.value })} className="h-8 min-w-0 bg-transparent text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
      <div className="flex items-center justify-end gap-1">
        {r?.scan ? (
          <span className="relative">
            <button type="button" aria-label="See the signed form" onClick={() => onView(r.scan!)} className="block size-8 overflow-hidden rounded border">
              <img src={mediaSrc(r.scan)} alt="" className="size-full object-cover" />
            </button>
            <button type="button" aria-label="Take the form off" onClick={() => set({ scan: undefined })} className="absolute -top-1.5 -right-1.5 hidden rounded-full border bg-background p-0.5 group-hover/rel:block">
              <XIcon className="size-2.5" />
            </button>
          </span>
        ) : (
          <button type="button" aria-label="Attach the signed form" title="Attach a picture of the signed form" onClick={() => void attach()} className={cn('rounded p-1.5 text-muted-foreground hover:text-foreground', status === 'signed' && 'text-link')}>
            {status === 'signed' ? <FileCheck2Icon className="size-4" /> : <ImagePlusIcon className="size-4" />}
          </button>
        )}
        {!row.entry && r && (
          <button type="button" aria-label="Delete this release" onClick={remove} className="rounded p-1 text-muted-foreground opacity-0 group-hover/rel:opacity-100 hover:text-destructive focus-visible:opacity-100">
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
