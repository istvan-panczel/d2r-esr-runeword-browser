import { useEffect, useRef } from 'react';

/**
 * Observes a sentinel element and calls `onLoadMore` when it scrolls into view.
 * Returns a ref to attach to the sentinel. No-op while `enabled` is false.
 */
export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (node === null || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, enabled]);

  return sentinelRef;
}
