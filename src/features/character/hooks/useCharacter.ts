import { createContext, use } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { CharacterFileMeta } from '../db/characterDb';
import type { CharacterLoadError } from '../engine/readCharacter';
import type { CharacterFile } from '../parser/types';

/** The remembered character: being read, none uploaded, parsed, or failed (a stored file the current parser rejects) */
export type CharacterLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly file: CharacterFileMeta; readonly character: CharacterFile }
  | { readonly status: 'error'; readonly file: CharacterFileMeta | null; readonly error: CharacterLoadError };

export interface CharacterContextValue {
  readonly state: CharacterLoadState;
  /** stash.json, loaded before any stash page renders */
  readonly bundle: StashBundle;
  /** Reading or parsing an upload */
  readonly busy: boolean;
  /** The last upload's failure; the remembered character (if any) stays as it was */
  readonly uploadError: CharacterLoadError | null;
  /** Set when the upload parsed but could not be remembered (private window, storage blocked) */
  readonly storageWarning: string | null;
  /** The picked files: one .d2s, optionally with its .d2rl */
  readonly upload: (files: readonly File[]) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly dismissUploadError: () => void;
}

/** The shared character state of the My Stash section (provided by StashLayout). */
export const CharacterContext = createContext<CharacterContextValue | null>(null);

export function useCharacter(): CharacterContextValue {
  const value = use(CharacterContext);
  if (value === null) throw new Error('useCharacter must be used inside <CharacterProvider>');
  return value;
}
