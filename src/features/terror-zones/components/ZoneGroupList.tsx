import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import { nextWindowPerZone, type TerrorZoneSchedule } from '../engine/schedule';
import { useClockValue } from '../store/clock';
import { formatIn, formatWhen } from '../utils/format';
import { WatchButton } from './ZoneParts';
import { CURRENT_ROW_CLASS, WATCHED_ROW_CLASS, zoneTitle } from '../utils/zoneDisplay';

interface ZoneGroupListProps {
  readonly schedule: TerrorZoneSchedule;
  readonly watched: ReadonlySet<string>;
  /** The slot index now (re-renders the "next time" column once per slot) */
  readonly slotKey: number;
}

/** Every zone group in file order: star toggle, the game's names, its areas (to the campaign map) and when it is next up. */
export function ZoneGroupList({ schedule, watched, slotKey }: ZoneGroupListProps) {
  const reference = schedule.bundle.config.start + slotKey * schedule.period;
  const next = nextWindowPerZone(schedule, Math.max(reference, schedule.bundle.config.start));
  // Minute resolution is enough for "in 3 h 20 min"
  const nowMinute = useClockValue((now) => Math.floor(now / 60) * 60);

  return (
    <ul className="space-y-1.5" aria-label="Zone groups">
      {schedule.bundle.zones.map((zone, index) => {
        const isWatched = watched.has(zone.id);
        const window = next[index] ?? null;
        const isNow = window !== null && window.start <= nowMinute && nowMinute < window.end;
        const areaNames = new Map<string, number>();
        for (const area of zone.areas) if (!areaNames.has(area.name)) areaNames.set(area.name, area.id);
        return (
          <li
            key={zone.id}
            className={cn('rounded-md border px-3 py-2', isWatched ? WATCHED_ROW_CLASS : isNow ? CURRENT_ROW_CLASS : 'bg-card')}
          >
            <div className="flex items-start gap-2">
              <WatchButton zone={zone} watched={isWatched} className="-my-0.5 -ml-1.5" />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm leading-snug', isWatched && 'font-semibold')}>{zoneTitle(zone)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {window === null ? (
                    'Not within the next weeks'
                  ) : isNow ? (
                    <span className="font-medium text-foreground">Terrorized now</span>
                  ) : (
                    <>
                      Next: <span className="font-medium text-foreground">{formatWhen(window.start, nowMinute)}</span> (
                      {formatIn(window.start - nowMinute)})
                    </>
                  )}
                </p>
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {areaNames.size} {areaNames.size === 1 ? 'area' : 'areas'} · {zone.id}
                  </summary>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {[...areaNames].map(([name, id]) => (
                      <li key={id}>
                        <Link to={campaignMapAreaPath(id)} className="underline-offset-2 hover:underline">
                          {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
