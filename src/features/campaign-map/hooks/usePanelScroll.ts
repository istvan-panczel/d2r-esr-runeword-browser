import { useEffect, useRef } from 'react';

/** Tailwind `lg`: the detail panel is a side column from here on */
const WIDE_QUERY = '(min-width: 1024px)';

/**
 * Below `lg` the detail panel sits above the list: after a tap (`requestScroll`, then the selection changes) the panel
 * (`panelRef`) is scrolled into view. `requestScroll` returns whether a scroll is coming (false on a wide screen), so
 * the caller can skip its own scroll. The request is used up by the next commit, whether the selection changed or not.
 */
export function usePanelScroll(selected: number | null) {
  const panelRef = useRef<HTMLElement>(null);
  const pending = useRef(false);
  // Every commit: a tap re-renders the page (the URL changes), so the request never outlives it.
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    if (selected !== null) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const requestScroll = (): boolean => {
    pending.current = !window.matchMedia(WIDE_QUERY).matches;
    return pending.current;
  };
  return { panelRef, requestScroll };
}
