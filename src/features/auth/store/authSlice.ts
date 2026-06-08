import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';
import { isSupabaseConfigured } from '@/core/supabase/config';
import type { Profile } from '@/core/supabase/types';
import { profileTag } from '../utils/profile';

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

interface AuthState {
  /** Whether the build-sharing feature is enabled (Supabase env vars present). */
  readonly isConfigured: boolean;
  /** True once the first auth state has resolved (so the UI knows logged-in vs not). */
  readonly initialized: boolean;
  /** In-flight state for auth actions (sign-in, consent). */
  readonly status: RequestState;
  readonly user: AuthUser | null;
  readonly profile: Profile | null;
  /** True when the post-registration consent gate must be shown. */
  readonly needsConsent: boolean;
  /** In-flight state for the display-name change (separate from sign-in/consent). */
  readonly displayNameStatus: RequestState;
  readonly error: string | null;
  readonly signInDialogOpen: boolean;
  /** True after a magic link was sent, so the dialog can show a confirmation. */
  readonly magicLinkSent: boolean;
}

const initialState: AuthState = {
  isConfigured: isSupabaseConfigured,
  initialized: false,
  status: RequestState.IDLE,
  user: null,
  profile: null,
  needsConsent: false,
  displayNameStatus: RequestState.IDLE,
  error: null,
  signInDialogOpen: false,
  magicLinkSent: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    openSignInDialog(state) {
      state.signInDialogOpen = true;
      state.magicLinkSent = false;
      state.error = null;
    },
    closeSignInDialog(state) {
      state.signInDialogOpen = false;
      state.magicLinkSent = false;
    },

    // --- Sign-in: Discord OAuth (saga redirects away) ---
    discordSignInRequested(state) {
      state.status = RequestState.LOADING;
      state.error = null;
    },

    // --- Sign-in: email magic link ---
    magicLinkRequested(state, _action: PayloadAction<string>) {
      state.status = RequestState.LOADING;
      state.error = null;
      state.magicLinkSent = false;
    },
    magicLinkSent(state) {
      state.status = RequestState.SUCCESS;
      state.magicLinkSent = true;
    },

    signOutRequested(_state) {
      // Handled by the saga; state is cleared when authStateChanged fires with no user.
    },

    // --- Auth state from onAuthStateChange ---
    authStateChanged(state, action: PayloadAction<{ user: AuthUser | null }>) {
      state.initialized = true;
      state.user = action.payload.user;
      if (!action.payload.user) {
        state.profile = null;
        state.needsConsent = false;
        state.signInDialogOpen = false;
        state.magicLinkSent = false;
        state.status = RequestState.IDLE;
        state.error = null;
      }
    },
    profileLoaded(state, action: PayloadAction<Profile>) {
      state.profile = action.payload;
      state.needsConsent = action.payload.privacy_policy_accepted_at === null;
      state.status = RequestState.SUCCESS;
      if (!state.needsConsent) {
        // Fully authenticated with consent — close any open sign-in UI.
        state.signInDialogOpen = false;
        state.magicLinkSent = false;
      }
    },

    // --- Consent gate ---
    acceptConsentRequested(state, _action: PayloadAction<{ displayName: string }>) {
      state.status = RequestState.LOADING;
      state.error = null;
    },

    // --- Profile editing: change display name (regenerates discriminator) ---
    updateDisplayNameRequested(state, _action: PayloadAction<{ displayName: string }>) {
      state.displayNameStatus = RequestState.LOADING;
      state.error = null;
    },
    updateDisplayNameSucceeded(state) {
      state.displayNameStatus = RequestState.SUCCESS;
    },
    updateDisplayNameFailed(state, action: PayloadAction<string>) {
      state.displayNameStatus = RequestState.ERROR;
      state.error = action.payload;
    },
    resetDisplayNameStatus(state) {
      state.displayNameStatus = RequestState.IDLE;
      if (state.status !== RequestState.ERROR) state.error = null;
    },

    authError(state, action: PayloadAction<string>) {
      state.status = RequestState.ERROR;
      state.error = action.payload;
    },
    clearAuthError(state) {
      state.error = null;
      if (state.status === RequestState.ERROR) {
        state.status = RequestState.IDLE;
      }
    },
  },
});

export const {
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
} = authSlice.actions;

export default authSlice.reducer;

// --- Selectors ---

const selectAuthState = (state: RootState) => state.auth;

export const selectAuthIsConfigured = createSelector([selectAuthState], (auth) => auth.isConfigured);
export const selectAuthInitialized = createSelector([selectAuthState], (auth) => auth.initialized);
export const selectAuthStatus = createSelector([selectAuthState], (auth) => auth.status);
export const selectAuthError = createSelector([selectAuthState], (auth) => auth.error);
export const selectAuthUser = createSelector([selectAuthState], (auth) => auth.user);
export const selectAuthUserId = createSelector([selectAuthState], (auth) => auth.user?.id ?? null);
export const selectIsAuthenticated = createSelector([selectAuthState], (auth) => auth.user !== null);
export const selectProfile = createSelector([selectAuthState], (auth) => auth.profile);
export const selectNeedsConsent = createSelector([selectAuthState], (auth) => auth.needsConsent);
export const selectSignInDialogOpen = createSelector([selectAuthState], (auth) => auth.signInDialogOpen);
export const selectMagicLinkSent = createSelector([selectAuthState], (auth) => auth.magicLinkSent);
export const selectAuthIsBusy = createSelector([selectAuthStatus], (status) => status === RequestState.LOADING);
export const selectDisplayNameStatus = createSelector([selectAuthState], (auth) => auth.displayNameStatus);
export const selectDisplayNameUpdating = createSelector([selectDisplayNameStatus], (status) => status === RequestState.LOADING);

export const selectProfileTag = createSelector([selectProfile], (profile) => (profile ? profileTag(profile) : null));
export const selectAvatarUrl = createSelector([selectProfile], (profile) => profile?.avatar_url ?? null);
export const selectDisplayName = createSelector([selectProfile], (profile) => profile?.display_name ?? null);
