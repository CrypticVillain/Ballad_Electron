/**
 * AppearancePanel.tsx — the suite's appearance controls, the same in every
 * app's Settings › Appearance and in the setup: the style gallery, light or
 * dark, the text font, effects, and "Apply to all Monospace apps".
 *
 * It only shows and reports: the app holds the appearance (and applies it with
 * applyAppearance.ts). Each preview tile is drawn in its own style's tokens:
 * tokens.css lets any element carry its own data-style.
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
import type { ReactNode } from 'react';
import { TEXT_FONTS, THEME_MODES, type Appearance } from '../../../../shared/themes/appearance';
import { STYLES, STYLE_SECTIONS, suiteStyle, type SuiteStyle } from '../../../../shared/themes/styles';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const LABEL = 'font-mono text-[10.5px] tracking-[var(--label-tracking)] text-muted-foreground uppercase';
const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Segments<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: readonly { id: T; name: string }[]; onPick: (id: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-[calc(var(--radius)+2px)] border border-border bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={cx(
            'h-[32px] min-w-0 flex-1 rounded-[var(--radius)] border px-2 text-[13px] font-medium whitespace-nowrap',
            FOCUS,
            value === o.id ? 'border-border bg-card text-foreground shadow-xs' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

function StyleTile({ style, picked, onPick }: { style: SuiteStyle; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      title={style.blurb}
      onClick={onPick}
      className={cx(
        'flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-1.5 text-left transition-[box-shadow,border-color]',
        FOCUS,
        picked ? 'border-primary shadow-[0_0_0_1px_var(--primary)]' : 'border-border hover:border-input',
      )}
    >
      {/* A tiny window in that style: rail, page, heading, key. */}
      <span data-style={style.id} className="flex h-[46px] w-full rounded-[min(var(--radius),6px)] border border-rail-border bg-rail py-1 pr-1 pl-3">
        <span className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden rounded-[min(calc(var(--radius)-2px),4px)] border border-border bg-background px-1.5 py-1 text-foreground">
          <span className="text-[13px] leading-none whitespace-nowrap" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as never }}>
            Aa
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[6px] w-4 rounded-[min(var(--radius),3px)] bg-primary" />
            <span className="h-[2px] flex-1 rounded-full bg-input" />
          </span>
        </span>
      </span>
      <span className="truncate px-0.5 text-xs leading-tight font-semibold">{style.name}</span>
    </button>
  );
}

export interface AppearancePanelProps {
  value: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
  /** Shows "Apply to all Monospace apps" (the apps; the setup applies to all anyway). */
  onApplyAll?: () => void;
  /** Said beside the button after it's pressed ("Applied to all Monospace apps"). */
  applyAllNote?: string;
  /** More controls for this app, after the shared ones (the setup's app icon). */
  children?: ReactNode;
  className?: string;
}

export function AppearancePanel({ value, onChange, onApplyAll, applyAllNote, children, className }: AppearancePanelProps) {
  const current = suiteStyle(value.style);
  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-3">
        {STYLE_SECTIONS.map((section) => (
          <div key={section.name} className="flex flex-col gap-2">
            <span className={LABEL}>{section.name}</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
              {STYLES.filter((s) => section.groups.includes(s.group)).map((s) => (
                <StyleTile key={s.id} style={s} picked={s.id === value.style} onPick={() => onChange({ style: s.id })} />
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">{current.name}.</span> {current.blurb}
          {current.signature && ` Drawn around ${current.signature} mode; both work.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Theme</span>
          <Segments label="Theme" value={value.theme} options={THEME_MODES} onPick={(theme) => onChange({ theme })} />
          <span className="text-xs leading-snug text-muted-foreground">Match Windows follows your light or dark mode, and changes when it does.</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Text font</span>
          <Segments label="Text font" value={value.text} options={TEXT_FONTS} onPick={(text) => onChange({ text })} />
          <span className="text-xs leading-snug text-muted-foreground">{TEXT_FONTS.find((t) => t.id === value.text)!.blurb} Plain is Inter Tight.</span>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={value.effects === 'reduced'}
            onChange={(e) => onChange({ effects: e.target.checked ? 'reduced' : 'full' })}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">Reduce effects</span>
            <span className="text-xs leading-snug text-muted-foreground">No scanlines, grain, glow or blinking. Always on when Windows has animations off.</span>
          </span>
        </label>
        {children}
      </div>

      {onApplyAll && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            data-slot="button"
            data-variant="outline"
            onClick={onApplyAll}
            className={cx('h-9 rounded-md border border-input bg-background px-4 text-sm font-medium whitespace-nowrap hover:bg-accent hover:text-accent-foreground', FOCUS)}
          >
            Apply to all Monospace apps
          </button>
          <span className="text-xs leading-snug text-muted-foreground" aria-live="polite">
            {applyAllNote ?? 'Harmony, Overture, Ballad and Libretto take this look, open or not. Each can still be changed on its own afterwards.'}
          </span>
        </div>
      )}
    </div>
  );
}
