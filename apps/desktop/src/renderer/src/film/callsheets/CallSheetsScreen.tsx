import { useNavigate, useSearch } from '@tanstack/react-router';
import { DownloadIcon, PlusIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Empty, Label } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { TimeField } from '@/components/shared/TimeField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SIDEBAR_ROW, SIDEBAR_ROW_ON, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createShootDay, updateRecord } from '@/lib/actions';
import { addDays, longDate, shortDate, today, weekdayShort } from '@/lib/dates';
import { useWorldRecords } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { FilmOnly, PILL } from '@/film/common';
import { useProductionScript } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import type { CastCall } from './model';
import { callSheetHtml } from './pdf';
import { assembleSheet, updateSheet, type AssembledSheet } from './sheet';

/**
 * /film/callsheets?day=… — a shoot day's call sheet: when everyone's
 * called, where to go (and park, and the nearest hospital), the day's
 * scenes and who's in them, the crew, and tomorrow's work. Exported as a
 * PDF to send out the night before.
 */
export function CallSheetsScreen() {
  return <FilmOnly>{(world) => <CallSheets world={world} />}</FilmOnly>;
}

function CallSheets({ world }: { world: World }) {
  const navigate = useNavigate();
  const { day: dayId } = useSearch({ from: '/film/callsheets' });
  const days = useWorldRecords('shootDays');
  const entries = useWorldRecords('entries');
  const script = useProductionScript();
  const sorted = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date) || a.call.localeCompare(b.call)), [days]);
  const day = sorted.find((d) => d.id === dayId) ?? sorted.find((d) => !d.done) ?? sorted[0];
  const sheet = useMemo(() => (day ? assembleSheet(day, sorted, script, entries) : null), [day, sorted, script, entries]);
  const pick = (id: string) => void navigate({ to: '/film/callsheets', search: { day: id }, replace: true });
  const add = () => pick(createShootDay(world.id, { date: sorted.at(-1) ? addDays(sorted.at(-1)!.date, 1) : today() }).id);
  const exportIt = async () => {
    if (!sheet) return;
    const path = await window.api.files.savePdf({ defaultName: `${world.name || 'Production'} Call Sheet Day ${sheet.index + 1}.pdf`, html: callSheetHtml(world.name, sheet), pageSize: 'Letter' });
    if (path) toast('Call Sheet Exported', { description: `Day ${sheet.index + 1}, ${longDate(sheet.day.date)}. Saved to ${path}` });
  };
  return (
    <>
      <Sidebar title="Call Sheets" addLabel="New Shoot Day" onAdd={add}>
        <SidebarSection title="Shoot Days">
          {sorted.map((d, i) => (
            <button key={d.id} type="button" onClick={() => pick(d.id)} className={cn(SIDEBAR_ROW, day?.id === d.id && SIDEBAR_ROW_ON, d.done && 'opacity-60')}>
              <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">DAY {i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {weekdayShort(d.date)} {shortDate(d.date)}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{d.sceneIds.length || ''}</span>
            </button>
          ))}
          {!sorted.length && <p className="px-2.5 text-[13px] text-muted-foreground">No shoot days yet.</p>}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Call Sheets', sheet ? `Day ${sheet.index + 1}` : world.name]}>
          <Button variant="outline" size="sm" className={PILL} disabled={!sheet} onClick={() => void exportIt()}>
            <DownloadIcon /> Export PDF
          </Button>
        </TopBar>
        {sheet ? (
          <Sheet world={world} sheet={sheet} places={entries.filter((e) => e.kind === 'place')} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Empty title="No Shoot Days Yet" action={<Button onClick={add}><PlusIcon /> New Shoot Day</Button>}>
              Plan a shoot day, and its call sheet comes together here: calls, scenes, cast and crew.
            </Empty>
          </div>
        )}
      </main>
    </>
  );
}

function Sheet({ world, sheet, places }: { world: World; sheet: AssembledSheet; places: { id: string; name: string }[] }) {
  const { day } = sheet;
  const s = sheet.sheet;
  const set = (changes: Parameters<typeof updateSheet>[1]) => updateSheet(day.id, changes);
  const setCast = (id: string, changes: Partial<CastCall>) => set({ cast: { ...s.cast, [id]: { ...s.cast?.[id], ...changes } } });
  const time = (label: string, value: string | undefined, onChange: (t: string) => void) => (
    <div className="flex flex-col gap-0.5 rounded-xl border px-3 py-2">
      <Label>{label}</Label>
      <TimeField label={label} variant="inline" value={value ?? ''} none="Not Set" from="04:00" to="23:30" onChange={onChange} className="font-mono text-[14px]" />
    </div>
  );
  const departments = [...new Set(sheet.crew.map((c) => c.department))];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-12">
      <div className="flex max-w-[980px] flex-col gap-5">
        <header className="flex flex-wrap items-end gap-4 border-b-2 border-foreground pb-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-mono text-[11px] tracking-[0.08em] text-link uppercase">
              {world.name} · Day {sheet.index + 1} Of {sheet.of}
            </span>
            <h2 className="font-display text-[30px] leading-tight font-black uppercase">{longDate(day.date)}</h2>
          </div>
          <div className="flex flex-col items-end">
            <Label>General Call</Label>
            <TimeField label="General call" variant="inline" value={day.call} from="04:00" to="21:00" step={15} onChange={(call) => updateRecord('shootDays', day.id, { call })} className="font-display text-[34px] leading-none font-black" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {time('Shooting Call', s.shooting, (shooting) => set({ shooting }))}
          {time('Breakfast', s.breakfast, (breakfast) => set({ breakfast }))}
          {time('Lunch', s.lunch, (lunch) => set({ lunch }))}
          {time('Est. Wrap', s.wrap, (wrap) => set({ wrap }))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Location">
            <SelectField label="Location" value={day.placeId} onChange={(placeId) => updateRecord('shootDays', day.id, { placeId })} options={[{ value: null, label: 'No Location' }, ...places.map((p) => ({ value: p.id as string | null, label: p.name || 'Untitled' }))]} />
            <span className="text-[13px] text-muted-foreground">{sheet.address || 'No address yet: add one on the location’s page.'}</span>
            <Input aria-label="Parking" value={s.parking ?? sheet.parking} placeholder="Parking and base camp…" onChange={(e) => set({ parking: e.target.value })} className={FIELD} />
          </Card>
          <Card title="Safety & Weather">
            <Textarea aria-label="Nearest hospital" rows={2} value={s.hospital ?? ''} placeholder="Nearest hospital: name, address, phone" onChange={(e) => set({ hospital: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
            <div className="grid grid-cols-3 gap-2">
              <Input aria-label="Weather" value={s.weather ?? ''} placeholder="Weather" onChange={(e) => set({ weather: e.target.value })} className={FIELD} />
              <Input aria-label="Sunrise" value={s.sunrise ?? ''} placeholder="Sunrise" onChange={(e) => set({ sunrise: e.target.value })} className={FIELD} />
              <Input aria-label="Sunset" value={s.sunset ?? ''} placeholder="Sunset" onChange={(e) => set({ sunset: e.target.value })} className={FIELD} />
            </div>
          </Card>
        </div>

        <Card title={`Scenes · ${sheet.scenes.length} · ${eighthsLabel(sheet.eighths)} Pages`}>
          {sheet.scenes.length ? (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  {['Sc', 'Set', 'D/N', 'Pages', 'Cast', 'Description'].map((h) => (
                    <th key={h} className="label pr-3 pb-1.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.scenes.map((sc) => (
                  <tr key={sc.scene.id} className="border-t">
                    <td className="py-1.5 pr-3 font-mono font-bold">{sc.number}</td>
                    <td className="pr-3 font-mono text-[12px] uppercase">
                      {sc.heading.ie && `${sc.heading.ie}. `}
                      {sc.heading.place || sc.scene.title}
                    </td>
                    <td className="pr-3 font-mono text-[12px]">{sc.heading.time ? (/night|evening|dusk/i.test(sc.heading.time) ? 'N' : 'D') : '—'}</td>
                    <td className="pr-3 font-mono text-[12px]">{eighthsLabel(sc.eighths)}</td>
                    <td className="pr-3 font-mono text-[12px]">{sc.cast.map((id) => sheet.cast.find((c) => c.id === id)?.number).join(', ')}</td>
                    <td>
                      <input aria-label={`Scene ${sc.number} description`} value={sc.note} placeholder={sc.scene.title} onChange={(e) => set({ sceneNotes: { ...s.sceneNotes, [sc.scene.id]: e.target.value } })} className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted-foreground">No scenes on this day yet: add them on the Schedule or the stripboard.</p>
          )}
        </Card>

        <Card title={`Cast · ${sheet.cast.length}`}>
          {sheet.cast.length ? (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  {['#', 'Role', 'Cast', '', 'Call', 'Makeup', 'On Set', 'Notes'].map((h, i) => (
                    <th key={i} className="label pr-3 pb-1.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.cast.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-1 pr-3 font-mono text-[12px] text-muted-foreground">{c.number}</td>
                    <td className="pr-3 font-medium">{c.role}</td>
                    <td className="pr-3 text-muted-foreground">{c.name !== c.role ? c.name : ''}</td>
                    <td className="pr-3 font-mono text-[11px]">{c.status}</td>
                    <td className="pr-1">
                      <TimeField label={`${c.role} call`} variant="inline" value={c.call} from="04:00" to="22:00" onChange={(call) => setCast(c.id, { call })} className="font-mono text-[12.5px]" />
                    </td>
                    <td className="pr-1">
                      <TimeField label={`${c.role} makeup`} variant="inline" value={c.makeup} none="—" from="04:00" to="22:00" onChange={(makeup) => setCast(c.id, { makeup })} className="font-mono text-[12.5px]" />
                    </td>
                    <td className="pr-1">
                      <TimeField label={`${c.role} on set`} variant="inline" value={c.set} none="—" from="04:00" to="22:00" onChange={(time) => setCast(c.id, { set: time })} className="font-mono text-[12.5px]" />
                    </td>
                    <td>
                      <input aria-label={`${c.role} notes`} value={c.note} placeholder="Pickup, wardrobe…" onChange={(e) => setCast(c.id, { note: e.target.value })} className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted-foreground">No cast in today’s scenes. Cast are found from who speaks or is named (@) in each scene.</p>
          )}
        </Card>

        <Card title={`Crew · ${sheet.crew.filter((c) => !c.off).length}`}>
          {sheet.crew.length ? (
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              {departments.map((dept) => (
                <div key={dept} className="flex flex-col">
                  <span className="label pb-1">{dept}</span>
                  {sheet.crew
                    .filter((c) => c.department === dept)
                    .map((c) => (
                      <div key={c.id} className={cn('flex items-center gap-2 border-t py-1 text-[13px]', c.off && 'opacity-50')}>
                        <Checkbox aria-label={`${c.name} needed today`} checked={!c.off} onCheckedChange={(v) => set({ crew: { ...s.crew, [c.id]: { ...s.crew?.[c.id], off: v !== true } } })} />
                        <span className="min-w-0 flex-1 truncate">
                          {c.name}
                          {c.role && <span className="text-muted-foreground"> · {c.role}</span>}
                        </span>
                        <TimeField label={`${c.name} call`} variant="inline" value={c.call} from="04:00" to="22:00" onChange={(call) => set({ crew: { ...s.crew, [c.id]: { ...s.crew?.[c.id], call } } })} className="font-mono text-[12.5px]" />
                      </div>
                    ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No crew yet: add them under Crew.</p>
          )}
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Notes">
            <Textarea aria-label="Notes for the day" rows={4} value={s.notes ?? ''} placeholder="Safety, special equipment, reminders…" onChange={(e) => set({ notes: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
          </Card>
          <Card title="Contacts">
            <Textarea aria-label="Contacts" rows={4} value={s.contacts ?? ''} placeholder={'Producer · phone\n1st AD · phone\nProduction office'} onChange={(e) => set({ contacts: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
          </Card>
        </div>

        {sheet.next && (
          <Card title={`Advance · Day ${sheet.next.index + 1} · ${weekdayShort(sheet.next.day.date)} ${shortDate(sheet.next.day.date)}`}>
            <p className="font-mono text-[12.5px]">{sheet.next.scenes.length ? sheet.next.scenes.map((sc) => `${sc.number} ${sc.heading.place || sc.scene.title}`).join(' · ') : 'No scenes yet.'}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border px-4 py-3">
      <Label>{title}</Label>
      {children}
    </section>
  );
}
