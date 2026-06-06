import { useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Unknown error';
}

/**
 * Catches route render errors — most importantly failed lazy chunk loads after
 * a redeploy (stale index.html requesting hashed chunks that no longer exist).
 * A full reload fetches the fresh index.html and chunks.
 */
export function RouteErrorScreen() {
  const error = useRouteError();
  console.error('[Router] Route error', error);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-svh flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold text-destructive mb-4">Failed to Load Page</h1>
        <p className="text-muted-foreground mb-4">
          This can happen after the app was updated. Reloading usually fixes it: {getErrorMessage(error)}
        </p>
        <Button onClick={handleReload} variant="outline">
          Reload
        </Button>
      </div>
    </div>
  );
}
