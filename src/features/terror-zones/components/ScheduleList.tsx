import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { windowsFrom, type TerrorZoneSchedule, type TerrorZoneSlot } from '../engine/schedule';
import { useClockValue } from '../store/clock';
import { formatClockRange, formatDayLabel, formatWhen, localDayKey } from '../utils/format';
import { filterSlots } from '../utils/watched';
import { WatchButton } from './ZoneParts';
import { CURRENT_ROW_CLASS, WATCHED_ROW_CLASS, zoneTitle } from '../utils/zoneDisplay';

interface ScheduleListProps {
  readonly schedule: TerrorZoneSchedule;
  /** The terrorized window now (listed first, highlighted) */
  readonly current: TerrorZoneSlot | null;
  readonly nextSlot: number;
  /** How many slots after the current one to list */
  readonly count: number;
  /** Slots added by "Load more" */
  readonly pageSize: number;
  readonly watched: ReadonlySet<string>;
  readonly watchedOnly: boolean;
  readonly onLoadMore: () => void;
}

/** The upcoming slots in local time, one day separator per local day; current and watched rows highlighted. */
export function ScheduleList({ schedule, current, nextSlot, count, pageSize, watched, watchedOnly, onLoadMore }: ScheduleListProps) {
  const upcoming = windowsFrom(schedule, nextSlot, count);
  const all = current === null ? upcoming : [current, ...upcoming];
  const shown = filterSlots(all, watched, watchedOnly);
  // Day labels relative to the real time (minute resolution), not the first slot's start: a slot can cross local midnight
  const reference = useClockValue((now) => Math.floor(now / 60) * 60);
  const last = upcoming.at(-1);
  const hours = Math.round((count * schedule.period) / 3600);

  return (
    <div className="space-y-2">
      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {watchedOnly
            ? `None of your watched zone groups comes up in the next ${String(hours)} hours.`
            : 'No terror zone is scheduled: the rotation has ended.'}
        </p>
      ) : (
        <ol className="space-y-1" aria-label="Terror zone schedule">
          {shown.map((slot, index) => {
            const day = localDayKey(slot.start);
            const newDay = index === 0 || localDayKey(shown[index - 1].start) !== day;
            const isCurrent = slot.slot === current?.slot;
            const isWatched = watched.has(slot.zone.id);
            return (
              <Fragment key={slot.slot}>
                {newDay && (
                  <li className="sticky top-0 z-10 bg-background/95 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                    {formatDayLabel(slot.start, reference)}
                  </li>
                )}
                <li
                  className={cn(
                    'flex items-start gap-3 rounded-md border px-3 py-2',
                    isWatched ? WATCHED_ROW_CLASS : isCurrent ? CURRENT_ROW_CLASS : 'border-transparent bg-card'
                  )}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <time
                    className="min-w-[6.5rem] shrink-0 text-sm whitespace-nowrap tabular-nums text-muted-foreground sm:min-w-[8.5rem]"
                    dateTime={new Date(slot.start * 1000).toISOString()}
                  >
                    {formatClockRange(slot.start, slot.end)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm leading-snug', (isWatched || isCurrent) && 'font-semibold')}>{zoneTitle(slot.zone)}</p>
                    {(isCurrent || isWatched) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isCurrent && <span className="font-medium text-foreground">Now</span>}
                        {isCurrent && isWatched && ' · '}
                        {isWatched && <span className="font-medium text-warning">Watched</span>}
                      </p>
                    )}
                  </div>
                  <WatchButton zone={slot.zone} watched={isWatched} className="-my-1" />
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
      {last !== undefined && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
            Load {String(Math.round((pageSize * schedule.period) / 3600))} more hours
          </Button>
          <span className="text-xs text-muted-foreground">Listed until {formatWhen(last.end, reference)}</span>
        </div>
      )}
    </div>
  );
}
