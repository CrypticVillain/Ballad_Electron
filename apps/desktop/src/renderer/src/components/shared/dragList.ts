import { useRef, useState, type DragEvent } from 'react';

/**
 * Drag to reorder a short list (worlds in the world menu, accounts in the
 * account menu): `item(id)` gives a row what it needs to be dragged and
 * dropped on; dropping one on another puts it just before that one, and
 * `marker(id)` lights the row it'll land before.
 */
export function useDragList(type: string, place: (id: string, before: string) => void) {
  const dragging = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const item = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragging.current = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(type, id);
    },
    onDragEnd: () => {
      dragging.current = null;
      setOver(null);
    },
    onDragOver: (e: DragEvent) => {
      if (!dragging.current || dragging.current === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== id) setOver(id);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === id ? null : o));
    },
    onDrop: (e: DragEvent) => {
      const moving = dragging.current;
      if (!moving || moving === id) return;
      e.preventDefault();
      place(moving, id);
      dragging.current = null;
      setOver(null);
    },
  });
  const marker = (id: string) => (over === id ? 'shadow-[inset_0_2px_0_var(--color-primary)]' : '');
  return { item, marker };
}
