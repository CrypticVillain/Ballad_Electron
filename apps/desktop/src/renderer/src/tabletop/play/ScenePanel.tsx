import { useNavigate } from '@tanstack/react-router';
import { ImageIcon, SquareDashedIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { mediaSrc } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { deletePlayScene, pictureSize, updateGrid, updatePlayScene } from './actions';
import { BACKGROUNDS, type DiagonalRule, type GridKind, type PlayScene } from './model';
import { usePlayUi } from './ui';

/**
 * Tabletop → Play: a scene's settings, beside the board. Its name; the grid
 * (squares or hexes, its size and where it starts, how it looks, or hidden);
 * measuring (how far a square is, how diagonals count, snapping); and its
 * picture (replace it, or a blank scene's size and color).
 */

const KINDS: { value: GridKind; label: string }[] = [
  { value: 'square', label: 'Squares' },
  { value: 'hexRows', label: 'Hexes (Rows)' },
  { value: 'hexColumns', label: 'Hexes (Columns)' },
];

const LINE_COLORS = ['#000000', '#ffffff', '#64748b', '#b45309', '#2563eb'];

/** A number field that keeps what you type sensible. */
function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value === '' || !Number.isFinite(n)) return;
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
        className={FIELD}
      />
    </Field>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function ScenePanel({ scene }: { scene: PlayScene }) {
  const navigate = useNavigate();
  const setTool = usePlayUi((s) => s.setTool);
  const grid = scene.grid;
  const set = (changes: Parameters<typeof updateGrid>[1]) => updateGrid(scene.id, changes);
  const blank = !scene.image;
  const across = Math.round(scene.width / grid.size);
  const down = Math.round(scene.height / grid.size);

  const replace = async () => {
    const got = await window.api.files.importMap();
    if (!got) return;
    try {
      const size = await pictureSize(mediaSrc(got.file));
      updatePlayScene(scene.id, { image: got.file, ...size, credit: undefined });
    } catch {
      toast.error('That picture couldn’t be opened');
    }
  };

  const remove = () =>
    confirmDelete({
      noun: 'Scene',
      name: scene.name || 'Untitled Scene',
      area: 'tabletop:play',
      remove: () => deletePlayScene(scene.id),
      after: () => void navigate({ to: '/play' }),
    });

  return (
    <aside aria-label="Scene settings" className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l bg-background">
      <Section title="Scene">
        <Field label="Name">
          <Input value={scene.name} maxLength={80} onChange={(e) => updatePlayScene(scene.id, { name: e.target.value })} className={FIELD} />
        </Field>
      </Section>

      <Section title="Grid">
        <Toggle label="Show the grid" checked={grid.show} onChange={(show) => set({ show })} />
        <Field label="Shape">
          <SelectField label="Grid shape" value={grid.kind} options={KINDS} onChange={(kind) => set({ kind })} />
        </Field>
        <Button variant="outline" size="sm" onClick={() => setTool('lineup')}>
          <SquareDashedIcon /> Line Up With The Map
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label={grid.kind === 'square' ? 'Size (px)' : 'Width (px)'} value={grid.size} min={4} max={2000} step={0.5} onChange={(size) => set({ size })} />
          <NumberField label="Offset X" value={grid.offsetX} step={0.5} onChange={(offsetX) => set({ offsetX })} />
          <NumberField label="Offset Y" value={grid.offsetY} step={0.5} onChange={(offsetY) => set({ offsetY })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label">Lines</span>
          <div className="flex items-center gap-1.5">
            {LINE_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Lines ${c}`} aria-pressed={grid.color === c} onClick={() => set({ color: c })} className={cn('size-6 rounded-md border', grid.color === c && 'ring-2 ring-primary ring-offset-1 ring-offset-background')} style={{ background: c }} />
            ))}
            <input type="color" aria-label="Line color" value={grid.color} onChange={(e) => set({ color: e.target.value })} className="h-6 w-8 cursor-pointer rounded-md border bg-transparent" />
          </div>
          <input type="range" aria-label="Line opacity" min={0.05} max={1} step={0.05} value={grid.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} className="accent-primary" />
        </div>
      </Section>

      <Section title="Measuring">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={`One ${grid.kind === 'square' ? 'square' : 'hex'} is`} value={grid.distance} min={0.1} max={1000} step={0.5} onChange={(distance) => set({ distance })} />
          <Field label="Unit">
            <Input value={grid.unit} maxLength={8} onChange={(e) => set({ unit: e.target.value })} className={FIELD} />
          </Field>
        </div>
        {grid.kind === 'square' && (
          <Field label="Diagonals">
            <SelectField<DiagonalRule>
              label="Diagonals"
              value={grid.diagonals}
              onChange={(diagonals) => set({ diagonals })}
              options={[
                { value: 'fives', label: `Each is one square (${grid.distance} ${grid.unit})` },
                { value: 'alternating', label: `Alternate ${grid.distance} and ${grid.distance * 2} ${grid.unit}` },
                { value: 'euclidean', label: 'The exact distance' },
              ]}
            />
          </Field>
        )}
        <Toggle label={`Snap to the middle of ${grid.kind === 'square' ? 'squares' : 'hexes'}`} checked={grid.snap} onChange={(snap) => set({ snap })} />
      </Section>

      <Section title={blank ? 'Blank Scene' : 'Picture'}>
        {blank ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Across" value={across} min={1} max={200} onChange={(n) => updatePlayScene(scene.id, { width: Math.round(n * grid.size) })} />
              <NumberField label="Down" value={down} min={1} max={200} onChange={(n) => updatePlayScene(scene.id, { height: Math.round(n * grid.size) })} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUNDS.map((b) => (
                <button key={b.value} type="button" aria-label={b.label} aria-pressed={scene.background === b.value} onClick={() => updatePlayScene(scene.id, { background: b.value })} className={cn('size-6 rounded-md border', scene.background === b.value && 'ring-2 ring-primary ring-offset-1 ring-offset-background')} style={{ background: b.value }} />
              ))}
            </div>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            {scene.width} × {scene.height} px{scene.credit ? ` · ${scene.credit}` : ''}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => void replace()}>
          <ImageIcon /> {blank ? 'Use A Picture…' : 'Replace The Picture…'}
        </Button>
      </Section>

      <div className="mt-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={remove} className="w-full text-destructive hover:text-destructive">
          <Trash2Icon /> Delete Scene
        </Button>
      </div>
    </aside>
  );
}
