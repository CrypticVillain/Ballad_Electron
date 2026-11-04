import { updateBook } from '@/lib/actions';
import { live, type Book } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/film/common';
import { scriptOrder } from '@/film/script/build';
import { blocksToElements } from '@/film/script/elements';
import { REVISION_COLORS, type ScriptLock, type ScriptSnapshot } from '@/film/script/model';
import { sceneNumbers } from '@/film/script/numbering';

/**
 * Filmmaking → Revisions: locking a script (its scene numbers fixed from
 * then on), starting each colored revision round (the script as it stands is
 * kept, to mark what changes after), and unlocking it.
 */

const store = () => useVault.getState();

/** The script's scenes now, numbered by `locked` (or in order), with their elements. */
function current(book: Book, locked?: [string, string][]) {
  const { parts, scenes } = store().vault;
  const ordered = scriptOrder(book, live(parts), live(scenes));
  const byId = new Map(ordered.map((s) => [s.id, s]));
  return sceneNumbers(
    ordered.map((s) => s.id),
    locked,
  ).map((n) => ({ ...n, elements: n.omitted ? [] : blocksToElements(byId.get(n.id)!.content) }));
}

function snapshot(book: Book, color: number, numbered: ReturnType<typeof current>) {
  const record: ScriptSnapshot = { ...stamp(), worldId: book.worldId, bookId: book.id, color, scenes: Object.fromEntries(numbered.filter((n) => !n.omitted).map((n) => [n.id, { number: n.number, elements: n.elements }])) };
  store().put('scriptSnapshots', record);
}

/** The snapshot the current round is measured against (null: not locked). */
export function roundSnapshot(book: Book): ScriptSnapshot | null {
  const round = book.script?.lock?.rounds.at(-1);
  if (!round) return null;
  return (
    live(store().vault.scriptSnapshots)
      .filter((s) => s.bookId === book.id && s.color === round.color)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

/** Locks the script: every scene keeps the number it has now. The White draft. */
export function lockScript(book: Book) {
  const numbered = current(book);
  const at = stamp().createdAt;
  const lock: ScriptLock = { lockedAt: at, numbers: numbered.map((n) => [n.id, n.number]), rounds: [{ color: 0, startedAt: at, label: '' }] };
  updateBook(book.id, { script: { ...book.script, lock } });
  snapshot(book, 0, numbered);
}

/** The next round's color (after Blue, Pink…; round and round after Tan). */
export const nextColor = (book: Book) => ((book.script?.lock?.rounds.at(-1)?.color ?? 0) % (REVISION_COLORS.length - 1)) + 1;

/** Starts the next colored round: scenes added since keep the numbers they have now; changes from here on are this color's. */
export function startRound(book: Book, label: string) {
  const lock = book.script?.lock;
  if (!lock) return;
  const numbered = current(book, lock.numbers);
  const color = nextColor(book);
  const next: ScriptLock = { ...lock, numbers: numbered.map((n) => [n.id, n.number]), rounds: [...lock.rounds, { color, startedAt: stamp().createdAt, label }] };
  updateBook(book.id, { script: { ...book.script, lock: next } });
  snapshot(book, color, numbered);
}

/** Unlocks the script (numbers run 1, 2, 3 again). Gives back how to undo it. */
export function unlockScript(book: Book): () => void {
  const before = book.script?.lock ?? null;
  updateBook(book.id, { script: { ...book.script, lock: null } });
  return () => updateBook(book.id, { script: { ...store().vault.books[book.id]?.script, lock: before } });
}
