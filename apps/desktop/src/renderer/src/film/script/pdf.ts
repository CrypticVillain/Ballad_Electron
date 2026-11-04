import { escapeXml } from './fdx';
import type { BuiltScript } from './build';
import type { Line, Page } from './layout';

/**
 * Filmmaking → Script: the script as print-ready HTML, page by page as laid
 * out (layout.ts), for the PDF. Courier 12 (a character is 0.1"), 1.5" left
 * margin; page numbers top right from page 2; scene numbers both sides when
 * asked; in a revision round, an asterisk beside each changed line and the
 * round's color and date at the top of each changed page.
 */

export type PdfOptions = {
  titlePage: boolean;
  sceneNumbers: boolean;
  /** Only the pages with changes in the current round (revised pages to hand out). */
  onlyChanged: boolean;
  /** Changed pages on the round's color, as if printed on colored paper. */
  tint: boolean;
  pageSize: 'Letter' | 'A4';
  /** Day key the revision pages are dated (default today). */
  date: string;
};

const SIZE = { Letter: { w: 8.5, h: 11 }, A4: { w: 8.27, h: 11.69 } };

const shortDate = (key: string) => {
  const [y, m, d] = key.split('-');
  return y && m && d ? `${m}/${d}/${y.slice(2)}` : key;
};

function lineHtml(line: Line, extra = '') {
  const star = line.changed ? '<span class="star">*</span>' : '';
  return `<div class="l ${line.kind}" style="padding-left:${line.indent}ch">${escapeXml(line.text) || '&nbsp;'}${extra}${star}</div>`;
}

function pageHtml(page: Page, script: BuiltScript, options: PdfOptions) {
  const round = script.round;
  const revised = Boolean(round && page.changed);
  const head = [
    revised ? `<span class="rev">${escapeXml(`${round!.name} Rev. ${shortDate(options.date)}`)}</span>` : '',
    page.number > 1 ? `<span>${page.number}.</span>` : '',
  ].join('');
  const body = page.items
    .map((item) => {
      if (item.kind === 'blank') return '<div class="l">&nbsp;</div>';
      if (item.kind === 'dual') {
        const rows = Math.max(item.left.length, item.right.length);
        return `<div class="dual" style="height:${rows * 12}pt"><div class="side">${item.left.map((l) => lineHtml(l)).join('')}</div><div class="side right">${item.right.map((l) => lineHtml(l)).join('')}</div></div>`;
      }
      const numbers = options.sceneNumbers && item.scene ? `<span class="num left">${escapeXml(item.scene)}</span><span class="num right">${escapeXml(item.scene)}</span>` : '';
      return lineHtml(item.line, numbers);
    })
    .join('');
  const tint = revised && options.tint ? ` style="background:${round!.tint}"` : '';
  return `<section class="page"${tint}><header>${head}</header><div class="body">${body}</div></section>`;
}

function titleHtml(script: BuiltScript) {
  const tp = script.titlePage;
  const lines = (s: string) => escapeXml(s).replace(/\n/g, '<br>');
  return `<section class="page title-page">
  <div class="tp-center">
    <div class="tp-title">${lines((tp.title || script.title).toUpperCase())}</div>
    ${tp.credit ? `<div class="tp-gap">${lines(tp.credit)}</div>` : ''}
    ${tp.authors ? `<div class="tp-gap">${lines(tp.authors)}</div>` : ''}
    ${tp.source ? `<div class="tp-gap">${lines(tp.source)}</div>` : ''}
  </div>
  ${tp.contact ? `<div class="tp-contact">${lines(tp.contact)}</div>` : ''}
  ${tp.draft || tp.date ? `<div class="tp-draft">${lines([tp.draft, tp.date ? shortDate(tp.date) : ''].filter(Boolean).join('\n'))}</div>` : ''}
</section>`;
}

export function scriptHtml(script: BuiltScript, options: PdfOptions): string {
  const { w, h } = SIZE[options.pageSize];
  const pages = options.onlyChanged && script.round ? script.layout.pages.filter((p) => p.changed) : script.layout.pages;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(script.title)}</title><style>
@page { size: ${w}in ${h}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Courier Prime', 'Courier New', Courier, monospace; font-size: 12pt; line-height: 12pt; color: #000; }
.page { position: relative; width: ${w}in; height: ${h}in; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
header { position: absolute; top: 0.5in; left: 1.5in; width: 6in; text-align: right; }
header .rev { margin-right: 2ch; }
.body { position: absolute; top: 1in; left: 1.5in; width: 6in; }
.l { position: relative; height: 12pt; white-space: pre; }
.sceneHeading { font-weight: normal; }
.num { position: absolute; top: 0; }
.num.left { left: -0.85in; }
.num.right { left: 6.3in; }
.star { position: absolute; top: 0; left: 6.6in; }
.dual { position: relative; }
.dual .side { position: absolute; top: 0; left: 0; width: 29ch; }
.dual .side.right { left: 31ch; }
.dual .star { left: auto; right: -1ch; }
.title-page .tp-center { position: absolute; top: 3.3in; left: 1.5in; width: 6in; text-align: center; }
.tp-gap { margin-top: 24pt; }
.tp-contact { position: absolute; bottom: 1in; left: 1.5in; width: 3.5in; }
.tp-draft { position: absolute; bottom: 1in; right: 1in; text-align: right; }
</style></head><body>
${options.titlePage ? titleHtml(script) : ''}
${pages.map((p) => pageHtml(p, script, options)).join('\n')}
</body></html>`;
}
