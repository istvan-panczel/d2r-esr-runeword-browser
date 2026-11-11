import { Outlet } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { StashProvider } from '../hooks/StashProvider';

const STASH_FILES = ['stash'] as const;

/**
 * Frame of the My Stash pages (the header's page row links them): title and the shared stash state (StashProvider) once
 * stash.json is loaded, so the upload survives moving between the pages. Character saves have their own page (/character).
 */
export function StashLayout() {
  const gameData = useGameData(STASH_FILES);
  return (
    <PageShell title="My Stash" meta="Your ESR shared stash, read in your browser: the file is never sent anywhere.">
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
