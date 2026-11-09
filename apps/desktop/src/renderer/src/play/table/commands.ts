/**
 * Play → the chat's commands, as Roll20 has them (pure, with tests beside it):
 *
 *   /r 1d20+5 Perception   a roll, for everyone (/roll too); the words after it are what it's for
 *   /gr 2d6                a roll only the GM (and you) see (/gmroll)
 *   /w Name message        a whisper to someone at the table, by name (or "gm")
 *   /em draws his blade    something you do, said as you (/me)
 *
 * Anything else is said to whoever the chat's To picks.
 */
export type Command =
  | { kind: 'say'; text: string }
  | { kind: 'roll'; expression: string; label: string; hidden: boolean }
  | { kind: 'whisper'; to: string; text: string }
  | { kind: 'emote'; text: string }
  | { kind: 'error'; message: string };

export function parseCommand(input: string): Command {
  const text = input.trim();
  const m = /^\/(\w+)\s*([\s\S]*)$/.exec(text);
  if (!m) return { kind: 'say', text };
  const [, name, rest] = m as unknown as [string, string, string];
  const word = name.toLowerCase();
  if (word === 'r' || word === 'roll' || word === 'gr' || word === 'gmroll') {
    const [expression, ...label] = rest.trim().split(/\s+/);
    if (!expression) return { kind: 'error', message: 'Say what to roll: /r 1d20+5' };
    return { kind: 'roll', expression, label: label.join(' '), hidden: word === 'gr' || word === 'gmroll' };
  }
  if (word === 'w' || word === 'whisper') {
    if (!rest.trim()) return { kind: 'error', message: 'Say who to whisper to, and what: /w Sam meet me outside' };
    return { kind: 'whisper', to: rest.trim(), text: '' };
  }
  if (word === 'em' || word === 'me') return rest.trim() ? { kind: 'emote', text: rest.trim() } : { kind: 'error', message: 'Say what you do: /em draws his blade' };
  return { kind: 'error', message: `There's no /${name}: try /r, /gr, /w or /em` };
}

/**
 * Who a whisper's "Name message" is to: the longest name (or first name,
 * or "gm") it starts with, case aside; and the message after it.
 */
export function whisperTarget(rest: string, people: { accountId: string; name: string; gm?: boolean; aliases?: string[] }[]): { accountId: string; text: string } | null {
  const lower = rest.toLowerCase();
  const names = (n: string) => [n, n.split(' ')[0]!];
  const candidates = people.flatMap((p) => [...names(p.name), ...(p.aliases ?? []).flatMap(names), ...(p.gm ? ['gm', 'dm'] : [])].map((n) => ({ p, n: n.toLowerCase() })));
  const hit = candidates.filter(({ n }) => n && (lower === n || lower.startsWith(`${n} `))).sort((a, b) => b.n.length - a.n.length)[0];
  if (!hit) return null;
  return { accountId: hit.p.accountId, text: rest.slice(hit.n.length).trim() };
}
