import { DownloadIcon } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { Button } from '@/components/ui/button';
import { shortDate } from '@/lib/dates';
import type { ShootDay, World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { PILL } from '@/film/common';
import { toCsv } from '@/film/reports/reports';
import { roleOf } from '@/film/script/cast';
import type { ProductionScript } from '@/film/script/hooks';
import { dayOutOfDays, type DoodCell } from './strips';

/**
 * Filmmaking → Day Out Of Days: which shoot days each cast member works
 * (start, work, finish) or is held between, with their totals. What a cast
 * member's deal is made from.
 */

const CELL: Record<Exclude<DoodCell, ''>, string> = {
  SW: 'bg-primary text-primary-foreground',
  W: 'bg-primary/20',
  WF: 'bg-primary text-primary-foreground',
  SWF: 'bg-primary text-primary-foreground',
  H: 'bg-muted text-muted-foreground',
};

export function DayOutOfDays({ world, days, script }: { world: World; days: ShootDay[]; script: ProductionScript }) {
  const rows = useMemo(
    () =>
      dayOutOfDays(
        days,
        (id) => script.byId.get(id)?.cast ?? [],
        [...script.castNumber.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id),
      ),
    [days, script],
  );
  if (!days.length || !rows.length) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Empty title="Nothing To Count Yet">Schedule scenes on shoot days, and each cast member’s working days show here.</Empty>
      </div>
    );
  }
  const name = (id: string) => script.cast.find((c) => c.id === id);
  const save = async () => {
    const header = ['#', 'Role', 'Cast', ...days.map((d, i) => `Day ${i + 1} (${d.date})`), 'Work', 'Hold', 'Total', 'Start', 'Finish'];
    const body = rows.map((r) => {
      const c = name(r.castId);
      return [script.castNumber.get(r.castId) ?? '', c ? roleOf(c) : '', c?.name ?? '', ...r.cells, r.work, r.hold, r.work + r.hold, days[r.start]!.date, days[r.finish]!.date];
    });
    const path = await window.api.files.saveText({ defaultName: `${world.name || 'Production'} Day Out Of Days.csv`, text: toCsv(header, body), filter: { name: 'CSV', extensions: ['csv'] } });
    if (path) toast('Day Out Of Days Saved', { description: path });
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto px-7 pt-5 pb-10">
      <div className="mb-3 flex items-center gap-3 text-[12px] text-muted-foreground">
        <span>
          <b className="font-mono">SW</b> starts work · <b className="font-mono">W</b> works · <b className="font-mono">WF</b> finishes · <b className="font-mono">SWF</b> one day only · <b className="font-mono">H</b> on hold between
        </span>
        <Button variant="outline" size="sm" className={cn(PILL, 'ml-auto')} onClick={() => void save()}>
          <DownloadIcon /> CSV
        </Button>
      </div>
      <table className="border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="label sticky left-0 bg-background pr-3 pb-2 text-left font-normal">Cast</th>
            {days.map((d, i) => (
              <th key={d.id} className="px-0.5 pb-2 text-center font-normal">
                <div className="font-mono text-[10.5px] text-link">{i + 1}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{shortDate(d.date)}</div>
              </th>
            ))}
            {['Work', 'Hold', 'Total', 'Start', 'Finish'].map((h) => (
              <th key={h} className="label px-2 pb-2 text-right font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = name(r.castId);
            return (
              <tr key={r.castId} className="border-t">
                <td className="sticky left-0 bg-background py-1.5 pr-3">
                  <span className="mr-2 font-mono text-[11px] text-muted-foreground">{script.castNumber.get(r.castId)}</span>
                  <span className="font-medium">{c ? roleOf(c) : ''}</span>
                  {c && roleOf(c) !== c.name && <span className="ml-1.5 text-muted-foreground">{c.name}</span>}
                </td>
                {r.cells.map((cell, i) => (
                  <td key={i} className="px-0.5 py-1">
                    <span className={cn('flex h-6 min-w-9 items-center justify-center rounded font-mono text-[10.5px]', cell && CELL[cell])}>{cell}</span>
                  </td>
                ))}
                <td className="px-2 text-right font-mono tabular-nums">{r.work}</td>
                <td className="px-2 text-right font-mono tabular-nums">{r.hold}</td>
                <td className="px-2 text-right font-mono font-bold tabular-nums">{r.work + r.hold}</td>
                <td className="px-2 text-right font-mono text-[11px] text-muted-foreground">{shortDate(days[r.start]!.date)}</td>
                <td className="px-2 text-right font-mono text-[11px] text-muted-foreground">{shortDate(days[r.finish]!.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
