import { DownloadIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Empty, Label } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { FilmOnly, PILL } from '@/film/common';
import { useProductionScript } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import { scriptReport, toCsv, type SplitRow } from './reports';

/**
 * /film/reports — the production's scripts counted: each character's
 * speeches, words and scenes; each set's scenes and pages; interior and
 * exterior, day and night. For casting, scouting and the schedule.
 */
export function ReportsScreen() {
  return <FilmOnly>{(world) => <Reports world={world} />}</FilmOnly>;
}

function Reports({ world }: { world: World }) {
  const script = useProductionScript();
  const report = useMemo(() => scriptReport(script.scenes.map((s) => ({ id: s.scene.id, number: s.number, eighths: s.eighths, heading: s.heading, elements: s.elements }))), [script]);
  const maxSpeeches = Math.max(1, ...report.characters.map((c) => c.speeches));
  const maxEighths = Math.max(1, ...report.locations.map((l) => l.eighths));
  const save = async (name: string, header: string[], rows: (string | number)[][]) => {
    const path = await window.api.files.saveText({ defaultName: `${world.name || 'Production'} ${name}.csv`, text: toCsv(header, rows), filter: { name: 'CSV', extensions: ['csv'] } });
    if (path) toast(`${name} Saved`, { description: path });
  };
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Reports', world.name]} />
      {!script.scenes.length ? (
        <div className="flex flex-1 items-center justify-center">
          <Empty title="No Script Yet">Write the script, and its characters, sets and scenes are counted here.</Empty>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          <div className="flex max-w-[1080px] flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Scenes" value={report.totals.scenes} />
              <Stat label="Pages" value={eighthsLabel(report.totals.eighths)} />
              <Stat label="Speaking Roles" value={report.characters.length} />
              <Stat label="Sets" value={report.locations.length} />
              <Stat label="Words Spoken" value={report.totals.dialogueWords.toLocaleString('en-US')} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Split title="Interior / Exterior" rows={report.interior} total={report.totals.eighths} />
              <Split title="Day / Night" rows={report.time} total={report.totals.eighths} />
            </div>
            <Section
              title="Characters"
              note="Most speeches first. Pages: the scenes they speak in, by the eighths."
              action={() => void save('Characters', ['Character', 'Speeches', 'Words', 'Scenes', 'Pages', 'First Scene'], report.characters.map((c) => [c.name, c.speeches, c.words, c.scenes, eighthsLabel(c.eighths), c.first]))}
            >
              <Table head={['Character', '', 'Speeches', 'Words', 'Scenes', 'Pages', 'First']} right={[2, 3, 4, 5, 6]}>
                {report.characters.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-[12.5px] uppercase">{c.name}</td>
                    <td className="w-[28%] pr-3">
                      <div className="h-1.5 rounded-full bg-primary/80" style={{ width: `${(c.speeches / maxSpeeches) * 100}%` }} />
                    </td>
                    <Num>{c.speeches}</Num>
                    <Num>{c.words.toLocaleString('en-US')}</Num>
                    <Num>{c.scenes}</Num>
                    <Num>{eighthsLabel(c.eighths)}</Num>
                    <Num>{c.first}</Num>
                  </tr>
                ))}
              </Table>
            </Section>
            <Section
              title="Sets"
              note="The places the scene headings name, most pages first."
              action={() => void save('Sets', ['Set', 'Scenes', 'Pages', 'Int/Ext', 'Times', 'Scene Numbers'], report.locations.map((l) => [l.place, l.scenes, eighthsLabel(l.eighths), l.ie.join(' '), l.times.join(' '), l.numbers.join(' ')]))}
            >
              <Table head={['Set', '', 'Scenes', 'Pages', 'Int / Ext', 'Times']} right={[2, 3]}>
                {report.locations.map((l) => (
                  <tr key={l.place} className="border-t">
                    <td className="py-1.5 pr-3 font-mono text-[12.5px] uppercase">{l.place}</td>
                    <td className="w-[24%] pr-3">
                      <div className="h-1.5 rounded-full bg-amber-500/80" style={{ width: `${(l.eighths / maxEighths) * 100}%` }} />
                    </td>
                    <Num>{l.scenes}</Num>
                    <Num>{eighthsLabel(l.eighths)}</Num>
                    <td className="pl-3 font-mono text-[11.5px] text-muted-foreground">{l.ie.join(' ')}</td>
                    <td className="pl-3 font-mono text-[11.5px] text-muted-foreground">{l.times.join(', ')}</td>
                  </tr>
                ))}
              </Table>
            </Section>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border px-4 py-3">
      <Label>{label}</Label>
      <span className="font-display text-[26px] leading-none font-black">{value}</span>
    </div>
  );
}

function Split({ title, rows, total }: { title: string; rows: SplitRow[]; total: number }) {
  const tones = ['bg-primary', 'bg-sky-500', 'bg-violet-500', 'bg-muted-foreground/40'];
  return (
    <section className="flex flex-col gap-2 rounded-2xl border px-4 py-3">
      <Label>{title}</Label>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {rows.map((r, i) => (
          <div key={r.label} className={tones[i % tones.length]} style={{ width: `${(r.eighths / Math.max(1, total)) * 100}%` }} title={r.label} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {rows.map((r, i) => (
          <span key={r.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', tones[i % tones.length])} />
            {r.label}
            <span className="font-mono text-[11px] text-muted-foreground">
              {r.scenes} sc · {eighthsLabel(r.eighths)} pg
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Section({ title, note, action, children }: { title: string; note: string; action: () => void; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col">
          <Label>{title}</Label>
          <span className="text-[12.5px] text-muted-foreground">{note}</span>
        </div>
        <Button variant="outline" size="sm" className={PILL} onClick={action}>
          <DownloadIcon /> CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border px-4 py-2">{children}</div>
    </section>
  );
}

function Table({ head, right, children }: { head: string[]; right: number[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-left">
          {head.map((h, i) => (
            <th key={i} className={cn('label pb-1.5 font-normal', right.includes(i) ? 'pl-3 text-right' : 'pl-3 first:pl-0')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const Num = ({ children }: { children: ReactNode }) => <td className="pl-3 text-right font-mono text-[12px] tabular-nums">{children}</td>;
