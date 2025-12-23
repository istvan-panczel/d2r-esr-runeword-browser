import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/core/layouts/AppLayout';
import { SocketablesScreen } from '@/features/socketables';

// Placeholder for Runewords (to be implemented later)
function RunewordsPlaceholder() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Runewords screen coming soon...</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <RunewordsPlaceholder /> },
      { path: 'socketables', element: <SocketablesScreen /> },
    ],
  },
]);
