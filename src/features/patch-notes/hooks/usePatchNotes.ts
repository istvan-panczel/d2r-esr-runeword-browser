import { useEffect, useState } from 'react';
import type { PatchNotesIndex } from '../engine/schema';
import { loadPatchNotes } from '../engine/loadPatchNotes';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: PatchNotesIndex }
  | { readonly status: 'error'; readonly error: unknown };

export type PatchNotesState = LoadState & { readonly retry: () => void };

/** Loads the patch notes index (cached by `loadPatchNotes`). `retry` refetches after an error. */
export function usePatchNotes(): PatchNotesState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadPatchNotes().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        console.error('Failed to load the patch notes:', error);
        if (!cancelled) setState({ status: 'error', error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}
