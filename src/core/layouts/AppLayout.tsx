import { useSelector, useDispatch } from 'react-redux';
import { Outlet } from 'react-router-dom';
import { Header } from '@/core/components/Header';
import { SettingsDrawer } from '@/core/components/SettingsDrawer';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { selectIsInitialized, selectError, startupCheck } from '@/core/store';

export function AppLayout() {
  const dispatch = useDispatch();
  const isInitialized = useSelector(selectIsInitialized);
  const error = useSelector(selectError);

  // Fatal error state - error occurred and app is not initialized
  if (error && !isInitialized) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold text-destructive mb-4">Unable to Load</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => dispatch(startupCheck())} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Loading state during startup
  if (!isInitialized) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center">
        <Spinner className="size-12 mb-4" />
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto p-4">
        <Outlet />
      </main>
      <SettingsDrawer />
    </div>
  );
}
