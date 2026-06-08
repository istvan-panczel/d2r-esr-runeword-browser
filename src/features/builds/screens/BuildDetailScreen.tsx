import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Heart, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { asBuildData, type EquipmentSlot, type ItemRef, type WeaponSwapSlot } from '../buildData';
import { compactItems } from '../utils/buildSnapshot';
import { computeBuildItemDiffs } from '../utils/itemDiff';
import { EquipmentGrid } from '../components/EquipmentGrid';
import { WeaponSwapGrid } from '../components/WeaponSwapGrid';
import { AscendancyDisplay } from '../components/AscendancyDisplay';
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

  const esrVersionMeta = useLiveQuery(() => db.metadata.get('esrVersion'));
  const currentEsrVersion = esrVersionMeta?.value ?? null;

  // Per-item ESR diff: re-resolve every referenced item against current local data.
  // Re-runs when the local item tables change (Dexie liveQuery) or the build changes.
  const itemDiffs = useLiveQuery(
    () => (build !== null ? computeBuildItemDiffs(asBuildData(build.build_data)) : Promise.resolve(undefined)),
    [build?.build_data]
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
  const buildData = asBuildData(build.build_data);
  // Only surface diff badges once local data is loaded (esrVersion present); before
  // that, computeBuildItemDiffs would report every item as "missing".
  const diffsReady = currentEsrVersion !== null ? itemDiffs : undefined;
  const playerItems: Partial<Record<EquipmentSlot, ItemRef | null>> = buildData.items ?? {};
  const swapItems: Partial<Record<WeaponSwapSlot, ItemRef | null>> = buildData.weaponSwap ?? {};
  const mercItems: Partial<Record<EquipmentSlot, ItemRef | null>> = buildData.mercenary ?? {};
  const hasPlayerGear = Object.keys(compactItems(playerItems)).length > 0;
  const hasSwap = Object.keys(compactItems(swapItems)).length > 0;
  const hasMerc = Object.keys(compactItems(mercItems)).length > 0;
  const hasAnyGear = hasPlayerGear || hasSwap || hasMerc;
  const charms = buildData.charms ?? [];
  const ascendancyName = buildData.ascendancy ?? null;
  const skills = buildData.skills ?? null;
  const hasSkills = skills !== null && skills.trim().length > 0;
  const hasSidebar = hasDescription || hasSkills || charms.length > 0 || ascendancyName !== null;
  const esrLabel = `ESR ${effectiveVersion ?? 'Unknown'}`;

  return (
    // When there's a sidebar, break out of the app container so the gear column can grow
    // as wide as the browse pages; capped and centered so it isn't edge-to-edge.
    <div className={hasSidebar ? 'mx-[calc(50%_-_50vw)] px-4 sm:px-6' : ''}>
      <div className={hasSidebar ? 'mx-auto w-full max-w-[1920px]' : ''}>
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
                      {author.avatar_url !== null && <AvatarImage src={author.avatar_url} alt="" />}
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
              <Button variant={liked ? 'default' : 'outline'} size="sm" disabled={likePending} onClick={handleLike}>
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

        {/* Gear (main) + textual details (sidebar) */}
        <div className={hasSidebar ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]' : 'flex flex-col gap-6'}>
          <div className="flex flex-col gap-6">
            <section>
              <SectionHeader title="Equipment" />
              {hasAnyGear ? (
                <div className="flex flex-col gap-6">
                  {hasPlayerGear && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Player Gear</h3>
                      <EquipmentGrid items={playerItems} diffs={diffsReady?.items} notes={buildData.itemNotes} />
                    </div>
                  )}
                  {hasSwap && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Weapon Swap</h3>
                      <WeaponSwapGrid items={swapItems} diffs={diffsReady?.weaponSwap} notes={buildData.weaponSwapNotes} />
                    </div>
                  )}
                  {hasMerc && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Mercenary</h3>
                      <EquipmentGrid items={mercItems} diffs={diffsReady?.mercenary} notes={buildData.mercenaryNotes} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No gear has been added to this build yet.</p>
              )}
            </section>
          </div>

          {hasSidebar && (
            <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
              {hasDescription && (
                <section>
                  <SectionHeader title="Description" />
                  <p className="whitespace-pre-wrap text-sm">{build.description}</p>
                </section>
              )}

              {hasSkills && (
                <section>
                  <SectionHeader title="Skills" />
                  <p className="whitespace-pre-wrap text-sm">{skills}</p>
                </section>
              )}

              {charms.length > 0 && (
                <section>
                  <SectionHeader title="Charms" />
                  <div className="flex flex-wrap gap-2">
                    {charms.map((charm, index) => (
                      <Badge key={`${String(index)}-${charm}`} variant="secondary">
                        {charm}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {ascendancyName !== null && (
                <section>
                  <SectionHeader title="Ascendancy" />
                  <AscendancyDisplay name={ascendancyName} />
                </section>
              )}
            </aside>
          )}
        </div>

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
