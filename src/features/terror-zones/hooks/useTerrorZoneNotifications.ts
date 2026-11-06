import { useEffect, useRef } from 'react';
import type { TerrorZoneSlot } from '../engine/schedule';
import { readLastNotifiedStart, writeLastNotifiedStart } from '../store/preferences';
import { formatClock } from '../utils/format';
import { showTerrorZoneNotification } from '../utils/notifications';
import { shouldNotify } from '../utils/watched';

/**
 * Sends a browser notification when a watched group starts while this tab is open (mounted once, by the widget). The
 * slot seen on page load never notifies: the zone started before the page was open.
 */
export function useTerrorZoneNotifications(current: TerrorZoneSlot | null, watched: ReadonlySet<string>, enabled: boolean): void {
  const previousSlot = useRef<number | null>(null);

  useEffect(() => {
    if (current === null) {
      // Opened in a break (or before the start): the next zone to start is new to this tab
      previousSlot.current ??= -1;
      return;
    }
    const notify = shouldNotify({
      previousSlot: previousSlot.current,
      current,
      watched,
      enabled,
      lastNotifiedStart: readLastNotifiedStart(),
      now: Date.now() / 1000,
    });
    previousSlot.current = current.slot;
    if (!notify) return;
    writeLastNotifiedStart(current.start);
    showTerrorZoneNotification(current, formatClock(current.end));
  }, [current, watched, enabled]);
}
