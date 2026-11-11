// Labels, groups, units and order of the character stats block (buildStats.ts), shared by the form and the detail page.
// Pure. (The My Character page may grow its own label table in character/engine/sheet/; unify them when both exist.)

import { type BuildStats, type StatKey, type StatsDifficulty, type StatValues } from '../buildStats';

export type StatGroupId = 'attributes' | 'pools' | 'resists' | 'defense' | 'speeds' | 'offence' | 'find' | 'skills';

export interface StatLabel {
  readonly key: StatKey;
  readonly label: string;
  /** '%' for percentages, '' for plain numbers */
  readonly unit: '%' | '';
  /** Shown with a leading + when positive (bonuses such as +skills) */
  readonly signed?: true;
}

export interface StatGroup {
  readonly id: StatGroupId;
  readonly title: string;
  readonly stats: readonly StatLabel[];
}

const plain = (key: StatKey, label: string): StatLabel => ({ key, label, unit: '' });
const percent = (key: StatKey, label: string): StatLabel => ({ key, label, unit: '%' });

/** Every stat in display order, grouped. Each stored key appears exactly once. */
export const STAT_GROUPS: readonly StatGroup[] = [
  {
    id: 'attributes',
    title: 'Attributes',
    stats: [plain('str', 'Strength'), plain('dex', 'Dexterity'), plain('vit', 'Vitality'), plain('ene', 'Energy')],
  },
  { id: 'pools', title: 'Life and mana', stats: [plain('life', 'Life'), plain('mana', 'Mana')] },
  {
    id: 'resists',
    title: 'Resistances',
    stats: [
      percent('fr', 'Fire'),
      percent('cr', 'Cold'),
      percent('lr', 'Lightning'),
      percent('pr', 'Poison'),
      percent('mr', 'Magic'),
      percent('phr', 'Physical'),
      percent('frm', 'Max fire'),
      percent('crm', 'Max cold'),
      percent('lrm', 'Max lightning'),
      percent('prm', 'Max poison'),
    ],
  },
  {
    id: 'defense',
    title: 'Defense and mitigation',
    stats: [
      plain('def', 'Defense'),
      plain('dr', 'Damage reduced'),
      plain('mdr', 'Magic damage reduced'),
      percent('blk', 'Chance to block'),
      percent('dod', 'Dodge'),
      percent('avo', 'Avoid'),
      percent('eva', 'Evade'),
    ],
  },
  {
    id: 'speeds',
    title: 'Speeds',
    stats: [
      percent('ias', 'Increased attack speed'),
      percent('frw', 'Faster run/walk'),
      percent('fhr', 'Faster hit recovery'),
      percent('fbr', 'Faster block rate'),
      percent('fcr', 'Faster cast rate'),
    ],
  },
  {
    id: 'offence',
    title: 'Offence',
    stats: [
      plain('ar', 'Attack rating (no skill)'),
      percent('arp', 'Attack rating bonus'),
      percent('ds', 'Deadly strike'),
      percent('cb', 'Crushing blow'),
      percent('ll', 'Life leech'),
      percent('ml', 'Mana leech'),
    ],
  },
  { id: 'find', title: 'Find', stats: [percent('mf', 'Magic find'), percent('gf', 'Gold find')] },
  { id: 'skills', title: 'Skills', stats: [{ key: 'sk', label: 'All skills', unit: '', signed: true }] },
];

const LABELS: ReadonlyMap<StatKey, StatLabel> = new Map(STAT_GROUPS.flatMap((group) => group.stats.map((stat) => [stat.key, stat])));

/** The label entry of a stat key (every StatKey has one). */
export function statLabel(key: StatKey): StatLabel {
  return LABELS.get(key) ?? { key, label: key, unit: '' };
}

export const DIFFICULTY_NAMES: Readonly<Record<StatsDifficulty, string>> = { 0: 'Normal', 1: 'Nightmare', 2: 'Hell' };

/** A stat value as shown: grouped digits, the unit, a + on signed bonuses ("6,080", "75%", "+10"). */
export function formatStatValue(key: StatKey, value: number): string {
  const { unit, signed } = statLabel(key);
  const sign = signed === true && value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US')}${unit}`;
}

/** A group's heading; the resistances name the difficulty they are for ("Resistances (Hell)"). */
export function statGroupTitle(group: StatGroup, difficulty: StatsDifficulty): string {
  return group.id === 'resists' ? `${group.title} (${DIFFICULTY_NAMES[difficulty]})` : group.title;
}

export interface StatedGroup {
  readonly group: StatGroup;
  readonly stats: readonly { readonly stat: StatLabel; readonly value: number }[];
}

/** The groups with at least one stated value, each with only its stated values (display order). */
export function statedGroups(values: StatValues): readonly StatedGroup[] {
  return STAT_GROUPS.flatMap((group) => {
    const stats = group.stats.flatMap((stat) => {
      const value = values[stat.key];
      return value === undefined ? [] : [{ stat, value }];
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
