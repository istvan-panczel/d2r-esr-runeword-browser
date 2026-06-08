import { describe, expect, it } from 'vitest';
import authReducer, {
  acceptConsentRequested,
  authError,
  authStateChanged,
  clearAuthError,
  closeSignInDialog,
  discordSignInRequested,
  magicLinkRequested,
  magicLinkSent,
  openSignInDialog,
  profileLoaded,
  resetDisplayNameStatus,
  updateDisplayNameFailed,
  updateDisplayNameRequested,
  updateDisplayNameSucceeded,
} from './authSlice';
import { RequestState } from '@/core/types';
import type { Profile } from '@/core/supabase';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    display_name: 'Hero',
    discriminator: 4242,
    avatar_url: null,
    privacy_policy_accepted_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const initial = authReducer(undefined, { type: '@@INIT' });

describe('authSlice', () => {
  it('opens and closes the sign-in dialog', () => {
    const opened = authReducer(initial, openSignInDialog());
    expect(opened.signInDialogOpen).toBe(true);
    const closed = authReducer(opened, closeSignInDialog());
    expect(closed.signInDialogOpen).toBe(false);
  });

  it('marks loading on a Discord sign-in request', () => {
    expect(authReducer(initial, discordSignInRequested()).status).toBe(RequestState.LOADING);
  });

  it('tracks the magic-link lifecycle', () => {
    const requested = authReducer(initial, magicLinkRequested('a@b.com'));
    expect(requested.status).toBe(RequestState.LOADING);
    expect(requested.magicLinkSent).toBe(false);

    const sent = authReducer(requested, magicLinkSent());
    expect(sent.status).toBe(RequestState.SUCCESS);
    expect(sent.magicLinkSent).toBe(true);
  });

  it('sets the user and initialized flag on auth state change', () => {
    const next = authReducer(initial, authStateChanged({ user: { id: 'user-1', email: 'a@b.com' } }));
    expect(next.initialized).toBe(true);
    expect(next.user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });

  it('clears profile and consent state when signed out', () => {
    const authed = authReducer(initial, profileLoaded(makeProfile({ privacy_policy_accepted_at: null })));
    expect(authed.needsConsent).toBe(true);

    const signedOut = authReducer(authed, authStateChanged({ user: null }));
    expect(signedOut.user).toBeNull();
    expect(signedOut.profile).toBeNull();
    expect(signedOut.needsConsent).toBe(false);
  });

  it('requires consent when the profile has no accepted timestamp', () => {
    const next = authReducer(initial, profileLoaded(makeProfile({ privacy_policy_accepted_at: null })));
    expect(next.needsConsent).toBe(true);
    expect(next.status).toBe(RequestState.SUCCESS);
  });

  it('clears consent and closes the dialog once the profile is accepted', () => {
    const opened = authReducer(initial, openSignInDialog());
    const next = authReducer(opened, profileLoaded(makeProfile()));
    expect(next.needsConsent).toBe(false);
    expect(next.signInDialogOpen).toBe(false);
  });

  it('records and clears auth errors', () => {
    const errored = authReducer(initial, authError('boom'));
    expect(errored.status).toBe(RequestState.ERROR);
    expect(errored.error).toBe('boom');

    const cleared = authReducer(errored, clearAuthError());
    expect(cleared.error).toBeNull();
    expect(cleared.status).toBe(RequestState.IDLE);
  });

  it('sets loading when consent is submitted', () => {
    expect(authReducer(initial, acceptConsentRequested({ displayName: 'Hero' })).status).toBe(RequestState.LOADING);
  });

  it('tracks the display-name change lifecycle', () => {
    const requested = authReducer(initial, updateDisplayNameRequested({ displayName: 'NewTag' }));
    expect(requested.displayNameStatus).toBe(RequestState.LOADING);

    const succeeded = authReducer(requested, updateDisplayNameSucceeded());
    expect(succeeded.displayNameStatus).toBe(RequestState.SUCCESS);

    const failed = authReducer(succeeded, updateDisplayNameFailed('tag taken'));
    expect(failed.displayNameStatus).toBe(RequestState.ERROR);
    expect(failed.error).toBe('tag taken');

    const reset = authReducer(failed, resetDisplayNameStatus());
    expect(reset.displayNameStatus).toBe(RequestState.IDLE);
  });
});
