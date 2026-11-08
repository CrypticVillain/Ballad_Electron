import { useMemo } from 'react';
import { segments, visibility, type Lighting, type LightSource, type Viewer, type Wall } from '../geometry/vision';

/**
 * Tabletop → Battle maps: the dark over what a player can't see (line of
 * sight on). It's a mask: dark everywhere, but each of their tokens' sight
 * (stopped by walls) shows through, all of it in bright or dim light (dim:
 * shaded), and in the dark only what a light reaches (in the light's own
 * sight) or their darkvision does.
 */
export function VisionLayer({ id, width, height, walls, lighting, viewers, lights }: { id: string; width: number; height: number; walls: Wall[]; lighting: Lighting; viewers: Viewer[]; lights: LightSource[] }) {
  const segs = useMemo(() => segments(walls, width, height), [walls, width, height]);
  const sight = useMemo(() => viewers.map((v) => visibility(v, segs)), [viewers, segs]);
  const lit = useMemo(() => lights.map((l) => visibility(l, segs)), [lights, segs]);
  const key = id.replace(/[^\w-]/g, '');
  const points = (poly: { x: number; y: number }[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');
  const glow = (
    <>
      {lights.map((l, j) => (
        <circle key={j} cx={l.x} cy={l.y} r={l.reach} fill="black" clipPath={`url(#light-${key}-${j})`} />
      ))}
    </>
  );
  return (
    <svg aria-hidden data-vision className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        {sight.map((poly, i) => (
          <clipPath key={i} id={`sight-${key}-${i}`}>
            <polygon points={points(poly)} />
          </clipPath>
        ))}
        {lit.map((poly, j) => (
          <clipPath key={j} id={`light-${key}-${j}`}>
            <polygon points={points(poly)} />
          </clipPath>
        ))}
        <mask id={`vision-${key}`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          {viewers.map((v, i) => (
            <g key={i} clipPath={`url(#sight-${key}-${i})`}>
              {lighting === 'dark' ? (
                <>
                  {v.darkvision > 0 && <circle cx={v.x} cy={v.y} r={v.darkvision} fill="#333" />}
                  {glow}
                </>
              ) : (
                <>
                  <rect width={width} height={height} fill={lighting === 'dim' ? '#555' : 'black'} />
                  {lighting === 'dim' && glow}
                </>
              )}
            </g>
          ))}
        </mask>
      </defs>
      <rect width={width} height={height} fill="#04060a" mask={`url(#vision-${key})`} />
    </svg>
  );
}
