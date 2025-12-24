import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store, registerSaga, runSagas, startupCheck } from '@/core/store';
import { dataSyncSaga } from '@/features/data-sync';
import { ThemeInitializer } from '@/features/settings';
import { router } from '@/core/router';
import './index.css';

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
