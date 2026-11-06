/** Formatting for the terror zone widget and page. Times are Unix seconds, shown in the browser's time zone. */

const pad = (value: number) => String(value).padStart(2, '0');

/** Seconds left → "4:05", "45:12" or "1:02:03" (negative reads as 0). */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${String(hours)}:${pad(minutes)}:${pad(secs)}` : `${String(minutes)}:${pad(secs)}`;
}

/** Local clock time of a Unix second, "14:00" / "2:00 PM" by the browser's locale. */
export function formatClock(seconds: number, locale?: string): string {
  return new Date(seconds * 1000).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * A window's local start and end on one short line: "2:00 – 3:00 PM" (en-US), "14:00–15:00" (24-hour locales), via
 * `Intl.DateTimeFormat#formatRange`. Across local midnight (also ending exactly at it) formatRange adds both dates, so the two times are joined
 * instead ("11:00 PM–12:00 AM").
 */
export function formatClockRange(start: number, end: number, locale?: string): string {
  if (localDayKey(start) !== localDayKey(end)) return `${formatClock(start, locale)}–${formatClock(end, locale)}`;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatRange(start * 1000, end * 1000);
}

/** Local calendar day of a Unix second, as a key ("2026-11-06") for grouping */
export function localDayKey(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today", "Tomorrow" or "Sunday, 8 November" (by locale), relative to `now`. */
export function formatDayLabel(seconds: number, now: number, locale?: string): string {
  const day = localDayKey(seconds);
  if (day === localDayKey(now)) return 'Today';
  const tomorrow = new Date(now * 1000);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === localDayKey(tomorrow.getTime() / 1000)) return 'Tomorrow';
  return new Date(seconds * 1000).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** When a window starts, from `now`: "14:00" today, else "Sun 14:00" within a week, else "8 Nov 14:00". */
export function formatWhen(seconds: number, now: number, locale?: string): string {
  const clock = formatClock(seconds, locale);
  if (localDayKey(seconds) === localDayKey(now)) return clock;
  const date = new Date(seconds * 1000);
  const withinWeek = seconds - now < 6 * 24 * 3600;
  const day = withinWeek
    ? date.toLocaleDateString(locale, { weekday: 'short' })
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${day} ${clock}`;
}

/** "in 3 h 20 min", "in 45 min", "in 2 d 4 h" (rounded down; "now" under a minute). */
export function formatIn(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return 'now';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `in ${String(days)} d${hours > 0 ? ` ${String(hours)} h` : ''}`;
  if (hours > 0) return `in ${String(hours)} h${mins > 0 ? ` ${String(mins)} min` : ''}`;
  return `in ${String(mins)} min`;
}

/** The browser's time zone name ("Europe/Budapest"), or null when unknown */
export function localTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
