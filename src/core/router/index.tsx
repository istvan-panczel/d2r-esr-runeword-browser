import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/core/layouts/AppLayout';
import { RouteErrorScreen } from './RouteErrorScreen';
import { Spinner } from '@/components/ui/spinner';

const RunewordsScreen = lazy(async () => {
  const module = await import('@/features/runewords');
  return { default: module.RunewordsScreen };
});

const GemwordsScreen = lazy(async () => {
  const module = await import('@/features/gemwords');
  return { default: module.GemwordsScreen };
});

const SocketablesScreen = lazy(async () => {
  const module = await import('@/features/socketables');
  return { default: module.SocketablesScreen };
});

const HtmUniqueItemsScreen = lazy(async () => {
  const module = await import('@/features/htm-unique-items');
  return { default: module.HtmUniqueItemsScreen };
});

const MythicalUniquesScreen = lazy(async () => {
  const module = await import('@/features/mythical-uniques');
  return { default: module.MythicalUniquesScreen };
});

const AscendanciesScreen = lazy(async () => {
  const module = await import('@/features/ascendancies');
  return { default: module.AscendanciesScreen };
});

const routeLoadingFallback = (
  <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
    <Spinner className="size-8" />
    <span>Loading page...</span>
  </div>
);

function routeElement(Screen: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={routeLoadingFallback}>
      <Screen />
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <RouteErrorScreen />,
      children: [
        { index: true, element: routeElement(RunewordsScreen) },
        { path: 'gemwords', element: routeElement(GemwordsScreen) },
        { path: 'socketables', element: routeElement(SocketablesScreen) },
        { path: 'uniques', element: routeElement(HtmUniqueItemsScreen) },
        { path: 'mythicals', element: routeElement(MythicalUniquesScreen) },
        { path: 'ascendancies', element: routeElement(AscendanciesScreen) },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
