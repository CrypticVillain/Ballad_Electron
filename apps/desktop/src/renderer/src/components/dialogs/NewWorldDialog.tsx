import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Field, FIELD } from '@/components/shared/Field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createWorld } from '@/lib/actions';
import { useUi } from '@/stores/ui';

/** New World: a name, a genre and the world's "now"; it opens on World Home with a first book ready. */
export function NewWorldDialog() {
  const open = useUi((s) => s.newWorld);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [era, setEra] = useState('');

  const close = () => {
    useUi.getState().setNewWorld(false);
    setName('');
    setGenre('');
    setEra('');
  };
  const create = () => {
    createWorld({ name: name.trim() || 'Untitled World', genre: genre.trim(), era: era.trim() });
    close();
    void navigate({ to: '/' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase">New World</DialogTitle>
          <DialogDescription>Its own books, characters, places, lore and timeline. You can change all of this later.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field label="Name">
            <Input autoFocus value={name} placeholder="The Glass Archipelago" onChange={(e) => setName(e.target.value)} className={FIELD} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Genre">
              <Input value={genre} placeholder="Low Fantasy" onChange={(e) => setGenre(e.target.value)} className={FIELD} />
            </Field>
            <Field label="Now (Its Year)">
              <Input value={era} placeholder="402 A.F." onChange={(e) => setEra(e.target.value)} className={FIELD} />
            </Field>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Create World</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
