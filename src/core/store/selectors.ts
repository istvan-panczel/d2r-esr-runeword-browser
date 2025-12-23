import { createSelector } from 'reselect';
import type { RootState } from './store';
import { RequestState } from '@/core/types';

// Base selector for dataSync state
const selectDataSyncState = (state: RootState) => state.dataSync;

export const selectRequestState = createSelector([selectDataSyncState], (dataSync) => dataSync.requestState);

export const selectIsLoading = createSelector([selectRequestState], (requestState) => requestState === RequestState.LOADING);

export const selectError = createSelector([selectDataSyncState], (dataSync) => dataSync.error);
