import { cn } from '@/lib/utils';
import type { AreaTerrain } from '@/features/game-data/engine/schema';
import { TERRAIN_CLASS } from './canvas/canvasStyles';

interface TerrainDotProps {
  readonly terrain: AreaTerrain;
  /** Side in CSS pixels */
  readonly size?: number;
  readonly className?: string;
}

/** The map's station dot for a terrain (a town is a square), for the legend, the list and the cards. */
export function TerrainDot({ terrain, size = 14, className }: TerrainDotProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden className={cn('shrink-0', className)}>
      {terrain === 'town' ? (
        <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" strokeWidth="1.5" className={TERRAIN_CLASS[terrain]} />
      ) : (
        <circle cx="7" cy="7" r="5.5" strokeWidth="1.5" className={TERRAIN_CLASS[terrain]} />
      )}
    </svg>
  );
}
