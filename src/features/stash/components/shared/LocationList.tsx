import { cn } from '@/lib/utils';
import { formatLocation, locationKey, type StashLocation } from '../../engine/locations';

/** "Page N · row R, col C", one per line */
export function LocationList({ locations, className }: { readonly locations: readonly StashLocation[]; readonly className?: string }) {
  return (
    <ul className={cn('space-y-0.5', className)}>
      {locations.map((location) => (
        <li key={locationKey(location)} className="whitespace-nowrap tabular-nums">
          {formatLocation(location)}
        </li>
      ))}
    </ul>
  );
}
