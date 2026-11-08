import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { confirmDelete } from '@/components/shared/Confirm';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { relativeTime } from '@/lib/dates';
import { deletions, purgePlan, restorePlan, type Deletion } from '@/lib/trash';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';

/**
 * The Trash (the Ballad mark → Trash…): everything deleted in this account,
 * one row per delete (an act comes with its scenes), newest first, with the
 * world it was in. Restore brings it back where it was (and what it sat in,
 * if that went too); Delete Forever, and Empty Trash, can't be undone.
 */
export function TrashDialog() {
  const open = useUi((s) => s.trash);
  const vault = useVault((s) => s.vault);
  const [world, setWorld] = useState<string | null>(null);
  const all = useMemo(() => (open ? deletions(vault) : []), [open, vault]);
  const worlds = useMemo(() => [...new Set(all.map((d) => d.worldId).filter((w): w is string => Boolean(w)))], [all]);
  const shown = world ? all.filter((d) => d.worldId === world) : all;
  const nameOfWorld = (id: string | null) => (id ? vault.worlds[id]?.name || 'Untitled' : '');
  const close = () => useUi.getState().setTrash(false);

  const restore = (d: Deletion) => {
    const plan = restorePlan(useVault.getState().vault, d);
    for (const ref of plan) useVault.getState().restore(ref.collection, ref.id);
    toast('Restored', { description: label(d) });
  };
  const purge = (list: Deletion[]) => {
    const v = useVault.getState().vault;
    const refs = list.flatMap((d) => purgePlan(v, d));
    for (const ref of refs) useVault.getState().purge(ref.collection, ref.id);
  };
  const forever = (d: Deletion) =>
    void confirmDelete(`Delete ${label(d)} forever?`, 'It can’t be brought back.', 'Delete Forever').then((ok) => ok && purge([d]));
  const empty = () =>
    void confirmDelete(world ? `Empty the Trash of ${nameOfWorld(world)}?` : 'Empty the Trash?', `${shown.length === 1 ? 'The one thing' : `All ${shown.length} things`} in it go for good. This can’t be undone.`, 'Empty Trash').then((ok) => ok && purge(shown));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[min(640px,calc(100vh-64px))] flex-col gap-4 sm:max-w-[640px]">
        <div className="flex flex-col gap-1">
          <DialogTitle className="font-display text-xl font-black uppercase">Trash</DialogTitle>
          <DialogDescription>What you’ve deleted, newest first. Restore puts it back where it was.</DialogDescription>
        </div>
        {all.length > 0 && (
          <div className="flex items-center gap-2">
            <SelectField
              label="World"
              value={world}
              onChange={setWorld}
              options={[{ value: null as string | null, label: 'Every World' }, ...worlds.map((w) => ({ value: w as string | null, label: nameOfWorld(w) }))]}
              className="h-8 w-56 text-[13px]"
            />
            <span className="flex-1" />
            <Button variant="outline" size="sm" className="text-destructive" disabled={!shown.length} onClick={empty}>
              <Trash2Icon /> Empty Trash
            </Button>
          </div>
        )}
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto border-t px-6">
          {shown.length ? (
            <ul aria-label="Deleted" className="flex flex-col divide-y">
              {shown.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-medium">{label(d)}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {[d.worldId && d.lead.collection !== 'worlds' ? nameOfWorld(d.worldId) : '', `Deleted ${relativeTime(d.at)}`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" aria-label={`Restore ${label(d)}`} onClick={() => restore(d)}>
                    <RotateCcwIcon /> Restore
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${label(d)} forever`} className="text-muted-foreground hover:text-destructive" onClick={() => forever(d)}>
                    Delete Forever
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Trash Is Empty">Deleted scenes, entries, maps and the rest wait here until you restore them or empty the Trash.</Empty>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Act II · The Tide and 2 more". */
function label(d: Deletion): string {
  const name = d.lead.name ? `${d.lead.noun} · ${d.lead.name}` : `Untitled ${d.lead.noun}`;
  return d.more ? `${name} and ${d.more} more` : name;
}
