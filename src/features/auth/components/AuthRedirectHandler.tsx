import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectNeedsConsent } from '../store';
import { takeAuthReturnTo } from '../utils/redirect';

/**
 * After a sign-in round-trip (OAuth / magic link), navigates back to the page the
 * user was on when they clicked Sign In. The return path is only stored on an
 * explicit sign-in, so a returning logged-in user on a normal load isn't moved.
 * Renders nothing.
 */
export function AuthRedirectHandler() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const needsConsent = useSelector(selectNeedsConsent);

  useEffect(() => {
    if (!isAuthenticated || needsConsent) return;
    const returnTo = takeAuthReturnTo();
    if (returnTo !== null) {
      void navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, needsConsent, navigate]);

  return null;
}
