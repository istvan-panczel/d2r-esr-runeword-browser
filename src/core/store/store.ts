import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import coreReducer from './coreSlice';
import dataSyncReducer from '@/features/data-sync/store/dataSyncSlice';
import { rootSaga } from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

const store = configureStore({
  reducer: {
    core: coreReducer,
    dataSync: dataSyncReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
});

export function runSagas() {
  sagaMiddleware.run(rootSaga);
}

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
