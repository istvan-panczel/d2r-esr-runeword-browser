import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Heart, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProfileAvatarImage } from '@/components/ProfileAvatarImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { hasCrafts } from '../utils/crafts';
import { useCraftData } from '../hooks/useCraftData';
import { useSkillTree } from '../hooks/useSkillTree';
import { hasSkillPoints } from '../utils/skillTree';
import { SkillTreeDisplay } from '../components/SkillTreeDisplay';
import { computeBuildItemDiffs } from '../utils/itemDiff';
import { hasSetItems } from '../utils/setBonuses';
import { SetBonusesBlock } from '../components/SetBonusesBlock';
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

type DetailTab = 'player' | 'skills' | 'mercenary';

const hasText = (value: string | null | undefined): boolean => value !== null && value !== undefined && value.trim().length > 0;

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

  // Parsed again below for rendering; here only to decide whether the crafting bundles are needed.
  const detailData = build !== null ? asBuildData(build.build_data) : null;
  const craftData = useCraftData(
    detailData !== null &&
      (hasCrafts(detailData.itemCrafts) || hasCrafts(detailData.weaponSwapCrafts) || hasCrafts(detailData.mercenaryCrafts))
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // UI-only tab choice; falls back to Player when the chosen tab isn't available for this build.
  const [tab, setTab] = useState<DetailTab>('player');
  // skills.json + skilldetails.json are only fetched when the build has a skill allocation to draw.
  const skillData = useSkillTree(detailData !== null && hasSkillPoints(detailData.skillPoints));

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
  const hasMercNotes = Object.values(buildData.mercenaryNotes ?? {}).some(hasText) || hasCrafts(buildData.mercenaryCrafts);
  const charms = buildData.charms ?? [];
  const ascendancyName = buildData.ascendancy ?? null;
  const skills = buildData.skills ?? null;
  const level = buildData.level ?? null;
  const skillPoints = buildData.skillPoints;
  const hasSkillText = hasText(skills);
  const hasSkills = hasSkillText || level !== null || hasSkillPoints(skillPoints);
  // Charms + ascendancy sit beside the player gear on wide screens.
  const hasPlayerAside = charms.length > 0 || ascendancyName !== null;
  const availableTabs: readonly DetailTab[] = [
    'player',
    ...(hasSkills ? (['skills'] as const) : []),
    ...(hasMerc || hasMercNotes ? (['mercenary'] as const) : []),
  ];
  const activeTab: DetailTab = availableTabs.includes(tab) ? tab : 'player';
  const esrLabel = `ESR ${effectiveVersion ?? 'Unknown'}`;

  return (
    // When there's a sidebar, break out of the app container so the gear column can grow
    // as wide as the browse pages; capped and centered so it isn't edge-to-edge.
    <div className={hasPlayerAside ? 'mx-[calc(50%_-_50vw)] px-4 sm:px-6' : ''}>
      <div className={hasPlayerAside ? 'mx-auto w-full max-w-[1920px]' : ''}>
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

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setTab(value as DetailTab);
          }}
          className="gap-4"
        >
          {availableTabs.length > 1 && (
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="player" className="sm:px-4">
                Player
              </TabsTrigger>
              {hasSkills && (
                <TabsTrigger value="skills" className="sm:px-4">
                  Skills
                </TabsTrigger>
              )}
              {(hasMerc || hasMercNotes) && (
                <TabsTrigger value="mercenary" className="sm:px-4">
                  Mercenary
                </TabsTrigger>
              )}
            </TabsList>
          )}

          <TabsContent value="player">
            <div className={hasPlayerAside ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]' : 'flex flex-col gap-6'}>
              <section>
                <SectionHeader title="Equipment" />
                {hasPlayerGear || hasSwap ? (
                  <div className="flex flex-col gap-6">
                    {hasPlayerGear && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Player Gear</h3>
                        <EquipmentGrid
                          items={playerItems}
                          diffs={diffsReady?.items}
                          notes={buildData.itemNotes}
                          crafts={buildData.itemCrafts}
                          craftData={craftData}
                        />
                        {hasSetItems(playerItems) && <SetBonusesBlock items={playerItems} />}
                      </div>
                    )}
                    {hasSwap && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Weapon Swap</h3>
                        <WeaponSwapGrid
                          items={swapItems}
                          diffs={diffsReady?.weaponSwap}
                          notes={buildData.weaponSwapNotes}
                          crafts={buildData.weaponSwapCrafts}
                          craftData={craftData}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {hasMerc ? 'No player gear has been added to this build yet.' : 'No gear has been added to this build yet.'}
                  </p>
                )}
              </section>

              {hasPlayerAside && (
                <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
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
          </TabsContent>

          {hasSkills && (
            <TabsContent value="skills">
              <section className="flex flex-col gap-4">
                <SectionHeader title="Skills" />
                {level !== null && <p className="text-sm font-medium">Level {level}</p>}
                {hasSkillText && <p className="whitespace-pre-wrap text-sm">{skills}</p>}
                {hasSkillPoints(skillPoints) && (
                  <SkillTreeDisplay characterClass={build.class} skillPoints={skillPoints} skillData={skillData} />
                )}
              </section>
            </TabsContent>
          )}

          {(hasMerc || hasMercNotes) && (
            <TabsContent value="mercenary">
              <section>
                <SectionHeader title="Mercenary Gear" />
                <EquipmentGrid
                  items={mercItems}
                  diffs={diffsReady?.mercenary}
                  notes={buildData.mercenaryNotes}
                  crafts={buildData.mercenaryCrafts}
                  craftData={craftData}
                />
                {hasSetItems(mercItems) && <SetBonusesBlock items={mercItems} />}
              </section>
            </TabsContent>
          )}
        </Tabs>

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
