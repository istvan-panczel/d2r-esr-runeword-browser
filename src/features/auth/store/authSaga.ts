import { eventChannel, type EventChannel } from 'redux-saga';
import { call, delay, fork, put, select, take, takeEvery, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { requireSupabase, type Database, type Profile } from '@/core/supabase';
import { MAX_DISCRIMINATOR_ATTEMPTS, randomDiscriminator, validateDisplayName } from '../utils/profile';
import { authRedirectTo } from '../utils/redirect';
import {
  acceptConsentRequested,
  authError,
  authStateChanged,
  discordSignInRequested,
  magicLinkRequested,
  magicLinkSent,
  profileLoaded,
  selectAuthUserId,
  signOutRequested,
  updateDisplayNameFailed,
  updateDisplayNameRequested,
  updateDisplayNameSucceeded,
  type AuthUser,
} from './authSlice';

/** PostgREST surfaces a Postgres unique-violation as this error code. */
const UNIQUE_VIOLATION = '23505';

type Client = SupabaseClient<Database>;

interface AuthEvent {
  readonly event: AuthChangeEvent;
  readonly session: Session | null;
}

function createAuthChannel(client: Client): EventChannel<AuthEvent> {
  return eventChannel<AuthEvent>((emit) => {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      emit({ event, session });
    });
    return () => {
      data.subscription.unsubscribe();
    };
  });
}

function toAuthUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/** Subscribes to Supabase auth changes for the lifetime of the app. */
function* watchAuthState() {
  const client = requireSupabase();
  const channel = createAuthChannel(client);
  try {
    for (;;) {
      const { session } = (yield take(channel)) as AuthEvent;
      yield put(authStateChanged({ user: toAuthUser(session) }));
    }
  } finally {
    // The loop only exits when the saga is cancelled; unsubscribe in all cases.
    channel.close();
  }
}

/**
 * Loads the user's profile after sign-in. On the very first login the profile row
 * is created by a DB trigger and may not be readable for a moment, so we retry.
 */
function* loadProfile(userId: string) {
  const client = requireSupabase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = (yield call(() => client.from('profiles').select('*').eq('id', userId).maybeSingle())) as {
      data: Profile | null;
      error: { message: string } | null;
    };
    if (error) {
      yield put(authError(error.message));
      yield call(toast.error, 'Could not load your profile. Please try again.');
      return;
    }
    if (data) {
      yield put(profileLoaded(data));
      return;
    }
    yield delay(400);
  }
  yield put(authError('Profile could not be found after sign-in.'));
  yield call(toast.error, 'Could not load your profile. Please try signing in again.');
}

function* handleAuthStateChanged(action: PayloadAction<{ user: AuthUser | null }>) {
  const { user } = action.payload;
  if (!user) return; // Signed out — the slice already cleared profile state.
  yield call(loadProfile, user.id);
}

function* handleDiscordSignIn() {
  try {
    const client = requireSupabase();
    const { error } = (yield call(() =>
      client.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: authRedirectTo() } })
    )) as {
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    // On success the browser is redirected to Discord; nothing more happens here.
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign-in failed.';
    yield put(authError(message));
    yield call(toast.error, 'Sign-in was cancelled or failed. Please try again.');
  }
}

function* handleMagicLink(action: PayloadAction<string>) {
  const email = action.payload;
  try {
    const client = requireSupabase();
    const { error } = (yield call(() => client.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectTo() } }))) as {
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    yield put(magicLinkSent());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send the magic link.';
    yield put(authError(message));
    yield call(toast.error, 'Could not send the magic link. Please check the address and try again.');
  }
}

function* handleSignOut() {
  try {
    const client = requireSupabase();
    const { error } = (yield call(() => client.auth.signOut())) as { error: { message: string } | null };
    if (error) throw new Error(error.message);
    // onAuthStateChange fires SIGNED_OUT, which clears the slice.
  } catch {
    yield call(toast.error, 'Failed to sign out. Please try again.');
  }
}

function* handleAcceptConsent(action: PayloadAction<{ displayName: string }>) {
  const validation = validateDisplayName(action.payload.displayName);
  if (!validation.valid) {
    const message = validation.error ?? 'Invalid display name.';
    yield put(authError(message));
    yield call(toast.error, message);
    return;
  }
  try {
    const client = requireSupabase();
    const userId = (yield select(selectAuthUserId)) as string | null;
    if (userId === null) throw new Error('You are not signed in.');
    const { data, error } = (yield call(() =>
      client
        .from('profiles')
        .update({ display_name: validation.trimmed, privacy_policy_accepted_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single()
    )) as { data: Profile | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    if (data) {
      yield put(profileLoaded(data));
      yield call(toast.success, 'Welcome! Your profile is ready.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save your profile.';
    yield put(authError(message));
    yield call(toast.error, message);
  }
}

/**
 * Changes the user's display name. Per the spec, a name change regenerates the
 * discriminator; the (display_name, discriminator) pair is unique, so on a
 * collision we retry with a fresh random tag (up to MAX_DISCRIMINATOR_ATTEMPTS).
 */
function* handleUpdateDisplayName(action: PayloadAction<{ displayName: string }>) {
  const validation = validateDisplayName(action.payload.displayName);
  if (!validation.valid) {
    const message = validation.error ?? 'Invalid display name.';
    yield put(updateDisplayNameFailed(message));
    yield call(toast.error, message);
    return;
  }
  try {
    const client = requireSupabase();
    const userId = (yield select(selectAuthUserId)) as string | null;
    if (userId === null) throw new Error('You are not signed in.');

    for (let attempt = 0; attempt < MAX_DISCRIMINATOR_ATTEMPTS; attempt++) {
      const discriminator = randomDiscriminator();
      const { data, error } = (yield call(() =>
        client.from('profiles').update({ display_name: validation.trimmed, discriminator }).eq('id', userId).select('*').single()
      )) as { data: Profile | null; error: { message: string; code?: string } | null };

      if (error === null && data !== null) {
        yield put(profileLoaded(data));
        yield put(updateDisplayNameSucceeded());
        yield call(toast.success, 'Your display name was updated.');
        return;
      }
      // Tag collision — try a different discriminator. Any other error is fatal.
      if (error !== null && error.code === UNIQUE_VIOLATION) continue;
      if (error !== null) throw new Error(error.message);
    }
    throw new Error('Could not find an available name tag. Please try a slightly different name.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update your display name.';
    yield put(updateDisplayNameFailed(message));
    yield call(toast.error, message);
  }
}

export function* authSaga() {
  yield takeEvery(discordSignInRequested.type, handleDiscordSignIn);
  yield takeLatest(magicLinkRequested.type, handleMagicLink);
  yield takeEvery(signOutRequested.type, handleSignOut);
  yield takeLatest(authStateChanged.type, handleAuthStateChanged);
  yield takeLatest(acceptConsentRequested.type, handleAcceptConsent);
  yield takeLatest(updateDisplayNameRequested.type, handleUpdateDisplayName);
  yield fork(watchAuthState);
}
