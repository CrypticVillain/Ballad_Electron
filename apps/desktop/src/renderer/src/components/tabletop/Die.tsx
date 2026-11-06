import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { DiceLook } from '@/lib/diceLooks';
import { usePreferences } from '@/stores/preferences';
import { cachedDieImage, dieImage } from './dice3d/snapshot';

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

/** The dice look picked (Settings → Dice, the tray). */
export function useDiceLook(): DiceLook {
  return usePreferences((s) => s.diceLook);
}

/** The die as a 3D picture (dice3d/snapshot), once it's made; null until then or without WebGL. */
function useDieImage(sides: number, look: DiceLook, value: string) {
  const key = `${sides}|${look}|${value}`;
  const [made, setMade] = useState<{ key: string; url: string | null }>({ key: '', url: null });
  const cached = cachedDieImage(sides, look, value);
  useEffect(() => {
    if (cached) return;
    let live = true;
    void dieImage(sides, look, value).then((url) => live && setMade({ key, url }));
    return () => {
      live = false;
    };
  }, [cached, key, sides, look, value]);
  return cached ?? (made.key === key ? made.url : null);
}

/**
 * Die — one die as you'd see it lying on the table, three-quarters on, in 3D
 * (the same die the throw rolls); until that picture is ready, or without
 * WebGL, drawn flat in its shape (a d4's triangle, a d6's rounded square,
 * a d8's diamond, a d10's kite, a d12's pentagon, a d20's hexagon) and one of
 * the dice looks (styles/globals.css .die). `top` marks the highest roll on
 * the die (a natural 20); `dropped` a die that advantage set aside.
 */
export function Die({
  sides,
  value,
  look,
  size = 56,
  top,
  dropped,
  className,
  style,
}: {
  sides: number;
  value: number | string;
  look: DiceLook;
  size?: number;
  top?: boolean;
  dropped?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const image = useDieImage(sides, look, String(value));
  const shape = (DIE_SIDES as readonly number[]).includes(sides) ? String(sides) : 'other';
  if (image) {
    return (
      <img
        src={image}
        width={size}
        height={size}
        alt={`d${sides}: ${value}${dropped ? ' (dropped)' : ''}`}
        draggable={false}
        className={cn('shrink-0 drop-shadow-[0_3px_4px_rgb(0_0_0/0.25)] select-none', dropped && 'opacity-40', className)}
        style={style}
      />
    );
  }
  return (
    <span
      className={cn('die', className)}
      data-sides={shape}
      data-look={look}
      data-top={top ? '' : undefined}
      data-dropped={dropped ? '' : undefined}
      data-big={String(value).length > 2 ? '' : undefined}
      style={{ '--die-size': `${size}px`, ...style } as CSSProperties}
      aria-label={`d${sides}: ${value}${dropped ? ' (dropped)' : ''}`}
      role="img"
    >
      <span className="die-rim" />
      <span className="die-face" />
      <span className="die-num">{value}</span>
    </span>
  );
}
