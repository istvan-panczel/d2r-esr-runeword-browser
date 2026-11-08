import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import type { GameDataManifest, ItemTextBundle, SkillsBundle, StashNamesBundle } from '@/features/game-data/engine/schema';
import { stashCatalog, withNames } from '@/features/stash/engine/catalog';
import type { ItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { itemTextContext } from '@/features/stash/hooks/useItemText';
import { useStashTypes } from '@/features/stash/hooks/useStashTypes';
import { CharacterGate } from '../components/CharacterGate';
import { CharacterItemSections } from '../components/CharacterItemSections';
import { CharacterHeader, CharacterSheet } from '../components/CharacterSheet';
import { SaveNotices } from '../components/SaveNotices';
import type { CharacterFileMeta } from '../db/characterDb';
import { buildCharacterItems } from '../engine/characterItems';
import { baseAttributeRows, hotkeyRows, skillNames, skillPointsByTab } from '../engine/characterSheet';
import { corpseNotice, incompleteNotice, saveAgeNotice, sidecarNotice, type SaveNotice } from '../engine/notices';
import { useCharacter } from '../hooks/useCharacter';
import { assessSaveAge } from '../parser/saveAge';
import type { CharacterFile } from '../parser/types';

const FILES = ['stashnames', 'skills', 'itemtext'] as const;

/** /stash/character: an uploaded character save: sheet, gear and items. Everything stays in the browser. */
export function CharacterScreen() {
  const types = useStashTypes();
  const gameData = useGameData(FILES);
  return (
    <CharacterGate>
      {(character, file) => {
        if (types.status === 'loading' || gameData.status === 'loading') return <GameDataLoading />;
        if (types.status === 'error') return <GameDataError error={types.error} onRetry={types.retry} />;
        if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
        return (
          <CharacterPage
            character={character}
            file={file}
            names={gameData.data.stashnames}
            skills={gameData.data.skills}
            text={gameData.data.itemtext}
            types={types.types}
          />
        );
      }}
    </CharacterGate>
  );
}

interface CharacterPageProps {
  readonly character: CharacterFile;
  readonly file: CharacterFileMeta;
  readonly names: StashNamesBundle;
  readonly skills: SkillsBundle;
  readonly text: ItemTextBundle;
  readonly types: ItemTypeIndex;
}

function noticesFor(character: CharacterFile, file: CharacterFileMeta, manifest: GameDataManifest | null): SaveNotice[] {
  const age =
    manifest === null
      ? null
      : saveAgeNotice(
          assessSaveAge({
            lastSavedAt: character.lastSavedAt,
            sidecarVersion: file.sidecar.status === 'matched' ? file.sidecar.esrVersion : null,
            bundleVersion: manifest.esrVersion,
            bundleDate: manifest.esrDate,
          })
        );
  return [
    age,
    sidecarNotice(file.sidecar),
    character.incomplete === null ? null : incompleteNotice(character.incomplete),
    corpseNotice(character.items.corpses.length),
  ].filter((notice) => notice !== null);
}

function CharacterPage({ character, file, names, skills, text, types }: CharacterPageProps) {
  const { bundle } = useCharacter();
  const manifest = useManifest();
  const catalog = stashCatalog(withNames(bundle, names), types);
  const itemText = itemTextContext(text, catalog);
  const nameOf = skillNames(text.skills);
  const view = buildCharacterItems(character, catalog, itemText);

  return (
    <div className="space-y-6">
      <CharacterHeader character={character} />
      <SaveNotices notices={noticesFor(character, file, manifest)} />
      <CharacterSheet
        attributes={baseAttributeRows(character)}
        skills={skillPointsByTab(character, nameOf, skills.classes)}
        hotkeys={hotkeyRows(character, nameOf)}
      />
      <CharacterItemSections view={view} />
    </div>
  );
}
