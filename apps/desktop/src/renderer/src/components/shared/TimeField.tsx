import { useMemo } from 'react';
import { SelectField } from '@/components/shared/SelectField';
import { formatTime, timeFromMinutes } from '@/lib/dates';
import { usePreferences } from '@/stores/preferences';

/** Formats an "HH:mm" time the way Settings → Appearance → Clock says ("7:00 PM" or "19:00"). */
export function useFormatTime(): (time: string) => string {
  const clock = usePreferences((s) => s.clock);
  return (time: string) => formatTime(time, clock);
}

/**
 * TimeField — picks a time ("HH:mm") in quarter hours, shown in the app's
 * clock (12- or 24-hour, from Settings), not the system's: the browser's own
 * time box ignores the app's setting. A time off the quarters stays listed.
 * Times from `from` to `to` ("HH:mm") every `step` minutes; every quarter of the day by default.
 */
export function TimeField({
  value,
  onChange,
  label,
  from = '00:00',
  to = '23:45',
  step = 15,
  className,
  variant = 'chip',
  none,
}: {
  value: string;
  onChange: (time: string) => void;
  label: string;
  from?: string;
  to?: string;
  step?: number;
  className?: string;
  variant?: 'field' | 'inline' | 'chip';
  /** Offers no time at all ('') first, called this ("No set time"). */
  none?: string;
}) {
  const format = useFormatTime();
  const options = useMemo(() => {
    const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const times: string[] = [];
    for (let m = minutes(from); m <= minutes(to); m += step) times.push(timeFromMinutes(m));
    if (/^\d{2}:\d{2}$/.test(value) && !times.includes(value)) times.push(value);
    return times.sort();
  }, [from, to, step, value]);
  return <SelectField label={label} variant={variant} value={value} onChange={onChange} options={[...(none !== undefined ? [{ value: '', label: none }] : []), ...options.map((t) => ({ value: t, label: format(t) }))]} className={className} />;
}
