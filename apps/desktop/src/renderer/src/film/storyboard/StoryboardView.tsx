import { ImagePlusIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { mediaSrc, pickPicture } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { createShot, updateRecord } from '@/lib/actions';
import type { Shot } from '@/lib/model';
import { cn } from '@/lib/utils';
import { FramePad } from './FramePad';

/**
 * Filmmaking → Storyboard: each scene's shots as frames in a grid, in
 * order, with what's in them. A frame is a picture you upload, a drawing,
 * or a drawing over the picture (FramePad: handwriting's tools; the picture
 * is never changed, and the drawing can be drawn on again).
 */

export type BoardScene = { id: string; number: string; title: string };

export function StoryboardView({ scenes, shots, worldId }: { scenes: BoardScene[]; shots: Shot[]; worldId: string }) {
  const [sketching, setSketching] = useState<{ shot: Shot; label: string } | null>(null);
  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      {scenes.map((scene) => {
        const own = shots.filter((s) => s.sceneId === scene.id).sort((a, b) => a.order - b.order);
        return (
          <section key={scene.id} className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-link">SCENE {scene.number}</span>
              <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{scene.title || 'Untitled Scene'}</h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {own.filter((s) => s.frame).length} / {own.length} Framed
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {own.map((shot, i) => {
                const label = `${scene.number}.${i + 1}`;
                return <Frame key={shot.id} shot={shot} label={label} onSketch={() => setSketching({ shot, label })} />;
              })}
              <button
                type="button"
                onClick={() => createShot(worldId, scene.id, own.at(-1) ? { size: own.at(-1)!.size, lens: own.at(-1)!.lens } : {})}
                className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] text-muted-foreground hover:border-primary hover:text-foreground"
              >
                <PlusIcon className="size-5" /> Add Shot
              </button>
            </div>
          </section>
        );
      })}
      {sketching && (
        <FramePad title={`Shot ${sketching.label}`} shot={sketching.shot} onSave={(frame) => updateRecord('shots', sketching.shot.id, { ...frame, sketch: undefined })} onClose={() => setSketching(null)} />
      )}
    </div>
  );
}

function Frame({ shot, label, onSketch }: { shot: Shot; label: string; onSketch: () => void }) {
  const upload = async () => {
    const picked = await pickPicture();
    if (picked) updateRecord('shots', shot.id, { frame: picked, base: picked, ink: [], sketch: undefined });
  };
  return (
    <article className={cn('group/frame flex flex-col gap-1.5', shot.status === 'cut' && 'opacity-50')}>
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted/40">
        {shot.frame ? (
          <img src={mediaSrc(shot.frame)} alt={`Frame for shot ${label}`} className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void upload()}>
              <ImagePlusIcon /> Picture
            </Button>
            <Button variant="outline" size="sm" onClick={onSketch}>
              <PencilIcon /> Draw
            </Button>
          </div>
        )}
        {shot.frame && (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/frame:opacity-100 focus-within:opacity-100">
            <Button variant="secondary" size="icon-xs" aria-label={`New picture for shot ${label}`} onClick={() => void upload()}>
              <ImagePlusIcon />
            </Button>
            <Button variant="secondary" size="icon-xs" aria-label={`Draw on shot ${label}`} onClick={onSketch}>
              <PencilIcon />
            </Button>
            <Button variant="secondary" size="icon-xs" aria-label={`Take the frame off shot ${label}`} onClick={() => updateRecord('shots', shot.id, { frame: undefined, base: null, ink: [], sketch: undefined })}>
              <XIcon />
            </Button>
          </div>
        )}
        <span className="absolute bottom-1.5 left-1.5 rounded bg-background/85 px-1.5 font-mono text-[10.5px]">
          {label} · {shot.size} · {shot.move}
          {shot.lens && ` · ${shot.lens}`}
        </span>
      </div>
      <textarea
        aria-label={`What we see in shot ${label}`}
        rows={2}
        value={shot.description}
        placeholder="What we see…"
        onChange={(e) => updateRecord('shots', shot.id, { description: e.target.value })}
        className="resize-none bg-transparent text-[13px] leading-snug outline-none placeholder:text-muted-foreground/50"
      />
    </article>
  );
}
