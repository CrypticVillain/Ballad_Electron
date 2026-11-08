import { CloudFogIcon, EyeIcon, EyeOffIcon, ImageIcon, SquareDashedIcon, BrickWallIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { mediaSrc } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { pictureSize } from './MapSourcePicker';
import { addFogOp } from './geometry/fog';
import { BACKGROUNDS, defaultFog, type BattleMap, type DiagonalRule, type GridKind, type GridSettings } from './model';
import { useBoardUi } from './ui';

/**
 * Tabletop → Battle maps: a map's settings, beside the board (an encounter's
 * map in Tabletop, a scene in Play). The grid (squares or hexes, its size and
 * where it starts, how it looks, or hidden); measuring (how far a square is,
 * how diagonals count, snapping); fog of war (on or off, reveal or cover
 * everything, draw it with F); and the picture (replace it, or a blank map's
 * size and color). `children` come first (a scene's name), `footer` last.
 */

const KINDS: { value: GridKind; label: string }[] = [
  { value: 'square', label: 'Squares' },
  { value: 'hexRows', label: 'Hexes (Rows)' },
  { value: 'hexColumns', label: 'Hexes (Columns)' },
];

const LINE_COLORS = ['#000000', '#ffffff', '#64748b', '#b45309', '#2563eb'];

/** A number field that keeps what you type sensible. */
export function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
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

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
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

export function MapPanel({ map, onChange, label, header, children, footer }: { map: BattleMap; onChange: (changes: Partial<BattleMap>) => void; label: string; header?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  const setTool = useBoardUi((s) => s.setTool);
  const grid = map.grid;
  const fog = map.fog ?? defaultFog();
  const set = (changes: Partial<GridSettings>) => onChange({ grid: { ...grid, ...changes } });
  const blank = !map.image;
  const across = Math.round(map.width / grid.size);
  const down = Math.round(map.height / grid.size);

  const replace = async () => {
    const got = await window.api.files.importMap();
    if (!got) return;
    try {
      const size = await pictureSize(mediaSrc(got.file));
      onChange({ image: got.file, ...size, credit: undefined });
    } catch {
      toast.error('That picture couldn’t be opened');
    }
  };

  return (
    <aside aria-label={label} className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l bg-background">
      {header}
      {children}

      <PanelSection title="Grid">
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
      </PanelSection>

      <PanelSection title="Measuring">
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
      </PanelSection>

      <PanelSection title="Sight And Light">
        <Toggle label="Line of sight" checked={Boolean(map.vision?.enabled)} onChange={(enabled) => onChange({ vision: { lighting: 'bright', ...map.vision, enabled } })} />
        <p className="text-[12px] text-muted-foreground">{map.vision?.enabled ? 'Players see only what their tokens see: walls block it, and in the dark only what’s lit or in darkvision.' : 'Off: walls don’t block the players’ view.'}</p>
        {map.vision?.enabled && (
          <Field label="Light">
            <SelectField
              label="Light"
              value={map.vision.lighting}
              options={[
                { value: 'bright' as const, label: 'Bright' },
                { value: 'dim' as const, label: 'Dim (in sight, shaded)' },
                { value: 'dark' as const, label: 'Dark (only what’s lit)' },
              ]}
              onChange={(lighting) => onChange({ vision: { ...map.vision!, lighting } })}
            />
          </Field>
        )}
        <Button variant="outline" size="sm" onClick={() => setTool('walls')}>
          <BrickWallIcon /> Draw Walls (W){map.walls?.length ? ` · ${map.walls.length}` : ''}
        </Button>
      </PanelSection>

      <PanelSection title="Fog Of War">
        <Toggle label="Fog of war" checked={fog.enabled} onChange={(enabled) => onChange({ fog: { ...fog, enabled } })} />
        <p className="text-[12px] text-muted-foreground">{fog.enabled ? 'Players see only what you reveal; you see through it, dimmed.' : 'Off: the players see the whole map.'}</p>
        <Button variant="outline" size="sm" onClick={() => setTool('fog')}>
          <CloudFogIcon /> Draw Fog (F)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange({ fog: addFogOp({ ...fog, enabled: true }, { mode: 'reveal', shape: 'all', points: [] }) })}>
            <EyeIcon /> Reveal All
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange({ fog: addFogOp({ ...fog, enabled: true }, { mode: 'hide', shape: 'all', points: [] }) })}>
            <EyeOffIcon /> Cover All
          </Button>
        </div>
      </PanelSection>

      <PanelSection title={blank ? 'Blank Map' : 'Picture'}>
        {blank ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Across" value={across} min={1} max={200} onChange={(n) => onChange({ width: Math.round(n * grid.size) })} />
              <NumberField label="Down" value={down} min={1} max={200} onChange={(n) => onChange({ height: Math.round(n * grid.size) })} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUNDS.map((b) => (
                <button key={b.value} type="button" aria-label={b.label} aria-pressed={map.background === b.value} onClick={() => onChange({ background: b.value })} className={cn('size-6 rounded-md border', map.background === b.value && 'ring-2 ring-primary ring-offset-1 ring-offset-background')} style={{ background: b.value }} />
              ))}
            </div>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            {map.width} × {map.height} px{map.credit ? ` · ${map.credit}` : ''}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => void replace()}>
          <ImageIcon /> {blank ? 'Use A Picture…' : 'Replace The Picture…'}
        </Button>
      </PanelSection>
      {footer}
    </aside>
  );
}
