import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { RequestState } from '@/core/types';

interface CoreState {
  readonly requestState: RequestState;
  readonly error: string | null;
}

const initialState: CoreState = {
  requestState: RequestState.IDLE,
  error: null,
};

const coreSlice = createSlice({
  name: 'core',
  initialState,
  reducers: {
    initDataLoad() {
      // Trigger action - saga will handle the side effects
    },
    setRequestState(state, action: PayloadAction<RequestState>) {
      state.requestState = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { initDataLoad, setRequestState, setError } = coreSlice.actions;
export default coreSlice.reducer;
