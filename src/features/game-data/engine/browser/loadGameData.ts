/**
 * Browser loader for the static game-data bundles in `public/game-data/`.
 *
 * - the manifest is always revalidated (`cache: 'no-cache'`); bundle URLs carry the content hash
 * - one cached promise per file for the lifetime of the page; a failed request clears its entry so a retry refetches
 * - a manifest with a different schema rejects with GameDataSchemaError ("game data out of date, reload")
 */
import {
  GAME_DATA_SCHEMA,
  type AffixesBundle,
  type AreasBundle,
  type BasesBundle,
  type CraftingBundle,
  type CubeBundle,
  type ElixirsBundle,
  type EnhanceBundle,
  type GameDataFile,
  type GameDataManifest,
  type IconsBundle,
  type ItemTextBundle,
  type LootFilterDataBundle,
  type MasteriesBundle,
  type MaterialsBundle,
  type ModifiersBundle,
  type SetsBundle,
  type SkillCalcBundle,
  type SkillDetailsBundle,
  type SkillsBundle,
  type SourcesBundle,
  type SpecializationsBundle,
  type StashBundle,
  type StashNamesBundle,
  type TerrorZonesBundle,
  type TiersBundle,
  type TxtRunewordsBundle,
  type TypesBundle,
} from '../schema.ts';

export interface GameDataBundles {
  types: TypesBundle;
  bases: BasesBundle;
  runewords: TxtRunewordsBundle;
  affixes: AffixesBundle;
  sources: SourcesBundle;
  lootfilter: LootFilterDataBundle;
  enhance: EnhanceBundle;
  cube: CubeBundle;
  materials: MaterialsBundle;
  sets: SetsBundle;
  skills: SkillsBundle;
  skilldetails: SkillDetailsBundle;
  skillcalc: SkillCalcBundle;
  crafting: CraftingBundle;
  tiers: TiersBundle;
  areas: AreasBundle;
  stash: StashBundle;
  stashnames: StashNamesBundle;
  itemtext: ItemTextBundle;
  terrorzones: TerrorZonesBundle;
  modifiers: ModifiersBundle;
  masteries: MasteriesBundle;
  specializations: SpecializationsBundle;
  elixirs: ElixirsBundle;
  icons: IconsBundle;
}

export class GameDataSchemaError extends Error {
  readonly expected: number;
  readonly actual: unknown;

  constructor(actual: unknown) {
    super(`Game data schema ${String(actual)} does not match the app (expected ${String(GAME_DATA_SCHEMA)}). Reload the page.`);
    this.name = 'GameDataSchemaError';
    this.expected = GAME_DATA_SCHEMA;
    this.actual = actual;
  }
}

export class GameDataFetchError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'GameDataFetchError';
    this.status = status;
  }
}

let manifestPromise: Promise<GameDataManifest> | null = null;
const filePromises = new Map<GameDataFile, Promise<unknown>>();

export function gameDataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}game-data/${path}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok)
    throw new GameDataFetchError(`Failed to load ${url}: ${String(response.status)} ${response.statusText}`, response.status);
  const data: unknown = await response.json();
  return data;
}

async function fetchManifest(): Promise<GameDataManifest> {
  const data = await fetchJson(gameDataUrl('manifest.json'), { cache: 'no-cache' });
  const schema = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).schema : undefined;
  if (schema !== GAME_DATA_SCHEMA) throw new GameDataSchemaError(schema);
  return data as GameDataManifest;
}

export function loadManifest(): Promise<GameDataManifest> {
  if (manifestPromise === null) {
    const promise = fetchManifest();
    manifestPromise = promise;
    promise.catch(() => {
      if (manifestPromise === promise) manifestPromise = null;
    });
  }
  return manifestPromise;
}

async function fetchFile(file: GameDataFile): Promise<unknown> {
  const manifest = await loadManifest();
  const entry = manifest.files[file];
  if (entry === undefined) throw new GameDataFetchError(`Game data file "${file}" is not in the manifest`, null);
  return fetchJson(gameDataUrl(`${file}.json?v=${entry.hash}`));
}

export function loadGameDataFile<F extends GameDataFile>(file: F): Promise<GameDataBundles[F]> {
  let promise = filePromises.get(file);
  if (promise === undefined) {
    const created = fetchFile(file);
    promise = created;
    filePromises.set(file, created);
    created.catch(() => {
      if (filePromises.get(file) === created) filePromises.delete(file);
    });
  }
  return promise as Promise<GameDataBundles[F]>;
}

/** Clears all cached promises (tests, or a manual "reload data" action). */
export function resetGameDataCache(): void {
  manifestPromise = null;
  filePromises.clear();
}
