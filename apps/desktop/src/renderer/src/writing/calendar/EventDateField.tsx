import { SelectField } from '@/components/shared/SelectField';
import { Input } from '@/components/ui/input';
import { updateEvent } from '@/lib/actions';
import type { TimelineEvent } from '@/lib/model';
import { clampDate, formatDate } from './calendar';
import type { WorldCalendar } from './model';

/**
 * A timeline event's day in the world's calendar (Writing): the month and the
 * day, within its year. Picking one writes the date into the event's When.
 */
export function EventDateField({ event, calendar }: { event: TimelineEvent; calendar: WorldCalendar }) {
  const set = (month: number | null, day: number) => {
    if (!month) {
      updateEvent(event.id, { month: undefined, day: undefined });
      return;
    }
    const date = clampDate(calendar, { year: event.year, month, day });
    updateEvent(event.id, { month: date.month, day: date.day, when: formatDate(calendar, date) });
  };
  return (
    <span className="flex gap-1.5">
      <SelectField
        label="Month"
        value={event.month ?? null}
        onChange={(month) => set(month, event.day ?? 1)}
        options={[{ value: null as number | null, label: 'No day' }, ...calendar.months.map((m, i) => ({ value: (i + 1) as number | null, label: m.name || `Month ${i + 1}` }))]}
        className="min-w-0 flex-1"
      />
      <Input
        type="number"
        aria-label="Day"
        disabled={!event.month}
        min={1}
        max={event.month ? calendar.months[event.month - 1]?.days : undefined}
        value={event.day ?? ''}
        onChange={(e) => event.month && set(event.month, Number(e.target.value) || 1)}
        className="h-9 w-16"
      />
    </span>
  );
}
