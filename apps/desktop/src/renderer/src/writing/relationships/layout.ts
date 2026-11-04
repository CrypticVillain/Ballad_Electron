/**
 * Writing → Relationships: where the web puts each entry. A small
 * force-directed layout, pure and repeatable (the same entries and links give
 * the same picture): linked entries pull together, every pair pushes apart,
 * a gentle pull keeps it all near the middle. Entries you've dragged stay
 * where you put them. Positions are 0–1 across and down.
 */

export type WebNode = { id: string };
export type WebEdge = { from: string; to: string };
export type Point = { x: number; y: number };

// Well inside the frame, so names under the edge ones still fit.
const clamp = (n: number) => Math.min(0.9, Math.max(0.1, n));

/** A repeatable "random" in [0, 1) from a string, so starting places don't change between looks. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

export function layoutWeb(nodes: WebNode[], edges: WebEdge[], pinned: Record<string, Point> = {}, iterations = 260): Record<string, Point> {
  const n = nodes.length;
  const out: Record<string, Point> = {};
  if (!n) return out;
  // Start on a circle (in a fixed order), nudged a little so nothing sits exactly on anything else.
  const ordered = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  ordered.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    out[node.id] = pinned[node.id] ?? { x: 0.5 + 0.32 * Math.cos(angle) + (hash(node.id) - 0.5) * 0.02, y: 0.5 + 0.32 * Math.sin(angle) + (hash(`${node.id}y`) - 0.5) * 0.02 };
  });
  if (n === 1) return { [ordered[0]!.id]: pinned[ordered[0]!.id] ?? { x: 0.5, y: 0.5 } };

  const ids = ordered.map((node) => node.id);
  const known = new Set(ids);
  const links = edges.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);
  const k = Math.sqrt(1 / n) * 0.55;
  let temperature = 0.08;
  for (let step = 0; step < iterations; step++) {
    const move: Record<string, Point> = Object.fromEntries(ids.map((id) => [id, { x: 0, y: 0 }]));
    // Every pair pushes apart.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = out[ids[i]!]!;
        const b = out[ids[j]!]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = (hash(ids[i]! + ids[j]!) - 0.5) * 1e-3;
          dy = (hash(ids[j]! + ids[i]!) - 0.5) * 1e-3;
          d = Math.hypot(dx, dy);
        }
        const push = (k * k) / d;
        move[ids[i]!]!.x += (dx / d) * push;
        move[ids[i]!]!.y += (dy / d) * push;
        move[ids[j]!]!.x -= (dx / d) * push;
        move[ids[j]!]!.y -= (dy / d) * push;
      }
    }
    // Linked entries pull together.
    for (const e of links) {
      const a = out[e.from]!;
      const b = out[e.to]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.max(Math.hypot(dx, dy), 1e-6);
      const pull = (d * d) / k;
      move[e.from]!.x -= (dx / d) * pull;
      move[e.from]!.y -= (dy / d) * pull;
      move[e.to]!.x += (dx / d) * pull;
      move[e.to]!.y += (dy / d) * pull;
    }
    // And everything drifts toward the middle a little; then each moves at most `temperature`.
    for (const id of ids) {
      if (pinned[id]) continue;
      const p = out[id]!;
      const m = move[id]!;
      m.x += (0.5 - p.x) * 0.6;
      m.y += (0.5 - p.y) * 0.6;
      const length = Math.max(Math.hypot(m.x, m.y), 1e-9);
      const step_ = Math.min(length, temperature);
      out[id] = { x: clamp(p.x + (m.x / length) * step_), y: clamp(p.y + (m.y / length) * step_) };
    }
    temperature *= 0.985;
  }
  return out;
}

/** Whether a relationship's label is family (parent, sibling, spouse…): the web can show just those. */
export const isFamily = (label: string) =>
  /\b(mother|father|parent|son|daughter|child|children|brother|sister|sibling|twin|husband|wife|spouse|married|aunt|uncle|niece|nephew|cousin|grand\w*|ancestor|descendant|heir|in-law|step\w*|half-\w+|kin|family)\b/i.test(label);
