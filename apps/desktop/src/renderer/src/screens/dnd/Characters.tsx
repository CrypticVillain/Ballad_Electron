import { useNavigate } from '@tanstack/react-router';
import { ArchiveIcon, ArchiveRestoreIcon, FolderIcon, PlayIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { afterConfirm } from '@/components/shared/Confirm';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { now } from '@/lib/model';
import { pickCharacter, restore, trash, updateRecord } from '@/lib/actions';
import { useArchivedCharacters, useLive, useMyCharacters } from '@/lib/hooks';
import type { PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { Portrait } from '@/components/shared/Portrait';

/**
 * Your characters, kept: grouped by campaign or by your own folders, moved
 * between them, put away in the archive (out of every menu, kept whole,
 * brought back any time) or deleted, after a confirmation.
 */

const label = (pc: PlayerCharacter) => pc.name || 'Unnamed Character';

/** Puts a character in the archive (with Undo). */
export function archiveCharacter(pc: PlayerCharacter) {
  updateRecord('pcs', pc.id, { archivedAt: now() });
  toast('Character Archived', { description: `${label(pc)} is in the archive: Manage Characters brings them back.`, action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, { archivedAt: null }) } });
}

/** Deletes a character after a confirmation (with Undo right after). */
export function deleteCharacter(pc: PlayerCharacter) {
  afterConfirm(
    `Delete ${label(pc)}?`,
    'Their sheet, journal and maps go with them. Archive them instead to keep them out of the way.',
    () => {
      trash('pcs', pc.id);
      toast('Character Deleted', { description: label(pc), action: { label: 'Undo', onClick: () => restore('pcs', pc.id) } });
    },
    'Delete',
  );
}

/** Your characters in groups: by campaign (No Campaign last) or by folder (No Folder last). */
export function useCharacterGroups(characters: PlayerCharacter[]) {
  const grouping = usePreferences((s) => s.characterGrouping);
  const campaigns = useLive('worlds').filter((w) => w.section === 'dnd');
  const keyOf = (pc: PlayerCharacter) => (grouping === 'folder' ? pc.folder?.trim() || '' : (campaigns.find((w) => w.id === pc.worldId)?.name ?? ''));
  const names = [...new Set(characters.map(keyOf))].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  return {
    grouping,
    groups: names.map((name) => ({ name: name || (grouping === 'folder' ? 'No Folder' : 'No Campaign'), characters: characters.filter((pc) => keyOf(pc) === name) })),
  };
}

export function CharactersDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const characters = useMyCharacters();
  const archived = useArchivedCharacters();
  const campaigns = useLive('worlds').filter((w) => w.section === 'dnd');
  const { grouping, groups } = useCharacterGroups(characters);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const folders = [...new Set(characters.concat(archived).map((pc) => pc.folder?.trim()).filter((f): f is string => Boolean(f)))].sort();

  const row = (pc: PlayerCharacter, inArchive = false) => (
    <li key={pc.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <Portrait image={pc.image} name={pc.name} className="size-9 rounded-full" text="text-[11px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold">{label(pc)}</span>
        <span className="truncate text-[12px] text-muted-foreground">
          Level {pc.level} {pc.species} {pc.className}
          {inArchive && pc.archivedAt && ` · archived ${new Date(pc.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </span>
      </span>
      {!inArchive && (
        <>
          <SelectField
            label="Campaign"
            variant="chip"
            value={pc.worldId}
            onChange={(worldId) => updateRecord('pcs', pc.id, { worldId })}
            options={[{ value: null as string | null, label: 'No Campaign' }, ...campaigns.map((w) => ({ value: w.id as string | null, label: w.name || 'Untitled Campaign' }))]}
          />
          <SelectField
            label="Folder"
            variant="chip"
            value={pc.folder?.trim() || ''}
            onChange={(folder) => (folder === NEW ? setNewFolder(pc.id) : updateRecord('pcs', pc.id, { folder: folder || undefined }))}
            options={[{ value: '', label: 'No Folder' }, ...folders.map((f) => ({ value: f, label: f })), { value: NEW, label: '+ New Folder…' }]}
          />
          <Hint label="Play">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Play ${label(pc)}`}
              onClick={() => {
                pickCharacter(pc.id);
                onClose();
                void navigate({ to: '/' });
              }}
            >
              <PlayIcon />
            </Button>
          </Hint>
        </>
      )}
      <Hint label={inArchive ? 'Bring back' : 'Archive'}>
        <Button variant="ghost" size="icon-sm" aria-label={inArchive ? `Bring back ${label(pc)}` : `Archive ${label(pc)}`} onClick={() => (inArchive ? updateRecord('pcs', pc.id, { archivedAt: null }) : archiveCharacter(pc))}>
          {inArchive ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        </Button>
      </Hint>
      <Hint label="Delete">
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label(pc)}`} className="hover:text-destructive" onClick={() => deleteCharacter(pc)}>
          <Trash2Icon />
        </Button>
      </Hint>
    </li>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[84vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-[26px] leading-none font-black uppercase">Your Characters</DialogTitle>
            <DialogDescription>Group them by campaign or your own folders; archive the ones you’re not playing.</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="Group by" className="flex rounded-lg border p-0.5">
              {(['campaign', 'folder'] as const).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={grouping === g} onClick={() => usePreferences.getState().setPreference('characterGrouping', g)} className={cn('rounded-md px-3 py-1 text-[12.5px] text-muted-foreground', grouping === g && 'bg-muted font-medium text-foreground')}>
                  By {g === 'campaign' ? 'Campaign' : 'Folder'}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                void navigate({ to: '/create' });
              }}
            >
              <PlusIcon /> New Character
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {newFolder && (
            <form
              className="mb-4 flex items-center gap-2 rounded-xl border border-primary px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get('folder') ?? '').trim();
                if (name) updateRecord('pcs', newFolder, { folder: name });
                if (name) usePreferences.getState().setPreference('characterGrouping', 'folder');
                setNewFolder(null);
              }}
            >
              <FolderIcon className="size-4 text-muted-foreground" />
              <input name="folder" autoFocus placeholder={`A folder for ${label(characters.find((pc) => pc.id === newFolder) ?? archived[0]!)}`} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
              <Button type="button" size="sm" variant="ghost" onClick={() => setNewFolder(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Make Folder
              </Button>
            </form>
          )}
          {groups.map((group) => (
            <section key={group.name} className="mb-4 flex flex-col gap-1.5">
              <Label>{`${group.name} · ${group.characters.length}`}</Label>
              <ul className="flex flex-col gap-1.5">{group.characters.map((pc) => row(pc))}</ul>
            </section>
          ))}
          {!characters.length && <p className="py-6 text-center text-[13px] text-muted-foreground">No characters out of the archive. Make one, or bring one back below.</p>}
          <section className="mt-2 flex flex-col gap-1.5 border-t pt-4">
            <Label>{`Archive · ${archived.length}`}</Label>
            {archived.length ? <ul className="flex flex-col gap-1.5 opacity-90">{archived.map((pc) => row(pc, true))}</ul> : <p className="text-[13px] text-muted-foreground">Archived characters wait here, out of every menu, until you bring them back.</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const NEW = '__new';
