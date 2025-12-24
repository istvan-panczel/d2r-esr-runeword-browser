import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/core/layouts/AppLayout';
import { SocketablesScreen } from '@/features/socketables';
import { RunewordsScreen } from '@/features/runewords';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <RunewordsScreen /> },
        { path: 'socketables', element: <SocketablesScreen /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
