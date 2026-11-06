import { DownloadIcon, HistoryIcon, MessageSquareIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Label } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime } from '@/lib/dates';
import { useBooks, useLive } from '@/lib/hooks';
import { byOrder, type Book, type Scene, type World } from '@/lib/model';
import { formatWords } from '@/lib/text';
import { cn } from '@/lib/utils';
import { addComment, autoRevision, deleteComment, deleteRevision, restoreRevision, saveRevision, updateComment, useEditorReload } from './actions';
import { buildBook } from './export/build';
import { fileName } from './export/document';
import { summary, toDocx, toEpub, toHtml, toMarkdown } from './export/formats';
import type { Revision } from './model';

/**
 * Writing → Manuscript tools, in a Writing scene's top bar: History (the
 * scene's saved revisions, to look at and restore), Comments (notes on
 * passages, resolved when dealt with), and Export (the book as a Word
 * document, an EPUB, a PDF or Markdown).
 */

/** The editor's key for a scene: changes when a revision is restored, so it reloads. */
export const useEditorKey = (sceneId: string) => useEditorReload((s) => s.keys[sceneId] ?? 0);

/** Opening a scene saves an automatic revision now and then (lib: autoRevision). */
export function useAutoRevision(scene: Scene, on: boolean) {
  useEffect(() => {
    if (on) autoRevision(scene);
    // Once per scene opened, as it was then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, on]);
}

export function ManuscriptTools({ scene, book, world }: { scene: Scene; book: Book; world: World }) {
  const [open, setOpen] = useState<'history' | 'comments' | 'export' | null>(null);
  const [quote, setQuote] = useState('');
  const revisions = useLive('revisions').filter((r) => r.sceneId === scene.id);
  const comments = useLive('comments').filter((c) => c.sceneId === scene.id);
  const openComments = comments.filter((c) => !c.resolved).length;
  /** Comments open on what's selected in the text, if anything. */
  const comment = () => {
    setQuote((window.getSelection()?.toString() ?? '').trim().slice(0, 400));
    setOpen('comments');
  };
  const pill = 'rounded-full font-mono text-xs tracking-[0.08em] uppercase';
  return (
    <>
      <Hint label="This scene’s saved revisions">
        <Button variant="outline" size="sm" className={pill} onClick={() => setOpen('history')}>
          <HistoryIcon /> History{revisions.length ? ` · ${revisions.length}` : ''}
        </Button>
      </Hint>
      <Hint label="Select a passage first to comment on it">
        <Button variant="outline" size="sm" className={pill} onMouseDown={(e) => e.preventDefault()} onClick={comment}>
          <MessageSquareIcon /> Comments{openComments ? ` · ${openComments}` : ''}
        </Button>
      </Hint>
      <Button variant="outline" size="sm" className={pill} onClick={() => setOpen('export')}>
        <DownloadIcon /> Export
      </Button>
      {open === 'history' && <HistoryDialog scene={scene} revisions={revisions} onClose={() => setOpen(null)} />}
      <CommentsSheet open={open === 'comments'} scene={scene} quote={quote} onClose={() => setOpen(null)} />
      {open === 'export' && <ExportDialog world={world} current={book} onClose={() => setOpen(null)} />}
    </>
  );
}

// ── History ──────────────────────────────────────────────────────────────

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function HistoryDialog({ scene, revisions, onClose }: { scene: Scene; revisions: Revision[]; onClose: () => void }) {
  const list = [...revisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [picked, setPicked] = useState<string | null>(list[0]?.id ?? null);
  const [label, setLabel] = useState('');
  const shown = list.find((r) => r.id === picked);
  const save = () => {
    const made = saveRevision(scene, label.trim());
    setLabel('');
    setPicked(made.id);
    toast('Revision Saved', { description: label.trim() || `${formatWords(scene.words)} words, as they are now` });
  };
  const restore = (r: Revision) => {
    const undo = restoreRevision(scene, r);
    toast('Revision Restored', { description: `${r.label || when(r.createdAt)}. The text as it was is saved too.`, action: { label: 'Undo', onClick: undo } });
    onClose();
  };
  const remove = (r: Revision) => confirmDelete({ noun: 'Revision', name: r.label || `the revision from ${when(r.createdAt)}`, area: 'writing:manuscript', remove: () => deleteRevision(r.id), after: () => setPicked(null) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(78vh,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[880px]">
        <DialogHeader className="border-b px-6 pt-5 pb-3">
          <DialogTitle className="font-display text-xl font-black uppercase">History · {scene.title || 'Untitled Scene'}</DialogTitle>
          <DialogDescription>Saved versions of this scene. One is kept automatically each day you change it; save your own before a big rewrite.</DialogDescription>
          <div className="flex gap-2 pt-2">
            <Input aria-label="Revision label" value={label} placeholder="Label it (optional): Before the rewrite…" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} className={cn(FIELD, 'flex-1')} />
            <Button onClick={save}>
              <SaveIcon /> Save Revision Now
            </Button>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <div className="w-[300px] shrink-0 overflow-y-auto border-r px-2 py-2">
            {list.length ? (
              list.map((r, i) => {
                const older = list[i + 1];
                const delta = older ? r.words - older.words : null;
                return (
                  <button key={r.id} type="button" onClick={() => setPicked(r.id)} className={cn('flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-muted', picked === r.id && 'bg-muted')}>
                    <span className="truncate text-[13.5px] font-medium">{r.label || (r.automatic ? 'Automatic' : 'Saved')}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {when(r.createdAt)} · {formatWords(r.words)} words{delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No revisions yet. Save one, or one is kept the next time you open the scene after changing it.</p>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            {shown ? (
              <>
                <div className="flex items-center gap-2 border-b px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                    {shown.title || 'Untitled'} · {relativeTime(shown.createdAt)}
                  </span>
                  <Button size="sm" onClick={() => restore(shown)}>
                    <RotateCcwIcon /> Restore This
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete this revision" onClick={() => remove(shown)} className="text-muted-foreground hover:text-destructive">
                    <Trash2Icon />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 font-[Literata,Georgia,serif] text-[14.5px] leading-relaxed whitespace-pre-wrap">{shown.text || <span className="text-muted-foreground">(Empty)</span>}</div>
              </>
            ) : (
              <p className="m-auto text-[13px] text-muted-foreground">Pick a revision to read it.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Comments ─────────────────────────────────────────────────────────────

function CommentsSheet({ open, scene, quote, onClose }: { open: boolean; scene: Scene; quote: string; onClose: () => void }) {
  const comments = useLive('comments').filter((c) => c.sceneId === scene.id);
  const [draft, setDraft] = useState('');
  const [about, setAbout] = useState(quote);
  const [showResolved, setShowResolved] = useState(false);
  useEffect(() => setAbout(quote), [quote, open]);
  const openOnes = comments.filter((c) => !c.resolved).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const resolved = comments.filter((c) => c.resolved).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const add = () => {
    if (!draft.trim()) return;
    addComment(scene, draft.trim(), about);
    setDraft('');
    setAbout('');
  };
  const remove = (id: string, text: string) => confirmDelete({ noun: 'Comment', name: `“${text.slice(0, 40)}${text.length > 40 ? '…' : ''}”`, area: 'writing:manuscript', remove: () => deleteComment(id) });
  const card = (c: (typeof comments)[number]) => (
    <article key={c.id} className={cn('flex flex-col gap-2 rounded-xl border px-3.5 py-3', c.resolved && 'opacity-70')}>
      {c.quote && <blockquote className="border-l-2 border-primary pl-2.5 font-[Literata,Georgia,serif] text-[13px] text-muted-foreground italic">{c.quote}</blockquote>}
      <Textarea aria-label="Comment" rows={2} value={c.text} onChange={(e) => updateComment(c.id, { text: e.target.value })} className={cn(AREA, 'min-h-0 resize-y text-[13.5px]')} />
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span className="flex-1">{relativeTime(c.createdAt)}</span>
        <Button variant="ghost" size="xs" onClick={() => updateComment(c.id, { resolved: !c.resolved })}>
          {c.resolved ? 'Reopen' : 'Resolve'}
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Delete comment" onClick={() => remove(c.id, c.text)} className="hover:text-destructive">
          <Trash2Icon />
        </Button>
      </div>
    </article>
  );
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-[420px] flex-col gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display text-lg font-black uppercase">Comments</SheetTitle>
          <SheetDescription>Notes in the margin of {scene.title || 'this scene'}. Select a passage before opening Comments to quote it.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 border-b px-5 py-3">
          {about && (
            <div className="flex items-start gap-2">
              <blockquote className="flex-1 border-l-2 border-primary pl-2.5 font-[Literata,Georgia,serif] text-[13px] text-muted-foreground italic">{about}</blockquote>
              <button type="button" onClick={() => setAbout('')} className="text-[11.5px] text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </div>
          )}
          <Textarea autoFocus aria-label="New comment" rows={3} value={draft} placeholder={about ? 'Your note on this passage…' : 'A note on the scene…'} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && add()} className={cn(AREA, 'resize-y text-[13.5px]')} />
          <Button size="sm" className="self-end" disabled={!draft.trim()} onClick={add}>
            <MessageSquareIcon /> Comment
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-3">
          {openOnes.map(card)}
          {!openOnes.length && <p className="py-4 text-center text-[13px] text-muted-foreground">No open comments.</p>}
          {resolved.length > 0 && (
            <button type="button" onClick={() => setShowResolved(!showResolved)} className="self-start text-[12px] text-muted-foreground hover:text-foreground">
              {showResolved ? 'Hide' : 'Show'} resolved · {resolved.length}
            </button>
          )}
          {showResolved && resolved.map(card)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Export ───────────────────────────────────────────────────────────────

type Format = 'docx' | 'epub' | 'pdf' | 'md';
const FORMATS: { id: Format; label: string; note: string }[] = [
  { id: 'docx', label: 'Word', note: 'A .docx to edit, or to send to an editor or agent' },
  { id: 'epub', label: 'EPUB', note: 'An e-book, for readers and e-book stores' },
  { id: 'pdf', label: 'PDF', note: 'To print or share, laid out like a manuscript' },
  { id: 'md', label: 'Markdown', note: 'Plain text with light formatting' },
];

function ExportDialog({ world, current, onClose }: { world: World; current: Book; onClose: () => void }) {
  const books = useBooks().filter((b) => b.audience !== 'player').sort(byOrder);
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  const [bookId, setBookId] = useState(current.id);
  const [format, setFormat] = useState<Format>('docx');
  const [byline, setByline] = useState('');
  const [partHeadings, setPartHeadings] = useState(true);
  const [sceneTitles, setSceneTitles] = useState(false);
  const [pageSize, setPageSize] = useState<'Letter' | 'A4'>('Letter');
  const [busy, setBusy] = useState(false);
  const book = books.find((b) => b.id === bookId) ?? current;
  const out = useMemo(() => buildBook(book, parts, scenes, byline.trim()), [book, parts, scenes, byline]);
  const go = async () => {
    setBusy(true);
    const options = { partHeadings, sceneTitles };
    try {
      let path: string | null = null;
      if (format === 'docx') path = await window.api.files.saveBinary({ defaultName: fileName(out.title, 'docx'), data: await toDocx(out, options), filter: { name: 'Word Document', extensions: ['docx'] } });
      else if (format === 'epub') path = await window.api.files.saveBinary({ defaultName: fileName(out.title, 'epub'), data: await toEpub(out, options, book.id), filter: { name: 'EPUB', extensions: ['epub'] } });
      else if (format === 'pdf') path = await window.api.files.savePdf({ defaultName: fileName(out.title, 'pdf'), html: toHtml(out, options), pageSize });
      else path = await window.api.files.saveText({ defaultName: fileName(out.title, 'md'), text: toMarkdown(out, options), filter: { name: 'Markdown', extensions: ['md'] } });
      if (path) {
        toast('Exported', { description: `${out.title}: ${summary(out)}. Saved to ${path}` });
        onClose();
      }
    } catch {
      toast.error('That couldn’t be exported', { description: 'Something went wrong making the file. Try another format, or again.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Export</DialogTitle>
          <DialogDescription>
            {out.title}: {summary(out)}, in manuscript order. Notes stay behind.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <Label>Book</Label>
              <SelectField label="Book" value={bookId} onChange={setBookId} options={books.map((b) => ({ value: b.id, label: b.title || 'Untitled Book' }))} />
            </label>
            <label className="flex flex-col gap-1">
              <Label>By</Label>
              <Input aria-label="Author" value={byline} placeholder={world.name ? `Your name (or ${world.name})` : 'Your name'} onChange={(e) => setByline(e.target.value)} className={FIELD} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)} className={cn('flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-left hover:border-primary', format === f.id && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                <span className="text-[14px] font-semibold">{f.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{f.note}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <label className="flex items-center gap-2">
              <Checkbox checked={partHeadings} onCheckedChange={(v) => setPartHeadings(v === true)} /> {book.partNoun} headings
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={sceneTitles} onCheckedChange={(v) => setSceneTitles(v === true)} /> Scene titles
            </label>
            {format === 'pdf' && (
              <span className="flex items-center gap-2">
                Page
                <SelectField label="Page size" variant="chip" value={pageSize} onChange={setPageSize} options={[{ value: 'Letter' as const, label: 'Letter' }, { value: 'A4' as const, label: 'A4' }]} />
              </span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !out.parts.length} onClick={() => void go()}>
            <DownloadIcon /> {busy ? 'Exporting…' : `Export ${FORMATS.find((f) => f.id === format)!.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
