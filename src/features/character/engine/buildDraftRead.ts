/** Upload checks and parse errors of a character save picked for a build draft. Never throws; the page stays usable. */
import type { StashBundle } from '@/features/game-data/engine/schema';
import { createCharacterData } from '../parser/characterData';
import { CharacterParseError } from '../parser/errors';
import { parseCharacter } from '../parser/parseCharacter';
import { createBuildDraft, type BuildDraft, type BuildDraftData } from './buildDraft';

const SAVE_EXTENSION = '.d2s';
/** An ESR save is a few KB; anything this large is not one */
const MAX_SAVE_BYTES = 8 * 1024 * 1024;

export interface SaveDraftError {
  readonly title: string;
  /** The failure point only, never item data */
  readonly message: string;
}

export type SaveDraftResult = { readonly ok: true; readonly draft: BuildDraft } | { readonly ok: false; readonly error: SaveDraftError };

/** The error of a file that should not be read at all, or null. */
export function checkSaveUpload(name: string, size: number): SaveDraftError | null {
  if (!name.toLowerCase().endsWith(SAVE_EXTENSION)) {
    return { title: 'Not a character save', message: `"${name}" is not a character save. Pick the character's ${SAVE_EXTENSION} file.` };
  }
  if (size > MAX_SAVE_BYTES) {
    return { title: 'Not a character save', message: `"${name}" is far too large for a character save.` };
  }
  return null;
}

export function draftFromSaveBytes(bytes: Uint8Array, fileName: string, stash: StashBundle, data: BuildDraftData): SaveDraftResult {
  try {
    const file = parseCharacter(bytes, createCharacterData(stash));
    return { ok: true, draft: createBuildDraft(file, data, fileName) };
  } catch (error) {
    if (error instanceof CharacterParseError) return { ok: false, error: { title: 'Could not read this save', message: error.message } };
    console.error('Could not build a draft from the save:', error);
    return {
      ok: false,
      error: { title: 'Something went wrong', message: 'The save could not be turned into a draft. Try again, or start a build by hand.' },
    };
  }
}
