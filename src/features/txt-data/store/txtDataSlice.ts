import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { RequestState } from '@/core/types';
import type { TxtFilesData, ParsedTxtData } from '@/core/db';

interface TxtDataState {
  readonly requestState: RequestState;
  readonly error: string | null;
  readonly isInitialized: boolean;
  readonly lastUpdated: string | null;
}

const initialState: TxtDataState = {
  requestState: RequestState.IDLE,
  error: null,
  isInitialized: false,
  lastUpdated: null,
};

const txtDataSlice = createSlice({
  name: 'txtData',
  initialState,
  reducers: {
    // Startup check - triggered on app start to auto-parse if needed
    startupTxtCheck(state) {
      state.requestState = RequestState.LOADING;
      state.error = null;
    },

    // Trigger data loading
    initTxtDataLoad(state, _action: PayloadAction<{ force?: boolean } | undefined>) {
      state.requestState = RequestState.LOADING;
      state.error = null;
    },

    // Already have cached data
    loadCachedTxtData(state, action: PayloadAction<string>) {
      state.requestState = RequestState.SUCCESS;
      state.isInitialized = true;
      state.lastUpdated = action.payload;
    },

    // Success actions (payloads passed to next saga step)
    fetchTxtFilesSuccess(_state, _action: PayloadAction<TxtFilesData>) {
      // Saga listens for this
    },
    parseTxtDataSuccess(_state, _action: PayloadAction<ParsedTxtData>) {
      // Saga listens for this
    },
    storeTxtDataSuccess(state) {
      state.requestState = RequestState.SUCCESS;
      state.isInitialized = true;
      state.lastUpdated = new Date().toISOString();
    },

    // Error actions
    fetchTxtFilesError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to fetch TXT files: ${action.payload}`;
    },
    parseTxtDataError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to parse TXT data: ${action.payload}`;
    },
    storeTxtDataError(state, action: PayloadAction<string>) {
      state.requestState = RequestState.ERROR;
      state.error = `Failed to store TXT data: ${action.payload}`;
    },
  },
});

export const {
  startupTxtCheck,
  initTxtDataLoad,
  loadCachedTxtData,
  fetchTxtFilesSuccess,
  fetchTxtFilesError,
  parseTxtDataSuccess,
  parseTxtDataError,
  storeTxtDataSuccess,
  storeTxtDataError,
} = txtDataSlice.actions;

// Selectors
type RootState = { txtData: TxtDataState };

export const selectTxtDataIsLoading = (state: RootState) => state.txtData.requestState === RequestState.LOADING;
export const selectTxtDataIsInitialized = (state: RootState) => state.txtData.isInitialized;
export const selectTxtDataError = (state: RootState) => state.txtData.error;
export const selectTxtDataLastUpdated = (state: RootState) => state.txtData.lastUpdated;

export default txtDataSlice.reducer;
