import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * RulesText — a spell's or item's text as the SRD writes it: paragraphs,
 * ***Run-in headings.*** and **bold**, *italics*, "## Headings", bullet lists
 * ("- " or "* ") and tables (runs of "| a | b |" lines, the "|---|" one dropped).
 */
export function RulesText({ text, className }: { text: string; className?: string }) {
  const blocks: ({ kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'table'; rows: string[][] } | { kind: 'list'; items: string[] })[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|?$/.test(line)) continue;
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const last = blocks.at(-1);
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells] });
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: 'h', text: line.replace(/^#+\s*/, '') });
    } else if (/^[-*]\s/.test(line)) {
      const last = blocks.at(-1);
      const item = line.replace(/^[-*]\s+/, '');
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return (
    <div className={cn('flex flex-col gap-2.5 text-[14px] leading-relaxed', className)} data-selectable>
      {blocks.map((block, i) =>
        block.kind === 'p' ? (
          <p key={i}>{inline(block.text)}</p>
        ) : block.kind === 'h' ? (
          <h3 key={i} className="pt-1 text-[15px] font-semibold">
            {inline(block.text)}
          </h3>
        ) : block.kind === 'list' ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <div key={i} className="overflow-x-auto rounded-lg border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/50">
                  {block.rows[0]!.map((cell, j) => (
                    <th key={j} className="px-2.5 py-1.5 text-left font-semibold">
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.slice(1).map((row, r) => (
                  <tr key={r} className="border-t">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2.5 py-1.5 align-top">
                        {inline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}

/** ***x*** bold italic, **x** bold, *x* and _x_ italic. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\b_[^_\s][^_]*_\b)/g);
  return parts.map((part, i) => {
    if (part.startsWith('***')) return <strong key={i} className="font-semibold italic">{part.slice(3, -3)}</strong>;
    if (part.startsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
