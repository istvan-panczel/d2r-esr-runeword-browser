/**
 * Display labels of the computed sheet's numbers, shared by every view of a sheet: the My Character Overview and its
 * "Copy as text", and a stats block built from a CharacterStatsSnapshot (the keys are the snapshot's). Plain data and
 * formatters, no React.
 */
import type { DifficultyIndex } from '../../parser/types';
import type { CharacterStatsSnapshot } from './types';

/** en-US grouping: the copy-as-text output and anything compared in tests */
export const EN_NUMBERS = new Intl.NumberFormat('en-US');

export const DIFFICULTY_NAMES: Readonly<Record<DifficultyIndex, string>> = { 0: 'Normal', 1: 'Nightmare', 2: 'Hell' };

/** The numeric snapshot fields (everything but the version, difficulty, dates and flags) */
export type SnapshotStatKey = Exclude<keyof CharacterStatsSnapshot, 'v' | 'difficulty' | 'savedAt' | 'esrVersion' | 'buf' | 'ws'>;

export type StatUnit =
  /** A count or amount: 6,080 */
  | 'number'
  /** A percentage: 79% */
  | 'percent'
  /** A bonus: +10 */
  | 'bonus';

export interface StatLabel {
  /** As the game's screens name it, sentence case ("Faster cast rate") */
  readonly label: string;
  /** The community short form ("FCR"), for compact text */
  readonly short: string;
  readonly unit: StatUnit;
}

export const SHEET_STAT_LABELS: Readonly<Record<SnapshotStatKey, StatLabel>> = {
  lvl: { label: 'Level', short: 'Level', unit: 'number' },
  str: { label: 'Strength', short: 'Str', unit: 'number' },
  dex: { label: 'Dexterity', short: 'Dex', unit: 'number' },
  vit: { label: 'Vitality', short: 'Vit', unit: 'number' },
  ene: { label: 'Energy', short: 'Ene', unit: 'number' },
  life: { label: 'Life', short: 'Life', unit: 'number' },
  mana: { label: 'Mana', short: 'Mana', unit: 'number' },
  def: { label: 'Defense', short: 'Def', unit: 'number' },
  fr: { label: 'Fire resistance', short: 'Fire', unit: 'percent' },
  cr: { label: 'Cold resistance', short: 'Cold', unit: 'percent' },
  lr: { label: 'Lightning resistance', short: 'Light', unit: 'percent' },
  pr: { label: 'Poison resistance', short: 'Poison', unit: 'percent' },
  mr: { label: 'Magic resistance', short: 'Magic', unit: 'percent' },
  phr: { label: 'Physical resistance', short: 'Phys', unit: 'percent' },
  mrm: { label: 'Maximum magic resistance', short: 'Max magic', unit: 'percent' },
  frm: { label: 'Maximum fire resistance', short: 'Max fire', unit: 'percent' },
  crm: { label: 'Maximum cold resistance', short: 'Max cold', unit: 'percent' },
  lrm: { label: 'Maximum lightning resistance', short: 'Max light', unit: 'percent' },
  prm: { label: 'Maximum poison resistance', short: 'Max poison', unit: 'percent' },
  dr: { label: 'Damage reduced by', short: 'DR', unit: 'number' },
  mdr: { label: 'Magic damage reduced by', short: 'MDR', unit: 'number' },
  ias: { label: 'Increased attack speed', short: 'IAS', unit: 'percent' },
  frw: { label: 'Faster run/walk', short: 'FRW', unit: 'percent' },
  fhr: { label: 'Faster hit recovery', short: 'FHR', unit: 'percent' },
  fbr: { label: 'Faster block rate', short: 'FBR', unit: 'percent' },
  fcr: { label: 'Faster cast rate', short: 'FCR', unit: 'percent' },
  sk: { label: 'All skills', short: 'All skills', unit: 'bonus' },
  ar: { label: 'Attack rating', short: 'AR', unit: 'number' },
  arp: { label: 'Bonus to attack rating', short: 'AR%', unit: 'percent' },
  ds: { label: 'Deadly strike', short: 'DS', unit: 'percent' },
  cb: { label: 'Crushing blow', short: 'CB', unit: 'percent' },
  ll: { label: 'Life leech', short: 'LL', unit: 'percent' },
  ml: { label: 'Mana leech', short: 'ML', unit: 'percent' },
  mf: { label: 'Magic find', short: 'MF', unit: 'percent' },
  gf: { label: 'Gold find', short: 'GF', unit: 'percent' },
  dod: { label: 'Dodge', short: 'Dodge', unit: 'percent' },
  avo: { label: 'Avoid', short: 'Avoid', unit: 'percent' },
  eva: { label: 'Evade', short: 'Evade', unit: 'percent' },
  blk: { label: 'Chance to block', short: 'Block', unit: 'percent' },
};

/** A number in a unit: "6,080", "79%", "+10", "-5" (the formatter decides the grouping; default en-US) */
export function formatStat(value: number, unit: StatUnit, format: Intl.NumberFormat = EN_NUMBERS): string {
  const text = format.format(value);
  switch (unit) {
    case 'number':
      return text;
    case 'percent':
      return `${text}%`;
    case 'bonus':
      return value > 0 ? `+${text}` : text;
  }
}
