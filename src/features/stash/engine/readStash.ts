/**
 * Upload checks and parse errors of a shared stash file, turned into what the page shows. The parser itself is in
 * ../parser (see docs/features/STASH.md).
 */
import type { StashBundle } from '@/features/game-data/engine/schema';
import { StashParseError, UnsupportedStashError, type StashParseErrorDetails, type UnsupportedStashReason } from '../parser/errors';
import { parseStash } from '../parser/parseStash';
import { createStashData } from '../parser/stashData';
import type { StashFile } from '../parser/types';

/** Where the game keeps the ESR shared stash (Windows) */
export const STASH_FILE_LOCATION = String.raw`%USERPROFILE%\Saved Games\Diablo II Resurrected\mods\Eastern_Sun_Resurrected`;
export const STASH_FILE_NAME = 'ModernSharedStashSoftCoreV2.d2i';
const STASH_EXTENSION = '.d2i';
/** A full ESR stash is ~200 KB; anything this large is not one (and would not be worth keeping in IndexedDB) */
export const MAX_STASH_BYTES = 16 * 1024 * 1024;

export type StashLoadError =
  | { readonly kind: 'wrong-type'; readonly message: string }
  | { readonly kind: 'unsupported'; readonly reason: UnsupportedStashReason; readonly message: string }
  | { readonly kind: 'parse'; readonly message: string; readonly details: StashParseErrorDetails }
  | { readonly kind: 'storage'; readonly message: string }
  | { readonly kind: 'unexpected'; readonly message: string };

/** The wrong-type error of a file that should not be read at all, or null when it may be a stash. */
export function checkStashUpload(name: string, size: number): StashLoadError | null {
  if (!name.toLowerCase().endsWith(STASH_EXTENSION)) {
    const what = name.toLowerCase().endsWith('.d2s') ? 'a character save (.d2s)' : `"${name}"`;
    return { kind: 'wrong-type', message: `That is ${what}, not a shared stash. Pick the ${STASH_EXTENSION} file (${STASH_FILE_NAME}).` };
  }
  if (size > MAX_STASH_BYTES) {
    return { kind: 'wrong-type', message: `"${name}" is ${String(Math.round(size / 1024 / 1024))} MB, far too large for a shared stash.` };
  }
  return null;
}

export function toStashLoadError(error: unknown): StashLoadError {
  if (error instanceof UnsupportedStashError) return { kind: 'unsupported', reason: error.reason, message: error.message };
  if (error instanceof StashParseError) return { kind: 'parse', message: error.message, details: error.details };
  return { kind: 'unexpected', message: error instanceof Error ? error.message : String(error) };
}

export type ReadStashResult = { readonly ok: true; readonly stash: StashFile } | { readonly ok: false; readonly error: StashLoadError };

/** Parses the file bytes; never throws. */
export function readStash(bytes: Uint8Array, bundle: Pick<StashBundle, 'stats' | 'items'>): ReadStashResult {
  try {
    return { ok: true, stash: parseStash(bytes, createStashData(bundle)) };
  } catch (error) {
    return { ok: false, error: toStashLoadError(error) };
  }
}
