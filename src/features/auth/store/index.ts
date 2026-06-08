export { default as authReducer } from './authSlice';
export {
  openSignInDialog,
  closeSignInDialog,
  discordSignInRequested,
  magicLinkRequested,
  magicLinkSent,
  signOutRequested,
  authStateChanged,
  profileLoaded,
  acceptConsentRequested,
  updateDisplayNameRequested,
  updateDisplayNameSucceeded,
  updateDisplayNameFailed,
  resetDisplayNameStatus,
  authError,
  clearAuthError,
  selectAuthIsConfigured,
  selectAuthInitialized,
  selectAuthStatus,
  selectAuthError,
  selectAuthUser,
  selectAuthUserId,
  selectIsAuthenticated,
  selectProfile,
  selectNeedsConsent,
  selectSignInDialogOpen,
  selectMagicLinkSent,
  selectAuthIsBusy,
  selectDisplayNameStatus,
  selectDisplayNameUpdating,
  selectProfileTag,
  selectAvatarUrl,
  selectDisplayName,
  type AuthUser,
} from './authSlice';

// NOTE: authSaga is intentionally NOT re-exported here. It imports the heavy
// Supabase client; keeping it out of this barrel ensures the eager app shell
// (which imports selectors from here) never pulls @supabase/supabase-js into the
// main bundle. startup.ts loads the saga via a deep dynamic import instead.
