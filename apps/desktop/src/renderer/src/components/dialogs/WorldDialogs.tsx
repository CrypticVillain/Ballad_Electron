import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createWorld, restore, trashWorld, updateDnd, updateFilm, updateWorld } from '@/lib/actions';
import { useLive, useRecord, useSection } from '@/lib/hooks';
import { FILM_FORMATS } from '@/lib/model';
import { dndDefaults, filmDefaults, SECTION_INFO } from '@/lib/sections';
import { useUi } from '@/stores/ui';

/**
 * The world dialogs, opened from the world menu (the mark at the top of the
 * rail), Home's sidebar and search. In Filmmaking and D&D a world is a
 * production or a campaign, and the words follow:
 *
 *   New      a name, a genre and the world's "now" (a production's format, a
 *            campaign's rules); it opens with a first book (script, session log) ready
 *   Edit     the same, for the open one (Home edits them in place too)
 *   Delete   confirms; the toast after can undo it
 */
export function WorldDialogs() {
  const dialog = useUi((s) => s.world);
  const close = () => useUi.getState().openWorldDialog(null);
  return (
    <>
      <WorldForm open={dialog?.kind === 'create' || dialog?.kind === 'edit'} id={dialog?.kind === 'edit' ? dialog.id : null} onClose={close} />
      <DeleteWorld id={dialog?.kind === 'delete' ? dialog.id : null} onClose={close} />
    </>
  );
}

function WorldForm({ open, id, onClose }: { open: boolean; id: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const world = useRecord('worlds', id);
  const openSection = useSection();
  const section = world?.section ?? openSection;
  const info = SECTION_INFO[section];
  const blank = { name: '', genre: '', era: '', format: filmDefaults().format, ruleset: dndDefaults().ruleset };
  const [draft, setDraft] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setDraft(
      world
        ? { name: world.name, genre: world.genre, era: world.era, format: world.film?.format ?? blank.format, ruleset: world.dnd?.ruleset ?? blank.ruleset }
        : blank,
    );
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const save = () => {
    const values = { name: draft.name.trim() || `Untitled ${info.container}`, genre: draft.genre.trim(), era: draft.era.trim() };
    const target = world ?? createWorld({ ...values, section }).world;
    if (world) updateWorld(world.id, values);
    if (section === 'film') updateFilm(target.id, { format: draft.format });
    if (section === 'dnd') updateDnd(target.id, { ruleset: draft.ruleset.trim() });
    if (!world) void navigate({ to: '/' });
    onClose();
  };
  const placeholder = { writing: 'The Glass Archipelago', film: 'How Glass Is Made', dnd: 'The Sunken Lantern' }[section];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase">
            {world ? 'Edit' : 'New'} {info.container}
          </DialogTitle>
          <DialogDescription>
            {section === 'film'
              ? 'A video, a short or a feature: its script, shots, schedule, budget, cast and crew. You can change all of this later.'
              : section === 'dnd'
                ? 'Its session log, the party’s sheets, encounters, a bestiary, NPCs, places and lore. You can change all of this later.'
                : world
                  ? 'Its name, genre and the year it is now in its own calendar.'
                  : 'Its own books, characters, places, lore and timeline. You can change all of this later.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Name">
            <Input autoFocus value={draft.name} placeholder={placeholder} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Genre">
              <Input value={draft.genre} placeholder={section === 'film' ? 'Documentary' : 'Low Fantasy'} onChange={(e) => setDraft({ ...draft, genre: e.target.value })} className={FIELD} />
            </Field>
            {section === 'film' ? (
              <Field label="Format">
                <SelectField label="Format" value={draft.format} onChange={(format) => setDraft({ ...draft, format })} options={FILM_FORMATS.map((f) => ({ value: f as string, label: f }))} />
              </Field>
            ) : section === 'dnd' ? (
              <Field label="Rules">
                <Input value={draft.ruleset} placeholder="5e" onChange={(e) => setDraft({ ...draft, ruleset: e.target.value })} className={FIELD} />
              </Field>
            ) : (
              <Field label="Now (Its Year)">
                <Input value={draft.era} placeholder="402 A.F." onChange={(e) => setDraft({ ...draft, era: e.target.value })} className={FIELD} />
              </Field>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{world ? 'Save' : `Create ${info.container}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWorld({ id, onClose }: { id: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const world = useRecord('worlds', id);
  const info = SECTION_INFO[world?.section ?? 'writing'];
  const books = useLive('books').filter((b) => b.worldId === id).length;
  const entries = useLive('entries').filter((e) => e.worldId === id).length;
  const remove = () => {
    if (!world) return;
    trashWorld(world.id);
    void navigate({ to: '/' });
    toast(`${info.container} Deleted`, { description: world.name || `Untitled ${info.container}`, action: { label: 'Undo', onClick: () => restore('worlds', world.id) } });
  };
  return (
    <AlertDialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {world?.name || `This ${info.container}`}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its {books === 1 ? 'book' : `${books} books`} and {entries === 1 ? '1 world-bible entry' : `${entries} world-bible entries`} go with it. You can undo it straight after.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={remove}>
              Delete {info.container}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
