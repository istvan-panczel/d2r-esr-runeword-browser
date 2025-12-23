import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import coreReducer from './coreSlice';
import dataSyncReducer from '@/features/data-sync/store/dataSyncSlice';
import settingsReducer from '@/features/settings/store/settingsSlice';
import socketablesReducer from '@/features/socketables/store/socketablesSlice';
import runewordsReducer from '@/features/runewords/store/runewordsSlice';
import { rootSaga } from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

const store = configureStore({
  reducer: {
    core: coreReducer,
    dataSync: dataSyncReducer,
    settings: settingsReducer,
    socketables: socketablesReducer,
    runewords: runewordsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
});

export function runSagas() {
  sagaMiddleware.run(rootSaga);
}

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
