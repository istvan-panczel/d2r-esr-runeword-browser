// The optional character stats block of a variant (`VariantData.stats`): headline numbers of the character screen, either
// computed by the app from a save (then editable) or typed by the author. Stored in the public build_data jsonb, so the
// read side rebuilds it from known keys only (asBuildStats). See builds-feature-docs/FEATURE-BUILD-SHARING.md.
//
// The numeric keys follow the computed sheet's CharacterStatsSnapshot (src/features/character/engine/sheet/types.ts)
// minus `lvl` (the variant's own `level` holds it). This module imports nothing from the character feature, so the
// builds model stays standalone; the snapshot → stats conversion lives in character/engine/buildDraftStats.ts.

/** 0 Normal, 1 Nightmare, 2 Hell: the difficulty the resistances are for. */
export type StatsDifficulty = 0 | 1 | 2;

export const STATS_DIFFICULTIES: readonly StatsDifficulty[] = [0, 1, 2];

/** Where the numbers came from: computed by the app from a save file, or typed by the author. */
export type StatsSource = 'save' | 'manual';

/** Inclusive integer range of one stat. */
export interface StatRange {
  readonly min: number;
  readonly max: number;
}

const ATTRIBUTE: StatRange = { min: 0, max: 100_000 };
const POOL: StatRange = { min: 0, max: 10_000_000 };
const RESIST: StatRange = { min: -1000, max: 100 };
const CAP: StatRange = { min: 0, max: 100 };
const FLAT: StatRange = { min: 0, max: 1_000_000 };
const SPEED: StatRange = { min: -1000, max: 10_000 };
const PERCENT: StatRange = { min: -1000, max: 100_000 };
const CHANCE: StatRange = { min: 0, max: 100 };

/**
 * Every stored number, in stored (and display) order, with its accepted range. Generous on purpose: the ranges only keep
 * nonsense out of a public table, they do not judge a build. Integers only (the character screen shows no fractions).
 */
export const STAT_RANGES = {
  str: ATTRIBUTE,
  dex: ATTRIBUTE,
  vit: ATTRIBUTE,
  ene: ATTRIBUTE,
  life: POOL,
  mana: POOL,
  fr: RESIST,
  cr: RESIST,
  lr: RESIST,
  pr: RESIST,
  mr: RESIST,
  phr: RESIST,
  frm: CAP,
  crm: CAP,
  lrm: CAP,
  prm: CAP,
  def: POOL,
  dr: FLAT,
  mdr: FLAT,
  blk: CHANCE,
  dod: CHANCE,
  avo: CHANCE,
  eva: CHANCE,
  ias: SPEED,
  frw: SPEED,
  fhr: SPEED,
  fbr: SPEED,
  fcr: SPEED,
  ar: { min: 0, max: 100_000_000 },
  arp: PERCENT,
  ds: { min: 0, max: 1000 },
  cb: { min: 0, max: 1000 },
  ll: { min: 0, max: 10_000 },
  ml: { min: 0, max: 10_000 },
  mf: PERCENT,
  gf: PERCENT,
  sk: { min: -100, max: 1000 },
} as const satisfies Readonly<Record<string, StatRange>>;

export type StatKey = keyof typeof STAT_RANGES;

export const STAT_KEYS = Object.keys(STAT_RANGES) as readonly StatKey[];

/** The stated numbers; an absent key means "not stated". */
export type StatValues = Readonly<Partial<Record<StatKey, number>>>;

export interface BuildStats {
  readonly source: StatsSource;
  /** Set once the author changed a number (or the difficulty / buffs flag) of save-derived stats. */
  readonly edited?: true;
  readonly difficulty: StatsDifficulty;
  /** The numbers include buffs (the app's own computation never does; the author can say so). */
  readonly buffed?: true;
  /** Save-derived only: the character's name, the save's last-saved time (Unix seconds) and the ESR version of its sidecar. */
  readonly character?: string;
  readonly savedAt?: number;
  readonly esrVersion?: string;
  readonly values: StatValues;
}

/** Longest stored ESR version text ("3.3.03"). */
export const STATS_ESR_VERSION_MAX_LENGTH = 20;
/** D2R character names are 2–15 characters: letters, one dash or underscore. */
const CHARACTER_NAME = /^[A-Za-z][A-Za-z_-]{1,14}$/;
const ESR_VERSION = /^\d{1,3}(\.\d{1,3}){1,3}[a-z]?$/;
/** Accepted last-saved times: 2020-01-01 up to 2100-01-01 (Unix seconds). */
const SAVED_AT_MIN = 1_577_836_800;
const SAVED_AT_MAX = 4_102_444_800;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether `value` is an integer within the stat's range. */
export function isStatValue(key: StatKey, value: unknown): value is number {
  const range = STAT_RANGES[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;
}

export const isStatsDifficulty = (value: unknown): value is StatsDifficulty =>
  STATS_DIFFICULTIES.some((difficulty) => difficulty === value);

/** The valid numbers of a stored values object, in STAT_KEYS order (unknown keys and bad values dropped). */
export function asStatValues(value: unknown): StatValues {
  if (!isRecord(value)) return {};
  const entries = STAT_KEYS.flatMap((key) => (isStatValue(key, value[key]) ? [[key, value[key]] as const] : []));
  return Object.fromEntries(entries);
}

export const hasStatValues = (values: StatValues): boolean => STAT_KEYS.some((key) => values[key] !== undefined);

/**
 * Defensive read of a stored stats block, rebuilt from known keys in a fixed order. Undefined when it is not an object,
 * its `source` or `difficulty` is not one of the known values, or no valid number is left. A bad number drops just that
 * number; a bad optional provenance field (`character`, `savedAt`, `esrVersion`) just that field, and those three plus
 * `edited` are only kept on save-derived stats. Never throws; the result is a few hundred bytes at most.
 */
export function asBuildStats(value: unknown): BuildStats | undefined {
  if (!isRecord(value)) return undefined;
  const { source, difficulty } = value;
  if ((source !== 'save' && source !== 'manual') || !isStatsDifficulty(difficulty)) return undefined;
  const values = asStatValues(value.values);
  if (!hasStatValues(values)) return undefined;
  const fromSave = source === 'save';
  const { character, savedAt, esrVersion } = value;
  return {
    source,
    ...(fromSave && value.edited === true ? { edited: true as const } : {}),
    difficulty,
    ...(value.buffed === true ? { buffed: true as const } : {}),
    ...(fromSave && typeof character === 'string' && CHARACTER_NAME.test(character) ? { character } : {}),
    ...(fromSave && typeof savedAt === 'number' && Number.isInteger(savedAt) && savedAt >= SAVED_AT_MIN && savedAt <= SAVED_AT_MAX
      ? { savedAt }
      : {}),
    ...(fromSave && typeof esrVersion === 'string' && esrVersion.length <= STATS_ESR_VERSION_MAX_LENGTH && ESR_VERSION.test(esrVersion)
      ? { esrVersion }
      : {}),
    values,
  };
}
