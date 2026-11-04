import { ArrowRightLeftIcon } from 'lucide-react';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import type { BalladEditor } from '@/components/editor/schema';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { roleOf } from './cast';
import { blocksToElements, cueName, parseHeading } from './elements';
import { suggestCue, suggestHeading, suggestTransition } from './suggest';

/**
 * Filmmaking → Script, in the script editor: as you type a character cue,
 * a scene heading or a transition, the names, sets and times you'd likely
 * want (Tab takes the first, or arrow to one and press Enter); and the Dual
 * button, which sets a cue beside the one before it (dual dialogue).
 */

export type ScriptAssistHandle = { onKey: (event: KeyboardEvent<HTMLDivElement>) => boolean };

type Block = ReturnType<BalladEditor['getTextCursorPosition']>['block'];

const blockText = (block: Block) => (Array.isArray(block.content) ? (block.content as { type: string; text?: string; props?: { name?: string } }[]).map((i) => (i.type === 'mention' ? (i.props?.name ?? '') : (i.text ?? ''))).join('') : '');

/** Whether the caret is at the end of its block's text. */
function caretAtEnd(): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const node = range.endContainer;
  const inline = (node instanceof Element ? node : node.parentElement)?.closest('.bn-inline-content');
  if (!inline) return false;
  const rest = document.createRange();
  rest.setStart(range.endContainer, range.endOffset);
  rest.setEnd(inline, inline.childNodes.length);
  return rest.toString().length === 0;
}

/** The names and sets the production's scripts use, most used first, with its cast's roles and its locations. */
function useVocabulary() {
  const books = useBooks();
  const scenes = useLive('scenes');
  const entries = useWorldRecords('entries');
  return useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    const names = new Map<string, number>();
    const places = new Map<string, number>();
    for (const scene of scenes) {
      if (!ids.has(scene.bookId)) continue;
      for (const e of blocksToElements(scene.content)) {
        if (e.type === 'character') {
          const name = cueName(e.text);
          if (name) names.set(name, (names.get(name) ?? 0) + 1);
        } else if (e.type === 'sceneHeading') {
          const place = parseHeading(e.text).place;
          if (place) places.set(place, (places.get(place) ?? 0) + 1);
        }
      }
    }
    for (const e of entries) {
      const name = e.kind === 'character' ? roleOf(e).toUpperCase() : e.kind === 'place' ? e.name.toUpperCase() : '';
      const into = e.kind === 'character' ? names : places;
      if (name && !into.has(name)) into.set(name, 0);
    }
    const ranked = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    return { names: ranked(names), places: ranked(places) };
  }, [books, scenes, entries]);
}

export function ScriptAssist({ editor, ref }: { editor: BalladEditor; ref: Ref<ScriptAssistHandle> }) {
  const vocabulary = useVocabulary();
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  /** Escape closes it until the text changes. */
  const dismissed = useRef<string | null>(null);
  const vocab = useRef(vocabulary);
  vocab.current = vocabulary;

  useEffect(() => {
    const update = () => {
      const block = editor.getTextCursorPosition().block;
      const text = blockText(block);
      const type = block.type as string;
      let next: string[] = [];
      if (caretAtEnd() && dismissed.current !== `${block.id}:${text}`) {
        if (type === 'character') next = suggestCue(text, vocab.current.names);
        else if (type === 'sceneHeading') next = suggestHeading(text, vocab.current.places);
        else if (type === 'transition') next = suggestTransition(text);
      }
      setItems(next);
      setIndex(0);
      setPicked(false);
      const rect = next.length ? window.getSelection()?.getRangeAt(0).getBoundingClientRect() : null;
      setAt(rect && (rect.width || rect.height || rect.left) ? { x: rect.left, y: rect.bottom + 6 } : null);
    };
    const offs = [editor.onChange(update), editor.onSelectionChange(update)];
    return () => offs.forEach((off) => off());
  }, [editor]);

  const accept = (text: string) => {
    const block = editor.getTextCursorPosition().block;
    editor.updateBlock(block, { content: text } as never);
    editor.setTextCursorPosition(block, 'end');
    setItems([]);
    editor.focus();
  };

  useImperativeHandle(ref, () => ({
    onKey: (event) => {
      if (!items.length || !at) return false;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setIndex((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
        setPicked(true);
        return true;
      }
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        accept(items[index]!);
        return true;
      }
      if (event.key === 'Enter' && picked) {
        event.preventDefault();
        event.stopPropagation();
        accept(items[index]!);
        return true;
      }
      if (event.key === 'Escape') {
        const block = editor.getTextCursorPosition().block;
        dismissed.current = `${block.id}:${blockText(block)}`;
        setItems([]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length || !at) return null;
  return createPortal(
    <div role="listbox" aria-label="Suggestions" className="fixed z-50 flex min-w-[220px] flex-col overflow-hidden rounded-lg border bg-popover py-1 font-mono text-[12.5px] text-popover-foreground shadow-lg" style={{ left: at.x, top: at.y }}>
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={i === index}
          onMouseDown={(e) => {
            e.preventDefault();
            accept(item);
          }}
          className={cn('px-3 py-1 text-left uppercase hover:bg-muted', i === index && 'bg-muted')}
        >
          {item}
        </button>
      ))}
      <span className="border-t px-3 pt-1 font-sans text-[10.5px] text-muted-foreground">Tab takes it · ↑↓ then Enter · Esc</span>
    </div>,
    document.body,
  );
}

/** The Dual button: sets the cue beside the one before it (both speak at once). Only on a character cue. */
export function DualToggle({ editor, current }: { editor: BalladEditor; current: string }) {
  const [, rerender] = useState(0);
  if (current !== 'character') return null;
  const block = editor.getTextCursorPosition().block;
  const on = Boolean((block.props as { dual?: boolean }).dual);
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        editor.updateBlock(block, { props: { dual: !on } } as never);
        rerender((n) => n + 1);
        editor.focus();
      }}
      aria-pressed={on}
      title="Dual dialogue: this cue speaks at the same time as the one before, side by side"
      className={cn('flex h-[26px] items-center gap-1 rounded-full border border-dashed px-2.5 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase hover:text-foreground', on && 'border-solid border-foreground bg-foreground text-background hover:text-background')}
    >
      <ArrowRightLeftIcon className="size-3" /> Dual
    </button>
  );
}
