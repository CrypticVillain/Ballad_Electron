import { CheckIcon, SignatureIcon, Trash2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NOTE_SIZE } from '@/lib/ink';
import type { InkStroke } from '@/lib/model';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { InkMarks, InkToolbar, penInUse, useInkEditor, useSurfaceRef, type InkEditor } from './engine';

/**
 * A note's sheet (a letter, a riddle, a rumor): its words, typed, and
 * handwriting on the same sheet, the ink tools' (engine.tsx). Play's note
 * handouts and Tabletop's lore documents. The sheet is 1000 units across; the
 * words are sized to it, so the handwriting stays where it was written at
 * any size.
 */

export { NOTE_SIZE };

export type NoteInk = { e: InkEditor; setSurface: (el: HTMLDivElement | null) => void; px: () => number };

/** A note's handwriting, while `writing`: the ink tools over the sheet (Esc stops). */
export function useNoteInk({ strokes, save, writing, editable, onDone }: { strokes: InkStroke[]; save: (strokes: InkStroke[]) => void; writing: boolean; editable: boolean; onDone: () => void }): NoteInk {
  const [surface, setSurface] = useSurfaceRef<HTMLDivElement>();
  const px = () => NOTE_SIZE.width / (surface.current?.getBoundingClientRect().width || NOTE_SIZE.width);
  const e = useInkEditor({
    strokes,
    save,
    active: writing,
    editable,
    surface,
    keys: surface,
    onEscape: onDone,
    toInk: (ev, el) => {
      const r = el.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * NOTE_SIZE.width, ((ev.clientY - r.top) / r.width) * NOTE_SIZE.width];
    },
    unitsPerPixel: px,
  });
  useEffect(() => {
    // Writing starts with the sheet in view (it can sit below the fold, under a spec sheet).
    if (!writing) return;
    surface.current?.scrollIntoView({ block: 'nearest' });
    surface.current?.focus({ preventScroll: true });
  }, [writing, surface]);
  return { e, setSurface, px };
}

/** Handwrite: starts writing on the note, or stops. */
export function HandwriteButton({ writing, onToggle, className }: { writing: boolean; onToggle: () => void; className?: string }) {
  return (
    <Button size="sm" variant={writing ? 'default' : 'outline'} aria-pressed={writing} onClick={onToggle} className={className}>
      <SignatureIcon /> Handwrite
    </Button>
  );
}

/** The ink tools for writing on a note, with Clear and Done. */
export function NoteInkTools({ ink, onDone, className }: { ink: NoteInk; onDone: () => void; className?: string }) {
  return (
    <InkToolbar e={ink.e} className={className}>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="sm" disabled={!ink.e.strokes.length} onClick={() => ink.e.clear()}>
        <Trash2Icon /> Clear
      </Button>
      <Button size="sm" onClick={onDone}>
        <CheckIcon /> Done
      </Button>
    </InkToolbar>
  );
}

/**
 * The note itself, filling its (positioned) parent: the words (a field, if
 * `onText`), the handwriting over them, and while writing, the surface that
 * takes the pen.
 */
export function NoteFace({ ink, text, onText, writing, height = NOTE_SIZE.height, label = 'Note', placeholder = 'What the note says: a letter, a riddle, a rumor…' }: { ink: NoteInk; text: string; onText?: (text: string) => void; writing: boolean; height?: number; label?: string; placeholder?: string }) {
  const finger = usePreferences((s) => s.inkFinger);
  const words = 'size-full overflow-hidden p-[6cqw] font-serif text-[2.3cqw] leading-relaxed';
  return (
    <div className="@container absolute inset-0">
      {onText && !writing ? (
        <textarea aria-label={label} value={text} placeholder={placeholder} onChange={(e) => onText(e.target.value)} className={cn(words, 'resize-none bg-transparent outline-none placeholder:text-muted-foreground/50')} />
      ) : (
        <p className={cn(words, 'whitespace-pre-wrap')}>{text}</p>
      )}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${NOTE_SIZE.width} ${height}`}>
        <InkMarks e={ink.e} px={ink.px()} />
      </svg>
      {writing && <div ref={ink.setSurface} tabIndex={-1} aria-label={`Writing on the ${label.toLowerCase()}`} className="absolute inset-0 cursor-crosshair outline-none" style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-x pan-y' }} />}
    </div>
  );
}
