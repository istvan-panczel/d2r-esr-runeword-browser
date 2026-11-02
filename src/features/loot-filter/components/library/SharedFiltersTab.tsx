import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LoadMoreError } from '@/features/builds/components/LoadMoreError';
import { useInfiniteScroll } from '@/features/builds/hooks/useInfiniteScroll';
import { useStartFilter } from '../../hooks/useStartFilter';
import {
  fetchMoreSharedFiltersRequested,
  fetchSharedFiltersRequested,
  selectSharedFilters,
  selectSharedFiltersError,
  selectSharedFiltersHasActiveSearch,
  selectSharedFiltersHasMore,
  selectSharedFiltersLoadMoreError,
  selectSharedFiltersLoading,
  selectSharedFiltersLoadingMore,
} from '../../sharing';
import { SharedFilterCard } from './SharedFilterCard';
import { SharedFilterCardSkeleton } from './SharedFilterCardSkeleton';
import { SharedFiltersToolbar } from './SharedFiltersToolbar';
import { SullyFilterCard } from './SullyFilterCard';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/** The Shared tab: the pinned Sully card, then the public filters (search, sort, infinite scroll). */
export function SharedFiltersTab() {
  const dispatch = useDispatch();
  const filters = useSelector(selectSharedFilters);
  const loading = useSelector(selectSharedFiltersLoading);
  const loadingMore = useSelector(selectSharedFiltersLoadingMore);
  const hasMore = useSelector(selectSharedFiltersHasMore);
  const error = useSelector(selectSharedFiltersError);
  const loadMoreError = useSelector(selectSharedFiltersLoadMoreError);
  const hasActiveSearch = useSelector(selectSharedFiltersHasActiveSearch);
  const { startFromTemplate, loadingTemplate } = useStartFilter();

  useEffect(() => {
    dispatch(fetchSharedFiltersRequested());
  }, [dispatch]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) dispatch(fetchMoreSharedFiltersRequested());
  };
  // Paused while a refetch runs and after a failed page (the user retries explicitly), as on the builds list.
  const sentinelRef = useInfiniteScroll(
    handleLoadMore,
    filters.length > 0 && hasMore && !loadingMore && !loading && loadMoreError === null
  );

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <SullyFilterCard onStart={() => void startFromTemplate()} starting={loadingTemplate} />
      </div>

      <SharedFiltersToolbar />

      {error !== null && filters.length === 0 ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Shared filters are temporarily unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            The backend may be waking up from inactivity (this can take a minute). Your filters in this browser still work.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              dispatch(fetchSharedFiltersRequested());
            }}
          >
            Try again
          </Button>
        </div>
      ) : loading && filters.length === 0 ? (
        <div className={GRID}>
          {SKELETON_KEYS.map((key) => (
            <SharedFilterCardSkeleton key={key} />
          ))}
        </div>
      ) : filters.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {hasActiveSearch
            ? 'No shared filters match your search.'
            : 'No shared filters yet. Save one of yours from the My filters tab to share it.'}
        </p>
      ) : (
        <>
          <div className={GRID}>
            {filters.map((filter) => (
              <SharedFilterCard key={filter.id} filter={filter} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Spinner className="size-6" />
            </div>
          )}
          {loadMoreError !== null && (
            <LoadMoreError message="Couldn’t load more filters. The backend may be waking up." onRetry={handleLoadMore} />
          )}
        </>
      )}
    </div>
  );
}
