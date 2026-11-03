/**
 * The owner's real stash for fixture tests: `describeWithFixture` runs its tests only when
 * test-fixtures/stash/ModernSharedStashSoftCoreV2.d2i (gitignored, a personal save) and the committed stash.json /
 * types.json exist, and skips them otherwise. The files are read and parsed once, on first use.
 */
import { describe } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle, StashNamesBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { readStash } from '../engine/readStash';
import type { StashFile } from '../parser/types';

const ROOT = resolve(__dirname, '../../../..');
export const STASH_FIXTURE_FILE = resolve(ROOT, 'test-fixtures/stash/ModernSharedStashSoftCoreV2.d2i');
const BUNDLE_FILE = resolve(ROOT, 'public/game-data/stash.json');
const NAMES_FILE = resolve(ROOT, 'public/game-data/stashnames.json');
const TYPES_FILE = resolve(ROOT, 'public/game-data/types.json');

export interface StashFixture {
  readonly stash: StashFile;
  /** The committed stash.json with the committed stashnames.json */
  readonly bundle: StashBundle & StashNamesBundle;
  /** The committed types.json */
  readonly types: TypesBundle;
}

export const hasStashFixture = (): boolean => [STASH_FIXTURE_FILE, BUNDLE_FILE, NAMES_FILE, TYPES_FILE].every((file) => existsSync(file));

let cached: StashFixture | null = null;

/** The parsed fixture (read once); throws when it is missing or does not parse. */
export function loadStashFixture(): StashFixture {
  if (cached !== null) return cached;
  const bundle = {
    ...(JSON.parse(readFileSync(BUNDLE_FILE, 'utf-8')) as StashBundle),
    ...(JSON.parse(readFileSync(NAMES_FILE, 'utf-8')) as StashNamesBundle),
  };
  const types = JSON.parse(readFileSync(TYPES_FILE, 'utf-8')) as TypesBundle;
  const result = readStash(new Uint8Array(readFileSync(STASH_FIXTURE_FILE)), bundle);
  if (!result.ok) throw new Error(`stash fixture: ${result.error.message}`);
  cached = { stash: result.stash, bundle, types };
  return cached;
}

/** A `describe` block that is skipped without the fixture; `fixture()` returns the parsed fixture inside the tests. */
export function describeWithFixture(name: string, body: (fixture: () => StashFixture) => void): void {
  describe.skipIf(!hasStashFixture())(name, () => {
    body(loadStashFixture);
  });
}
