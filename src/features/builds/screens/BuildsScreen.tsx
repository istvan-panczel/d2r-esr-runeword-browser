import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { db } from '@/core/db';
import { openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import { BuildCard } from '../components/BuildCard';
import { BuildCardSkeleton } from '../components/BuildCardSkeleton';
import { BuildFilters } from '../components/BuildFilters';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  fetchBuildsRequested,
  fetchMoreBuildsRequested,
  selectBuilds,
  selectBuildsError,
  selectBuildsHasActiveFilters,
  selectBuildsHasMore,
  selectBuildsLoading,
  selectBuildsLoadingMore,
  selectLikedBuildIdSet,
} from '../store';

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];

export function BuildsScreen() {
  const dispatch = useDispatch();
  const builds = useSelector(selectBuilds);
  const loading = useSelector(selectBuildsLoading);
  const loadingMore = useSelector(selectBuildsLoadingMore);
  const hasMore = useSelector(selectBuildsHasMore);
  const error = useSelector(selectBuildsError);
  const hasActiveFilters = useSelector(selectBuildsHasActiveFilters);
  const likedBuildIds = useSelector(selectLikedBuildIdSet);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const esrVersionMeta = useLiveQuery(() => db.metadata.get('esrVersion'));
  const currentEsrVersion = esrVersionMeta?.value ?? null;

  useEffect(() => {
    dispatch(fetchBuildsRequested());
  }, [dispatch]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) dispatch(fetchMoreBuildsRequested());
  };
  const sentinelRef = useInfiniteScroll(handleLoadMore, builds.length > 0 && hasMore && !loadingMore);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Builds" />
      <BuildFilters />

      {error !== null && builds.length === 0 ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Builds are temporarily unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            The backend may be waking up from inactivity (this can take a minute). The rest of the app works offline.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              dispatch(fetchBuildsRequested());
            }}
          >
            Try again
          </Button>
        </div>
      ) : loading && builds.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <BuildCardSkeleton key={key} />
          ))}
        </div>
      ) : builds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          {hasActiveFilters ? (
            <p className="text-muted-foreground">No builds match your filters.</p>
          ) : (
            <>
              <p className="text-muted-foreground">No builds yet. Be the first to share a build!</p>
              {isAuthenticated ? (
                <Button asChild>
                  <Link to="/builds/new">
                    <Plus className="size-4" />
                    Create Build
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    dispatch(openSignInDialog());
                  }}
                >
                  <Plus className="size-4" />
                  Create Build
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builds.map((build) => (
              <BuildCard key={build.id} build={build} currentEsrVersion={currentEsrVersion} liked={likedBuildIds.has(build.id)} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Spinner className="size-6" />
            </div>
          )}
        </>
      )}

      <ScrollToTopButton />
    </div>
  );
}
