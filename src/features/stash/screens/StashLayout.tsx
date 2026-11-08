import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/PageShell';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { CharacterProvider } from '@/features/character/hooks/CharacterProvider';
import { StashProvider } from '../hooks/StashProvider';
import { STASH_PAGES } from './stashPages';

const STASH_FILES = ['stash'] as const;

/**
 * Frame of the My Stash pages: title, sub-page tabs, and the shared stash and character state (StashProvider, CharacterProvider) once stash.json is
 * loaded, so the uploads survive moving between the pages.
 */
export function StashLayout() {
  const gameData = useGameData(STASH_FILES);
  return (
    <PageShell
      title="My Stash"
      meta="Your ESR shared stash and characters, read in your browser: the files are never sent anywhere."
      nav={
        <nav className="flex flex-wrap gap-1" aria-label="My Stash pages">
          {STASH_PAGES.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end
              className={({ isActive }) => cn(SUBTAB_BASE, isActive ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
            >
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
          <CharacterProvider bundle={gameData.data.stash}>
            <Outlet />
          </CharacterProvider>
        </StashProvider>
      )}
    </PageShell>
  );
}
