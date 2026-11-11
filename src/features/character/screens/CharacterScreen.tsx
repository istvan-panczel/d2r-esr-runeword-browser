import { PageShell } from '@/components/PageShell';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { CharacterGate } from '../components/CharacterGate';
import { CharacterTabBar } from '../components/CharacterTabBar';
import { CombatTab } from '../components/tabs/CombatTab';
import { GearTab } from '../components/tabs/GearTab';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { ProgressTab } from '../components/tabs/ProgressTab';
import { SkillsTab } from '../components/tabs/SkillsTab';
import { StorageTab } from '../components/tabs/StorageTab';
import type { CharacterFileMeta } from '../db/characterDb';
import { CHARACTER_TAB_PANEL_ID, characterTabId, type CharacterTab } from '../engine/characterTabs';
import { CharacterProvider } from '../hooks/CharacterProvider';
import { useCharacterTab } from '../hooks/useCharacterTab';
import type { CharacterFile } from '../parser/types';

const FILES = ['stash'] as const;

interface CharacterPageProps {
  readonly character: CharacterFile;
  readonly file: CharacterFileMeta;
  readonly bytes: Uint8Array;
}

interface TabBodyProps extends CharacterPageProps {
  readonly tab: CharacterTab;
  readonly onTab: (tab: CharacterTab) => void;
}

function TabBody({ tab, character, file, bytes, onTab }: TabBodyProps) {
  switch (tab) {
    case 'overview':
      return <OverviewTab character={character} file={file} bytes={bytes} onTab={onTab} />;
    case 'gear':
      return <GearTab character={character} />;
    case 'skills':
      return <SkillsTab character={character} />;
    case 'combat':
      return <CombatTab character={character} />;
    case 'storage':
      return <StorageTab character={character} />;
    case 'progress':
      return <ProgressTab character={character} />;
  }
}

function CharacterPage({ character, file, bytes }: CharacterPageProps) {
  const [tab, setTab] = useCharacterTab();
  return (
    <div className="space-y-4">
      <CharacterTabBar tab={tab} onChange={setTab} />
      <div id={CHARACTER_TAB_PANEL_ID} role="tabpanel" aria-labelledby={characterTabId(tab)}>
        <TabBody tab={tab} character={character} file={file} bytes={bytes} onTab={setTab} />
      </div>
    </div>
  );
}

/**
 * /character: the uploaded character saves, one shown at a time (switcher), in tabs kept in `?tab=`. Everything stays in
 * the browser. stash.json is loaded first: the parser needs its stat and item tables.
 */
export function CharacterScreen() {
  const gameData = useGameData(FILES);
  return (
    <PageShell
      title="My Character"
      meta="Your ESR characters, read from their save files in your browser: the files are never sent anywhere."
    >
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && (
        <CharacterProvider bundle={gameData.data.stash}>
          <CharacterGate>{(character, file, bytes) => <CharacterPage character={character} file={file} bytes={bytes} />}</CharacterGate>
        </CharacterProvider>
      )}
    </PageShell>
  );
}
