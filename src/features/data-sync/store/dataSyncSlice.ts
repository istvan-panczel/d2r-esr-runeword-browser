import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { RequestState } from '@/core/types';
import type { ParsedData } from '../interfaces';

export interface FetchedHtmlData {
  readonly gemsHtml: string;
  readonly runewordsHtml: string;
}

interface DataSyncState {
  readonly requestState: RequestState;
  readonly error: string | null;
  readonly isInitialized: boolean;
  readonly isUsingCachedData: boolean;
  readonly networkWarning: string | null;
}

const initialState: DataSyncState = {
  requestState: RequestState.IDLE,
  error: null,
  isInitialized: false,
  isUsingCachedData: false,
  networkWarning: null,
};

const dataSyncSlice = createSlice({
  name: 'dataSync',
  initialState,
  reducers: {
    // Startup actions
    startupCheck(state) {
      state.requestState = RequestState.LOADING;
      state.error = null;
      state.networkWarning = null;
    },
    startupUseCached(state) {
      state.requestState = RequestState.SUCCESS;
      state.isInitialized = true;
      state.isUsingCachedData = true;
    },
    startupNeedsFetch(state) {
      // Keep loading state, will transition to fetch
      state.isUsingCachedData = false;
    },
    setNetworkWarning(state, action: PayloadAction<string>) {
      state.networkWarning = action.payload;
    },

    // Manual refresh trigger (force bypasses version check)
    initDataLoad(state, _action: PayloadAction<{ force?: boolean } | undefined>) {
      state.requestState = RequestState.LOADING;
      state.error = null;
      state.networkWarning = null;
    },

    // Success actions (payloads passed to next saga, not stored in state)
    fetchHtmlSuccess(_state, _action: PayloadAction<FetchedHtmlData>) {
      // Saga listens for this, no state change
    },
    parseDataSuccess(_state, _action: PayloadAction<ParsedData>) {
      // Saga listens for this, no state change
    },
    storeDataSuccess(_state) {
      // Saga listens for this to trigger affix extraction, no state change yet
    },
    extractAffixesSuccess(state) {
      state.requestState = RequestState.SUCCESS;
      state.isInitialized = true;
      state.isUsingCachedData = false;
    },

    // Error actions
    fetchHtmlError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to fetch data: ${action.payload}`;
    },
    parseDataError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to parse data: ${action.payload}`;
    },
    storeDataError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to store data: ${action.payload}`;
    },
    extractAffixesError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to extract affixes: ${action.payload}`;
    },
    fatalError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = action.payload;
      state.isInitialized = false;
    },
  },
});

export const {
  startupCheck,
  startupUseCached,
  startupNeedsFetch,
  setNetworkWarning,
  initDataLoad,
  fetchHtmlSuccess,
  fetchHtmlError,
  parseDataSuccess,
  parseDataError,
  storeDataSuccess,
  storeDataError,
  extractAffixesSuccess,
  extractAffixesError,
  fatalError,
} = dataSyncSlice.actions;

export default dataSyncSlice.reducer;
