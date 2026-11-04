import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Heart, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProfileAvatarImage } from '@/components/ProfileAvatarImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SectionHeader } from '@/components/SectionHeader';
import { db } from '@/core/db';
import { RequestState } from '@/core/types';
import { avatarInitials, formatProfileTag, openSignInDialog, selectAuthUserId, selectIsAuthenticated } from '@/features/auth';
import { selectPageWidth } from '@/features/settings';
import { asBuildData } from '../buildData';
import { useCraftData } from '../hooks/useCraftData';
import { useSkillTree } from '../hooks/useSkillTree';
import { hasSkillPoints } from '../utils/skillTree';
import { unpackVariants, variantAt, variantHasCrafts, variantLabel } from '../utils/buildVariants';
import { computeVariantItemDiffs } from '../utils/itemDiff';
import { VARIANT_PARAM, variantIndexFromParam, variantParamValue } from '../utils/variantParam';
import { VariantDetail, type DetailTab } from '../components/VariantDetail';
import { VariantSelector } from '../components/VariantSelector';
import { ExportBuildButton } from '../components/ExportBuildButton';
import {
  clearDetail,
  deleteBuildRequested,
  fetchBuildRequested,
  selectDeleteStatus,
  selectDetailBuild,
  selectDetailLiked,
  selectDetailNotFound,
  selectDetailStatus,
  selectLikePending,
  toggleLikeRequested,
} from '../store';

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function BuildDetailScreen() {
  const { buildId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const build = useSelector(selectDetailBuild);
  const status = useSelector(selectDetailStatus);
  const notFound = useSelector(selectDetailNotFound);
  const liked = useSelector(selectDetailLiked);
  const likePending = useSelector(selectLikePending);
  const deleteStatus = useSelector(selectDeleteStatus);

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUserId = useSelector(selectAuthUserId);
  const pageWidth = useSelector(selectPageWidth);

  const esrVersionMeta = useLiveQuery(() => db.metadata.get('esrVersion'));
  const currentEsrVersion = esrVersionMeta?.value ?? null;

  // The shown variant is `?variant=N` (1-based) so a copied link opens it; a bad value shows the first.
  const [searchParams, setSearchParams] = useSearchParams();
  const variantList = build !== null ? unpackVariants(asBuildData(build.build_data)) : [];
  const variantIndex = variantIndexFromParam(searchParams.get(VARIANT_PARAM), variantList.length);
  const selectVariant = (index: number) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        const value = variantParamValue(index);
        if (value === null) params.delete(VARIANT_PARAM);
        else params.set(VARIANT_PARAM, value);
        return params;
      },
      { replace: true }
    );
  };

  // Per-item ESR diff of the shown variant: re-resolve every referenced item (main and alternatives) against
  // current local data. Re-runs when the local item tables change (Dexie liveQuery), the build or the variant changes.
  // Tagged with the variant index so a previous variant's result is never shown on the next one.
  const variantDiffs = useLiveQuery(async () => {
    if (build === null) return undefined;
    const diffs = await computeVariantItemDiffs(variantAt(asBuildData(build.build_data), variantIndex));
    return { index: variantIndex, diffs };
  }, [build?.build_data, variantIndex]);

  // The crafting and skill bundles load when any variant needs them, so a variant switch never shows them loading.
  const craftData = useCraftData(variantList.some(variantHasCrafts));

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // UI-only tab choice; falls back to Player when the chosen tab isn't available for the shown variant.
  const [tab, setTab] = useState<DetailTab>('player');
  // skills.json + skilldetails.json are only fetched when the build has a skill allocation to draw.
  const skillData = useSkillTree(variantList.some((variant) => hasSkillPoints(variant.skillPoints)));

  useEffect(() => {
    if (buildId === undefined) return;
    dispatch(fetchBuildRequested(buildId));
    return () => {
      dispatch(clearDetail());
    };
  }, [dispatch, buildId]);

  useEffect(() => {
    if (deleteStatus === RequestState.SUCCESS) {
      void navigate('/builds', { replace: true });
    }
  }, [deleteStatus, navigate]);

  const handleLike = () => {
    if (!isAuthenticated) {
      dispatch(openSignInDialog());
      return;
    }
    dispatch(toggleLikeRequested());
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-bold">Build not found</h1>
        <p className="mt-2 text-muted-foreground">This build may have been deleted.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/builds">Back to builds</Link>
        </Button>
      </div>
    );
  }

  if (build === null) {
    if (status === RequestState.ERROR) {
      return (
        <div className="mx-auto max-w-2xl py-16 text-center">
          <p className="text-muted-foreground">Couldn’t load this build. The backend may be waking up.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              if (buildId !== undefined) dispatch(fetchBuildRequested(buildId));
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    // Loading / idle.
    return (
      <div>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-3 h-5 w-40" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    );
  }

  const author = build.profiles;
  const isOwner = currentUserId !== null && currentUserId === build.user_id;
  const updatedVersion = build.esr_version_updated;
  const effectiveVersion = updatedVersion ?? build.esr_version;
  const versionMismatch = effectiveVersion !== null && currentEsrVersion !== null && effectiveVersion !== currentEsrVersion;
  const hasDescription = build.description !== null && build.description.trim().length > 0;
  const variant = variantList[variantIndex];
  // Only surface diff badges once local data is loaded (esrVersion present); before
  // that, computeVariantItemDiffs would report every item as "missing".
  const diffsReady = currentEsrVersion !== null && variantDiffs?.index === variantIndex ? variantDiffs.diffs : undefined;
  // Charms + ascendancy sit beside the player gear on wide screens, so the Standard page breaks out for them. Any
  // variant with them does it, so a variant switch never changes the page frame.
  const hasPlayerAside = variantList.some((entry) => (entry.charms?.length ?? 0) > 0 || (entry.ascendancy ?? null) !== null);
  const breakout = hasPlayerAside && pageWidth === 'standard';
  const esrLabel = `ESR ${effectiveVersion ?? 'Unknown'}`;

  return (
    // With the sidebar and the Standard page width, break out of the app container so the gear column can grow;
    // capped at 1920 px and centered so it isn't edge-to-edge. Wide and Full need no breakout: the app frame itself is
    // 1920 px (Wide) or the whole window (Full), and the page lines up with the header. Without the sidebar the page
    // fills the app frame. Wide and Full make the page the `page` container (like PageShell), so the gear can use the
    // extra room; Standard has no container, so the `@…/page:` classes below never apply there.
    <div className={breakout ? 'mx-[calc(50%_-_50vw)] px-4 sm:px-6' : ''}>
      <div className={breakout ? 'mx-auto w-full max-w-[1920px]' : pageWidth === 'standard' ? '' : '@container/page'}>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/builds">
            <ArrowLeft className="size-4" />
            Builds
          </Link>
        </Button>

        {/* Summary header band */}
        <Card className="mb-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{build.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                <Badge variant="secondary">{build.class}</Badge>
                {author !== null && (
                  <Link to={`/user/${build.user_id}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Avatar className="size-5">
                      <ProfileAvatarImage url={author.avatar_url} />
                      <AvatarFallback className="text-[10px]">{avatarInitials(author.display_name)}</AvatarFallback>
                    </Avatar>
                    {formatProfileTag(author.display_name, author.discriminator)}
                  </Link>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {dateFormatter.format(new Date(build.created_at))}
                </span>
                <Badge
                  variant="outline"
                  className={versionMismatch ? 'border-amber-500 text-amber-600 dark:text-amber-400' : undefined}
                  title={versionMismatch ? `You are on ESR ${currentEsrVersion}` : undefined}
                >
                  {esrLabel}
                </Badge>
              </div>
              {updatedVersion !== null && updatedVersion !== build.esr_version && (
                <p className="text-xs text-muted-foreground">
                  Created on ESR {build.esr_version ?? 'Unknown'}, updated on ESR {updatedVersion}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant={liked ? 'default' : 'outline'}
                size="sm"
                disabled={likePending}
                onClick={handleLike}
                aria-pressed={liked}
                aria-label={`Like this build (${String(build.likes_count)} ${build.likes_count === 1 ? 'like' : 'likes'})`}
              >
                <Heart className={liked ? 'size-4 fill-current' : 'size-4'} />
                {build.likes_count}
              </Button>
              <CopyLinkButton />
              <ExportBuildButton build={build} />
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="More actions">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/builds/${build.id}/edit`}>
                        <Pencil className="size-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {versionMismatch && (
            <div className="mt-4 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              This build was created on ESR {effectiveVersion} (you are on {currentEsrVersion}) — check the changelogs for balance changes.
            </div>
          )}
        </Card>

        {hasDescription && (
          <section className="mb-6">
            <SectionHeader title="Description" />
            <p className="whitespace-pre-wrap text-sm">{build.description}</p>
          </section>
        )}

        {variantList.length > 1 && (
          <VariantSelector
            labels={variantList.map((entry, index) => variantLabel(entry, index))}
            activeIndex={variantIndex}
            onSelect={selectVariant}
            note={variant.variantNote}
          />
        )}

        <VariantDetail
          key={variantIndex}
          variant={variant}
          characterClass={build.class}
          diffs={diffsReady}
          craftData={craftData}
          skillData={skillData}
          tab={tab}
          onTabChange={setTab}
        />

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete this build?</DialogTitle>
              <DialogDescription>
                This permanently deletes “{build.name}” and all its likes. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleteStatus === RequestState.LOADING}
                onClick={() => {
                  if (buildId !== undefined) dispatch(deleteBuildRequested(buildId));
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
