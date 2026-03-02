import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store, registerSaga, runSagas, startupCheck } from '@/core/store';
import { dataSyncSaga } from '@/features/data-sync';
import { ThemeInitializer } from '@/features/settings';
import { router } from '@/core/router';
import './index.css';

// Clean up legacy TXT data database if it exists
const LEGACY_TXT_DB = 'd2r-esr-txt-data';
void indexedDB.databases().then((dbs) => {
  if (dbs.some((db) => db.name === LEGACY_TXT_DB)) {
    const req = indexedDB.deleteDatabase(LEGACY_TXT_DB);
    req.onsuccess = () => {
      console.log(`Deleted legacy IndexedDB "${LEGACY_TXT_DB}"`);
    };
  }
});

// Register feature sagas
registerSaga(dataSyncSaga);

// Run all registered sagas
runSagas();

// Trigger startup data check
store.dispatch(startupCheck());

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeInitializer />
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
);
