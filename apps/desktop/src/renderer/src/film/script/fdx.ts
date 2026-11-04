import { emptyTitlePage, type ElementType, type ScriptElement, type TitlePage } from './model';

/**
 * Filmmaking → Script: Final Draft's .fdx (XML), written and read (pure).
 * Paragraphs carry a Type (Scene Heading, Action, Character, Parenthetical,
 * Dialogue, Transition), scene headings their Number, and dual dialogue sits
 * inside a <DualDialogue>. Read without a DOM so it works anywhere.
 */

const TYPE_NAME: Record<ElementType, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
};

const NAME_TYPE: Record<string, ElementType> = {
  'scene heading': 'sceneHeading',
  action: 'action',
  general: 'action',
  shot: 'action',
  'cast list': 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  lyrics: 'dialogue',
  transition: 'transition',
};

export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const para = (type: string, text: string, attrs = '') => `    <Paragraph Type="${type}"${attrs}>\n      <Text>${escapeXml(text)}</Text>\n    </Paragraph>`;
const centered = (text: string) => `      <Paragraph Alignment="Center" Type="Action">\n        <Text>${escapeXml(text)}</Text>\n      </Paragraph>`;
const left = (text: string) => `      <Paragraph Alignment="Left" Type="Action">\n        <Text>${escapeXml(text)}</Text>\n      </Paragraph>`;

/** One script as a Final Draft document. */
export function toFdx(script: { title: string; titlePage: TitlePage; scenes: { number?: string; elements: ScriptElement[] }[] }): string {
  const body: string[] = [];
  for (const scene of script.scenes) {
    let numbered = false;
    const els = scene.elements;
    for (let i = 0; i < els.length; i++) {
      const e = els[i]!;
      if (e.type === 'sceneHeading') {
        body.push(para(TYPE_NAME.sceneHeading, e.text.toUpperCase(), scene.number && !numbered ? ` Number="${escapeXml(scene.number)}"` : ''));
        numbered = true;
        continue;
      }
      if (e.type === 'character') {
        // A speech; if the next speech is its dual partner, both go in a <DualDialogue>.
        const speech = (k: number) => {
          const out = [para('Character', els[k]!.text.toUpperCase())];
          let j = k + 1;
          while (els[j] && (els[j]!.type === 'dialogue' || els[j]!.type === 'parenthetical')) {
            out.push(para(TYPE_NAME[els[j]!.type], els[j]!.text));
            j++;
          }
          return { out, end: j };
        };
        const first = speech(i);
        if (els[first.end]?.type === 'character' && els[first.end]!.dual) {
          const second = speech(first.end);
          body.push(`    <Paragraph>\n      <DualDialogue>\n${[...first.out, ...second.out].map((p) => p.replace(/^ {4}/gm, '        ')).join('\n')}\n      </DualDialogue>\n    </Paragraph>`);
          i = second.end - 1;
        } else {
          body.push(...first.out);
          i = first.end - 1;
        }
        continue;
      }
      body.push(para(TYPE_NAME[e.type], e.type === 'transition' ? e.text.toUpperCase() : e.text));
    }
  }
  const tp = script.titlePage;
  const title: string[] = [];
  for (let k = 0; k < 16; k++) title.push(centered(''));
  title.push(centered((tp.title || script.title).toUpperCase()), centered(''), centered(tp.credit || 'Written by'), centered(''), centered(tp.authors));
  if (tp.source) title.push(centered(''), centered(tp.source));
  for (let k = 0; k < 12; k++) title.push(centered(''));
  for (const line of tp.contact.split('\n').filter(Boolean)) title.push(left(line));
  if (tp.draft || tp.date) title.push(left([tp.draft, tp.date].filter(Boolean).join(' · ')));
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="5">',
    '  <Content>',
    ...body,
    '  </Content>',
    '  <TitlePage>',
    '    <Content>',
    ...title,
    '    </Content>',
    '  </TitlePage>',
    '</FinalDraft>',
    '',
  ].join('\n');
}

/** The text of a paragraph's <Text> runs. */
const textOf = (inner: string) =>
  decodeXml(
    [...inner.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>|<Text\b[^>]*\/>/g)]
      .map((m) => m[1] ?? '')
      .join('')
      .replace(/<[^>]+>/g, ''),
  );

/** A Final Draft document as its scenes (a new one at each scene heading) and a title page. */
export function fromFdx(xml: string): { titlePage: TitlePage; scenes: { number?: string; elements: ScriptElement[] }[] } {
  const titlePage = emptyTitlePage();
  const titleXml = xml.match(/<TitlePage\b[\s\S]*?<\/TitlePage>/)?.[0] ?? '';
  const bodyXml = xml.replace(/<TitlePage\b[\s\S]*?<\/TitlePage>/, '').match(/<Content\b[^>]*>([\s\S]*)<\/Content>/)?.[1] ?? '';

  // The title page: the first line is the title; a "by" line is the credit, the next line the authors; left-aligned lines at the end are the contact.
  const titleLines = [...titleXml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)].map((m) => ({ left: /Alignment="Left"/.test(m[1]!), text: textOf(m[2]!).trim() })).filter((l) => l.text);
  const center = titleLines.filter((l) => !l.left);
  if (center[0]) titlePage.title = center[0].text;
  const by = center.findIndex((l) => /\bby\b/i.test(l.text));
  if (by > 0) {
    titlePage.credit = center[by]!.text;
    titlePage.authors = center[by + 1]?.text ?? '';
    titlePage.source = center.slice(by + 2).map((l) => l.text).join('\n');
  }
  titlePage.contact = titleLines.filter((l) => l.left).map((l) => l.text).join('\n');

  // Dual dialogue's spans, to know which cues are the second half.
  const duals = [...bodyXml.matchAll(/<DualDialogue\b[^>]*>[\s\S]*?<\/DualDialogue>/g)].map((m) => [m.index!, m.index! + m[0].length] as const);
  const scenes: { number?: string; elements: ScriptElement[] }[] = [];
  const cuesIn = new Map<number, number>();
  for (const m of bodyXml.matchAll(/<Paragraph\b([^>]*\bType="([^"]*)"[^>]*)>([\s\S]*?)<\/Paragraph>/g)) {
    const type = NAME_TYPE[m[2]!.toLowerCase()] ?? 'action';
    const text = textOf(m[3]!).replace(/\s+$/, '');
    if (!text.trim()) continue;
    if (type === 'sceneHeading') {
      const number = m[1]!.match(/\bNumber="([^"]*)"/)?.[1];
      scenes.push({ ...(number ? { number: decodeXml(number) } : {}), elements: [{ type, text: text.trim().toUpperCase() }] });
      continue;
    }
    if (!scenes.length) scenes.push({ elements: [] });
    const element: ScriptElement = { type, text };
    if (type === 'character') {
      const span = duals.findIndex(([a, b]) => m.index! >= a && m.index! < b);
      if (span >= 0) {
        const seen = (cuesIn.get(span) ?? 0) + 1;
        cuesIn.set(span, seen);
        if (seen > 1) element.dual = true;
      }
    }
    scenes.at(-1)!.elements.push(element);
  }
  return { titlePage, scenes };
}
