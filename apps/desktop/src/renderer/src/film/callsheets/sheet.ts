import type { Entry, ShootDay } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { roleOf } from '@/film/script/cast';
import type { ProductionScene, ProductionScript } from '@/film/script/hooks';
import { dayOutOfDays, type DoodCell } from '@/film/stripboard/strips';
import type { CallSheet } from './model';

/**
 * Filmmaking → Call Sheets: a shoot day's call sheet put together from the
 * day, its scenes, the cast in them, the crew and the location, with the
 * sheet's own times and notes over the top.
 */

const spec = (entry: Entry | undefined, label: string) => entry?.specs.find((s) => s.label.toLowerCase() === label.toLowerCase())?.value.trim() ?? '';

export type SheetCast = { id: string; number: number; role: string; name: string; status: DoodCell; call: string; makeup: string; set: string; note: string };
export type SheetCrew = { id: string; name: string; role: string; department: string; call: string; off: boolean };

export type AssembledSheet = {
  day: ShootDay;
  index: number;
  of: number;
  location: Entry | undefined;
  address: string;
  parking: string;
  scenes: (ProductionScene & { note: string })[];
  eighths: number;
  cast: SheetCast[];
  crew: SheetCrew[];
  /** The next shoot day after this one, for the advance schedule. */
  next: { day: ShootDay; index: number; scenes: ProductionScene[] } | null;
  sheet: CallSheet;
};

export function assembleSheet(day: ShootDay, days: ShootDay[], script: ProductionScript, entries: Entry[]): AssembledSheet {
  const sheet = day.sheet ?? {};
  const index = days.findIndex((d) => d.id === day.id);
  const location = entries.find((e) => e.id === day.placeId);
  const scenes = day.sceneIds.map((id) => script.byId.get(id)).filter((s) => s !== undefined);
  const dood = dayOutOfDays(days, (id) => script.byId.get(id)?.cast ?? [], script.cast.map((c) => c.id));
  const today = new Set(scenes.flatMap((s) => s.cast));
  const cast: SheetCast[] = script.cast
    .filter((c) => today.has(c.id))
    .map((c) => {
      const own = sheet.cast?.[c.id] ?? {};
      return {
        id: c.id,
        number: script.castNumber.get(c.id) ?? 0,
        role: roleOf(c),
        name: c.name,
        status: dood.find((r) => r.castId === c.id)?.cells[index] ?? 'W',
        call: own.call ?? day.call,
        makeup: own.makeup ?? '',
        set: own.set ?? '',
        note: own.note ?? '',
      };
    })
    .sort((a, b) => a.number - b.number);
  const crew: SheetCrew[] = entries
    .filter((e) => e.kind === 'crew')
    .map((e) => ({ id: e.id, name: e.name, role: spec(e, 'Role') || e.tagline, department: e.group || 'Production', call: sheet.crew?.[e.id]?.call ?? day.call, off: Boolean(sheet.crew?.[e.id]?.off) }))
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  const after = days[index + 1];
  return {
    day,
    index,
    of: days.length,
    location,
    address: spec(location, 'Address'),
    parking: sheet.parking ?? spec(location, 'Power & Parking'),
    scenes: scenes.map((s) => ({ ...s, note: sheet.sceneNotes?.[s.scene.id] ?? s.scene.note })),
    eighths: scenes.reduce((n, s) => n + s.eighths, 0),
    cast,
    crew,
    next: after ? { day: after, index: index + 1, scenes: after.sceneIds.map((id) => script.byId.get(id)).filter((s) => s !== undefined) } : null,
    sheet,
  };
}

/** Changes a day's call sheet. */
export function updateSheet(dayId: string, changes: Partial<CallSheet>) {
  const store = useVault.getState();
  const day = store.vault.shootDays[dayId];
  if (day) store.patch('shootDays', dayId, { sheet: { ...day.sheet, ...changes } });
}
