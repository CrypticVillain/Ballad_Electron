import { ImageIcon, ImagePlusIcon, XIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Hint } from '@/components/shared/Hint';
import { useLive } from '@/lib/hooks';
import { now } from '@/lib/model';
import { initials } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';

/**
 * Portrait — a character's, NPC's, place's, creature's, item's or spell's
 * picture, or (with none) its initials or icon, in the same spot: big on its
 * sheet, small in lists and search. Pictures are files beside the vault
 * (ballad-media://maps/…), like maps; a data: URL works too.
 */
let mediaOwner: string | null = null;
/** Whose pictures and music to load: a Play window for another account's campaign loads its owner's (online: the server's). */
export const setMediaOwner = (owner: string | null) => {
  mediaOwner = owner;
};
const ownerQuery = () => (mediaOwner ? `?owner=${encodeURIComponent(mediaOwner)}` : '');
export const mediaSrc = (image: string) => (image.startsWith('data:') ? image : `ballad-media://maps/${encodeURIComponent(image)}${ownerQuery()}`);
/** A music track's file (tabletop/music). */
export const musicSrc = (file: string) => `ballad-media://music/${encodeURIComponent(file)}${ownerQuery()}`;

export function Portrait({ image, name, className, text, icon }: { image?: string; name: string; className?: string; text?: string; icon?: boolean }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden', !image && (icon ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background'), className)}>
      {image ? (
        <img src={mediaSrc(image)} alt="" className="size-full object-cover" draggable={false} />
      ) : icon ? (
        <ImageIcon className="size-1/2 max-h-6 max-w-6 opacity-70" />
      ) : (
        <span className={cn('font-mono leading-none', text)}>{initials(name || '?')}</span>
      )}
    </span>
  );
}

/** The longest side a picture is kept at: big enough for a sheet, small enough for the vault. */
const MAX_SIDE = 1024;

/** Shrinks a picked image to MAX_SIDE (as webp; a png or jpg if webp isn't to be had). */
async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob: png ?? file, ext: 'png' };
}

/**
 * Asks for a picture (the system's Open dialog, from the window itself),
 * shrinks it and keeps it beside the vault: its file, or null if cancelled.
 * Without the app's save (a session started before it existed) it's kept as
 * a data: URL instead, so a pick always lands.
 */
export function pickPicture(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const { blob, ext } = await shrink(file);
        const saved = window.api.files.savePicture ? await window.api.files.savePicture(new Uint8Array(await blob.arrayBuffer()), ext) : null;
        if (saved) return resolve(saved.file);
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      } catch {
        toast.error('That picture couldn’t be opened', { description: 'Try a PNG, JPG or WebP image.' });
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * A portrait you can change: click it to pick a picture (when `editable`),
 * the × takes it off again. `children` is the portrait itself.
 */
export function PortraitPicker({ image, label, editable, onChange, children, className }: { image?: string; label: string; editable: boolean; onChange: (image: string | undefined) => void; children: ReactNode; className?: string }) {
  if (!editable) return <span className={className}>{children}</span>;
  return (
    <span className={cn('group/portrait relative', className)}>
      <Hint label={image ? `Change the picture of ${label}` : `Add a picture of ${label}`}>
        <button
          type="button"
          aria-label={image ? `Change the picture of ${label}` : `Add a picture of ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            void pickPicture().then((file) => file && onChange(file));
          }}
          className="relative block size-full rounded-[inherit]"
        >
          {children}
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/45 text-white opacity-0 transition-opacity group-hover/portrait:opacity-100 group-focus-visible/portrait:opacity-100">
            <ImagePlusIcon className="size-5" />
          </span>
        </button>
      </Hint>
      {image && (
        <Hint label="Take the picture off">
          <button
            type="button"
            aria-label={`Take the picture of ${label} off`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm group-hover/portrait:opacity-100 hover:text-foreground focus-visible:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        </Hint>
      )}
    </span>
  );
}

// ── Pictures of things that aren't records (spells, items, Library entries) ──

/**
 * The key a thing's picture is kept under: its kind and id (a spell and an
 * item can share an id: "shield"). An NPC from the Library is a creature.
 */
export const pictureKey = (kind: string, id: string) => `${kind === 'npcs' ? 'monsters' : kind}:${id}`;

/** Every such picture, by its key (pictureKey). */
export function usePictures(): Map<string, string> {
  const pictures = useLive('pictures');
  return useMemo(() => new Map(pictures.map((p) => [p.id, p.image])), [pictures]);
}

/**
 * Pictures of one kind (spells, items) by name, lowercased: for a character's
 * sheet, whose spells and items are kept by name, not by the compendium's id.
 */
export function usePicturesByName(kind: string): Map<string, string> {
  const pictures = useLive('pictures');
  return useMemo(() => new Map(pictures.filter((p) => p.name && p.id.startsWith(`${kind}:`)).map((p) => [p.name!.trim().toLowerCase(), p.image])), [pictures, kind]);
}

/** Gives a thing a picture (remembering its name), or (undefined) takes it off. */
export function setPicture(id: string, image: string | undefined, name?: string) {
  const store = useVault.getState();
  if (!image) {
    if (store.vault.pictures[id]) store.purge('pictures', id);
    return;
  }
  const t = now();
  const had = store.vault.pictures[id];
  store.put('pictures', { id, image, name, createdAt: had?.createdAt ?? t, updatedAt: t, deletedAt: null });
}

/** A thing's picture beside its name, at the far right of its header (Library, Spells, Inventory): click to add or change it. */
export function HeaderPicture({ id, image, label, editable = true }: { id: string; image?: string; label: string; editable?: boolean }) {
  return (
    <PortraitPicker image={image} label={label} editable={editable} onChange={(next) => setPicture(id, next, label)} className="block size-24 shrink-0 rounded-2xl border @2xl:size-28">
      <Portrait image={image} name={label} icon className="size-full rounded-2xl" />
    </PortraitPicker>
  );
}

/** A thing's picture, small, at the far right of its row in a list (only if it has one). */
export function RowPicture({ image, className }: { image?: string; className?: string }) {
  return image ? <Portrait image={image} name="" className={cn('ml-1 size-8 rounded-md border', className)} /> : null;
}
