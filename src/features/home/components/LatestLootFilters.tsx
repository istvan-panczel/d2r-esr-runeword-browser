import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { startLootFilterSharing } from '@/core/startup';
import { RequestState } from '@/core/types';
import { FOCUS_RING } from '@/features/guide/components/styles';
import { SharedFilterCard } from '@/features/loot-filter/components/library/SharedFilterCard';
import { SharedFilterCardSkeleton } from '@/features/loot-filter/components/library/SharedFilterCardSkeleton';
import { LATEST_FILTERS_COUNT } from '@/features/loot-filter/sharing/constants';
import { fetchLatestFiltersRequested, selectLatestFilters, selectLatestFiltersStatus } from '@/features/loot-filter/sharing/sharingSlice';
import { SHARED_TAB_PATH } from '@/features/loot-filter/utils/library';
import { cn } from '@/lib/utils';

/**
 * "Latest loot filters" strip (only mounted when Supabase is configured), next to Latest builds. It waits for the
 * sharing saga to listen (`startLootFilterSharing`, as the loot filter routes do via loadAfter) before asking for the
 * newest public filters. Hidden on error or when nothing is shared yet.
 */
export function LatestLootFilters() {
  const dispatch = useDispatch();
  const filters = useSelector(selectLatestFilters);
  const status = useSelector(selectLatestFiltersStatus);

  useEffect(() => {
    let cancelled = false;
    void startLootFilterSharing().then(() => {
      if (!cancelled) dispatch(fetchLatestFiltersRequested());
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (status === RequestState.ERROR) return null;
  if (status === RequestState.SUCCESS && filters.length === 0) return null;
  const loading = status !== RequestState.SUCCESS;

  return (
    <section aria-labelledby="home-loot-filters-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-loot-filters-heading" className="text-lg font-semibold">
          Latest loot filters
        </h2>
        <Link
          to={SHARED_TAB_PATH}
          className={cn('inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline', FOCUS_RING)}
        >
          All shared filters
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {loading
          ? Array.from({ length: LATEST_FILTERS_COUNT }, (_, index) => (
              // One skeleton row; on phones only the first card shows so the placeholder stays a single row.
              <li key={index} className={index > 0 ? 'hidden md:block' : undefined}>
                <SharedFilterCardSkeleton />
              </li>
            ))
          : filters.map((filter) => (
              <li key={filter.id}>
                <SharedFilterCard filter={filter} compact />
              </li>
            ))}
      </ul>
    </section>
  );
}
