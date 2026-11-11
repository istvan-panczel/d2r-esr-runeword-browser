// The character stats block in the build form: stored BuildStats ⇄ StatsDraft (raw input text per stat), parsing and
// validity. Pure; the reducer actions live in variantDrafts.ts.

import {
  STAT_KEYS,
  STAT_RANGES,
  hasStatValues,
  isStatValue,
  type BuildStats,
  type StatKey,
  type StatValues,
  type StatsDifficulty,
} from '../buildStats';
import type { StatsDraft } from '../components/buildFormModel';

/** The difficulty a new hand-made block starts on (most builds are about Hell). */
export const DEFAULT_STATS_DIFFICULTY: StatsDifficulty = 2;

/** A hand-made block with nothing stated yet. */
export function emptyStatsDraft(): StatsDraft {
  return { source: 'manual', edited: false, difficulty: DEFAULT_STATS_DIFFICULTY, buffed: false, values: {} };
}

/** The editable form of a stored block (or of one computed from a save); null without one. */
export function toStatsDraft(stats: BuildStats | undefined): StatsDraft | null {
  if (stats === undefined) return null;
  const values: Partial<Record<StatKey, string>> = {};
  for (const key of STAT_KEYS) {
    const value = stats.values[key];
    if (value !== undefined) values[key] = String(value);
  }
  return {
    source: stats.source,
    edited: stats.edited === true,
    difficulty: stats.difficulty,
    buffed: stats.buffed === true,
    ...(stats.character !== undefined ? { character: stats.character } : {}),
    ...(stats.savedAt !== undefined ? { savedAt: stats.savedAt } : {}),
    ...(stats.esrVersion !== undefined ? { esrVersion: stats.esrVersion } : {}),
    values,
  };
}

/** A stat's input text parsed: undefined when blank (not stated), null when not an integer in the stat's range. */
export function parseStatText(key: StatKey, text: string | undefined): number | undefined | null {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return isStatValue(key, value) ? value : null;
}

/** The keys whose text is not a valid number for the stat. */
export function invalidStatKeys(draft: StatsDraft | null): readonly StatKey[] {
  if (draft === null) return [];
  return STAT_KEYS.filter((key) => parseStatText(key, draft.values[key]) === null);
}

/** Whether the block is absent or every stated number is valid (the form refuses to save otherwise). */
export function statsDraftValid(draft: StatsDraft | null): boolean {
  return invalidStatKeys(draft).length === 0;
}

/** The stated, valid numbers of a draft, in stored order. */
export function statsDraftValues(draft: StatsDraft): StatValues {
  const entries = STAT_KEYS.flatMap((key) => {
    const value = parseStatText(key, draft.values[key]);
    return value === undefined || value === null ? [] : [[key, value] as const];
  });
  return Object.fromEntries(entries);
}

/** The stored form of a draft; undefined when there is no block or nothing is stated (an empty block is not stored). */
export function fromStatsDraft(draft: StatsDraft | null): BuildStats | undefined {
  if (draft === null) return undefined;
  const values = statsDraftValues(draft);
  if (!hasStatValues(values)) return undefined;
  const fromSave = draft.source === 'save';
  return {
    source: draft.source,
    ...(fromSave && draft.edited ? { edited: true as const } : {}),
    difficulty: draft.difficulty,
    ...(draft.buffed ? { buffed: true as const } : {}),
    ...(fromSave && draft.character !== undefined ? { character: draft.character } : {}),
    ...(fromSave && draft.savedAt !== undefined ? { savedAt: draft.savedAt } : {}),
    ...(fromSave && draft.esrVersion !== undefined ? { esrVersion: draft.esrVersion } : {}),
    values,
  };
}

/** The stated input count of a draft (blank texts not counted). */
export function statedCount(draft: StatsDraft): number {
  return STAT_KEYS.filter((key) => (draft.values[key] ?? '').trim() !== '').length;
}

/** The accepted range of a stat as text ("-1,000 to 100, whole numbers"), the hint of an invalid input. */
export function statRangeHint(key: StatKey): string {
  const { min, max } = STAT_RANGES[key];
  return `${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}, whole numbers`;
}
