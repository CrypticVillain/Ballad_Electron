import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Empty } from '@/components/shared/bits';
import { Portrait } from '@/components/shared/Portrait';
import type { Entry, Relationship } from '@/lib/model';
import { cn } from '@/lib/utils';
import { familyOf } from './family';

/**
 * Writing → Relationships, the family tree: characters in generations,
 * worked out from their relationships' labels (writing/relationships/family).
 * Spouses side by side on a double line; children hang from a bar under
 * their parents; siblings with no parents on record share a bracket.
 */

const NODE = 150;
const GAP = 36;
const ROW = 184;
const TOP = 70;
const AVATAR = 24;
/** Below a person's name and one-line tagline: where the line down to their children starts. */
const UNDER = 72;

export function FamilyTree({ characters, relationships, selected, onSelect }: { characters: Entry[]; relationships: Relationship[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const navigate = useNavigate();
  const ids = useMemo(() => characters.map((c) => c.id), [characters]);
  const family = useMemo(() => familyOf(relationships.map((r) => ({ from: r.fromId, to: r.toId, label: r.label })), ids), [relationships, ids]);
  const byId = new Map(characters.map((c) => [c.id, c]));
  const widest = Math.max(1, ...family.rows.map((r) => r.length));
  const width = widest * NODE + (widest - 1) * GAP + 80;
  const height = TOP + family.rows.length * ROW;

  /** Where each person sits: rows centered on the widest. */
  const at = new Map<string, { x: number; y: number }>();
  family.rows.forEach((row, g) => {
    const rowWidth = row.length * NODE + (row.length - 1) * GAP;
    const left = (width - rowWidth) / 2;
    row.forEach((id, i) => at.set(id, { x: left + i * (NODE + GAP) + NODE / 2, y: TOP + g * ROW }));
  });

  // Children grouped by their parents, so each family hangs from one bar.
  const broods = new Map<string, { parents: string[]; children: string[] }>();
  for (const child of family.people) {
    const parents = family.parents.filter(([, c]) => c === child).map(([p]) => p).sort();
    if (!parents.length) continue;
    const key = parents.join('|');
    const brood = broods.get(key) ?? { parents, children: [] };
    brood.children.push(child);
    broods.set(key, brood);
  }
  const hasParents = new Set(family.parents.map(([, c]) => c));
  // Siblings with no parents on record: one bracket per group of them.
  const bracketed = family.siblings.filter(([a, b]) => !hasParents.has(a) || !hasParents.has(b));
  const unplaced = characters.filter((c) => !family.people.includes(c.id) && c.name);

  if (!family.people.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty title="No Family Yet">Give characters family relationships (Mother of, Son of, Sister, Married to, Grandfather…) and they appear here in generations.</Empty>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" onPointerDown={() => onSelect(null)}>
      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
          {[...broods.values()].map(({ parents, children }) => {
            const ps = parents.map((p) => at.get(p)!).filter(Boolean);
            const cs = children.map((c) => at.get(c)!).filter(Boolean);
            if (!ps.length || !cs.length) return null;
            const px = ps.reduce((s, p) => s + p.x, 0) / ps.length;
            const py = ps[0]!.y + UNDER;
            const bar = cs[0]!.y - AVATAR - 30;
            const xs = [px, ...cs.map((c) => c.x)];
            const lit = selected && (parents.includes(selected) || children.includes(selected));
            return (
              <g key={parents.join('|')} className={lit ? 'stroke-primary' : 'stroke-muted-foreground/60'} strokeWidth={lit ? 2 : 1.5} fill="none">
                <path d={`M ${px} ${py} V ${bar}`} />
                <path d={`M ${Math.min(...xs)} ${bar} H ${Math.max(...xs)}`} />
                {cs.map((c, i) => (
                  <path key={i} d={`M ${c.x} ${bar} V ${c.y - AVATAR - 4}`} />
                ))}
              </g>
            );
          })}
          {family.spouses.map(([a, b]) => {
            const p = at.get(a);
            const q = at.get(b);
            if (!p || !q || p.y !== q.y) return null;
            const [l, r] = p.x < q.x ? [p, q] : [q, p];
            return (
              <g key={`${a}|${b}`} className="stroke-amber-500" strokeWidth={1.5}>
                <line x1={l.x + AVATAR + 4} y1={l.y - 3} x2={r.x - AVATAR - 4} y2={r.y - 3} />
                <line x1={l.x + AVATAR + 4} y1={l.y + 3} x2={r.x - AVATAR - 4} y2={r.y + 3} />
              </g>
            );
          })}
          {bracketed.map(([a, b]) => {
            const p = at.get(a);
            const q = at.get(b);
            if (!p || !q || p.y !== q.y) return null;
            const y = p.y - AVATAR - 16;
            return <path key={`${a}~${b}`} d={`M ${p.x} ${p.y - AVATAR - 4} V ${y} H ${q.x} V ${q.y - AVATAR - 4}`} fill="none" className="stroke-muted-foreground/60" strokeWidth={1.5} strokeDasharray="4 3" />;
          })}
        </svg>
        {family.people.map((id) => {
          const entry = byId.get(id);
          const p = at.get(id);
          if (!entry || !p) return null;
          return (
            <button
              key={id}
              type="button"
              aria-label={entry.name || 'Untitled'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(selected === id ? null : id)}
              onDoubleClick={() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: entry.kind, entryId: entry.id } })}
              className="absolute flex -translate-x-1/2 -translate-y-6 flex-col items-center gap-1"
              style={{ left: p.x, top: p.y, width: NODE }}
            >
              <Portrait image={entry.image} name={entry.name} className={cn('size-12 rounded-full border-2 border-background shadow-md', selected === id && 'ring-2 ring-primary')} text="text-[13px]" />
              <span className="max-w-full truncate text-[12.5px] font-semibold">{entry.name || 'Untitled'}</span>
              {entry.tagline && <span className="max-w-full truncate text-[11px] text-muted-foreground">{entry.tagline}</span>}
            </button>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <p className="mx-auto max-w-[680px] px-6 pb-8 text-center text-[12px] text-muted-foreground">
          Not in a family yet: {unplaced.map((c) => c.name).join(', ')}. Give them a family relationship to place them.
        </p>
      )}
    </div>
  );
}
