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
import { BUNDLED_TEMPLATE_LIST } from '../../utils/template';
import { BundledTemplateCard } from './BundledTemplateCard';
import { SharedFilterCard } from './SharedFilterCard';
import { SharedFilterCardSkeleton } from './SharedFilterCardSkeleton';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];
/** Three cards per row on Standard pages; Wide and Full pages add one per step of the `page` container (see PageShell). */
const GRID =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7';

/**
 * The Shared tab: the pinned bundled templates (Sully's, the example), then the public filters (infinite scroll). Their search
 * and sort (`SharedFiltersToolbar`) sit on the library's toolbar card, next to the Shared / My filters switch.
 */
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
        {BUNDLED_TEMPLATE_LIST.map((template) => (
          <BundledTemplateCard
            key={template.id}
            template={template}
            onStart={() => void startFromTemplate(template.id)}
            starting={loadingTemplate === template.id}
            disabled={loadingTemplate !== null}
          />
        ))}
      </div>

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
