import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import coreReducer from './coreSlice';
import dataSyncReducer from '@/features/data-sync/store/dataSyncSlice';
import settingsReducer from '@/features/settings/store/settingsSlice';
import socketablesReducer from '@/features/socketables/store/socketablesSlice';
import runewordsReducer from '@/features/runewords/store/runewordsSlice';
import gemwordsReducer from '@/features/gemwords/store/gemwordsSlice';
import htmUniqueItemsReducer from '@/features/htm-unique-items/store/htmUniqueItemsSlice';
import mythicalUniquesReducer from '@/features/mythical-uniques/store/mythicalUniquesSlice';
import ascendanciesReducer from '@/features/ascendancies/store/ascendanciesSlice';
import { rootSaga } from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

const store = configureStore({
  reducer: {
    core: coreReducer,
    dataSync: dataSyncReducer,
    settings: settingsReducer,
    socketables: socketablesReducer,
    runewords: runewordsReducer,
    gemwords: gemwordsReducer,
    htmUniqueItems: htmUniqueItemsReducer,
    mythicalUniques: mythicalUniquesReducer,
    ascendancies: ascendanciesReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
});

export function runSagas() {
  sagaMiddleware.run(rootSaga);
}

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
