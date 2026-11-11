import { createContext, use } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { CharacterEntry } from '../engine/characterList';
import type { CharacterLoadError, CharacterUploadError } from '../engine/readCharacter';

/** The remembered characters: being read, read (possibly none), or the storage could not be read at all */
export type CharacterListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly entries: readonly CharacterEntry[] }
  | { readonly status: 'error'; readonly error: CharacterLoadError };

export interface CharacterContextValue {
  readonly list: CharacterListState;
  /** The stored characters, sorted by name ([] while loading or on a storage error) */
  readonly entries: readonly CharacterEntry[];
  /** The character the page shows: the remembered selection, else the most recent upload; null without any */
  readonly selected: CharacterEntry | null;
  readonly select: (key: string) => void;
  /** stash.json, loaded before the page renders */
  readonly bundle: StashBundle;
  /** Reading or parsing an upload */
  readonly busy: boolean;
  /** The last upload's failures, one per file (or one for the upload as a whole); the stored characters stay as they were */
  readonly uploadErrors: readonly CharacterUploadError[];
  /** Set when an upload parsed but could not be remembered (private window, storage blocked) */
  readonly storageWarning: string | null;
  /** The picked files: any number of .d2s, optionally with their .d2rl */
  readonly upload: (files: readonly File[]) => Promise<void>;
  readonly remove: (key: string) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly dismissUploadErrors: () => void;
}

/** The shared state of the My Character page (provided by CharacterScreen). */
export const CharacterContext = createContext<CharacterContextValue | null>(null);

export function useCharacter(): CharacterContextValue {
  const value = use(CharacterContext);
  if (value === null) throw new Error('useCharacter must be used inside <CharacterProvider>');
  return value;
}
