import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import type { Profile } from '@/core/supabase';

// Shared mock Supabase client. Query builders are chainable; terminal methods
// (maybeSingle/single) and auth methods are configured per test.
const mocks = vi.hoisted(() => {
  const subscription = { unsubscribe: vi.fn() };
  const auth = {
    onAuthStateChange: vi.fn(() => ({ data: { subscription } })),
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.maybeSingle = vi.fn();
  builder.single = vi.fn();
  const client = { auth, from: vi.fn(() => builder) };
  return { client, auth, builder, subscription };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { authSaga } from './authSaga';
import authReducer, { acceptConsentRequested, authStateChanged, magicLinkRequested, updateDisplayNameRequested } from './authSlice';
import { RequestState } from '@/core/types';
import { MAX_DISCRIMINATOR_ATTEMPTS } from '../utils/profile';

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

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(authSaga);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps implementations and the *Once queue; reset the terminal
  // query methods so per-test mockResolvedValue(Once) setups don't leak across tests.
  mocks.builder.single.mockReset();
  mocks.builder.maybeSingle.mockReset();
});

describe('authSaga', () => {
  it('sends a magic link and flags magicLinkSent on success', async () => {
    mocks.auth.signInWithOtp.mockResolvedValue({ error: null });
    const store = setupStore();

    store.dispatch(magicLinkRequested('player@example.com'));

    await vi.waitFor(() => {
      expect(store.getState().auth.magicLinkSent).toBe(true);
    });
    expect(mocks.auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'player@example.com' }));
  });

  it('records an error when the magic link request fails', async () => {
    mocks.auth.signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } });
    const store = setupStore();

    store.dispatch(magicLinkRequested('player@example.com'));

    await vi.waitFor(() => {
      expect(store.getState().auth.error).not.toBeNull();
    });
    expect(store.getState().auth.magicLinkSent).toBe(false);
  });

  it('loads the profile after an auth state change', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    const store = setupStore();

    store.dispatch(authStateChanged({ user: { id: 'user-1', email: 'h@x.com' } }));

    await vi.waitFor(() => {
      expect(store.getState().auth.profile?.display_name).toBe('Hero');
    });
    expect(store.getState().auth.needsConsent).toBe(false);
  });

  it('flags needsConsent when the loaded profile has no accepted timestamp', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile({ privacy_policy_accepted_at: null }), error: null });
    const store = setupStore();

    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));

    await vi.waitFor(() => {
      expect(store.getState().auth.needsConsent).toBe(true);
    });
  });

  it('accepts consent and updates the profile', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile({ privacy_policy_accepted_at: null }), error: null });
    mocks.builder.single.mockResolvedValue({
      data: makeProfile({ display_name: 'NewName', privacy_policy_accepted_at: '2026-06-08T00:00:00.000Z' }),
      error: null,
    });
    const store = setupStore();

    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));
    await vi.waitFor(() => {
      expect(store.getState().auth.needsConsent).toBe(true);
    });

    store.dispatch(acceptConsentRequested({ displayName: 'NewName' }));

    await vi.waitFor(() => {
      expect(store.getState().auth.needsConsent).toBe(false);
      expect(store.getState().auth.profile?.display_name).toBe('NewName');
    });
    expect(mocks.builder.update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'NewName' }));
  });

  it('changes the display name and reloads the profile with a new discriminator', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    mocks.builder.single.mockResolvedValue({ data: makeProfile({ display_name: 'Renamed', discriminator: 1234 }), error: null });
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));
    await vi.waitFor(() => {
      expect(store.getState().auth.profile).not.toBeNull();
    });

    store.dispatch(updateDisplayNameRequested({ displayName: 'Renamed' }));

    await vi.waitFor(() => {
      expect(store.getState().auth.displayNameStatus).toBe(RequestState.SUCCESS);
    });
    expect(store.getState().auth.profile?.display_name).toBe('Renamed');
    expect(mocks.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Renamed', discriminator: expect.any(Number) })
    );
  });

  it('retries with a fresh discriminator when the name tag collides', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    mocks.builder.single
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key', code: '23505' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key', code: '23505' } })
      .mockResolvedValue({ data: makeProfile({ display_name: 'Taken', discriminator: 5678 }), error: null });
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));
    await vi.waitFor(() => {
      expect(store.getState().auth.profile).not.toBeNull();
    });

    store.dispatch(updateDisplayNameRequested({ displayName: 'Taken' }));

    await vi.waitFor(() => {
      expect(store.getState().auth.displayNameStatus).toBe(RequestState.SUCCESS);
    });
    expect(mocks.builder.single).toHaveBeenCalledTimes(3);
    expect(store.getState().auth.profile?.display_name).toBe('Taken');
  });

  it('fails after exhausting the discriminator retry budget', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    mocks.builder.single.mockResolvedValue({ data: null, error: { message: 'duplicate key', code: '23505' } });
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));
    await vi.waitFor(() => {
      expect(store.getState().auth.profile).not.toBeNull();
    });

    store.dispatch(updateDisplayNameRequested({ displayName: 'Crowded' }));

    await vi.waitFor(() => {
      expect(store.getState().auth.displayNameStatus).toBe(RequestState.ERROR);
    });
    expect(mocks.builder.single).toHaveBeenCalledTimes(MAX_DISCRIMINATOR_ATTEMPTS);
  });

  it('rejects an invalid display name without touching the backend', async () => {
    mocks.builder.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'user-1', email: null } }));
    await vi.waitFor(() => {
      expect(store.getState().auth.profile).not.toBeNull();
    });

    store.dispatch(updateDisplayNameRequested({ displayName: '   ' }));

    await vi.waitFor(() => {
      expect(store.getState().auth.displayNameStatus).toBe(RequestState.ERROR);
    });
    expect(mocks.builder.update).not.toHaveBeenCalled();
  });
});
