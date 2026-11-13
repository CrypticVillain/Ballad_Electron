/**
 * AppearancePanel.tsx — the suite's appearance controls, the same in every
 * app's Settings › Appearance and in the setup: a live preview, the style
 * gallery, light or dark, the text font, effects, and "Apply to all Monospace
 * apps".
 *
 * It only shows and reports: the app holds the appearance (and applies it with
 * applyAppearance.ts). The preview is a small app window drawn whole in the
 * style you point at (hover or keyboard focus; else the one in use): its
 * tokens (tokens.css lets any element carry its own data-style, and
 * data-mode="light" keeps it light inside a dark window) and its touches,
 * effects included (touches-preview.css, for [data-preview]). Light or dark is
 * the preview's own, so either can be seen without changing the app's.
 *
 * The source is the suite repo's themes/ folder (Monospace-Suite_Electron);
 * the copies in the apps are written by `npm run themes` there. Don't edit a copy.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { TEXT_FONTS, THEME_MODES, type Appearance } from '../../../../shared/themes/appearance';
import { DEFAULT_STYLE, STYLES, STYLE_SECTIONS, suiteStyle, type StyleId, type SuiteStyle } from '../../../../shared/themes/styles';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const LABEL = 'font-mono text-[10.5px] tracking-[var(--label-tracking)] text-muted-foreground uppercase';
const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const subscribeDark = (onChange: () => void) => {
  darkQuery.addEventListener('change', onChange);
  return () => darkQuery.removeEventListener('change', onChange);
};

function Segments<T extends string>({ label, value, options, onPick, small }: { label: string; value: T; options: readonly { id: T; name: string }[]; onPick: (id: T) => void; small?: boolean }) {
  return (
    <div role="group" aria-label={label} className={cx('flex gap-1 rounded-[calc(var(--radius)+2px)] border border-border bg-muted', small ? 'p-0.5' : 'p-1')}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={cx(
            'min-w-0 flex-1 rounded-[var(--radius)] border font-medium whitespace-nowrap',
            small ? 'h-[24px] px-2.5 text-xs' : 'h-[32px] px-2 text-[13px]',
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

/**
 * A small app window in one style: module bar, sidebar, a page with a heading,
 * text, buttons and an avatar, and the status bar. It carries the same hooks
 * the apps give touches.css (.rail-ink, data-surface, .font-display,
 * .uppercase, data-slot), so it shows what the style does to them.
 */
export function StylePreview({ style, mode, text, effects, className }: { style: StyleId; mode: 'light' | 'dark'; text: Appearance['text']; effects: Appearance['effects']; className?: string }) {
  const label = 'uppercase font-mono text-[9.5px] tracking-[var(--label-tracking)] text-muted-foreground';
  return (
    <div
      aria-hidden
      data-preview=""
      data-style={style}
      data-mode={mode}
      data-text={text}
      data-effects={effects}
      className={cx('relative isolate flex h-[180px] flex-col overflow-hidden rounded-[calc(var(--radius)+4px)] border border-rail-border bg-rail font-sans text-foreground select-none', mode === 'dark' && 'dark', className)}
    >
      <div className="flex min-h-0 flex-1">
        <div className="rail-ink flex w-11 shrink-0 flex-col items-center gap-1.5 bg-rail py-2.5">
          <span className="grid size-7 place-items-center rounded-[var(--tile-radius)] bg-primary text-[11px] font-bold text-primary-foreground">B</span>
          <span className="grid size-7 place-items-center rounded-[var(--tile-radius)] border border-rail-border bg-rail-item text-[11px] font-bold">H</span>
          <span className="grid size-7 place-items-center rounded-[var(--tile-radius)] border border-rail-border bg-rail-item text-[11px] font-bold">O</span>
        </div>
        <div className="flex w-[136px] shrink-0 flex-col gap-0.5 rounded-tl-[var(--radius)] border-r border-sidebar-border bg-sidebar px-2 py-2.5 text-[12px] text-sidebar-foreground">
          <span className={cx(label, 'px-1.5 pb-1')}>Chapters</span>
          <span className="truncate rounded-[calc(var(--radius)-2px)] bg-sidebar-accent px-1.5 py-1 font-medium text-sidebar-accent-foreground">Low Water</span>
          <span className="flex items-center gap-1.5 px-1.5 py-1">
            <span className="truncate">The Lamp</span>
            <span className="led-unread ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-unread px-1 font-mono text-[9px] font-bold text-unread-foreground">2</span>
          </span>
          <span className="truncate px-1.5 py-1">What It Uncovered</span>
        </div>
        <div data-surface="page" className="flex min-w-0 flex-1 flex-col gap-1.5 bg-background px-4 py-3">
          <span className={label}>Chapter one</span>
          <span className="font-display truncate text-[24px] leading-tight">Low Water</span>
          <p className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
            The tide went out further than anyone alive had seen, and it did not come back. By noon the harbor was a field of wet glass.
          </p>
          <div className="mt-auto flex items-center gap-2">
            <span data-slot="button" data-variant="default" data-size="sm" className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium whitespace-nowrap text-primary-foreground">
              Save
            </span>
            <span data-slot="button" data-variant="outline" data-size="sm" className="inline-flex h-7 items-center rounded-md border border-input bg-background px-3 text-xs font-medium whitespace-nowrap">
              Share
            </span>
            <span className="truncate text-xs text-link underline underline-offset-2">Notes</span>
            <span data-slot="avatar" className="ml-auto grid size-6 shrink-0 place-items-center rounded-md bg-avatar-1 text-[10px] font-semibold text-avatar-foreground">
              W
            </span>
          </div>
        </div>
      </div>
      <div className="rail-ink flex h-6 shrink-0 items-center gap-2 bg-rail px-3 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
        <span className="led-online size-1.5 shrink-0 rounded-full bg-online" />
        <span>Saved</span>
        <span>· 412 words</span>
        <span className="ml-auto">Ctrl K Search</span>
      </div>
    </div>
  );
}

function StyleTile({ style, picked, onPick, onPoint }: { style: SuiteStyle; picked: boolean; onPick: () => void; onPoint: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      title={style.blurb}
      onClick={onPick}
      onMouseEnter={() => onPoint(true)}
      onFocus={() => onPoint(true)}
      onBlur={() => onPoint(false)}
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
      <span className="flex items-baseline justify-between gap-1 px-0.5">
        <span className="truncate text-xs leading-tight font-semibold">{style.name}</span>
        {style.id === DEFAULT_STYLE && <span className="shrink-0 text-[10px] leading-tight text-muted-foreground">Default</span>}
      </span>
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
  // The style the preview shows: the one pointed at, else the one in use.
  const [pointed, setPointed] = useState<StyleId | null>(null);
  const shown = suiteStyle(pointed ?? value.style);
  // Light or dark: the preview's own once picked; until then, the app's.
  const systemDark = useSyncExternalStore(subscribeDark, () => darkQuery.matches);
  const appMode = value.theme === 'system' ? (systemDark ? 'dark' : 'light') : value.theme;
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | null>(null);
  const mode = previewMode ?? appMode;

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      {/* Stays in view while the gallery scrolls under it, so a style can be pointed at and seen at once. */}
      <div className="sticky top-0 z-10 -mt-1 flex flex-col gap-2 bg-background pt-1 pb-1">
        <div className="flex items-center justify-between gap-3">
          <span className={LABEL}>Preview</span>
          <Segments
            small
            label="Preview in"
            value={mode}
            options={[
              { id: 'light', name: 'Light' },
              { id: 'dark', name: 'Dark' },
            ]}
            onPick={setPreviewMode}
          />
        </div>
        <StylePreview style={shown.id} mode={mode} text={value.text} effects={value.effects} />
        <p className="min-h-[2lh] text-xs leading-snug text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{shown.name}</span>
          {shown.id === value.style ? ' · in use. ' : ' · click to use it. '}
          {shown.blurb}
          {shown.signature && ` Drawn around ${shown.signature} mode; both work.`}
        </p>
      </div>

      <div className="flex flex-col gap-3" onMouseLeave={() => setPointed(null)}>
        {STYLE_SECTIONS.map((section) => (
          <div key={section.name} className="flex flex-col gap-2">
            <span className={LABEL}>{section.name}</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
              {STYLES.filter((s) => section.groups.includes(s.group)).map((s) => (
                <StyleTile
                  key={s.id}
                  style={s}
                  picked={s.id === value.style}
                  onPick={() => onChange({ style: s.id })}
                  onPoint={(on) => setPointed((was) => (on ? s.id : was === s.id ? null : was))}
                />
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs leading-snug text-muted-foreground">
          Point at a style to preview it above. <span className="font-semibold text-foreground">{current.name}</span> is in use.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Theme</span>
          <Segments
            label="Theme"
            value={value.theme}
            options={THEME_MODES}
            onPick={(theme) => {
              setPreviewMode(null);
              onChange({ theme });
            }}
          />
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
