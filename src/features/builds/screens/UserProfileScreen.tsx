import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/core/db';
import { ProfileEditDialog, avatarInitials, formatProfileTag, selectAuthUserId } from '@/features/auth';
import { BuildCard } from '../components/BuildCard';
import { BuildCardSkeleton } from '../components/BuildCardSkeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  clearAuthorProfile,
  fetchAuthorProfileRequested,
  fetchMoreAuthorBuildsRequested,
  selectAuthorBuilds,
  selectAuthorBuildsHasMore,
  selectAuthorBuildsLoadingMore,
  selectAuthorLikedBuildIdSet,
  selectAuthorLoading,
  selectAuthorNotFound,
  selectAuthorProfile,
} from '../store';

const SKELETON_KEYS = ['s1', 's2', 's3'];
const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' });

export function UserProfileScreen() {
  const { userId } = useParams();
  const dispatch = useDispatch();

  const profile = useSelector(selectAuthorProfile);
  const loading = useSelector(selectAuthorLoading);
  const notFound = useSelector(selectAuthorNotFound);
  const builds = useSelector(selectAuthorBuilds);
  const loadingMore = useSelector(selectAuthorBuildsLoadingMore);
  const hasMore = useSelector(selectAuthorBuildsHasMore);
  const likedBuildIds = useSelector(selectAuthorLikedBuildIdSet);
  const currentUserId = useSelector(selectAuthUserId);

  const esrVersionMeta = useLiveQuery(() => db.metadata.get('esrVersion'));
  const currentEsrVersion = esrVersionMeta?.value ?? null;

  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (userId === undefined) return;
    dispatch(fetchAuthorProfileRequested(userId));
    return () => {
      dispatch(clearAuthorProfile());
    };
  }, [dispatch, userId]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) dispatch(fetchMoreAuthorBuildsRequested());
  };
  const sentinelRef = useInfiniteScroll(handleLoadMore, builds.length > 0 && hasMore && !loadingMore);

  if (userId === undefined) {
    return <Navigate to="/builds" replace />;
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="mt-2 text-muted-foreground">This user may no longer exist.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/builds">Back to builds</Link>
        </Button>
      </div>
    );
  }

  if (profile === null) {
    if (!loading) {
      // Status settled without a profile or a not-found flag → a backend error.
      return (
        <div className="mx-auto max-w-2xl py-16 text-center">
          <p className="text-muted-foreground">Couldn’t load this profile. The backend may be waking up.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              dispatch(fetchAuthorProfileRequested(userId));
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <BuildCardSkeleton key={key} />
          ))}
        </div>
      </div>
    );
  }

  const isOwner = currentUserId !== null && currentUserId === profile.id;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {profile.avatar_url !== null && <AvatarImage src={profile.avatar_url} alt="" />}
            <AvatarFallback className="text-lg">{avatarInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">{formatProfileTag(profile.display_name, profile.discriminator)}</h1>
            <p className="text-sm text-muted-foreground">Joined {dateFormatter.format(new Date(profile.created_at))}</p>
          </div>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Builds</h2>
        {builds.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {isOwner ? 'You haven’t shared any builds yet.' : 'This user hasn’t shared any builds yet.'}
          </p>
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
      </section>

      {isOwner && (
        <ProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => {
            dispatch(fetchAuthorProfileRequested(userId));
          }}
        />
      )}
    </div>
  );
}
