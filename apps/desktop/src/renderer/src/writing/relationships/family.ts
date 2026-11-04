/**
 * Writing → Relationships: the family tree, worked out from relationships'
 * labels (pure). A label says how the first entry relates to the second
 * ("Mother of", "Married to", "Older sister"), as the relationship form asks.
 * Parents sit a generation above their children, spouses side by side,
 * siblings together; grandparents, aunts, uncles, nieces, nephews and cousins
 * only set the generations. People in no family relationship are left out.
 */

export type Link = { from: string; to: string; label: string };

/** What a label says, about the first entry: parent (of the second), child, sibling, spouse; or just how many generations above (+) or below (-) the second it is. */
export type Kinship = { kind: 'parent' | 'child' | 'sibling' | 'spouse' } | { kind: 'generation'; above: number };

export function kinship(label: string): Kinship | null {
  const l = label.toLowerCase();
  const has = (re: RegExp) => re.test(l);
  if (has(/\bin-law\b/)) return has(/\b(mother|father|parent)\b/) ? { kind: 'generation', above: 1 } : has(/\b(son|daughter|child)\b/) ? { kind: 'generation', above: -1 } : { kind: 'generation', above: 0 };
  const greats = (l.match(/\bgreat-/g) ?? []).length;
  if (has(/\bgrand(mother|father|parent|ma|pa|mama|papa)s?\b/)) return { kind: 'generation', above: 2 + greats };
  if (has(/\bgrand(son|daughter|child|children|kid)s?\b/)) return { kind: 'generation', above: -2 - greats };
  if (has(/\b(mother|father|parent|mom|mum|dad|mama|papa)s?\b/)) return { kind: 'parent' };
  if (has(/\b(son|daughter|child|children|kid)s?\b/)) return { kind: 'child' };
  if (has(/\b(brother|sister|sibling|twin)s?\b/)) return { kind: 'sibling' };
  if (has(/\b(wife|husband|spouse|married|wed|betrothed|consort)\b/)) return { kind: 'spouse' };
  if (has(/\b(aunt|uncle)s?\b/)) return { kind: 'generation', above: 1 };
  if (has(/\b(niece|nephew)s?\b/)) return { kind: 'generation', above: -1 };
  if (has(/\bcousins?\b/)) return { kind: 'generation', above: 0 };
  return null;
}

export type Family = {
  /** Everyone in a family relationship. */
  people: string[];
  /** [parent, child] */
  parents: [string, string][];
  spouses: [string, string][];
  siblings: [string, string][];
  /** Each person's generation: 0 at the top. */
  generation: Record<string, number>;
  /** Each generation's people, left to right. */
  rows: string[][];
};

/** The family relationships among `ids`, as generations and rows. */
export function familyOf(links: Link[], ids: string[]): Family {
  const known = new Set(ids);
  const parents: [string, string][] = [];
  const spouses: [string, string][] = [];
  const siblings: [string, string][] = [];
  // Generation constraints: gen[b] - gen[a] = d.
  const steps: [string, string, number][] = [];
  for (const { from, to, label } of links) {
    if (!known.has(from) || !known.has(to) || from === to) continue;
    const k = kinship(label);
    if (!k) continue;
    if (k.kind === 'parent') {
      parents.push([from, to]);
      steps.push([from, to, 1]);
    } else if (k.kind === 'child') {
      parents.push([to, from]);
      steps.push([to, from, 1]);
    } else if (k.kind === 'sibling') {
      siblings.push([from, to]);
      steps.push([from, to, 0]);
    } else if (k.kind === 'spouse') {
      spouses.push([from, to]);
      steps.push([from, to, 0]);
    } else if (k.kind === 'generation') steps.push([from, to, k.above]);
  }
  const people = ids.filter((id) => steps.some(([a, b]) => a === id || b === id));

  // Generations: walk each family from its first person, each step setting the next (first answer wins on a contradiction).
  const neighbours = new Map<string, [string, number][]>();
  for (const [a, b, d] of steps) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), [b, d]]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), [a, -d]]);
  }
  const generation: Record<string, number> = {};
  const family: Record<string, number> = {};
  let families = 0;
  for (const start of people) {
    if (start in generation) continue;
    generation[start] = 0;
    family[start] = families;
    const queue = [start];
    const members = [start];
    while (queue.length) {
      const at = queue.shift()!;
      for (const [next, d] of neighbours.get(at) ?? []) {
        if (next in generation) continue;
        generation[next] = generation[at]! + d;
        family[next] = families;
        members.push(next);
        queue.push(next);
      }
    }
    // Each family's top generation is 0.
    const top = Math.min(...members.map((m) => generation[m]!));
    for (const m of members) generation[m]! -= top;
    families++;
  }

  // Rows, top down: a family's people together (families side by side), children under their parents, spouses side by side.
  const depth = Math.max(-1, ...people.map((p) => generation[p]!)) + 1;
  const position = new Map<string, number>();
  const rows: string[][] = [];
  const spouseOf = (id: string) => spouses.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
  for (let g = 0; g < depth; g++) {
    const row = people.filter((p) => generation[p] === g);
    const key = (id: string) => {
      const mine = parents.filter(([, c]) => c === id).map(([p]) => position.get(p)).filter((x): x is number => x !== undefined);
      return mine.length ? mine.reduce((s, x) => s + x, 0) / mine.length : Number.POSITIVE_INFINITY;
    };
    row.sort((a, b) => family[a]! - family[b]! || key(a) - key(b) || ids.indexOf(a) - ids.indexOf(b));
    // Pull each spouse in beside their partner.
    const placed: string[] = [];
    for (const id of row) {
      if (placed.includes(id)) continue;
      placed.push(id);
      for (const partner of spouseOf(id)) if (generation[partner] === g && !placed.includes(partner)) placed.push(partner);
    }
    placed.forEach((id, i) => position.set(id, i));
    rows.push(placed);
  }
  return { people, parents, spouses, siblings, generation, rows };
}
