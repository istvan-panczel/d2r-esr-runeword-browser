/**
 * Persistence for the loot filter library:
 * - at start, reads `loot-filters/library` from localStorage and dispatches `hydrate`;
 * - after editor edits settle (debounced), dispatches `editorFlushed`, which serializes the model into its entry;
 * - after every library change (including that flush, `flushNow`, and the opens and `close`, which also flush), writes
 *   the library.
 * A refused write (quota) shows one toast until a write succeeds again; editing keeps working in memory.
 */
import { isAnyOf } from '@reduxjs/toolkit';
import { all, call, debounce, put, select, takeEvery } from 'redux-saga/effects';
import type { SagaIterator } from 'redux-saga';
import { toast } from 'sonner';
import type { PersistentStorage } from '@/core/hooks/usePersistentState';
import { readLibrary, writeLibrary } from './libraryStorage';
import {
  addRule,
  addRules,
  chooseRuleStyle,
  close,
  copyToMyFilters,
  createBlank,
  discardChanges,
  duplicate,
  duplicateRule,
  editorFlushed,
  flushNow,
  hydrate,
  importText,
  moveRule,
  open,
  openSaved,
  openSandbox,
  patchRule,
  removeRule,
  remove,
  removeStyle,
  rename,
  renameStyle,
  replaceFilter,
  renumberLevel,
  saveSucceeded,
  savedFilterRenamed,
  setFilterLevels,
  setHeader,
  setNotifications,
  setQualityColors,
  setRuleDisabled,
  setStyle,
  takeUpdate,
  updateRule,
} from './lootFilterSlice';
import type { LootFilterEntry, LootFilterState } from './types';

export const EDITOR_FLUSH_DELAY_MS = 400;
const STORAGE_FULL_MESSAGE = 'Could not save: browser storage is full';

/**
 * Editor actions that change the model (selection is not an edit): each one starts the debounced flush into the
 * library, so a reducer missing here keeps its edit in memory only until the next listed one (lootFilterSaga.test.ts
 * checks that every slice action is either here or a known non-edit).
 */
export const isEditorMutation = isAnyOf(
  setHeader,
  setFilterLevels,
  renumberLevel,
  setNotifications,
  setQualityColors,
  addRule,
  addRules,
  updateRule,
  patchRule,
  chooseRuleStyle,
  setRuleDisabled,
  removeRule,
  moveRule,
  duplicateRule,
  setStyle,
  renameStyle,
  removeStyle,
  replaceFilter
);

/** Actions that can change `library.entries`. */
const isLibraryChange = isAnyOf(
  createBlank,
  importText,
  duplicate,
  rename,
  remove,
  editorFlushed,
  flushNow,
  open,
  openSaved,
  openSandbox,
  close,
  saveSucceeded,
  savedFilterRenamed,
  discardChanges,
  copyToMyFilters,
  takeUpdate
);

export interface LootFilterSagaOptions {
  readonly storage: PersistentStorage | null;
  readonly onSaveFailed: () => void;
  readonly flushDelayMs?: number;
}

const selectEntries = (state: { readonly lootFilter: LootFilterState }): readonly LootFilterEntry[] => state.lootFilter.library.entries;

export function createLootFilterSaga({ storage, onSaveFailed, flushDelayMs = EDITOR_FLUSH_DELAY_MS }: LootFilterSagaOptions) {
  let lastWritten: readonly LootFilterEntry[] | null = null;
  let failureReported = false;

  function* flushEditorSaga(): SagaIterator {
    yield put(editorFlushed());
  }

  function* persistSaga(): SagaIterator {
    const entries = (yield select(selectEntries)) as readonly LootFilterEntry[];
    // `open`/`close` without a pending edit leave the entries untouched: skip the rewrite.
    if (entries === lastWritten) return;
    const saved = (yield call(writeLibrary, storage, entries)) as boolean;
    if (saved) {
      lastWritten = entries;
      failureReported = false;
    } else if (!failureReported) {
      failureReported = true;
      yield call(onSaveFailed);
    }
  }

  return function* lootFilterSaga(): SagaIterator {
    const stored = (yield call(readLibrary, storage)) as readonly LootFilterEntry[];
    yield put(hydrate(stored));
    lastWritten = (yield select(selectEntries)) as readonly LootFilterEntry[];
    yield all([debounce(flushDelayMs, isEditorMutation, flushEditorSaga), takeEvery(isLibraryChange, persistSaga)]);
  };
}

function browserStorage(): PersistentStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const lootFilterSaga = createLootFilterSaga({
  storage: browserStorage(),
  onSaveFailed: () => {
    toast.error(STORAGE_FULL_MESSAGE);
  },
});
