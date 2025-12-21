import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store, registerSaga, runSagas } from '@/core/store';
import { dataSyncSaga } from '@/features/data-sync';
import './index.css';
import App from './App.tsx';

// Register feature sagas
registerSaga(dataSyncSaga);

// Run all registered sagas
runSagas();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
