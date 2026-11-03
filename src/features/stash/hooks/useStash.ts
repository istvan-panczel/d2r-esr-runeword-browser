import { createContext, use } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { StashFileMeta } from '../db/stashDb';
import type { StashLoadError } from '../engine/readStash';
import type { StashFile } from '../parser/types';

/** The remembered stash: being read, none uploaded, parsed, or failed (a stored file the current parser rejects) */
export type StashLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly file: StashFileMeta; readonly stash: StashFile }
  | { readonly status: 'error'; readonly file: StashFileMeta | null; readonly error: StashLoadError };

export interface StashContextValue {
  readonly state: StashLoadState;
  /** stash.json, loaded before any stash page renders */
  readonly bundle: StashBundle;
  /** Reading or parsing an upload */
  readonly busy: boolean;
  /** The last upload's failure; the remembered stash (if any) stays as it was */
  readonly uploadError: StashLoadError | null;
  /** Set when the upload parsed but could not be remembered (private window, storage blocked) */
  readonly storageWarning: string | null;
  readonly upload: (file: File) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly dismissUploadError: () => void;
}

/** The shared stash state of every My Stash page (provided by StashLayout). */
export const StashContext = createContext<StashContextValue | null>(null);

export function useStash(): StashContextValue {
  const value = use(StashContext);
  if (value === null) throw new Error('useStash must be used inside <StashProvider>');
  return value;
}
