import { changedSince } from '@/film/revisions/diff';
import { byOrder, type Book, type Part, type Scene } from '@/lib/model';
import { blocksToElements, parseHeading, type Heading } from './elements';
import { layoutScript, withContinueds, type Layout, type LayoutElement, type LayoutScene } from './layout';
import { emptyTitlePage, REVISION_COLORS, type RevisionRound, type ScriptSnapshot, type TitlePage } from './model';
import { sceneNumbers } from './numbering';

/**
 * Filmmaking → Script: a script put together from its book (pure): its
 * scenes in order with their numbers (as locked), their elements, what
 * changed in the current revision round, and the pages.
 */

export type BuiltScene = LayoutScene & { title: string; heading: Heading; partId: string };
export type BuiltScript = {
  title: string;
  titlePage: TitlePage;
  scenes: BuiltScene[];
  /** The current revision round (null: not locked, or still the locked White draft). */
  round: (RevisionRound & { name: string; tint: string }) | null;
  layout: Layout;
};

export type BuildOptions = {
  /** Add (CONT'D) when a character speaks again after action. */
  continueds?: boolean;
  /** Mark what changed in the current round (asterisks in the margin). */
  marks?: boolean;
};

/** The script's scenes in order (its parts in order, then their scenes), notes left out. */
export function scriptOrder(book: Book, parts: Part[], scenes: Scene[]): Scene[] {
  return parts
    .filter((p) => p.bookId === book.id)
    .sort(byOrder)
    .flatMap((p) => scenes.filter((s) => s.partId === p.id && s.kind !== 'note').sort(byOrder));
}

/** A scene's heading: its first scene heading, or (with none) its title and time of day. */
export function headingOf(scene: Scene, elements = blocksToElements(scene.content)): Heading {
  const first = elements.find((e) => e.type === 'sceneHeading');
  return first ? parseHeading(first.text) : { ie: '', place: scene.title.toUpperCase(), time: scene.when.toUpperCase() };
}

export function buildScript(book: Book, parts: Part[], scenes: Scene[], snapshot: ScriptSnapshot | null = null, options: BuildOptions = {}): BuiltScript {
  const ordered = scriptOrder(book, parts, scenes);
  const byId = new Map(ordered.map((s) => [s.id, s]));
  const lock = book.script?.lock ?? null;
  const rounds = lock?.rounds ?? [];
  const current = rounds.at(-1) ?? null;
  const marking = Boolean(options.marks && current && current.color > 0 && snapshot);
  const built: BuiltScene[] = sceneNumbers(
    ordered.map((s) => s.id),
    lock?.numbers,
  ).map(({ id, number, omitted }) => {
    const scene = byId.get(id);
    if (omitted || !scene) {
      // Omitted since the round began: a change.
      const was = snapshot?.scenes[id];
      return { id, number, omitted: true, elements: [], title: '', heading: { ie: '', place: 'OMITTED', time: '' }, partId: '', ...(marking && was ? { changed: true } : {}) };
    }
    let elements: LayoutElement[] = blocksToElements(scene.content);
    if (options.continueds) elements = withContinueds(elements);
    if (marking) {
      const before = snapshot!.scenes[id]?.elements;
      const marks = before ? changedSince(before, blocksToElements(scene.content)) : elements.map(() => true);
      elements = elements.map((e, i) => (marks[i] ? { ...e, changed: true } : e));
    }
    return { id, number, elements, title: scene.title, heading: headingOf(scene), partId: scene.partId };
  });
  const layout = layoutScript(built);
  const color = current ? REVISION_COLORS[current.color % REVISION_COLORS.length]! : null;
  return {
    title: book.script?.titlePage?.title || book.title || 'Untitled Script',
    titlePage: { ...emptyTitlePage(), ...book.script?.titlePage },
    scenes: built,
    round: current && current.color > 0 && color ? { ...current, name: color.name, tint: color.tint } : null,
    layout,
  };
}
