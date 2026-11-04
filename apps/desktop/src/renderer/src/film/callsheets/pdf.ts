import { formatTime, longDate, shortDate, weekdayShort } from '@/lib/dates';
import { usePreferences } from '@/stores/preferences';
import { escapeXml } from '@/film/script/fdx';
import { eighthsLabel } from '@/film/script/layout';
import type { AssembledSheet } from './sheet';

/** Filmmaking → Call Sheets: the call sheet as print-ready HTML for the PDF. */

export function callSheetHtml(production: string, sheet: AssembledSheet): string {
  // In the app's clock (Settings), like everywhere else.
  const clock = usePreferences.getState().clock;
  const t = (time?: string) => (time ? formatTime(time, clock) : '—');
  const e = (s: string) => escapeXml(s).replace(/\n/g, '<br>');
  const s = sheet.sheet;
  const crew = sheet.crew.filter((c) => !c.off);
  const departments = [...new Set(crew.map((c) => c.department))];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Call Sheet</title><style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #111; margin: 0; }
h1 { margin: 0; font-size: 20pt; text-transform: uppercase; }
.top { display: grid; grid-template-columns: 1fr auto; gap: 12pt; border-bottom: 2.5px solid #111; padding-bottom: 8pt; }
.prod { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
.call { text-align: right; }
.call b { display: block; font-size: 26pt; line-height: 1; }
.label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
.times { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin: 8pt 0; }
.box { border: 1px solid #bbb; border-radius: 4pt; padding: 5pt 7pt; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin-bottom: 8pt; }
table { width: 100%; border-collapse: collapse; margin-top: 3pt; }
th { text-align: left; font-weight: normal; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1px solid #111; padding: 2pt 4pt; }
td { border-bottom: 1px solid #ddd; padding: 3pt 4pt; vertical-align: top; }
.mono { font-family: 'Courier New', monospace; }
section { margin-bottom: 9pt; break-inside: avoid; }
.depts { columns: 2; column-gap: 14pt; }
.dept { break-inside: avoid; margin-bottom: 6pt; }
</style></head><body>
<div class="top">
  <div><div class="prod">${e(production)} · Call Sheet · Day ${sheet.index + 1} of ${sheet.of}</div><h1>${e(longDate(sheet.day.date))}</h1></div>
  <div class="call"><span class="label">General Call</span><b>${t(sheet.day.call)}</b></div>
</div>
<div class="times">
  <div class="box"><div class="label">Shooting Call</div>${t(s.shooting)}</div>
  <div class="box"><div class="label">Breakfast</div>${t(s.breakfast)}</div>
  <div class="box"><div class="label">Lunch</div>${t(s.lunch)}</div>
  <div class="box"><div class="label">Est. Wrap</div>${t(s.wrap)}</div>
</div>
<div class="grid2">
  <div class="box"><div class="label">Location</div><b>${e(sheet.location?.name ?? 'To be confirmed')}</b><br>${e(sheet.address)}${sheet.parking || s.parking ? `<br><span class="label">Parking</span> ${e(s.parking ?? sheet.parking)}` : ''}</div>
  <div class="box"><div class="label">Nearest Hospital</div>${e(s.hospital ?? '—')}<br><span class="label">Weather</span> ${e(s.weather ?? '—')} · <span class="label">Sunrise</span> ${e(s.sunrise ?? '—')} · <span class="label">Sunset</span> ${e(s.sunset ?? '—')}</div>
</div>
<section><div class="label">Scenes · ${eighthsLabel(sheet.eighths)} pages</div>
<table><tr><th>Sc</th><th>Set</th><th>D/N</th><th>Pages</th><th>Cast</th><th>Description</th></tr>
${sheet.scenes.map((sc) => `<tr><td class="mono"><b>${e(sc.number)}</b></td><td class="mono">${e(`${sc.heading.ie ? `${sc.heading.ie}. ` : ''}${sc.heading.place || sc.scene.title}`)}</td><td class="mono">${sc.heading.time ? (/night|evening|dusk/i.test(sc.heading.time) ? 'N' : 'D') : ''}</td><td class="mono">${eighthsLabel(sc.eighths)}</td><td class="mono">${sc.cast.map((id) => sheet.cast.find((c) => c.id === id)?.number).join(', ')}</td><td>${e(sc.note)}</td></tr>`).join('')}
</table></section>
<section><div class="label">Cast</div>
<table><tr><th>#</th><th>Role</th><th>Cast</th><th></th><th>Call</th><th>Makeup</th><th>On Set</th><th>Notes</th></tr>
${sheet.cast.map((c) => `<tr><td class="mono">${c.number}</td><td><b>${e(c.role)}</b></td><td>${c.name !== c.role ? e(c.name) : ''}</td><td class="mono">${c.status}</td><td class="mono">${t(c.call)}</td><td class="mono">${t(c.makeup)}</td><td class="mono">${t(c.set)}</td><td>${e(c.note)}</td></tr>`).join('')}
</table></section>
${crew.length ? `<section><div class="label">Crew</div><div class="depts">${departments.map((d) => `<div class="dept"><b>${e(d)}</b><table>${crew.filter((c) => c.department === d).map((c) => `<tr><td>${e(c.name)}${c.role ? ` · ${e(c.role)}` : ''}</td><td class="mono" style="text-align:right">${t(c.call)}</td></tr>`).join('')}</table></div>`).join('')}</div></section>` : ''}
${s.notes ? `<section class="box"><div class="label">Notes</div>${e(s.notes)}</section>` : ''}
${s.contacts ? `<section class="box"><div class="label">Contacts</div>${e(s.contacts)}</section>` : ''}
${sheet.next ? `<section class="box"><div class="label">Advance · Day ${sheet.next.index + 1} · ${e(`${weekdayShort(sheet.next.day.date)} ${shortDate(sheet.next.day.date)}`)}</div><span class="mono">${e(sheet.next.scenes.map((sc) => `${sc.number} ${sc.heading.place || sc.scene.title}`).join(' · ') || 'No scenes yet')}</span></section>` : ''}
</body></html>`;
}
