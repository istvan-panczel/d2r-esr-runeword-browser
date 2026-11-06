import { useEffect, useState } from 'react';
import type { GameDataFile } from '../engine/schema';
import { loadGameDataFile, type GameDataBundles } from '../engine/browser/loadGameData';

export type GameDataStatus = 'loading' | 'ready' | 'error';

type LoadedBundles<F extends GameDataFile> = { readonly [K in F]: GameDataBundles[K] };

export type GameDataState<F extends GameDataFile> =
  | { readonly status: 'loading'; readonly data: null; readonly error: null; readonly retry: () => void }
  | { readonly status: 'ready'; readonly data: LoadedBundles<F>; readonly error: null; readonly retry: () => void }
  | { readonly status: 'error'; readonly data: null; readonly error: unknown; readonly retry: () => void };

type LoadState<F extends GameDataFile> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: LoadedBundles<F> }
  | { readonly status: 'error'; readonly error: unknown };

/** The files of a `files.join(',')` key; an empty key is no files (not one file named "") */
export function filesFromKey<F extends GameDataFile>(key: string): F[] {
  return key === '' ? [] : (key.split(',') as F[]);
}

/**
 * Loads the given game-data bundles (cached per file by `loadGameDataFile`).
 * `retry` refetches after an error; the failed promise has already been evicted from the loader cache. An empty list
 * fetches nothing and is ready with no data (callers pass one while a feature is off).
 */
export function useGameData<F extends GameDataFile>(files: readonly F[]): GameDataState<F> {
  const filesKey = files.join(',');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState<F>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const list = filesFromKey<F>(filesKey);
    Promise.all(list.map(async (file) => [file, await loadGameDataFile(file)] as const)).then(
      (entries) => {
        if (!cancelled) setState({ status: 'ready', data: Object.fromEntries(entries) as LoadedBundles<F> });
      },
      (error: unknown) => {
        console.error('Failed to load game data:', error);
        if (!cancelled) setState({ status: 'error', error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [filesKey, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  switch (state.status) {
    case 'loading':
      return { status: 'loading', data: null, error: null, retry };
    case 'ready':
      return { status: 'ready', data: state.data, error: null, retry };
    case 'error':
      return { status: 'error', data: null, error: state.error, retry };
  }
}
