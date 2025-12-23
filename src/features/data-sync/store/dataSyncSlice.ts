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
}

const initialState: DataSyncState = {
  requestState: RequestState.IDLE,
  error: null,
};

const dataSyncSlice = createSlice({
  name: 'dataSync',
  initialState,
  reducers: {
    // Trigger action
    initDataLoad(state) {
      state.requestState = RequestState.LOADING;
      state.error = null;
    },

    // Success actions (payloads passed to next saga, not stored in state)
    fetchHtmlSuccess(_state, _action: PayloadAction<FetchedHtmlData>) {
      // Saga listens for this, no state change
    },
    parseDataSuccess(_state, _action: PayloadAction<ParsedData>) {
      // Saga listens for this, no state change
    },
    storeDataSuccess(state) {
      state.requestState = RequestState.SUCCESS;
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
  },
});

export const { initDataLoad, fetchHtmlSuccess, fetchHtmlError, parseDataSuccess, parseDataError, storeDataSuccess, storeDataError } =
  dataSyncSlice.actions;

export default dataSyncSlice.reducer;
