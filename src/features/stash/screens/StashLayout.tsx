import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/PageShell';
import { TAB_ACTIVE, TAB_BASE, TAB_INACTIVE } from '@/core/components/navTabClasses';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { StashProvider } from '../hooks/StashProvider';
import { STASH_PAGES } from './stashPages';

const STASH_FILES = ['stash'] as const;

/**
 * Frame of the My Stash pages: title, sub-page tabs, and the shared stash state (StashProvider) once stash.json is
 * loaded, so the upload survives moving between the pages.
 */
export function StashLayout() {
  const gameData = useGameData(STASH_FILES);
  return (
    <PageShell
      title="My Stash"
      meta="Your ESR shared stash, read in your browser: the file is never sent anywhere."
      nav={
        <nav className="flex flex-wrap gap-1" aria-label="My Stash pages">
          {STASH_PAGES.map((page) => (
            <NavLink key={page.to} to={page.to} end className={({ isActive }) => cn(TAB_BASE, isActive ? TAB_ACTIVE : TAB_INACTIVE)}>
              {page.label}
            </NavLink>
          ))}
        </nav>
      }
    >
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && (
        <StashProvider bundle={gameData.data.stash}>
          <Outlet />
        </StashProvider>
      )}
    </PageShell>
  );
}
