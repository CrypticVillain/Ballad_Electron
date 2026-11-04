import { Link, useNavigate } from '@tanstack/react-router';
import { BarChart3Icon, DownloadIcon, FileUpIcon, LockIcon, UnlockIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { PillTabs } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { today } from '@/lib/dates';
import { useBooks, useLive } from '@/lib/hooks';
import { byOrder, type Book, type Scene, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { PILL } from '@/film/common';
import { RevisionsDialog } from '@/film/revisions/RevisionsDialog';
import { roundSnapshot } from '@/film/revisions/actions';
import { importScript, updateTitlePage, type ImportedScript } from './actions';
import { buildScript, type BuiltScript } from './build';
import { fromFdx, toFdx } from './fdx';
import { fromFountain, toFountain } from './fountain';
import { eighthsLabel } from './layout';
import { REVISION_COLORS, type TitlePage } from './model';
import { scriptHtml } from './pdf';

/**
 * Filmmaking → Script tools, in a script scene's top bar: Revisions (lock
 * the script, colored revision rounds), Import (a Fountain or Final Draft
 * file), Export (a screenplay PDF, Final Draft, Fountain; the title page),
 * and Reports.
 */

export const fileName = (title: string, ext: string) => `${(title.trim() || 'Script').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)}.${ext}`;

export function ScriptTools({ book, world }: { scene: Scene; book: Book; world: World }) {
  const [open, setOpen] = useState<'revisions' | 'import' | 'export' | null>(null);
  const lock = book.script?.lock;
  const round = lock?.rounds.at(-1);
  const color = round ? REVISION_COLORS[round.color % REVISION_COLORS.length]! : null;
  return (
    <>
      <Hint label={lock ? 'Locked: scene numbers stay put. Revision rounds and colors' : 'Lock the script’s scene numbers, then revise in colors'}>
        <Button variant="outline" size="sm" className={PILL} onClick={() => setOpen('revisions')}>
          {lock ? <LockIcon /> : <UnlockIcon />}
          {lock && color ? (
            <>
              <span className="size-2.5 rounded-full border border-foreground/30" style={{ background: color.tint }} /> {color.name}
            </>
          ) : (
            'Lock'
          )}
        </Button>
      </Hint>
      <Hint label="Characters, locations and scenes, counted">
        <Button variant="outline" size="sm" className={PILL} asChild>
          <Link to="/film/reports">
            <BarChart3Icon /> Reports
          </Link>
        </Button>
      </Hint>
      <Button variant="outline" size="sm" className={PILL} onClick={() => setOpen('import')}>
        <FileUpIcon /> Import
      </Button>
      <Button variant="outline" size="sm" className={PILL} onClick={() => setOpen('export')}>
        <DownloadIcon /> Export
      </Button>
      {open === 'revisions' && <RevisionsDialog book={book} onClose={() => setOpen(null)} />}
      {open === 'import' && <ImportDialog world={world} onClose={() => setOpen(null)} />}
      {open === 'export' && <ExportDialog current={book} onClose={() => setOpen(null)} />}
    </>
  );
}

// ── Export ───────────────────────────────────────────────────────────────

type Format = 'pdf' | 'fdx' | 'fountain';
const FORMATS: { id: Format; label: string; note: string }[] = [
  { id: 'pdf', label: 'PDF', note: 'Laid out as a screenplay, to read, print or send' },
  { id: 'fdx', label: 'Final Draft', note: 'A .fdx, for Final Draft and most script apps' },
  { id: 'fountain', label: 'Fountain', note: 'Plain text that any screenwriting app reads' },
];

/** The script's scenes grouped by sequence, for Fountain and Final Draft. */
const sectionsOf = (built: BuiltScript, book: Book, parts: { id: string; title: string; bookId: string; order: number }[], numbers: boolean) =>
  parts
    .filter((p) => p.bookId === book.id)
    .sort(byOrder)
    .map((p) => ({ title: p.title, scenes: built.scenes.filter((s) => s.partId === p.id).map((s) => ({ ...(numbers ? { number: s.number } : {}), elements: s.elements })) }))
    .filter((s) => s.scenes.length);

function ExportDialog({ current, onClose }: { current: Book; onClose: () => void }) {
  const books = [...useBooks()].sort(byOrder);
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  const [tab, setTab] = useState<'export' | 'title'>('export');
  const [bookId, setBookId] = useState(current.id);
  const book = books.find((b) => b.id === bookId) ?? current;
  const locked = Boolean(book.script?.lock);
  const [format, setFormat] = useState<Format>('pdf');
  const [titlePage, setTitlePage] = useState(true);
  const [numbers, setNumbers] = useState(locked);
  const [continueds, setContinueds] = useState(true);
  const [marks, setMarks] = useState(true);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [tint, setTint] = useState(false);
  const [pageSize, setPageSize] = useState<'Letter' | 'A4'>('Letter');
  const [busy, setBusy] = useState(false);
  const snapshot = useMemo(() => roundSnapshot(book), [book]);
  const built = useMemo(() => buildScript(book, parts, scenes, snapshot, { continueds, marks }), [book, parts, scenes, snapshot, continueds, marks]);
  const changedPages = built.layout.pages.filter((p) => p.changed).length;
  const go = async () => {
    setBusy(true);
    try {
      let path: string | null = null;
      if (format === 'pdf') {
        path = await window.api.files.savePdf({
          defaultName: fileName(built.title, 'pdf'),
          html: scriptHtml(built, { titlePage: titlePage && !onlyChanged, sceneNumbers: numbers, onlyChanged: onlyChanged && Boolean(built.round), tint, pageSize, date: today() }),
          pageSize,
          margins: 'none',
          background: tint,
        });
      } else if (format === 'fdx') {
        const all = sectionsOf(built, book, parts, numbers).flatMap((s) => s.scenes);
        path = await window.api.files.saveText({ defaultName: fileName(built.title, 'fdx'), text: toFdx({ title: built.title, titlePage: built.titlePage, scenes: all }), filter: { name: 'Final Draft', extensions: ['fdx'] } });
      } else {
        path = await window.api.files.saveText({ defaultName: fileName(built.title, 'fountain'), text: toFountain({ title: built.title, titlePage: titlePage ? built.titlePage : { ...built.titlePage, title: '', authors: '', source: '', draft: '', date: '', contact: '', credit: '' }, sections: sectionsOf(built, book, parts, numbers) }), filter: { name: 'Fountain', extensions: ['fountain'] } });
      }
      if (path) {
        toast('Exported', { description: `${built.title}: ${built.layout.pages.length} pages. Saved to ${path}` });
        onClose();
      }
    } catch {
      toast.error('That couldn’t be exported', { description: 'Something went wrong making the file. Try another format, or again.' });
    } finally {
      setBusy(false);
    }
  };
  const tp = built.titlePage;
  const setTp = (changes: Partial<TitlePage>) => updateTitlePage(book, changes);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Export Script</DialogTitle>
          <DialogDescription>
            {built.title}: {built.layout.pages.length} {built.layout.pages.length === 1 ? 'page' : 'pages'}, {built.scenes.filter((s) => !s.omitted).length} scenes, {eighthsLabel(built.layout.eighths)} pages by the eighths.
          </DialogDescription>
        </DialogHeader>
        <PillTabs
          label="Export or title page"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'export', label: 'Export' },
            { value: 'title', label: 'Title Page' },
          ]}
        />
        {tab === 'export' ? (
          <div className="flex flex-col gap-4">
            {books.length > 1 && (
              <label className="flex flex-col gap-1">
                <Label>Script</Label>
                <SelectField label="Script" value={bookId} onChange={setBookId} options={books.map((b) => ({ value: b.id, label: b.title || 'Untitled Script' }))} />
              </label>
            )}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)} className={cn('flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-left hover:border-primary', format === f.id && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                  <span className="text-[14px] font-semibold">{f.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{f.note}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[13px]">
              <label className="flex items-center gap-2">
                <Checkbox checked={titlePage} onCheckedChange={(v) => setTitlePage(v === true)} /> Title page
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={numbers} onCheckedChange={(v) => setNumbers(v === true)} /> Scene numbers
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={continueds} onCheckedChange={(v) => setContinueds(v === true)} /> (CONT’D) when a character speaks again
              </label>
              {format === 'pdf' && (
                <span className="flex items-center gap-2">
                  Page
                  <SelectField label="Page size" variant="chip" value={pageSize} onChange={setPageSize} options={[{ value: 'Letter' as const, label: 'Letter' }, { value: 'A4' as const, label: 'A4' }]} />
                </span>
              )}
            </div>
            {built.round && format === 'pdf' && (
              <div className="flex flex-col gap-2 rounded-xl border px-3.5 py-3 text-[13px]" style={{ borderColor: built.round.tint }}>
                <span className="flex items-center gap-2 font-medium">
                  <span className="size-3 rounded-full border border-foreground/30" style={{ background: built.round.tint }} />
                  {built.round.name} Revisions · {changedPages} {changedPages === 1 ? 'page' : 'pages'} changed
                </span>
                <label className="flex items-center gap-2">
                  <Checkbox checked={marks} onCheckedChange={(v) => setMarks(v === true)} /> Asterisks beside changed lines
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={onlyChanged} onCheckedChange={(v) => setOnlyChanged(v === true)} /> Only the changed pages (to hand out)
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={tint} onCheckedChange={(v) => setTint(v === true)} /> Changed pages in {built.round.name.toLowerCase()}, like colored paper
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <Label>Title</Label>
              <Input aria-label="Title" value={tp.title} placeholder={book.title || 'Untitled Script'} onChange={(e) => setTp({ title: e.target.value })} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Credit</Label>
              <Input aria-label="Credit" value={tp.credit} placeholder="Written by" onChange={(e) => setTp({ credit: e.target.value })} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Writers</Label>
              <Input aria-label="Writers" value={tp.authors} placeholder="Your name" onChange={(e) => setTp({ authors: e.target.value })} className={FIELD} />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <Label>Source</Label>
              <Input aria-label="Source" value={tp.source} placeholder="Based on the novel by…" onChange={(e) => setTp({ source: e.target.value })} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Draft</Label>
              <Input aria-label="Draft" value={tp.draft} placeholder="Second Draft" onChange={(e) => setTp({ draft: e.target.value })} className={FIELD} />
            </label>
            <div className="flex flex-col gap-1">
              <Label>Date</Label>
              <DateField label="Draft date" value={tp.date || null} onChange={(date) => setTp({ date: date ?? '' })} />
            </div>
            <label className="col-span-2 flex flex-col gap-1">
              <Label>Contact</Label>
              <Textarea aria-label="Contact" rows={3} value={tp.contact} placeholder={'Your name\nPhone · Email\nAgent'} onChange={(e) => setTp({ contact: e.target.value })} className={cn(AREA, 'resize-y text-[13.5px]')} />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !built.scenes.length || (onlyChanged && !changedPages && format === 'pdf' && Boolean(built.round))} onClick={() => void go()}>
            <DownloadIcon /> {busy ? 'Exporting…' : `Export ${FORMATS.find((f) => f.id === format)!.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import ───────────────────────────────────────────────────────────────

/** Asks for a script file (Fountain or Final Draft) and reads it. */
function pickScriptFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fountain,.spmd,.txt,.fdx,.md';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** A file's text as a script: Final Draft by its XML, else Fountain. */
export function readScriptFile(name: string, text: string): ImportedScript {
  if (/\.fdx$/i.test(name) || /<FinalDraft\b/.test(text)) {
    const fdx = fromFdx(text);
    return { titlePage: fdx.titlePage, sections: [{ title: '', scenes: fdx.scenes }] };
  }
  return fromFountain(text);
}

function ImportDialog({ world, onClose }: { world: World; onClose: () => void }) {
  const navigate = useNavigate();
  const [file, setFile] = useState<{ name: string; script: ImportedScript } | null>(null);
  const [title, setTitle] = useState('');
  const [locations, setLocations] = useState(true);
  const [cast, setCast] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const pick = async () => {
    const picked = await pickScriptFile();
    if (!picked) return;
    const script = readScriptFile(picked.name, picked.text);
    const count = script.sections.reduce((n, s) => n + s.scenes.length, 0);
    if (!count) {
      toast.error('No script in that file', { description: 'Pick a Fountain (.fountain) or Final Draft (.fdx) script.' });
      return;
    }
    setFile({ name: picked.name, script });
    setTitle(script.titlePage.title || picked.name.replace(/\.[^.]+$/, ''));
  };
  const scenes = file?.script.sections.flatMap((s) => s.scenes) ?? [];
  const numbered = scenes.some((s) => s.number);
  const go = () => {
    if (!file) return;
    const first = importScript(world.id, file.script, title.trim(), { locations, cast, numbers: numbers && numbered });
    if (!first) return;
    toast('Script Imported', { description: `${title || 'The script'}: ${scenes.length} scenes, as a new script in ${world.name}.` });
    onClose();
    void navigate({ to: '/manuscript/$sceneId', params: { sceneId: first.id } });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Import Script</DialogTitle>
          <DialogDescription>A Fountain (.fountain) or Final Draft (.fdx) script comes in as a new script in this production, a scene for each scene heading.</DialogDescription>
        </DialogHeader>
        {file ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border px-3.5 py-2.5 text-[13px]">
              <div className="font-medium">{file.name}</div>
              <div className="text-muted-foreground">
                {scenes.length} scenes{file.script.sections.length > 1 ? ` in ${file.script.sections.length} sequences` : ''}
                {numbered ? ', numbered' : ''}
                {file.script.titlePage.authors ? ` · by ${file.script.titlePage.authors}` : ''}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <Label>Title</Label>
              <Input aria-label="Script title" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={locations} onCheckedChange={(v) => setLocations(v === true)} /> Add its sets to Locations
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={cast} onCheckedChange={(v) => setCast(v === true)} /> Add its speaking roles to Cast
            </label>
            {numbered && (
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox checked={numbers} onCheckedChange={(v) => setNumbers(v === true)} /> Keep its scene numbers (locks the script)
              </label>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => void pick()} className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-[13.5px] text-muted-foreground hover:border-primary hover:text-foreground">
            <FileUpIcon className="size-6" />
            Choose A Script File…
          </button>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {file && (
            <Button variant="outline" onClick={() => void pick()}>
              Another File
            </Button>
          )}
          <Button disabled={!file} onClick={go}>
            <FileUpIcon /> Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
