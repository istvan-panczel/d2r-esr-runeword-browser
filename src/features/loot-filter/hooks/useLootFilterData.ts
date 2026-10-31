import { useGameData, type GameDataStatus } from '@/features/game-data/hooks/useGameData';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { buildLootFilterReference, EMPTY_LOOT_FILTER_REFERENCE } from '../engine/reference';
import type { LootFilterReference } from '../engine/types';
import {
  buildLookup,
  buildPickerOptions,
  EMPTY_LOOKUP,
  EMPTY_PICKER_OPTIONS,
  type LootFilterLookup,
  type LootFilterPickerOptions,
} from '../utils/lookup';
import { buildStatParamData, EMPTY_STAT_PARAMS, type StatParamData } from '../utils/statParams';

export interface LootFilterData {
  readonly status: GameDataStatus;
  readonly data: LootFilterDataBundle | null;
  readonly types: TypesBundle | null;
  /** Names for codes and ids; every lookup returns undefined until the bundles are in. */
  readonly lookup: LootFilterLookup;
  /** The pickers' option lists; empty until the bundles are in (the pickers then take typed codes and ids). */
  readonly options: LootFilterPickerOptions;
  /** Skills, classes, tabs and known params of the layered stats; empty until the bundles are in. */
  readonly params: StatParamData;
  /** The validator's game-data lookups; the empty reference (no reference checks) until the bundles are in or on error. */
  readonly reference: LootFilterReference;
}

const BUNDLES = ['lootfilter', 'types'] as const;

const EMPTY = {
  data: null,
  types: null,
  lookup: EMPTY_LOOKUP,
  options: EMPTY_PICKER_OPTIONS,
  params: EMPTY_STAT_PARAMS,
  reference: EMPTY_LOOT_FILTER_REFERENCE,
};
const LOADING: LootFilterData = { status: 'loading', ...EMPTY };
const ERROR: LootFilterData = { status: 'error', ...EMPTY };

// One derived object per loaded bundle pair: the bundles are cached for the page's lifetime, so the maps, option
// lists and the validator's reference are built once and every component shares them. A stable identity also
// keeps the diagnostics selector (which memoizes on the reference) from recomputing.
let cached: LootFilterData | null = null;

function ready(data: LootFilterDataBundle, types: TypesBundle): LootFilterData {
  if (cached?.data !== data || cached.types !== types) {
    const params = buildStatParamData(data, types);
    cached = {
      status: 'ready',
      data,
      types,
      lookup: buildLookup(data, types, params),
      options: buildPickerOptions(data, types),
      params,
      reference: buildLootFilterReference(data, types),
    };
  }
  return cached;
}

/** Loads the `lootfilter` and `types` bundles for the rule editor's pickers, summaries, names and the validator. */
export function useLootFilterData(): LootFilterData {
  const gameData = useGameData(BUNDLES);
  if (gameData.status === 'ready') return ready(gameData.data.lootfilter, gameData.data.types);
  return gameData.status === 'loading' ? LOADING : ERROR;
}
