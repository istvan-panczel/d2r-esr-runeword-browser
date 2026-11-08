/**
 * Upload checks, parse errors and the .d2rl check of a character save, turned into what the page shows. The parser
 * itself is in ../parser (see docs/features/CHARACTER-SAVE.md).
 */
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { CharacterSidecar } from '../db/characterDb';
import { createCharacterData } from '../parser/characterData';
import { d2rlMatchesSave, parseD2rl } from '../parser/d2rl';
import { CharacterParseError, type CharacterParseErrorDetails } from '../parser/errors';
import { parseCharacter } from '../parser/parseCharacter';
import type { CharacterFile } from '../parser/types';

const SAVE_EXTENSION = '.d2s';
const SIDECAR_EXTENSION = '.d2rl';
/** A save is a few KB; anything this large is not one (and would not be worth keeping in IndexedDB) */
export const MAX_CHARACTER_BYTES = 16 * 1024 * 1024;

export type CharacterLoadError =
  | { readonly kind: 'wrong-type'; readonly message: string }
  | { readonly kind: 'parse'; readonly message: string; readonly details: CharacterParseErrorDetails }
  | { readonly kind: 'storage'; readonly message: string }
  | { readonly kind: 'unexpected'; readonly message: string };

export type PickedFiles<F> =
  { readonly ok: true; readonly save: F; readonly sidecars: readonly F[] } | { readonly ok: false; readonly error: CharacterLoadError };

const hasExtension = (name: string, extension: string) => name.toLowerCase().endsWith(extension);

const wrongType = (message: string) => ({ ok: false, error: { kind: 'wrong-type', message } }) as const;

/** Which of the picked files is the save and which are .d2rl candidates; the wrong-type error when there is no usable save. */
export function pickCharacterFiles<F extends { readonly name: string; readonly size: number }>(files: readonly F[]): PickedFiles<F> {
  const saves = files.filter((file) => hasExtension(file.name, SAVE_EXTENSION));
  const sidecars = files.filter((file) => hasExtension(file.name, SIDECAR_EXTENSION) && file.size <= MAX_CHARACTER_BYTES);
  const save = saves.at(0);
  if (save === undefined) {
    if (sidecars.length > 0) return wrongType('A .d2rl file alone is not a save. Pick the .d2s together with it.');
    const first = files.at(0);
    if (first === undefined) return wrongType('No file was picked.');
    if (hasExtension(first.name, '.d2i')) return wrongType('That is a shared stash (.d2i): it goes on the My Stash Overview page.');
    return wrongType(`"${first.name}" is not a character save. Pick a ${SAVE_EXTENSION} file.`);
  }
  if (saves.length > 1) return wrongType(`Pick one ${SAVE_EXTENSION} file at a time (got ${String(saves.length)}).`);
  if (save.size > MAX_CHARACTER_BYTES) {
    return wrongType(`"${save.name}" is ${String(Math.round(save.size / 1024 / 1024))} MB, far too large for a character save.`);
  }
  return { ok: true, save, sidecars };
}

export function toCharacterLoadError(error: unknown): CharacterLoadError {
  if (error instanceof CharacterParseError) return { kind: 'parse', message: error.message, details: error.details };
  return { kind: 'unexpected', message: error instanceof Error ? error.message : String(error) };
}

export type ReadCharacterResult =
  { readonly ok: true; readonly character: CharacterFile } | { readonly ok: false; readonly error: CharacterLoadError };

/** Parses the save's bytes; never throws. */
export function readCharacter(
  bytes: Uint8Array,
  bundle: Pick<StashBundle, 'stats' | 'items' | 'characterStats' | 'characterClasses'>
): ReadCharacterResult {
  try {
    return { ok: true, character: parseCharacter(bytes, createCharacterData(bundle)) };
  } catch (error) {
    return { ok: false, error: toCharacterLoadError(error) };
  }
}

export interface SidecarCandidate {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/**
 * The .d2rl among the candidates whose recorded hash is this save's. A sidecar that cannot be read or does not match
 * never blocks the save: the page then falls back to the last-saved date.
 */
export async function resolveSidecar(candidates: readonly SidecarCandidate[], save: Uint8Array): Promise<CharacterSidecar> {
  let rejected: CharacterSidecar = { status: 'none' };
  for (const { name, bytes } of candidates) {
    try {
      const sidecar = parseD2rl(bytes);
      if (await d2rlMatchesSave(sidecar, save)) return { status: 'matched', name, esrVersion: sidecar.esrVersion };
      if (rejected.status === 'none') rejected = { status: 'rejected', name, reason: 'mismatch' };
    } catch (error) {
      console.warn(`[Character] Ignoring the sidecar ${name}:`, error);
      if (rejected.status === 'none') rejected = { status: 'rejected', name, reason: 'unreadable' };
    }
  }
  return rejected;
}
