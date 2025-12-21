import { createSelector } from 'reselect';
import type { RootState } from './store';
import { RequestState } from '@/core/types';

// Base selector for core state
const selectCoreState = (state: RootState) => state.core;

export const selectRequestState = createSelector([selectCoreState], (core) => core.requestState);

export const selectIsLoading = createSelector([selectRequestState], (requestState) => requestState === RequestState.LOADING);

export const selectError = createSelector([selectCoreState], (core) => core.error);
