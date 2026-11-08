import { Link } from '@tanstack/react-router';
import { MinusIcon, PlusIcon, XIcon } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Empty, Label } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { updateScene } from '@/lib/actions';
import { useLive } from '@/lib/hooks';
import type { Book, Entry, Scene } from '@/lib/model';
import { cn } from '@/lib/utils';
import { StatusLed } from '@/screens/manuscript/Binder';
import { dayRange, numbered, povLanes } from './days';

const DAY = 172;
const LANE_LABEL = 150;

/**
 * The timeline's Story Days (Writing): a book's scenes by the day of the
 * story they happen on (Day 1 its first), one lane per point of view. Drag a
 * scene to another day, or from "No Day Yet" onto one; pick one to set its
 * day here, or open it.
 */
export function StoryDays({ book, books, onBook, selectedId, onSelect }: { book: Book | undefined; books: Book[]; onBook: (id: string) => void; selectedId: string | undefined; onSelect: (id: string | undefined) => void }) {
  const parts = useLive('parts');
  const allScenes = useLive('scenes');
  const entries = useLive('entries');
  const names = useMemo(() => new Map(entries.map((e: Entry) => [e.id, e.name || 'Untitled'])), [entries]);
  const list = useMemo(
    () =>
      book
        ? numbered(
            parts.filter((p) => p.bookId === book.id),
            allScenes.filter((s) => s.bookId === book.id),
          )
        : [],
    [book, parts, allScenes],
  );
  const scenes = list.map((n) => n.scene);
  const labels = new Map(list.map((n) => [n.scene.id, n.label]));
  const days = dayRange(scenes);
  const lanes = povLanes(scenes.filter((s) => typeof s.storyDay === 'number'));
  const undated = scenes.filter((s) => typeof s.storyDay !== 'number');
  const selected = scenes.find((s) => s.id === selectedId);

  // ── Dragging a scene onto a day ──
  const dragging = useRef<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const drag = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragging.current = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-ballad-scene', id);
    },
    onDragEnd: () => {
      dragging.current = null;
      setOver(null);
    },
  });
  const onDay = (day: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== day) setOver(day);
    },
    onDrop: (e: DragEvent) => {
      const id = dragging.current;
      if (!id) return;
      e.preventDefault();
      updateScene(id, { storyDay: day });
      dragging.current = null;
      setOver(null);
    },
  });

  const card = (scene: Scene) => (
    <button
      key={scene.id}
      type="button"
      {...drag(scene.id)}
      onClick={() => onSelect(scene.id)}
      className={cn(
        'flex w-full flex-col gap-px rounded-[9px] border bg-background px-2.5 py-1.5 text-left hover:border-foreground/30',
        scene.id === selectedId && 'border-2 border-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]',
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <StatusLed status={scene.status} /> {labels.get(scene.id)}
      </span>
      <span className="truncate text-[12.5px] leading-tight font-medium">{scene.title || 'Untitled Scene'}</span>
    </button>
  );

  if (!book) return <Empty title="No Book Yet">Start a book in the Manuscript, then lay its scenes out by the day they happen.</Empty>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField label="Book" value={book.id} onChange={onBook} options={books.map((b) => ({ value: b.id, label: b.title || 'Untitled Book' }))} className="h-[34px] w-56 text-[13px]" />
        <span className="text-[12.5px] text-muted-foreground">Drag a scene onto the day it happens, or pick one to set its day.</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <div style={{ minWidth: LANE_LABEL + days.length * DAY }}>
          <div className="flex border-b bg-muted/40">
            <div style={{ width: LANE_LABEL }} className="flex shrink-0 items-center px-3">
              <Label>Day</Label>
            </div>
            {days.map((day) => (
              <div key={day} {...onDay(day)} style={{ minWidth: DAY }} className={cn('flex h-8 flex-1 shrink-0 items-center border-l border-border/50 px-2 font-mono text-[10.5px] text-muted-foreground', over === day && 'bg-primary/10 text-foreground')}>
                Day {day}
              </div>
            ))}
          </div>
          {(lanes.length ? lanes : [null]).map((pov) => (
            <div key={pov ?? 'none'} className="flex border-t first:border-t-0">
              <div style={{ width: LANE_LABEL }} className="flex shrink-0 items-center px-3 text-[13px] font-semibold">
                <span className="truncate">{pov ? names.get(pov) : 'No POV'}</span>
              </div>
              {days.map((day) => (
                <div key={day} {...onDay(day)} style={{ minWidth: DAY }} className={cn('flex min-h-[56px] flex-1 shrink-0 flex-col gap-1.5 border-l border-border/50 p-1.5', over === day && 'bg-primary/10')}>
                  {scenes.filter((s) => s.storyDay === day && s.povId === pov).map(card)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {undated.length > 0 && (
        <section aria-label="No day yet" className="flex flex-col gap-2">
          <Label>No Day Yet · {undated.length}</Label>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-1.5">{undated.map(card)}</div>
        </section>
      )}

      {selected && (
        <section aria-label="Scene" className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[11px] text-muted-foreground">{labels.get(selected.id)}{selected.povId && ` · POV ${names.get(selected.povId)}`}</span>
            <span className="truncate font-display text-xl font-black uppercase">{selected.title || 'Untitled Scene'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Label>Story Day</Label>
            <Button variant="outline" size="icon-sm" aria-label="A day earlier" disabled={typeof selected.storyDay !== 'number'} onClick={() => updateScene(selected.id, { storyDay: (selected.storyDay ?? 1) - 1 })}>
              <MinusIcon />
            </Button>
            <input
              aria-label="Story day"
              inputMode="numeric"
              value={selected.storyDay ?? ''}
              placeholder="–"
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                updateScene(selected.id, { storyDay: Number.isFinite(n) ? n : null });
              }}
              className="h-8 w-14 rounded-md border bg-background text-center font-mono text-[13px] outline-none focus:border-ring"
            />
            <Button variant="outline" size="icon-sm" aria-label="A day later" onClick={() => updateScene(selected.id, { storyDay: (selected.storyDay ?? 0) + 1 })}>
              <PlusIcon />
            </Button>
            {typeof selected.storyDay === 'number' && (
              <Button variant="ghost" size="sm" onClick={() => updateScene(selected.id, { storyDay: null })}>
                No Day
              </Button>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/manuscript/$sceneId" params={{ sceneId: selected.id }}>
              Open Scene
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => onSelect(undefined)}>
            <XIcon />
          </Button>
        </section>
      )}
    </div>
  );
}
