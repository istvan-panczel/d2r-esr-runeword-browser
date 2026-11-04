import { useSelector } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/core/components/Header';
import { SettingsDrawer } from '@/core/components/SettingsDrawer';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { APP_FRAME_CLASS } from '@/components/pageWidthClasses';
import { cn } from '@/lib/utils';
import { selectIsInitialized, selectError } from '@/core/store';
import { startDataSync } from '@/core/startup';
import { AuthOverlays, selectAuthIsConfigured } from '@/features/auth';
import { selectPageWidth } from '@/features/settings';
// Static-bundle routes (the home page, guide, loot filters, enhance) skip both startup gates below.
import { isStaticBundlePath } from './staticBundleRoutes';

export function AppLayout() {
  const isInitialized = useSelector(selectIsInitialized);
  const error = useSelector(selectError);
  const isSupabaseEnabled = useSelector(selectAuthIsConfigured);
  const pageWidth = useSelector(selectPageWidth);
  const { pathname } = useLocation();
  const skipsStartupGate = isStaticBundlePath(pathname);

  // Fatal error state - error occurred and app is not initialized (static-bundle routes still render, see above)
  if (error && !isInitialized && !skipsStartupGate) {
    const handleRetry = () => {
      // Retries the data-sync chunk import if it never loaded, then re-runs the startup check
      void startDataSync();
    };

    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold text-destructive mb-4">Unable to Load</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Loading state during startup
  if (!isInitialized && !skipsStartupGate) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center">
        <Spinner className="size-12 mb-4" />
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex flex-col overflow-x-clip">
      <Header />
      {/* The frame width follows the Page width setting (the pages inside set their own width, see PageShell). */}
      <main className={cn('flex-1 p-4', APP_FRAME_CLASS[pageWidth])}>
        <Outlet />
      </main>
      <SettingsDrawer />
      {isSupabaseEnabled && <AuthOverlays />}
    </div>
  );
}
