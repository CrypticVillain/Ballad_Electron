import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, StarIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { mediaSrc, pickPicture } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateEntry } from '@/lib/actions';
import type { Entry } from '@/lib/model';
import { cn } from '@/lib/utils';

/**
 * Filmmaking → Locations: a location's scouting photos, on its page. Add
 * as many as you like; click one to see it large (and step through them);
 * star one to make it the location's picture.
 */
export function LocationPhotos({ entry, locked }: { entry: Entry; locked: boolean }) {
  const photos = entry.photos ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const add = async () => {
    const picked = await pickPicture();
    if (!picked) return;
    updateEntry(entry.id, { photos: [...photos, picked], ...(entry.image ? {} : { image: picked }) });
  };
  const remove = (i: number) => {
    const before = photos;
    const gone = photos[i];
    updateEntry(entry.id, { photos: photos.filter((_, k) => k !== i), ...(entry.image === gone ? { image: undefined } : {}) });
    toast('Photo Removed', { action: { label: 'Undo', onClick: () => updateEntry(entry.id, { photos: before, ...(entry.image === gone ? { image: gone } : {}) }) } });
  };
  const shown = open !== null ? photos[open] : undefined;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <Label>Scouting Photos</Label>
        <span className="font-mono text-[11px] text-muted-foreground">{photos.length || ''}</span>
      </div>
      {photos.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {photos.map((photo, i) => (
            <div key={`${photo}-${i}`} className="group/photo relative aspect-[4/3] overflow-hidden rounded-lg border">
              <button type="button" aria-label={`See photo ${i + 1}`} onClick={() => setOpen(i)} className="block size-full">
                <img src={mediaSrc(photo)} alt="" className="size-full object-cover" draggable={false} />
              </button>
              {!locked && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/photo:opacity-100 focus-within:opacity-100">
                  <Button variant="secondary" size="icon-xs" aria-label="Make it the location’s picture" onClick={() => updateEntry(entry.id, { image: photo })}>
                    <StarIcon className={cn(entry.image === photo && 'fill-current')} />
                  </Button>
                  <Button variant="secondary" size="icon-xs" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)}>
                    <XIcon />
                  </Button>
                </div>
              )}
              {entry.image === photo && <StarIcon className="absolute bottom-1 left-1 size-3.5 fill-amber-400 text-amber-400 drop-shadow" />}
            </div>
          ))}
          {!locked && (
            <button type="button" onClick={() => void add()} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[12px] text-muted-foreground hover:border-primary hover:text-foreground">
              <ImagePlusIcon className="size-5" /> Add
            </button>
          )}
        </div>
      ) : locked ? (
        <p className="text-[13px] text-muted-foreground">No photos yet.</p>
      ) : (
        <button type="button" onClick={() => void add()} className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-[13px] text-muted-foreground hover:border-primary hover:text-foreground">
          <ImagePlusIcon className="size-5" /> Add Scouting Photos
        </button>
      )}
      {shown && open !== null && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="sm:max-w-[960px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-black uppercase">
                {entry.name || 'Location'} · {open + 1} / {photos.length}
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <img src={mediaSrc(shown)} alt={`Photo ${open + 1} of ${entry.name}`} className="max-h-[70vh] w-full rounded-lg object-contain" />
              {photos.length > 1 && (
                <>
                  <Button variant="secondary" size="icon" aria-label="Previous photo" className="absolute top-1/2 left-2 -translate-y-1/2" onClick={() => setOpen((open - 1 + photos.length) % photos.length)}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label="Next photo" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setOpen((open + 1) % photos.length)}>
                    <ChevronRightIcon />
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
