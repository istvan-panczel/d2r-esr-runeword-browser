import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Filter, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RequestState } from '@/core/types';
import { openSignInDialog } from '@/features/auth';
import type { RootState } from '@/core/store/store';
import {
  MY_FILTERS_LIMIT,
  fetchMyFiltersRequested,
  fetchSourceRevisionsRequested,
  selectMyFilters,
  selectMyFiltersError,
  selectMyFiltersStatus,
  selectSourceRevisions,
  type SharedFilterSummary,
} from '../../sharing';
import { selectLibraryHydrated, selectVisibleDrafts } from '../../store/selectors';
import { useTemplateVersions } from '../../hooks/useTemplateSource';
import { filterUpdateStatus, sourceIdsOf, type FilterUpdateStatus } from '../../utils/library';
import { bundledTemplate } from '../../utils/template';
import { DraftsSection } from './DraftsSection';
import { SharedFilterCard } from './SharedFilterCard';
import { SharedFilterCardSkeleton } from './SharedFilterCardSkeleton';
import { StartFilterActions } from './StartFilterActions';

/** Three cards per row on Standard pages; Wide and Full pages add one per step of the `page` container (see PageShell). */
const GRID =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7';
const SKELETON_KEYS = ['s1', 's2', 's3'];

interface MyFiltersTabProps {
  /** Whether filters can be saved (Supabase configured). Without it the tab is only the drafts, as before sharing. */
  readonly sharingEnabled: boolean;
  /** The signed-in user, or null. */
  readonly viewerId: string | null;
  /** The sign-in state is not known yet: the drafts show, the "Sign in to save" prompt waits. */
  readonly authPending?: boolean;
}

/** My filters: Start from a bundled template / Upload / New, the viewer's saved filters, then the drafts in this browser. */
export function MyFiltersTab({ sharingEnabled, viewerId, authPending = false }: MyFiltersTabProps) {
  const dispatch = useDispatch();
  const hydrated = useSelector(selectLibraryHydrated);
  const drafts = useSelector((state: RootState) => selectVisibleDrafts(state, viewerId));
  const signedIn = viewerId !== null;
  const showSaved = sharingEnabled && signedIn;
  // Only drafts that record their owner open through the saved filter (`draftLinks`); the rest open on their own route.
  const editedSavedIds = drafts.map((draft) => (draft.entry.savedOwnerId === undefined ? undefined : draft.entry.savedId));

  return (
    <div className="space-y-6">
      <StartFilterActions ready={hydrated} />

      {sharingEnabled && !signedIn && !authPending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-4 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Sign in to save your filters</span> to your account, share them or keep them
            private. Until then they stay in this browser, and you can edit and download them as usual.
          </p>
          <Button size="sm" variant="outline" onClick={() => dispatch(openSignInDialog())}>
            <LogIn />
            Sign in
          </Button>
        </div>
      )}

      {showSaved && <SavedFilters viewerId={viewerId} drafts={editedSavedIds} />}

      <section className="space-y-3">
        {showSaved && (
          <div>
            <h2 className="text-lg font-semibold">Unsaved in this browser</h2>
            <p className="text-sm text-muted-foreground">New filters and unsaved changes, kept in this browser until you save them.</p>
          </div>
        )}
        {!hydrated ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-8" />
          </div>
        ) : drafts.length === 0 ? (
          showSaved ? (
            <p className="py-4 text-sm text-muted-foreground">Nothing unsaved.</p>
          ) : (
            <Card className="mx-auto max-w-xl">
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Filter className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">No filters yet</p>
                <p className="text-sm text-muted-foreground">
                  Begin from Sully&apos;s QoL filter (recommended) or the example (to learn how rules work), upload one you already have, or
                  start a blank filter.
                </p>
              </CardContent>
            </Card>
          )
        ) : (
          <DraftsSection drafts={drafts} sharingEnabled={sharingEnabled} signedIn={signedIn} />
        )}
      </section>
    </div>
  );
}

interface SavedFiltersProps {
  readonly viewerId: string;
  /** The `savedId` of every visible draft (undefined for new drafts), for the Unsaved changes badge. */
  readonly drafts: readonly (string | undefined)[];
}

function SavedFilters({ viewerId, drafts }: SavedFiltersProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectMyFilters);
  const status = useSelector(selectMyFiltersStatus);
  const error = useSelector(selectMyFiltersError);
  const sourceRevisions = useSelector(selectSourceRevisions);
  // The current version of the templates the saved filters started from (none loaded when no filter is template-based).
  const templateVersions = useTemplateVersions(filters.flatMap((filter) => bundledTemplate(filter.based_on_template)?.id ?? []));

  useEffect(() => {
    dispatch(fetchMyFiltersRequested());
  }, [dispatch, viewerId]);

  // One lookup for the sources of every copy, again whenever the set of sources changes.
  const sourceKey = sourceIdsOf(filters).join(',');
  useEffect(() => {
    if (sourceKey !== '') dispatch(fetchSourceRevisionsRequested(sourceKey.split(',')));
  }, [dispatch, sourceKey]);

  const editedIds = new Set(drafts.filter((id) => id !== undefined));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Saved filters</h2>
        {status === RequestState.SUCCESS && (
          <span className="text-sm text-muted-foreground">
            {filters.length} of {MY_FILTERS_LIMIT} saved
          </span>
        )}
      </div>
      {status === RequestState.ERROR && filters.length === 0 ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Your saved filters could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">{error ?? 'The backend may be waking up from inactivity.'}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              dispatch(fetchMyFiltersRequested());
            }}
          >
            Try again
          </Button>
        </div>
      ) : status !== RequestState.SUCCESS && filters.length === 0 ? (
        <div className={GRID}>
          {SKELETON_KEYS.map((key) => (
            <SharedFilterCardSkeleton key={key} />
          ))}
        </div>
      ) : filters.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          You have not saved a filter yet. Open one of your filters below (or start a new one) and choose Save: it is public unless you tick
          Private.
        </p>
      ) : (
        <div className={GRID}>
          {filters.map((filter) => (
            <SharedFilterCard
              key={filter.id}
              filter={filter}
              badges={
                <SavedFilterBadges
                  filter={filter}
                  edited={editedIds.has(filter.id)}
                  status={filterUpdateStatus(filter, sourceRevisions, templateVersions)}
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface SavedFilterBadgesProps {
  readonly filter: SharedFilterSummary;
  readonly edited: boolean;
  readonly status: FilterUpdateStatus;
}

function SavedFilterBadges({ filter, edited, status }: SavedFilterBadgesProps) {
  const sourceLabel = filter.based_on_label ?? 'the original';
  return (
    <>
      {edited && (
        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
          Unsaved changes
        </Badge>
      )}
      {status?.kind === 'update' && (
        <Badge
          variant="outline"
          className="border-sky-500 text-sky-600 dark:text-sky-400"
          title={status.note === null ? `${sourceLabel} has a newer version` : `${sourceLabel}: ${status.note}`}
        >
          Update available
        </Badge>
      )}
      {status?.kind === 'gone' && (
        <Badge variant="outline" className="text-muted-foreground" title={`${sourceLabel} was deleted or made private`}>
          Original no longer shared
        </Badge>
      )}
    </>
  );
}
