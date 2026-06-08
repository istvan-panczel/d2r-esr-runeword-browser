import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { openSignInDialog, selectAuthInitialized, selectAuthIsConfigured, selectIsAuthenticated } from '../store';
import { UserMenu } from './UserMenu';

/**
 * Header auth control: the signed-in user menu, or a "Sign In" button when
 * logged out. Renders nothing when Supabase is not configured, or until the
 * first auth state has resolved (avoids a Sign In ↔ avatar flicker on load).
 */
export function AuthControls() {
  const dispatch = useDispatch();
  const isConfigured = useSelector(selectAuthIsConfigured);
  const initialized = useSelector(selectAuthInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (!isConfigured || !initialized) return null;

  if (isAuthenticated) return <UserMenu />;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        dispatch(openSignInDialog());
      }}
    >
      Sign In
    </Button>
  );
}
