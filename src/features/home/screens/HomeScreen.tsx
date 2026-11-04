import { useSelector } from 'react-redux';
import { selectAuthIsConfigured } from '@/features/auth';
import { HomeCommunityTools } from '../components/HomeCommunityTools';
import { HomeFooter } from '../components/HomeFooter';
import { HomeOfficialLinks } from '../components/HomeOfficialLinks';
import { HomeHero } from '../components/HomeHero';
import { HomeSections } from '../components/HomeSections';
// Hidden for now, see the note in the JSX below.
// import { HomeStartHere } from '../components/HomeStartHere';
import { LatestBuilds } from '../components/LatestBuilds';
import { LatestLootFilters } from '../components/LatestLootFilters';

/**
 * Home page (`/`): what the site offers. Renders without the startup loading gate (see staticBundleRoutes.ts); the
 * parts that need the synced item data (search over item names, the docs version) fill in once the sync has run.
 */
export function HomeScreen() {
  const isSupabaseEnabled = useSelector(selectAuthIsConfigured);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <HomeHero />
      <HomeSections />
      {isSupabaseEnabled && <LatestBuilds />}
      {isSupabaseEnabled && <LatestLootFilters />}
      {/*
        "New to ESR? Start here" (HomeStartHere) is hidden on purpose (2026-11-04): it no longer does its job of pointing
        new players to the right place. The component is kept and will be revisited; restore the import above to show it.
        <HomeStartHere />
      */}
      <HomeOfficialLinks />
      <HomeCommunityTools />
      <HomeFooter />
    </div>
  );
}
