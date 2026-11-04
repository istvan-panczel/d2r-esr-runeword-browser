import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { RequestState } from '@/core/types';
import { LoadMoreError } from '@/features/builds/components/LoadMoreError';
import {
  clearAuthorFilters,
  fetchAuthorFiltersRequested,
  fetchMoreAuthorFiltersRequested,
  selectAuthorFilters,
  selectAuthorFiltersError,
  selectAuthorFiltersHasMore,
  selectAuthorFiltersLoadMoreError,
  selectAuthorFiltersLoadingMore,
  selectAuthorFiltersStatus,
} from '../../sharing';
import { SharedFilterCard } from './SharedFilterCard';
import { SharedFilterCardSkeleton } from './SharedFilterCardSkeleton';

const SKELETON_KEYS = ['s1', 's2', 's3'];
/** Three cards per row on Standard pages; Wide and Full pages add one per step of the `page` container (see PageShell). */
const GRID =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7';

interface AuthorFiltersSectionProps {
  readonly userId: string;
  /** The viewer is this author: their private filters are listed too (with a badge), and the empty text says "You". */
  readonly isOwner: boolean;
}

/**
 * "Loot filters" on `/user/:userId`: the author's filters, newest first. Paged with a Load more button rather than
 * infinite scroll, since the builds above already page on scroll.
 */
export function AuthorFiltersSection({ userId, isOwner }: AuthorFiltersSectionProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectAuthorFilters);
  // Not loaded yet also before the mount effect has asked, so the empty text never flashes first.
  const status = useSelector(selectAuthorFiltersStatus);
  const loading = status === RequestState.IDLE || status === RequestState.LOADING;
  const loadingMore = useSelector(selectAuthorFiltersLoadingMore);
  const hasMore = useSelector(selectAuthorFiltersHasMore);
  const error = useSelector(selectAuthorFiltersError);
  const loadMoreError = useSelector(selectAuthorFiltersLoadMoreError);

  useEffect(() => {
    dispatch(fetchAuthorFiltersRequested(userId));
    return () => {
      dispatch(clearAuthorFilters());
    };
  }, [dispatch, userId]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) dispatch(fetchMoreAuthorFiltersRequested());
  };

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">Loot filters</h2>
      {filters.length === 0 && error !== null ? (
        <LoadMoreError
          message="Couldn’t load loot filters. The backend may be waking up."
          onRetry={() => {
            dispatch(fetchAuthorFiltersRequested(userId));
          }}
        />
      ) : loading && filters.length === 0 ? (
        <div className={GRID}>
          {SKELETON_KEYS.map((key) => (
            <SharedFilterCardSkeleton key={key} />
          ))}
        </div>
      ) : filters.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {isOwner ? 'You haven’t saved any loot filters yet.' : 'This user hasn’t shared any loot filters yet.'}
        </p>
      ) : (
        <>
          <div className={GRID}>
            {filters.map((filter) => (
              <SharedFilterCard key={filter.id} filter={filter} />
            ))}
          </div>
          {loadMoreError !== null ? (
            <LoadMoreError message="Couldn’t load more loot filters. The backend may be waking up." onRetry={handleLoadMore} />
          ) : (
            hasMore && (
              <div className="flex justify-center py-6">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore && <Spinner />}
                  Load more filters
                </Button>
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
