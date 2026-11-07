import type { Fog } from '../model';

/**
 * Tabletop → Battle maps: fog of war over the map (in its own coordinates, so
 * it zooms and turns with it). A mask: everything covered, then each stroke
 * in order reveals (black) or hides again (white). The GM sees through it,
 * dimmed; players see solid black.
 */
export function FogLayer({ id, fog, width, height, gm }: { id: string; fog: Fog; width: number; height: number; gm: boolean }) {
  if (!fog.enabled) return null;
  const mask = `fog-${id}`;
  return (
    <svg aria-hidden data-fog className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          {fog.ops.map((op, i) =>
            op.shape === 'all' ? (
              <rect key={i} x={0} y={0} width={width} height={height} fill={op.mode === 'reveal' ? 'black' : 'white'} />
            ) : op.shape === 'brush' ? (
              op.points.length === 1 ? (
                <circle key={i} cx={op.points[0]!.x} cy={op.points[0]!.y} r={op.radius ?? 0} fill={op.mode === 'reveal' ? 'black' : 'white'} />
              ) : (
                <polyline key={i} points={op.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={op.mode === 'reveal' ? 'black' : 'white'} strokeWidth={(op.radius ?? 0) * 2} strokeLinecap="round" strokeLinejoin="round" />
              )
            ) : (
              <polygon key={i} points={op.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={op.mode === 'reveal' ? 'black' : 'white'} />
            ),
          )}
        </mask>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={gm ? '#0b0d14' : '#000'} fillOpacity={gm ? 0.55 : 1} mask={`url(#${mask})`} />
    </svg>
  );
}
