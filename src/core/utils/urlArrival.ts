export type UrlRead = 'skip' | 'first-mount' | 'arrival';

/**
 * Whether a filter screen reads its URL params now. It reads them once when it mounts, and again whenever the URL later
 * carries params the screen recognises: a link to the page you are on (the global search) leaves the screen mounted.
 * The screen then strips those params, which leaves a URL with nothing to read, so the cleanup triggers nothing.
 * `handled` is the last `URLSearchParams` seen: `useSearchParams` keeps one object per search string, so a repeat of the
 * same effect (StrictMode) skips while a repeat of the same link, after the cleanup, is a new object and is read.
 */
export function decideUrlRead(
  handled: URLSearchParams | null,
  current: URLSearchParams,
  hasParams: (params: URLSearchParams) => boolean
): UrlRead {
  if (handled === current) return 'skip';
  if (handled === null) return 'first-mount';
  return hasParams(current) ? 'arrival' : 'skip';
}
