/**
 * InkBlock — the Handwriting block in pages (/ Handwriting), and a picture
 * being marked up (/ Mark Up a Picture, or Mark Up on an image): ink on a
 * sheet or on the picture (components/ink/InkSurface, which has the tools).
 *
 * The block keeps only its ink's id (lib/model.ts Ink). A new block gets its
 * ink here; a copied block (a second copy in the page, or pasted into
 * another page) gets a copy of the ink, so the two don't draw on each other.
 */
import { createContext, useContext, useEffect } from 'react';
import { InkSurface } from '@/components/ink/InkSurface';
import { createInk } from '@/lib/actions';
import { useRecord } from '@/lib/hooks';
import { useVault } from '@/stores/vault';

/** The page the editor is showing (new ink belongs to it). */
export const InkPageContext = createContext<string | null>(null);

/** Which editors already show which ink, to tell a copied block. */
const shown = new WeakMap<object, Map<string, symbol>>();

export function InkBlock({
  inkId,
  editable,
  editor,
  onInkId,
  onDelete,
  onPlainPicture,
}: {
  inkId: string;
  editable: boolean;
  editor: object;
  onInkId: (id: string) => void;
  onDelete: () => void;
  /** A marked-up picture back to an image block (its picture, without the marks). */
  onPlainPicture: (src: string, name?: string) => void;
}) {
  const pageId = useContext(InkPageContext);
  const ink = useRecord('inks', inkId || undefined);

  useEffect(() => {
    if (!editable) return;
    if (!inkId || (!ink && !useVault.getState().vault.inks[inkId])) {
      onInkId(createInk(pageId).id);
      return;
    }
    const source = useVault.getState().vault.inks[inkId]!;
    const here = shown.get(editor) ?? new Map<string, symbol>();
    shown.set(editor, here);
    if (here.has(inkId) || (pageId && source.pageId && source.pageId !== pageId)) {
      onInkId(createInk(pageId, source).id);
      return;
    }
    const me = Symbol(inkId);
    here.set(inkId, me);
    return () => {
      if (here.get(inkId) === me) here.delete(inkId);
    };
  }, [inkId, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ink) return <div contentEditable={false} className="h-24 w-full rounded-xl border border-dashed" />;
  const picture = ink.image;
  return <InkSurface ink={ink} editable={editable} onDelete={onDelete} onPlainPicture={picture ? () => onPlainPicture(picture.src, picture.name) : undefined} />;
}
