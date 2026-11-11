// The one table of the character stats' labels, short forms, units, groups and order: the build form and detail page
// (the stats block of buildStats.ts) and every view of the computed sheet on My Character (Overview, Copy as text) read
// it, so a number is named the same everywhere. Pure, and it imports only the builds model: the builds route never pulls
// the character feature in for its labels.

import { type BuildStats, type StatKey, type StatsDifficulty, type StatValues } from '../buildStats';

export type StatGroupId = 'attributes' | 'pools' | 'resists' | 'defense' | 'speeds' | 'offence' | 'find' | 'skills';

/** How a number reads: a count (6,080), a percentage (79%), a bonus (+10) */
export type StatUnit = 'number' | 'percent' | 'bonus';

export interface StatLabel {
  readonly key: StatKey;
  /** Sentence case, as the game's screens name it ("Faster cast rate") */
  readonly label: string;
  /** The community short form ("FCR"), for compact text such as Copy as text */
  readonly short: string;
  readonly unit: StatUnit;
}

export interface StatGroup {
  readonly id: StatGroupId;
  readonly title: string;
  readonly stats: readonly StatLabel[];
}

const stat = (key: StatKey, label: string, short: string, unit: StatUnit): StatLabel => ({ key, label, short, unit });

/** Every stat in display order, grouped. Each stored key appears exactly once. */
export const STAT_GROUPS: readonly StatGroup[] = [
  {
    id: 'attributes',
    title: 'Attributes',
    stats: [
      stat('str', 'Strength', 'Str', 'number'),
      stat('dex', 'Dexterity', 'Dex', 'number'),
      stat('vit', 'Vitality', 'Vit', 'number'),
      stat('ene', 'Energy', 'Ene', 'number'),
    ],
  },
  { id: 'pools', title: 'Life and mana', stats: [stat('life', 'Life', 'Life', 'number'), stat('mana', 'Mana', 'Mana', 'number')] },
  {
    id: 'resists',
    title: 'Resistances',
    stats: [
      stat('fr', 'Fire', 'Fire', 'percent'),
      stat('cr', 'Cold', 'Cold', 'percent'),
      stat('lr', 'Lightning', 'Lightning', 'percent'),
      stat('pr', 'Poison', 'Poison', 'percent'),
      stat('mr', 'Magic', 'Magic', 'percent'),
      stat('phr', 'Physical', 'Physical', 'percent'),
      stat('frm', 'Max fire', 'max', 'percent'),
      stat('crm', 'Max cold', 'max', 'percent'),
      stat('lrm', 'Max lightning', 'max', 'percent'),
      stat('prm', 'Max poison', 'max', 'percent'),
      stat('mrm', 'Max magic', 'max', 'percent'),
    ],
  },
  {
    id: 'defense',
    title: 'Defense and mitigation',
    stats: [
      stat('def', 'Defense', 'Defense', 'number'),
      stat('dr', 'Damage reduced by', 'DR', 'number'),
      stat('mdr', 'Magic damage reduced by', 'MDR', 'number'),
      stat('blk', 'Chance to block', 'Block', 'percent'),
      stat('dod', 'Dodge chance', 'Dodge', 'percent'),
      stat('avo', 'Avoid chance', 'Avoid', 'percent'),
      stat('eva', 'Evade chance', 'Evade', 'percent'),
    ],
  },
  {
    id: 'speeds',
    title: 'Speeds',
    stats: [
      stat('ias', 'Increased attack speed', 'IAS', 'percent'),
      stat('frw', 'Faster run/walk', 'FRW', 'percent'),
      stat('fhr', 'Faster hit recovery', 'FHR', 'percent'),
      stat('fbr', 'Faster block rate', 'FBR', 'percent'),
      stat('fcr', 'Faster cast rate', 'FCR', 'percent'),
    ],
  },
  {
    id: 'offence',
    title: 'Offence',
    stats: [
      stat('ar', 'Attack rating', 'AR', 'number'),
      stat('arp', 'Attack rating bonus', 'AR bonus', 'percent'),
      stat('ds', 'Deadly strike', 'DS', 'percent'),
      stat('cb', 'Crushing blow', 'CB', 'percent'),
      stat('ll', 'Life stolen per hit', 'LL', 'percent'),
      stat('ml', 'Mana stolen per hit', 'ML', 'percent'),
    ],
  },
  { id: 'find', title: 'Find', stats: [stat('mf', 'Magic find', 'MF', 'percent'), stat('gf', 'Extra gold', 'Extra gold', 'percent')] },
  { id: 'skills', title: 'Skills', stats: [stat('sk', 'All skills', 'all skills', 'bonus')] },
];

const LABELS: ReadonlyMap<StatKey, StatLabel> = new Map(STAT_GROUPS.flatMap((group) => group.stats.map((entry) => [entry.key, entry])));

/** The label entry of a stat key (every StatKey has one). */
export function statLabel(key: StatKey): StatLabel {
  return LABELS.get(key) ?? { key, label: key, short: key, unit: 'number' };
}

/** The resist each max-resist key belongs to (the detail page folds them: "79% · max 79") */
export const MAX_RESIST_OF: Readonly<Partial<Record<StatKey, StatKey>>> = { frm: 'fr', crm: 'cr', lrm: 'lr', prm: 'pr', mrm: 'mr' };
const MAX_OF_RESIST: ReadonlyMap<StatKey, StatKey> = new Map(
  Object.entries(MAX_RESIST_OF).map(([max, resist]) => [resist, max as StatKey] as const)
);

/**
 * Bonuses for which 0 means "none": a save import leaves them out, and the detail page hides a typed 0 ("Avoid chance 0%"
 * says nothing). Attributes, life, mana, resistances, defense and attack rating keep a 0: "0% fire" says something.
 */
export const OMIT_WHEN_ZERO: ReadonlySet<StatKey> = new Set<StatKey>([
  'dr',
  'mdr',
  'blk',
  'dod',
  'avo',
  'eva',
  'ias',
  'frw',
  'fhr',
  'fbr',
  'fcr',
  'arp',
  'ds',
  'cb',
  'll',
  'ml',
  'mf',
  'gf',
  'sk',
]);

/** The base resist cap: a stored max resist only matters above it (the import stores it only then). */
export const BASE_RESIST_CAP = 75;

export const DIFFICULTY_NAMES: Readonly<Record<StatsDifficulty, string>> = { 0: 'Normal', 1: 'Nightmare', 2: 'Hell' };

/** en-US grouping: Copy as text, the stats block and anything compared in tests */
export const EN_NUMBERS = new Intl.NumberFormat('en-US');

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

/** A stat value as shown: grouped digits, the unit, a + on bonuses ("6,080", "75%", "+10"). */
export function formatStatValue(key: StatKey, value: number): string {
  return formatStat(value, statLabel(key).unit);
}

/** A group's heading; the resistances name the difficulty they are for ("Resistances (Hell)"). */
export function statGroupTitle(group: StatGroup, difficulty: StatsDifficulty): string {
  return group.id === 'resists' ? `${group.title} (${DIFFICULTY_NAMES[difficulty]})` : group.title;
}

export interface StatedStat {
  readonly stat: StatLabel;
  readonly value: number;
  /** The value as shown, with a folded max resist ("79% · max 79") */
  readonly text: string;
}

export interface StatedGroup {
  readonly group: StatGroup;
  readonly stats: readonly StatedStat[];
}

/**
 * The groups with at least one shown value, each with only its shown values (display order): a 0 of an OMIT_WHEN_ZERO
 * bonus is hidden, and a max resist folds into its resist's row ("79% · max 79"; alone only without the resist).
 */
export function statedGroups(values: StatValues): readonly StatedGroup[] {
  return STAT_GROUPS.flatMap((group) => {
    const stats = group.stats.flatMap((entry): StatedStat[] => {
      const value = values[entry.key];
      if (value === undefined || (value === 0 && OMIT_WHEN_ZERO.has(entry.key))) return [];
      const resist = MAX_RESIST_OF[entry.key];
      if (resist !== undefined && values[resist] !== undefined) return [];
      const maxKey = MAX_OF_RESIST.get(entry.key);
      const max = maxKey === undefined ? undefined : values[maxKey];
      const text = formatStatValue(entry.key, value);
      return [{ stat: entry, value, text: max === undefined ? text : `${text} · max ${EN_NUMBERS.format(max)}` }];
    });
    return stats.length > 0 ? [{ group, stats }] : [];
  });
}

/** "11 Nov 2026" in UTC from Unix seconds (a fixed format, so the line reads the same everywhere). */
export function formatSavedDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** What the provenance line reads: a stored block, or the form's draft (booleans) */
export type StatsProvenance = Pick<BuildStats, 'source' | 'character' | 'savedAt' | 'esrVersion'> & {
  readonly edited?: boolean;
  readonly buffed?: boolean;
};

/**
 * Where the numbers came from, as one line: "From SpinToWin's save of 11 Nov 2026, ESR 3.3.03, unbuffed",
 * "…, edited by the author", "Entered by hand" (", buffed" when the block says so).
 */
export function statsProvenance(stats: StatsProvenance): string {
  const buffs = stats.buffed === true ? 'buffed' : 'unbuffed';
  if (stats.source === 'manual') return stats.buffed === true ? 'Entered by hand, buffed' : 'Entered by hand';
  const owner = stats.character === undefined ? 'a save' : `${stats.character}'s save`;
  const parts = [
    `From ${owner}${stats.savedAt === undefined ? '' : ` of ${formatSavedDate(stats.savedAt)}`}`,
    ...(stats.esrVersion === undefined ? [] : [`ESR ${stats.esrVersion}`]),
    buffs,
    ...(stats.edited === true ? ['edited by the author'] : []),
  ];
  return parts.join(', ');
}

/** The note under the stats on the detail page, following the block's flags (a buffed block never says "without buffs"). */
export function statsNote(stats: Pick<BuildStats, 'source' | 'edited' | 'buffed'>): string {
  const buffs = stats.buffed === true ? ' The author says they include buffs.' : '';
  if (stats.source === 'manual') return `The author’s numbers, entered by hand.${buffs}`;
  const changed = stats.edited === true ? ', then changed by the author' : '';
  return stats.buffed === true
    ? `The author’s numbers, computed by this app from their save file${changed}.${buffs}`
    : `The author’s numbers, computed by this app from their save file without buffs${changed}.`;
}
