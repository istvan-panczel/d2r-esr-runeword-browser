import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TerrorZoneGroup } from '@/features/game-data/engine/schema';
import { useNow } from '../store/clock';
import { toggleWatchedZone } from '../store/preferences';
import { formatCountdown } from '../utils/format';
import { zoneTitle } from '../utils/zoneDisplay';

interface WatchButtonProps {
  readonly zone: TerrorZoneGroup;
  readonly watched: boolean;
  readonly className?: string;
}

/** Star toggle of a zone group's watch state (stored in this browser). */
export function WatchButton({ zone, watched, className }: WatchButtonProps) {
  const name = zoneTitle(zone);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-7 shrink-0', className)}
      aria-pressed={watched}
      aria-label={watched ? `Stop watching ${name}` : `Watch ${name}`}
      title={watched ? 'Watched: click to stop watching' : 'Watch this zone group'}
      onClick={() => {
        toggleWatchedZone(zone.id);
      }}
    >
      <Star className={cn('size-4', watched ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
    </Button>
  );
}

/** "45:12" until `until` (Unix seconds); the only part that re-renders every second. */
export function Countdown({ until, className }: { readonly until: number; readonly className?: string }) {
  const now = useNow();
  return (
    <time className={cn('tabular-nums', className)} dateTime={new Date(until * 1000).toISOString()}>
      {formatCountdown(until - now)}
    </time>
  );
}
