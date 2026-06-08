import { useSelector } from 'react-redux';
import { selectNeedsConsent } from '../store';
import { SignInDialog } from './SignInDialog';
import { ConsentGate } from './ConsentGate';
import { AuthRedirectHandler } from './AuthRedirectHandler';

/**
 * App-level auth overlays and behaviours: the sign-in dialog, the post-login
 * consent gate (mounted only when required, so its form pre-fills correctly),
 * and the post-sign-in redirect handler. Mounted once near the app root.
 */
export function AuthOverlays() {
  const needsConsent = useSelector(selectNeedsConsent);

  return (
    <>
      <SignInDialog />
      {needsConsent && <ConsentGate />}
      <AuthRedirectHandler />
    </>
  );
}
