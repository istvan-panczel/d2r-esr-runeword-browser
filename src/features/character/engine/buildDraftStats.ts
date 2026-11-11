/**
 * Character save → the character stats block of a build (VariantData.stats, see src/features/builds/buildStats.ts): the
 * computed sheet for the save's own difficulty, unbuffed, as its compact snapshot, kept to the stored keys and ranges.
 * Pure and never throws: a failure gives null (the import goes on without stats) or an error to show.
 */
import { asBuildStats, STAT_KEYS, type BuildStats } from '@/features/builds/buildStats';
import type { CharSheetBundle, ItemTextBundle, StashBundle } from '@/features/game-data/engine/schema';
import { createCharacterData } from '../parser/characterData';
import { CharacterParseError, type CharacterSectionName } from '../parser/errors';
import { parseCharacter } from '../parser/parseCharacter';
import type { CharacterFile } from '../parser/types';
import { computeCharacterSheet, createSheetData, toStatsSnapshot, type CharacterStatsSnapshot, type SheetData } from './sheet';

/** The stored stats block of a snapshot: the numbers the block keeps (no level: the variant holds it) and the provenance. */
export function buildStatsFromSnapshot(snapshot: CharacterStatsSnapshot, character: string): BuildStats | null {
  const values = Object.fromEntries(STAT_KEYS.flatMap((key) => (snapshot[key] === undefined ? [] : [[key, snapshot[key]] as const])));
  // Through the validator, so a number outside the stored range is dropped exactly as it would be on read
  return (
    asBuildStats({
      source: 'save',
      difficulty: snapshot.difficulty,
      ...(snapshot.buf === 1 ? { buffed: true } : {}),
      character,
      savedAt: snapshot.savedAt,
      ...(snapshot.esrVersion === undefined ? {} : { esrVersion: snapshot.esrVersion }),
      values,
    }) ?? null
  );
}

/** Early stops that leave the player's own items whole, so the sheet is still right */
const STOPS_AFTER_PLAYER_ITEMS: ReadonlySet<CharacterSectionName> = new Set(['corpses', 'merc-items', 'golem', 'bound-demon', 'summons']);

/**
 * The stats of a parsed save (its own difficulty, no buffs); null when the sheet could not be computed, or the parse
 * stopped before the player's items were all read (the numbers would be missing gear).
 */
export function computeBuildStats(file: CharacterFile, sheetData: SheetData, esrVersion: string | null): BuildStats | null {
  if (file.incomplete !== null && !STOPS_AFTER_PLAYER_ITEMS.has(file.incomplete.section)) return null;
  try {
    const sheet = computeCharacterSheet(file, sheetData);
    const snapshot = toStatsSnapshot(sheet, { savedAt: file.lastSavedAt, ...(esrVersion === null ? {} : { esrVersion }) });
    return buildStatsFromSnapshot(snapshot, file.name);
  } catch (error) {
    console.error('Could not compute the character stats from the save:', error);
    return null;
  }
}

/** The sheet's game data, or null when the bundles are missing or do not fit (the import then goes on without stats). */
export function sheetDataOf(charsheet: CharSheetBundle, itemtext: ItemTextBundle): SheetData | null {
  try {
    return createSheetData(charsheet, itemtext);
  } catch (error) {
    console.error('Could not read the character sheet data:', error);
    return null;
  }
}

export interface StatsBundles {
  readonly stash: StashBundle;
  readonly charsheet: CharSheetBundle;
  readonly itemtext: ItemTextBundle;
}

export type SaveStatsResult =
  | { readonly ok: true; readonly stats: BuildStats }
  | { readonly ok: false; readonly error: { readonly title: string; readonly message: string } };

/** "Fill from a save file" in the build form: only the stats of a picked .d2s, never anything else from it. */
export function statsFromSaveBytes(bytes: Uint8Array, fileName: string, bundles: StatsBundles): SaveStatsResult {
  let file: CharacterFile;
  try {
    file = parseCharacter(bytes, createCharacterData(bundles.stash));
  } catch (error) {
    if (error instanceof CharacterParseError) return { ok: false, error: { title: 'Could not read this save', message: error.message } };
    console.error('Could not read the save for its stats:', error);
    return { ok: false, error: { title: 'Something went wrong', message: `"${fileName}" could not be read.` } };
  }
  const sheetData = sheetDataOf(bundles.charsheet, bundles.itemtext);
  const stats = sheetData === null ? null : computeBuildStats(file, sheetData, null);
  if (stats === null) {
    return {
      ok: false,
      error: { title: 'Stats not available', message: `The stats of "${fileName}" could not be computed. You can enter them by hand.` },
    };
  }
  return { ok: true, stats };
}
