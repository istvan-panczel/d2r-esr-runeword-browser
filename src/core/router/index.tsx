/* eslint-disable react-refresh/only-export-components -- route table, not a component module: it exports `router` and keeps its lazy screens local */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/core/layouts/AppLayout';
import { RouteErrorScreen } from './RouteErrorScreen';
import { NotFoundScreen } from './NotFoundScreen';
import { Spinner } from '@/components/ui/spinner';
import { startBuilds, startLootFilterSharing } from '@/core/startup';
import { loadAfter } from './loadAfter';
import { HomeRoute } from './HomeRoute';

const HomeScreen = lazy(async () => {
  const module = await import('@/features/home');
  return { default: module.HomeScreen };
});

const RunewordsScreen = lazy(async () => {
  const module = await import('@/features/runewords');
  return { default: module.RunewordsScreen };
});

const GemwordsScreen = lazy(async () => {
  const module = await import('@/features/gemwords');
  return { default: module.GemwordsScreen };
});

const GuideLayout = lazy(async () => {
  const module = await import('@/features/guide');
  return { default: module.GuideLayout };
});

const GuideOverviewScreen = lazy(async () => {
  const module = await import('@/features/guide');
  return { default: module.GuideOverviewScreen };
});

const GuideNoteScreen = lazy(async () => {
  const module = await import('@/features/guide');
  return { default: module.GuideNoteScreen };
});

const SocketablesScreen = lazy(async () => {
  const module = await import('@/features/socketables');
  return { default: module.SocketablesScreen };
});

const HtmUniqueItemsScreen = lazy(async () => {
  const module = await import('@/features/htm-unique-items');
  return { default: module.HtmUniqueItemsScreen };
});

const MythicalUniquesScreen = lazy(async () => {
  const module = await import('@/features/mythical-uniques');
  return { default: module.MythicalUniquesScreen };
});

const AscendanciesScreen = lazy(async () => {
  const module = await import('@/features/ascendancies');
  return { default: module.AscendanciesScreen };
});

const SkillsScreen = lazy(async () => {
  const module = await import('@/features/skills');
  return { default: module.SkillsScreen };
});

const SpecializationsScreen = lazy(async () => {
  const module = await import('@/features/specializations');
  return { default: module.SpecializationsScreen };
});
const WeaponMasteriesScreen = lazy(async () => {
  const module = await import('@/features/weapon-masteries');
  return { default: module.WeaponMasteriesScreen };
});

const ModifiersScreen = lazy(async () => {
  const module = await import('@/features/modifiers');
  return { default: module.ModifiersScreen };
});

// The builds screens dispatch fetch requests in mount effects, so they must not mount before the builds saga listens
// (an action dispatched earlier is silently lost and the page stays on skeletons). `startBuilds` is idempotent and
// resolves at once when Supabase is not configured, where the screens show their "not configured" state instead.
const loadBuildsFeature = () => loadAfter(() => import('@/features/builds'), startBuilds);

const BuildsScreen = lazy(async () => {
  const module = await loadBuildsFeature();
  return { default: module.BuildsScreen };
});

const CreateBuildScreen = lazy(async () => {
  const module = await loadBuildsFeature();
  return { default: module.CreateBuildScreen };
});

const EditBuildScreen = lazy(async () => {
  const module = await loadBuildsFeature();
  return { default: module.EditBuildScreen };
});

const BuildDetailScreen = lazy(async () => {
  const module = await loadBuildsFeature();
  return { default: module.BuildDetailScreen };
});

// The profile also lists the author's loot filters, so it waits for the sharing saga too.
const UserProfileScreen = lazy(async () => {
  const [module] = await Promise.all([loadBuildsFeature(), startLootFilterSharing()]);
  return { default: module.UserProfileScreen };
});

const ElixirsScreen = lazy(async () => {
  const module = await import('@/features/elixirs');
  return { default: module.ElixirsScreen };
});

const CampaignMapScreen = lazy(async () => {
  const module = await import('@/features/campaign-map');
  return { default: module.CampaignMapScreen };
});

const TerrorZonesScreen = lazy(async () => {
  const module = await import('@/features/terror-zones');
  return { default: module.TerrorZonesScreen };
});

const GameDataLayout = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.GameDataLayout };
});

const GameDataBasesScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.BasesScreen };
});

const GameDataBestBaseScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.BestBaseScreen };
});

const GameDataAffixesScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.AffixesScreen };
});

const GameDataItemTypesScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.ItemTypesScreen };
});

const GameDataEnhanceScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.EnhanceScreen };
});

const GameDataCubeScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.CubeScreen };
});

const GameDataMaterialsScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.MaterialsScreen };
});

// Areas page
const GameDataAreasScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.AreasScreen };
});

const GameDataSetsScreen = lazy(async () => {
  const module = await import('@/features/game-data');
  return { default: module.SetsScreen };
});

// The loot filter screens dispatch sharing requests (Shared tab, saved filters) on mount, so they wait for the sharing
// saga like the builds screens wait for theirs. Resolves at once without Supabase: drafts work without a backend.
const loadLootFilterFeature = () => loadAfter(() => import('@/features/loot-filter'), startLootFilterSharing);

const LootFilterLayout = lazy(async () => {
  const module = await loadLootFilterFeature();
  return { default: module.LootFilterLayout };
});

const LootFilterLibraryScreen = lazy(async () => {
  const module = await loadLootFilterFeature();
  return { default: module.LootFilterLibraryScreen };
});

const LootFilterEditorScreen = lazy(async () => {
  const module = await loadLootFilterFeature();
  return { default: module.LootFilterEditorScreen };
});

const LootFilterAiScreen = lazy(async () => {
  const module = await loadLootFilterFeature();
  return { default: module.LootFilterAiScreen };
});

const StashLayout = lazy(async () => {
  const module = await import('@/features/stash');
  return { default: module.StashLayout };
});

const StashHomeScreen = lazy(async () => {
  const module = await import('@/features/stash');
  return { default: module.StashHomeScreen };
});

const StashCouponsScreen = lazy(async () => {
  const module = await import('@/features/stash');
  return { default: module.StashCouponsScreen };
});

const StashItemsScreen = lazy(async () => {
  const module = await import('@/features/stash');
  return { default: module.StashItemsScreen };
});

const routeLoadingFallback = (
  <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
    <Spinner className="size-8" />
    <span>Loading page...</span>
  </div>
);

function routeElement(Screen: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={routeLoadingFallback}>
      <Screen />
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <RouteErrorScreen />,
      children: [
        // Bare `/` is the home page; `/?…` (old runewords links) redirects to `/runewords?…`.
        { index: true, element: <HomeRoute>{routeElement(HomeScreen)}</HomeRoute> },
        { path: 'runewords', element: routeElement(RunewordsScreen) },
        {
          path: 'guide',
          element: routeElement(GuideLayout),
          children: [
            { index: true, element: routeElement(GuideOverviewScreen) },
            // The old note map: `/guide` is the only overview now, so old links and bookmarks land there (query dropped).
            // Static segment: the router ranks it above ':slug' (a note with the slug 'map' would be shadowed).
            { path: 'map', element: <Navigate to="/guide" replace /> },
            { path: ':slug', element: routeElement(GuideNoteScreen) },
          ],
        },
        { path: 'gemwords', element: routeElement(GemwordsScreen) },
        { path: 'socketables', element: routeElement(SocketablesScreen) },
        { path: 'uniques', element: routeElement(HtmUniqueItemsScreen) },
        { path: 'mythicals', element: routeElement(MythicalUniquesScreen) },
        { path: 'ascendancies', element: routeElement(AscendanciesScreen) },
        { path: 'skills', element: routeElement(SkillsScreen) },
        { path: 'modifiers', element: routeElement(ModifiersScreen) },
        { path: 'specializations', element: routeElement(SpecializationsScreen) },
        { path: 'weapon-masteries', element: routeElement(WeaponMasteriesScreen) },
        { path: 'elixirs', element: routeElement(ElixirsScreen) },
        { path: 'campaign-map', element: routeElement(CampaignMapScreen) },
        { path: 'terror-zones', element: routeElement(TerrorZonesScreen) },
        {
          path: 'game-data',
          element: routeElement(GameDataLayout),
          children: [
            { index: true, element: <Navigate to="bases" replace /> },
            { path: 'bases', element: routeElement(GameDataBasesScreen) },
            { path: 'sets', element: routeElement(GameDataSetsScreen) },
            { path: 'best-base', element: routeElement(GameDataBestBaseScreen) },
            { path: 'affixes', element: routeElement(GameDataAffixesScreen) },
            { path: 'types', element: routeElement(GameDataItemTypesScreen) },
            { path: 'enhance', element: routeElement(GameDataEnhanceScreen) },
            { path: 'cube', element: routeElement(GameDataCubeScreen) },
            { path: 'materials', element: routeElement(GameDataMaterialsScreen) },
            { path: 'areas', element: routeElement(GameDataAreasScreen) },
          ],
        },
        {
          path: 'loot-filters',
          element: routeElement(LootFilterLayout),
          children: [
            { index: true, element: routeElement(LootFilterLibraryScreen) },
            { path: 'ai', element: routeElement(LootFilterAiScreen) },
            // One screen for the editor routes (the param names, or the path of a bundled template's sandbox, tell
            // them apart), so moving from a draft's route to its saved route after Save keeps the editor mounted.
            // Static segments rank above ':id'.
            { path: 'draft/:draftId', element: routeElement(LootFilterEditorScreen) },
            { path: 'sully', element: routeElement(LootFilterEditorScreen) },
            { path: 'example', element: routeElement(LootFilterEditorScreen) },
            { path: ':id', element: routeElement(LootFilterEditorScreen) },
          ],
        },
        {
          path: 'stash',
          element: routeElement(StashLayout),
          children: [
            { index: true, element: routeElement(StashHomeScreen) },
            { path: 'coupons', element: routeElement(StashCouponsScreen) },
            { path: 'items', element: routeElement(StashItemsScreen) },
          ],
        },
        { path: 'builds', element: routeElement(BuildsScreen) },
        { path: 'builds/new', element: routeElement(CreateBuildScreen) },
        { path: 'builds/:buildId/edit', element: routeElement(EditBuildScreen) },
        { path: 'build/:buildId', element: routeElement(BuildDetailScreen) },
        { path: 'user/:userId', element: routeElement(UserProfileScreen) },
        { path: '*', element: <NotFoundScreen /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
