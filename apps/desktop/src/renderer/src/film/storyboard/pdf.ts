import { mediaSrc } from '@/components/shared/Portrait';
import type { Shot } from '@/lib/model';
import { escapeXml } from '@/film/script/fdx';
import type { BoardScene } from './StoryboardView';

/** Filmmaking → Storyboard: the boards as print-ready HTML (landscape, six frames a page) for the PDF. */

export function storyboardHtml(production: string, scenes: BoardScene[], shots: Shot[]): string {
  const panels = scenes.flatMap((scene) =>
    shots
      .filter((s) => s.sceneId === scene.id && s.status !== 'cut')
      .sort((a, b) => a.order - b.order)
      .map((shot, i) => ({ scene, shot, label: `${scene.number}.${i + 1}` })),
  );
  const pages: (typeof panels)[] = [];
  for (let i = 0; i < panels.length; i += 6) pages.push(panels.slice(i, i + 6));
  const panel = ({ scene, shot, label }: (typeof panels)[number]) => `<div class="panel">
  <div class="frame">${shot.frame ? `<img src="${escapeXml(mediaSrc(shot.frame))}">` : ''}</div>
  <div class="meta"><b>${escapeXml(label)}</b> ${escapeXml([shot.size, shot.move, shot.lens].filter(Boolean).join(' · '))}<span class="scene">${escapeXml(scene.title)}</span></div>
  <div class="desc">${escapeXml(shot.description)}</div>
</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Storyboard</title><style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #111; margin: 0; }
.page { page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; }
.head { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 8pt; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12pt 14pt; }
.frame { aspect-ratio: 16 / 9; border: 1.5px solid #111; overflow: hidden; background: #fff; }
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.meta { margin-top: 4pt; font-family: 'Courier New', monospace; font-size: 9pt; }
.scene { float: right; color: #666; font-family: 'Helvetica Neue', Arial, sans-serif; }
.desc { margin-top: 2pt; min-height: 24pt; }
</style></head><body>
${pages.map((p, i) => `<section class="page"><div class="head">${escapeXml(production)} · Storyboard · ${i + 1} / ${pages.length}</div><div class="grid">${p.map(panel).join('')}</div></section>`).join('\n')}
</body></html>`;
}
