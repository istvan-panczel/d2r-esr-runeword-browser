import { createSlice } from '@reduxjs/toolkit';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Reserved for future core state
interface CoreState {}

const initialState: CoreState = {};

const coreSlice = createSlice({
  name: 'core',
  initialState,
  reducers: {
    // Reserved for future core actions
  },
});

export default coreSlice.reducer;
