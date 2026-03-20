import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/core/layouts/AppLayout';
import { SocketablesScreen } from '@/features/socketables';
import { RunewordsScreen } from '@/features/runewords';
import { HtmUniqueItemsScreen } from '@/features/htm-unique-items';
import { MythicalUniquesScreen } from '@/features/mythical-uniques';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <RunewordsScreen /> },
        { path: 'socketables', element: <SocketablesScreen /> },
        { path: 'uniques', element: <HtmUniqueItemsScreen /> },
        { path: 'mythicals', element: <MythicalUniquesScreen /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
