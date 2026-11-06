import { useEffect, useRef, useState, type Ref } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePersistentState } from '@/core/hooks/usePersistentState';
import { cn } from '@/lib/utils';
import type { TerrorZoneSchedule } from '../engine/schedule';
import { windowsFrom } from '../engine/schedule';
import { useCurrentSlots } from '../hooks/useCurrentSlots';
import { useTerrorZoneNotifications } from '../hooks/useTerrorZoneNotifications';
import { useTerrorZonePrefs, WIDGET_OPEN_STORAGE_KEY } from '../store/preferences';
import { useClockValue } from '../store/clock';
import { useTerrorZoneSchedule } from '../store/scheduleStore';
import { formatBoostLines, sameCaps, summariseBoosts } from '../utils/boosts';
import { formatWhen } from '../utils/format';
import { knownWatched, watchAlert, type WatchAlert } from '../utils/watched';
import { isWidgetHidden, TERROR_ZONES_PATH, WIDGET_BOTTOM_CLASS, widgetLift } from '../utils/widgetPosition';
import { Countdown, TzMark, WatchButton } from './ZoneParts';
import { CURRENT_ROW_CLASS, WATCHED_ROW_CLASS, zoneTitle } from '../utils/zoneDisplay';

const UPCOMING_FEW = 3;
const UPCOMING_MORE = 12;
/** Below Tailwind's `sm`: the widget starts minimised */
const PHONE_QUERY = '(max-width: 639px)';

const isOpenChoice = (value: unknown): value is boolean | null => value === null || typeof value === 'boolean';

function isPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

/**
 * The floating terror zone tracker, bottom-left on every page (mounted once by AppLayout, lazy). Renders nothing until
 * terrorzones.json has loaded (or when it failed: the page shows the error).
 */
export function TerrorZoneWidget() {
  const { schedule } = useTerrorZoneSchedule();
  if (schedule === null) return null;
  return <WidgetFrame schedule={schedule} />;
}

function WidgetFrame({ schedule }: { readonly schedule: TerrorZoneSchedule }) {
  const { pathname } = useLocation();
  // null: never chosen in this browser → open, minimised on phones
  const [openChoice, setOpenChoice] = usePersistentState<boolean | null>(WIDGET_OPEN_STORAGE_KEY, null, isOpenChoice);
  const [phone] = useState(isPhone);
  const open = openChoice ?? !phone;
  const prefs = useTerrorZonePrefs();
  const watched = knownWatched(
    prefs.watched,
    schedule.bundle.zones.map((zone) => zone.id)
  );
  const { current, next, nextSlot } = useCurrentSlots(schedule);
  useTerrorZoneNotifications(current, watched, prefs.notify);
  const alert = watchAlert(current, next, watched);
  const circleRef = useRef<HTMLButtonElement>(null);
  const minimiseRef = useRef<HTMLButtonElement>(null);
  // Set by a click on minimise / open: focus follows to the control that replaced the clicked one (never on mount)
  const focusAfterToggle = useRef(false);
  useEffect(() => {
    if (!focusAfterToggle.current) return;
    focusAfterToggle.current = false;
    (open ? minimiseRef : circleRef).current?.focus();
  }, [open]);
  const toggle = (value: boolean) => {
    focusAfterToggle.current = true;
    setOpenChoice(value);
  };
  const position = cn('fixed left-[max(1.5rem,env(safe-area-inset-left))] z-40', WIDGET_BOTTOM_CLASS[widgetLift(pathname)]);

  // The schedule page shows all of it: nothing visible there, but the notifications above keep running
  if (isWidgetHidden(pathname)) return null;
  if (!open) {
    return (
      <MinimisedButton
        className={position}
        alert={alert}
        buttonRef={circleRef}
        onOpen={() => {
          toggle(true);
        }}
      />
    );
  }
  return (
    <WidgetCard
      className={position}
      schedule={schedule}
      watched={watched}
      nextSlot={nextSlot}
      minimiseRef={minimiseRef}
      onMinimise={() => {
        toggle(false);
      }}
      current={current}
    />
  );
}

const ALERT_LABELS: Readonly<Record<NonNullable<WatchAlert>, string>> = {
  active: 'a watched zone is terrorized now',
  next: 'a watched zone is next',
};

interface MinimisedButtonProps {
  readonly className: string;
  readonly alert: WatchAlert;
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly onOpen: () => void;
}

/** The minimised widget: a round button like ScrollToTopButton, with a ring and a dot when a watched group is up. */
function MinimisedButton({ className, alert, buttonRef, onOpen }: MinimisedButtonProps) {
  return (
    <Button
      ref={buttonRef}
      variant="outline"
      size="icon"
      className={cn(
        'relative rounded-full shadow-lg',
        alert === 'active' && 'ring-2 ring-warning ring-offset-2 ring-offset-background',
        alert === 'next' && 'ring-2 ring-warning/50',
        className
      )}
      onClick={onOpen}
      aria-label={`Show the terror zone tracker${alert === null ? '' : ` (${ALERT_LABELS[alert]})`}`}
      title="Terror zones"
    >
      <TzMark className="text-sm" />
      {alert !== null && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-warning',
            alert === 'active' && 'animate-pulse'
          )}
          aria-hidden
        />
      )}
    </Button>
  );
}

interface WidgetCardProps {
  readonly className: string;
  readonly schedule: TerrorZoneSchedule;
  readonly watched: ReadonlySet<string>;
  readonly current: ReturnType<typeof useCurrentSlots>['current'];
  readonly nextSlot: number;
  readonly minimiseRef: Ref<HTMLButtonElement>;
  readonly onMinimise: () => void;
}

function WidgetCard({ className, schedule, watched, current, nextSlot, minimiseRef, onMinimise }: WidgetCardProps) {
  const [showMore, setShowMore] = useState(false);
  const upcoming = windowsFrom(schedule, nextSlot, showMore ? UPCOMING_MORE : UPCOMING_FEW);
  const changeAt = current?.end ?? upcoming.at(0)?.start ?? null;
  // Day names relative to the real time (minute resolution), not the slot start: a slot can cross local midnight
  const nowMinute = useClockValue((now) => Math.floor(now / 60) * 60);
  const boosts = summariseBoosts(schedule.bundle.boosts);
  const boostLines = formatBoostLines(boosts);
  // The caps are the same for every game version in ESR 3.2.24; shown once when they agree
  const caps = sameCaps(boosts);
  const currentWatched = current !== null && watched.has(current.zone.id);

  return (
    <section
      aria-label="Terror zone tracker"
      className={cn(
        'flex max-h-[min(70svh,34rem)] w-80 max-w-[calc(100vw-6rem)] flex-col rounded-xl border bg-card/95 text-card-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <TzMark className="shrink-0 text-sm" />
        <h2 className="flex-1 text-sm font-semibold">Terror zone</h2>
        <Button asChild variant="ghost" size="icon" className="size-7">
          <Link to={TERROR_ZONES_PATH} aria-label="Open the terror zone schedule page" title="Full schedule">
            <ExternalLink className="size-4" />
          </Link>
        </Button>
        <Button
          ref={minimiseRef}
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMinimise}
          aria-label="Minimise the terror zone tracker"
          title="Minimise"
        >
          <Minus className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <div className={cn('rounded-md border p-2', currentWatched ? WATCHED_ROW_CLASS : CURRENT_ROW_CLASS)}>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">{current === null ? 'No terror zone' : 'Now'}</span>
            {changeAt !== null && (
              <span>
                {current === null ? 'starts in ' : 'changes in '}
                <Countdown until={changeAt} className="font-semibold text-foreground" />
              </span>
            )}
          </div>
          {current !== null && (
            <div className="mt-1 flex items-start gap-1">
              <p className="flex-1 text-sm font-semibold leading-snug">{zoneTitle(current.zone)}</p>
              <WatchButton zone={current.zone} watched={currentWatched} className="-mt-1 -mr-1" />
            </div>
          )}
          {currentWatched && <p className="mt-1 text-xs font-medium text-warning">Watched zone: terrorized now</p>}
        </div>

        {upcoming.length > 0 && (
          <ol className="space-y-1" aria-label="Next terror zones">
            {upcoming.map((slot) => {
              const isWatched = watched.has(slot.zone.id);
              return (
                <li
                  key={slot.slot}
                  className={cn('flex items-start gap-2 rounded-md border border-transparent px-2 py-1', isWatched && WATCHED_ROW_CLASS)}
                >
                  <time
                    className="min-w-14 shrink-0 pt-0.5 text-xs whitespace-nowrap tabular-nums text-muted-foreground"
                    dateTime={new Date(slot.start * 1000).toISOString()}
                  >
                    {formatWhen(slot.start, nowMinute)}
                  </time>
                  <span className={cn('flex-1 text-xs leading-snug', isWatched && 'font-semibold')}>{zoneTitle(slot.zone)}</span>
                  <WatchButton zone={slot.zone} watched={isWatched} className="-my-1 size-6" />
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            aria-expanded={showMore}
            onClick={() => {
              setShowMore(!showMore);
            }}
          >
            {showMore ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showMore ? 'Show fewer' : 'Show more'}
          </Button>
          <Link to={TERROR_ZONES_PATH} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Full schedule
          </Link>
        </div>

        <div className="space-y-1.5 border-t pt-2">
          {boostLines.length > 0 && (
            <div className="text-sm leading-snug font-semibold text-terror">
              <p className="text-xs tracking-wide uppercase">Terror boost</p>
              {boostLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {caps.length > 0 && <p className="font-medium">Monster level cap {caps.join(' / ')}</p>}
            </div>
          )}
          <p className="text-[11px] leading-snug text-muted-foreground">
            ESR {schedule.bundle.esrVersion} offline schedule, by your PC clock
          </p>
        </div>
      </div>
    </section>
  );
}
