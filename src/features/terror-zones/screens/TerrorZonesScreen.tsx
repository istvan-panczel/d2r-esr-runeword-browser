import { useState, type ReactNode } from 'react';
import { CalendarClock, Info, Layers, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from '@/components/ExternalLink';
import { PageShell } from '@/components/PageShell';
import { SectionHeader } from '@/components/SectionHeader';
import { ToolbarCard } from '@/components/ToolbarCard';
import { cn } from '@/lib/utils';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { TerrorZoneSchedule } from '../engine/schedule';
import { BoostTable } from '../components/BoostTable';
import { NotificationToggle } from '../components/NotificationToggle';
import { ScheduleList } from '../components/ScheduleList';
import { ZoneGroupList } from '../components/ZoneGroupList';
import { Countdown, TzMark, WatchButton } from '../components/ZoneParts';
import { CURRENT_ROW_CLASS, WATCHED_ROW_CLASS, zoneTitle } from '../utils/zoneDisplay';
import { useCurrentSlots } from '../hooks/useCurrentSlots';
import { useTerrorZonePrefs } from '../store/preferences';
import { retryTerrorZones, useTerrorZoneSchedule } from '../store/scheduleStore';
import { useClockValue } from '../store/clock';
import { formatClock, formatClockRange, formatWhen, localTimeZone } from '../utils/format';
import { knownWatched } from '../utils/watched';

const ARCANE_TRACKER_URL = 'https://github.com/hyperremix/d2r-arcane-tracker';
const ESR_DOCS_URL = 'https://github.com/dotsyzygy/esr-docs';
/** Slots listed at first and added per "Load more" (60-minute slots: 48 hours) */
const PAGE_SLOTS = 48;

export function TerrorZonesScreen() {
  const { schedule, error } = useTerrorZoneSchedule();
  if (schedule !== null) return <TerrorZonesPage schedule={schedule} />;
  if (error !== null) return <GameDataError error={error} onRetry={retryTerrorZones} />;
  return <GameDataLoading />;
}

function TerrorZonesPage({ schedule }: { readonly schedule: TerrorZoneSchedule }) {
  const prefs = useTerrorZonePrefs();
  const zoneIds = schedule.bundle.zones.map((zone) => zone.id);
  const watched = knownWatched(prefs.watched, zoneIds);
  const { current, next, nextSlot } = useCurrentSlots(schedule);
  const [count, setCount] = useState(PAGE_SLOTS);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const timeZone = localTimeZone();
  const nowMinute = useClockValue((now) => Math.floor(now / 60) * 60);
  const { esrVersion, config } = schedule.bundle;

  return (
    <PageShell
      title="Terror Zones"
      meta={
        <>
          The offline (single-player) terror zone rotation of ESR {esrVersion}, worked out from the game files. Times are in your time zone
          {timeZone === null ? '' : ` (${timeZone})`}.
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <SlotCard
          label="Terrorized now"
          slot={current}
          watched={watched}
          emphasis="current"
          detail={
            current === null ? (
              'No terror zone right now.'
            ) : (
              <>
                Until {formatClock(current.end)} · changes in <Countdown until={current.end} className="font-semibold text-foreground" />
              </>
            )
          }
        />
        <SlotCard
          label="Next"
          slot={next}
          watched={watched}
          emphasis="next"
          detail={
            next === null
              ? 'Nothing scheduled.'
              : formatWhen(next.start, nowMinute) === formatClock(next.start)
                ? formatClockRange(next.start, next.end)
                : `${formatWhen(next.start, nowMinute)}–${formatClock(next.end)}`
          }
        />
      </div>

      <ToolbarCard className="my-4">
        <div className="flex flex-wrap items-start gap-3">
          <Button
            type="button"
            variant={watchedOnly ? 'default' : 'outline'}
            size="sm"
            aria-pressed={watchedOnly}
            disabled={watched.size === 0 && !watchedOnly}
            onClick={() => {
              setWatchedOnly(!watchedOnly);
            }}
          >
            <Star className={cn('size-4', watchedOnly && 'fill-current')} />
            Watched only
            {watched.size > 0 && <span className="text-xs opacity-80">({watched.size})</span>}
          </Button>
          <NotificationToggle enabled={prefs.notify} watchedCount={watched.size} />
        </div>
        <p className="text-xs text-muted-foreground">
          Star a zone group to watch it: it is highlighted here and in the tracker at the bottom left of every page. Watched groups are
          stored in this browser only.
        </p>
      </ToolbarCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="tz-schedule">
          <SectionHeader id="tz-schedule" title="Schedule" icon={CalendarClock} count={`${String(config.zoneMinutes)} min per zone`} />
          <ScheduleList
            schedule={schedule}
            current={current}
            nextSlot={nextSlot}
            count={count}
            pageSize={PAGE_SLOTS}
            watched={watched}
            watchedOnly={watchedOnly}
            onLoadMore={() => {
              setCount(count + PAGE_SLOTS);
            }}
          />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="tz-groups">
            <SectionHeader id="tz-groups" title="Zone groups" icon={Layers} count={schedule.bundle.zones.length} />
            <ZoneGroupList schedule={schedule} watched={watched} slotKey={Math.max(0, nextSlot - 1)} />
          </section>

          <section aria-labelledby="tz-boost">
            <SectionHeader id="tz-boost" title="Terror boost" icon={TrendingUp} />
            <BoostTable boosts={schedule.bundle.boosts} />
            <p className="mt-2 text-xs text-muted-foreground">
              From desecratedzones.json: the levels added to the monsters of a terrorized area, the monster level range it stays in, and the
              experience bonus. Lord of Destruction and Reign of the Warlock games have their own values.
            </p>
          </section>

          <section aria-labelledby="tz-about">
            <SectionHeader id="tz-about" title="About this schedule" icon={Info} />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Offline games pick the terror zone from <code className="text-xs">desecratedzones.json</code>: a seeded rotation that starts
                on {new Date(config.start * 1000).toLocaleDateString(undefined, { dateStyle: 'long' })} and changes every{' '}
                {config.zoneMinutes} minutes. This page replays it for ESR {esrVersion}. It follows your PC clock, like the game: a clock
                that is off shows the wrong zone in both.
              </p>
              <p>
                A different ESR version can change the zone list, its order or the seed, and with them every slot. Online (Battle.net) games
                use Blizzard&apos;s own schedule, not this one.
              </p>
              <p>
                Rotation algorithm ported from{' '}
                <ExternalLink
                  href={ARCANE_TRACKER_URL}
                  className="underline underline-offset-2 hover:text-foreground"
                  iconClassName="inline size-3"
                >
                  d2r-arcane-tracker
                </ExternalLink>{' '}
                by Fredrik Pettersson (MIT), via{' '}
                <ExternalLink
                  href={ESR_DOCS_URL}
                  className="underline underline-offset-2 hover:text-foreground"
                  iconClassName="inline size-3"
                >
                  ESR Docs
                </ExternalLink>{' '}
                by Syzygy.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

interface SlotCardProps {
  readonly label: string;
  readonly slot: ReturnType<typeof useCurrentSlots>['current'];
  readonly watched: ReadonlySet<string>;
  readonly emphasis: 'current' | 'next';
  readonly detail: ReactNode;
}

/** The "Terrorized now" / "Next" cards at the top of the page. */
function SlotCard({ label, slot, watched, emphasis, detail }: SlotCardProps) {
  const isWatched = slot !== null && watched.has(slot.zone.id);
  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-sm',
        isWatched ? WATCHED_ROW_CLASS : emphasis === 'current' ? CURRENT_ROW_CLASS : 'bg-card'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {emphasis === 'current' && <TzMark className="text-sm tracking-normal" />}
        <span className="flex-1">{label}</span>
        {isWatched && <span className="normal-case tracking-normal text-warning">Watched</span>}
      </div>
      {slot !== null && (
        <div className="mt-2 flex items-start gap-2">
          <p className="flex-1 text-lg font-semibold leading-snug">{zoneTitle(slot.zone)}</p>
          <WatchButton zone={slot.zone} watched={isWatched} />
        </div>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
