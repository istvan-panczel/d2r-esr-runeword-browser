import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ShowMoreListProps<T> {
  readonly items: readonly T[];
  /** Items rendered at first and added per click */
  readonly pageSize: number;
  /** Renders the visible slice (a table body, a card grid …) */
  readonly render: (visible: readonly T[]) => ReactNode;
}

/** The first `pageSize` items and a "Show more" button adding another page. Re-mount (via `key`) to reset. */
export function ShowMoreList<T>({ items, pageSize, render }: ShowMoreListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  return (
    <>
      {render(items.slice(0, visibleCount))}
      {visibleCount < items.length && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setVisibleCount((count) => count + pageSize);
            }}
          >
            Show more ({items.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </>
  );
}
