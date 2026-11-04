import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/core/store/store';
import { readPersistentJson, writePersistentJson, type PersistentStorage } from '@/core/hooks/usePersistentState';
import type { ClassCode } from '../engine/schema';
import type { BaseKind, BaseSortKey, BaseTier, BaseView, SortDir } from '../constants/bases';
import { AFFIX_LEVEL_RANGE, type AffixKind, type AffixQuality, type AffixSortKey } from '../constants/affixes';
import { CHARACTER_STORAGE_KEY, DEFAULT_CHARACTER, isCharacter, patchCharacter, type Character } from './character';

/** 'any' = no class filter, 'none' = only bases without a class restriction, ClassCode = only that class's bases. */
export type ClassFilter = 'any' | 'none' | ClassCode;

export interface BaseFilters {
  readonly search: string;
  /** Empty = all kinds */
  readonly kinds: readonly BaseKind[];
  /** Empty = all tiers */
  readonly tiers: readonly BaseTier[];
  /** Selected item-type codes, matched against `base.ancestors`. Empty = all types */
  readonly types: readonly string[];
  /** Minimum of `max(socketCaps)` */
  readonly minSockets: number | null;
  readonly maxReqLvl: number | null;
  readonly classOnly: ClassFilter;
  readonly sort: BaseSortKey;
  readonly sortDir: SortDir;
  /** Cards (sorted) or the family table (sort ignored but kept) */
  readonly view: BaseView;
}

/** HTM runeword (Dexie `runewords`, keyed by name + variant). */
export interface RunewordRef {
  readonly name: string;
  readonly variant: number;
}

export interface BestBaseOptions {
  /** Also list bases whose requirements the character does not meet yet */
  readonly includeUnusable: boolean;
  readonly ethereal: boolean;
  readonly selected: RunewordRef | null;
  /** Manually picked txt runeword key (when the selected runeword has no or the wrong game-file match) */
  readonly txtKeyOverride: string | null;
}

export interface AffixFilters {
  readonly search: string;
  /** Empty = all kinds */
  readonly kinds: readonly AffixKind[];
  readonly rareOnly: boolean;
  /** Affix level range filter (browse mode): the affix's `lvl`–`maxLvl` must overlap it */
  readonly minLvl: number | null;
  readonly maxLvl: number | null;
  /** 'any' = all, 'none' = only affixes without `classspecific`, ClassCode = only that class's affixes */
  readonly cls: ClassFilter;
  /** Item-type codes (browse mode); an affix matches when any is in its itypes and none in its etypes. Empty = all */
  readonly types: readonly string[];
  /** Base code: switches the page to "what can roll" mode */
  readonly base: string | null;
  /** Item level 1–99 (what-can-roll mode) */
  readonly ilvl: number;
  readonly quality: AffixQuality;
  readonly includeAutomagic: boolean;
  readonly sort: AffixSortKey;
  readonly sortDir: SortDir;
}

interface GameDataState {
  readonly bases: BaseFilters;
  /** Persisted in localStorage (`gameData.character`) */
  readonly character: Character;
  readonly bestBase: BestBaseOptions;
  readonly affixes: AffixFilters;
}

export const DEFAULT_BASE_FILTERS: BaseFilters = {
  search: '',
  kinds: [],
  tiers: [],
  types: [],
  minSockets: null,
  maxReqLvl: null,
  classOnly: 'any',
  sort: 'qlvl',
  sortDir: 'asc',
  view: 'cards',
};

export const DEFAULT_BEST_BASE_OPTIONS: BestBaseOptions = {
  includeUnusable: false,
  ethereal: false,
  selected: null,
  txtKeyOverride: null,
};

export const DEFAULT_AFFIX_FILTERS: AffixFilters = {
  search: '',
  kinds: [],
  rareOnly: false,
  minLvl: null,
  maxLvl: null,
  cls: 'any',
  types: [],
  base: null,
  ilvl: AFFIX_LEVEL_RANGE.max,
  quality: 'magic',
  includeAutomagic: true,
  sort: 'lvl',
  sortDir: 'asc',
};

function clampLevel(value: number): number {
  return Math.min(AFFIX_LEVEL_RANGE.max, Math.max(AFFIX_LEVEL_RANGE.min, Math.round(value)));
}

function browserStorage(): PersistentStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

const initialState: GameDataState = {
  bases: DEFAULT_BASE_FILTERS,
  character: readPersistentJson(browserStorage(), CHARACTER_STORAGE_KEY, DEFAULT_CHARACTER, isCharacter),
  bestBase: DEFAULT_BEST_BASE_OPTIONS,
  affixes: DEFAULT_AFFIX_FILTERS,
};

function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

const gameDataSlice = createSlice({
  name: 'gameData',
  initialState,
  reducers: {
    setBaseFilters(state, action: PayloadAction<BaseFilters>) {
      return { ...state, bases: action.payload };
    },
    /** Resets every base filter but keeps the view (cards / families). */
    resetBaseFilters(state) {
      return { ...state, bases: { ...DEFAULT_BASE_FILTERS, view: state.bases.view } };
    },
    setBaseSearch(state, action: PayloadAction<string>) {
      state.bases.search = action.payload;
    },
    toggleBaseKind(state, action: PayloadAction<BaseKind>) {
      state.bases.kinds = toggleValue(state.bases.kinds, action.payload);
    },
    toggleBaseTier(state, action: PayloadAction<BaseTier>) {
      state.bases.tiers = toggleValue(state.bases.tiers, action.payload);
    },
    toggleBaseType(state, action: PayloadAction<string>) {
      state.bases.types = toggleValue(state.bases.types, action.payload);
    },
    /** Selects (`selected: true`) or deselects every listed type code, e.g. a whole picker group. */
    setBaseTypeGroup(state, action: PayloadAction<{ codes: readonly string[]; selected: boolean }>) {
      const { codes, selected } = action.payload;
      const rest = state.bases.types.filter((code) => !codes.includes(code));
      state.bases.types = selected ? [...rest, ...codes] : rest;
    },
    clearBaseTypes(state) {
      state.bases.types = [];
    },
    setBaseMinSockets(state, action: PayloadAction<number | null>) {
      state.bases.minSockets = action.payload;
    },
    setBaseMaxReqLvl(state, action: PayloadAction<number | null>) {
      state.bases.maxReqLvl = action.payload;
    },
    setBaseClassOnly(state, action: PayloadAction<ClassFilter>) {
      state.bases.classOnly = action.payload;
    },
    setBaseSort(state, action: PayloadAction<BaseSortKey>) {
      state.bases.sort = action.payload;
    },
    setBaseSortDir(state, action: PayloadAction<SortDir>) {
      state.bases.sortDir = action.payload;
    },
    setBaseView(state, action: PayloadAction<BaseView>) {
      state.bases.view = action.payload;
    },
    /** Merges, clamps and persists the character (level 1–110, str/dex 0–999). */
    updateCharacter(state, action: PayloadAction<Partial<Character>>) {
      state.character = patchCharacter(state.character, action.payload);
      writePersistentJson(browserStorage(), CHARACTER_STORAGE_KEY, state.character);
    },
    setIncludeUnusable(state, action: PayloadAction<boolean>) {
      state.bestBase.includeUnusable = action.payload;
    },
    setEthereal(state, action: PayloadAction<boolean>) {
      state.bestBase.ethereal = action.payload;
    },
    /** Selects an HTM runeword; a manual txt pick belongs to the previous selection and is cleared. */
    setBestBaseRuneword(state, action: PayloadAction<RunewordRef | null>) {
      const previous = state.bestBase.selected;
      const next = action.payload;
      state.bestBase.selected = next;
      if (previous?.name !== next?.name || previous?.variant !== next?.variant) state.bestBase.txtKeyOverride = null;
    },
    setTxtKeyOverride(state, action: PayloadAction<string | null>) {
      state.bestBase.txtKeyOverride = action.payload;
    },
    setAffixFilters(state, action: PayloadAction<AffixFilters>) {
      return { ...state, affixes: action.payload };
    },
    /** Resets every affix filter but stays in the current mode (base, item level, quality, automods are kept). */
    resetAffixFilters(state) {
      const { base, ilvl, quality, includeAutomagic } = state.affixes;
      return { ...state, affixes: { ...DEFAULT_AFFIX_FILTERS, base, ilvl, quality, includeAutomagic } };
    },
    setAffixSearch(state, action: PayloadAction<string>) {
      state.affixes.search = action.payload;
    },
    toggleAffixKind(state, action: PayloadAction<AffixKind>) {
      state.affixes.kinds = toggleValue(state.affixes.kinds, action.payload);
    },
    setAffixRareOnly(state, action: PayloadAction<boolean>) {
      state.affixes.rareOnly = action.payload;
    },
    setAffixMinLvl(state, action: PayloadAction<number | null>) {
      state.affixes.minLvl = action.payload === null ? null : clampLevel(action.payload);
    },
    setAffixMaxLvl(state, action: PayloadAction<number | null>) {
      state.affixes.maxLvl = action.payload === null ? null : clampLevel(action.payload);
    },
    setAffixClass(state, action: PayloadAction<ClassFilter>) {
      state.affixes.cls = action.payload;
    },
    toggleAffixType(state, action: PayloadAction<string>) {
      state.affixes.types = toggleValue(state.affixes.types, action.payload);
    },
    clearAffixTypes(state) {
      state.affixes.types = [];
    },
    setAffixBase(state, action: PayloadAction<string | null>) {
      state.affixes.base = action.payload;
    },
    setAffixIlvl(state, action: PayloadAction<number>) {
      state.affixes.ilvl = clampLevel(action.payload);
    },
    setAffixQuality(state, action: PayloadAction<AffixQuality>) {
      state.affixes.quality = action.payload;
    },
    setAffixIncludeAutomagic(state, action: PayloadAction<boolean>) {
      state.affixes.includeAutomagic = action.payload;
    },
    setAffixSort(state, action: PayloadAction<AffixSortKey>) {
      state.affixes.sort = action.payload;
    },
    setAffixSortDir(state, action: PayloadAction<SortDir>) {
      state.affixes.sortDir = action.payload;
    },
  },
});

export const {
  setBaseFilters,
  resetBaseFilters,
  setBaseSearch,
  toggleBaseKind,
  toggleBaseTier,
  toggleBaseType,
  setBaseTypeGroup,
  clearBaseTypes,
  setBaseMinSockets,
  setBaseMaxReqLvl,
  setBaseClassOnly,
  setBaseSort,
  setBaseSortDir,
  setBaseView,
  updateCharacter,
  setIncludeUnusable,
  setEthereal,
  setBestBaseRuneword,
  setTxtKeyOverride,
  setAffixFilters,
  resetAffixFilters,
  setAffixSearch,
  toggleAffixKind,
  setAffixRareOnly,
  setAffixMinLvl,
  setAffixMaxLvl,
  setAffixClass,
  toggleAffixType,
  clearAffixTypes,
  setAffixBase,
  setAffixIlvl,
  setAffixQuality,
  setAffixIncludeAutomagic,
  setAffixSort,
  setAffixSortDir,
} = gameDataSlice.actions;

export default gameDataSlice.reducer;

// Selectors
export const selectBaseFilters = (state: RootState): BaseFilters => state.gameData.bases;
export const selectCharacter = (state: RootState): Character => state.gameData.character;
export const selectBestBaseOptions = (state: RootState): BestBaseOptions => state.gameData.bestBase;
export const selectAffixFilters = (state: RootState): AffixFilters => state.gameData.affixes;
