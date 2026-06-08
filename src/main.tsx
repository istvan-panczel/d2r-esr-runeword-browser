import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store } from '@/core/store';
import { startDataSync, startAuth, startBuilds } from '@/core/startup';
import { ThemeInitializer } from '@/features/settings';
import { Toaster } from '@/components/ui/sonner';
import { router } from '@/core/router';
import './index.css';

// Clean up legacy TXT data database if it exists
const LEGACY_TXT_DB = 'd2r-esr-txt-data';
if (typeof indexedDB.databases === 'function') {
  indexedDB
    .databases()
    .then((dbs) => {
      if (dbs.some((db) => db.name === LEGACY_TXT_DB)) {
        const req = indexedDB.deleteDatabase(LEGACY_TXT_DB);
        req.onsuccess = () => {
          console.log(`Deleted legacy IndexedDB "${LEGACY_TXT_DB}"`);
        };
        req.onerror = () => {
          console.warn(`Failed to delete legacy IndexedDB "${LEGACY_TXT_DB}"`);
        };
      }
    })
    .catch(() => {
      // Silently ignore — legacy cleanup is best-effort
    });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeInitializer />
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </Provider>
  </StrictMode>
);

void startDataSync();
void startAuth();
void startBuilds();
