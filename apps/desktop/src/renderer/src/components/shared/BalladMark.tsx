import { cn } from '@/lib/utils';

/** The B, drawn as strokes. */
const B = 'M42 30v60M42 30h18a15 15 0 0 1 0 30H42M42 60h22a15 15 0 0 1 0 30H42';
/** The ember: three level-meter bars (x, y, height), each 7 wide. */
const BARS = [
  [70, 24, 13],
  [79, 13, 24],
  [88, 19, 18],
] as const;

/**
 * The Ballad mark ("Meter Ember", concept 19 on the design canvas): a bold B
 * with a three-bar level meter for its ember. It takes the theme's colors:
 * the tile is the foreground color, the B the background, the bars the
 * accent (each ringed in the tile color, which cuts it out of the B). `bare`
 * leaves out the tile. The app icon is the same drawing with fixed colors:
 * build/icon.svg.
 */
export function BalladMark({ bare = false, className }: { bare?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('shrink-0', className)} role="img" aria-label="Ballad">
      {!bare && <rect width="120" height="120" rx="28" className="fill-foreground" />}
      <path d={B} fill="none" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className={bare ? 'stroke-foreground' : 'stroke-background'} />
      {BARS.map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="7" height={h} rx="3.5" strokeWidth="4" className={cn('fill-primary', bare ? 'stroke-rail' : 'stroke-foreground')} />
      ))}
    </svg>
  );
}

/** The app icon itself, dark or light, in its fixed colors (build/icon.svg, build/icon-light.svg): Settings → Appearance → App Icon. */
export function AppIconArt({ variant, className }: { variant: 'dark' | 'light'; className?: string }) {
  const [tile, ink, edge] = variant === 'dark' ? ['#141414', '#f1efea', 'none'] : ['#f1efea', '#141414', '#d6d2ca'];
  return (
    <svg viewBox="0 0 120 120" className={cn('shrink-0', className)} aria-hidden>
      <rect x="0.75" y="0.75" width="118.5" height="118.5" rx="27.4" fill={tile} stroke={edge} strokeWidth="1.5" />
      <path d={B} fill="none" stroke={ink} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      {BARS.map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="7" height={h} rx="3.5" fill="#ff4a1c" stroke={tile} strokeWidth="4" />
      ))}
    </svg>
  );
}
