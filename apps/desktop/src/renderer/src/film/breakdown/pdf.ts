import { escapeXml } from '@/film/script/fdx';
import { roleOf } from '@/film/script/cast';
import type { ProductionScript } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import { BREAKDOWN_CATEGORIES, type BreakdownItem } from './model';

/** Filmmaking → Breakdown: a breakdown sheet per scene, as print-ready HTML for the PDF. */

export function breakdownHtml(production: string, script: ProductionScript, items: BreakdownItem[]): string {
  const sheets = script.scenes.map((s) => {
    const mine = items.filter((i) => i.sceneIds.includes(s.scene.id));
    const cast = s.cast.map((id) => script.cast.find((c) => c.id === id)).filter((c) => c !== undefined);
    const boxes = [
      `<div class="box" style="border-top-color:#dc2626"><h3>Cast</h3>${cast.map((c) => `<div>${script.castNumber.get(c.id)}. ${escapeXml(roleOf(c).toUpperCase())}${roleOf(c) !== c.name ? ` <span class="muted">(${escapeXml(c.name)})</span>` : ''}</div>`).join('') || '<div class="muted">None</div>'}${s.unmatched.map((n) => `<div>${escapeXml(n)} <span class="muted">(not cast)</span></div>`).join('')}</div>`,
      ...BREAKDOWN_CATEGORIES.filter((c) => mine.some((i) => i.category === c.id)).map(
        (c) =>
          `<div class="box" style="border-top-color:${c.hex}"><h3>${escapeXml(c.label)}</h3>${mine
            .filter((i) => i.category === c.id)
            .map((i) => `<div>${i.qty > 1 ? `${i.qty} × ` : ''}${escapeXml(i.name)}${i.notes ? ` <span class="muted">— ${escapeXml(i.notes)}</span>` : ''}</div>`)
            .join('')}</div>`,
      ),
    ];
    return `<section class="sheet">
  <header>
    <div class="prod">${escapeXml(production)} · Breakdown Sheet</div>
    <div class="row"><span class="num">Scene ${escapeXml(s.number)}</span><span>${escapeXml([s.heading.ie, s.heading.time].filter(Boolean).join(' · '))}</span><span>${eighthsLabel(s.eighths)} pg</span></div>
    <h1>${escapeXml(s.heading.place || s.scene.title || 'Untitled Scene')}</h1>
    ${s.scene.note ? `<p class="muted">${escapeXml(s.scene.note)}</p>` : ''}
  </header>
  <div class="grid">${boxes.join('')}</div>
</section>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Breakdown</title><style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #111; margin: 0; }
.sheet { page-break-after: always; break-after: page; }
.sheet:last-child { page-break-after: auto; }
header { border-bottom: 2px solid #111; padding-bottom: 8pt; margin-bottom: 12pt; }
.prod { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
.row { display: flex; gap: 14pt; margin-top: 6pt; font-family: 'Courier New', monospace; font-size: 10pt; }
.num { font-weight: 700; }
h1 { margin: 4pt 0 0; font-size: 18pt; text-transform: uppercase; }
.muted { color: #666; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
.box { border: 1px solid #ccc; border-top: 4px solid #999; border-radius: 4pt; padding: 6pt 8pt; break-inside: avoid; }
.box h3 { margin: 0 0 4pt; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
.box div { padding: 1pt 0; }
</style></head><body>${sheets.join('\n')}</body></html>`;
}
