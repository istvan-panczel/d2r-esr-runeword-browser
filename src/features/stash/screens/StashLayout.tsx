import { Outlet } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { CharacterProvider } from '@/features/character/hooks/CharacterProvider';
import { StashProvider } from '../hooks/StashProvider';

const STASH_FILES = ['stash'] as const;

/**
 * Frame of the My Stash pages (the header's page row links them): title and the shared stash and character state (StashProvider, CharacterProvider) once stash.json is
 * loaded, so the uploads survive moving between the pages.
 */
export function StashLayout() {
  const gameData = useGameData(STASH_FILES);
  return (
    <PageShell title="My Stash" meta="Your ESR shared stash and characters, read in your browser: the files are never sent anywhere.">
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
