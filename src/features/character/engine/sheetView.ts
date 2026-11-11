/**
 * The computed sheet as the My Character tabs show it: rows with display text, the unbuffed value beside a buffed one,
 * the resist read-out against the cap, where a number comes from, the buff switches, the hand skills' attack ratings
 * and the "Copy as text" summary. Pure: the components stay thin over these.
 */
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import type { StatKey } from '@/features/builds/buildStats';
import {
  BASE_RESIST_CAP,
  DIFFICULTY_NAMES,
  EN_NUMBERS,
  OMIT_WHEN_ZERO,
  formatStat,
  statLabel,
  type StatUnit,
} from '@/features/builds/utils/statLabels';
import type {
  AvailableBuff,
  AttributeValue,
  BuffKind,
  BuffSelection,
  CharacterSheet,
  ResistValue,
  SheetSource,
  SheetSourceKind,
  SheetStatus,
  MercenaryFacts,
  SheetFacts,
  SheetValue,
  SkillLevel,
} from './sheet/types';
import { weaponSetName } from './sheet/otherSet';

/** How a row's number reads: the stat units, a yes/no flag, or a reduction ("−28%") */
export type RowUnit = StatUnit | 'flag' | 'reduction';

export function formatValue(value: number, unit: RowUnit, format: Intl.NumberFormat = EN_NUMBERS): string {
  if (unit === 'flag') return value > 0 ? 'Yes' : 'No';
  if (unit === 'reduction') return value === 0 ? '0%' : `−${format.format(Math.abs(value))}%`;
  return formatStat(value, unit, format).replace(/^-/, '−');
}

// --- statuses ----------------------------------------------------------------------------------------------------

export const STATUS_TEXT: Readonly<Record<Exclude<SheetStatus, 'verified'>, { readonly short: string; readonly long: string }>> = {
  inferred: {
    short: 'Not yet compared with the game',
    long: 'Worked out from the game files and the game rules, not yet compared with the in-game screen.',
  },
  unverified: {
    short: 'Not yet checked in game',
    long: 'Changed by a buff you switched on or a what-if entry you added. Such numbers have not been checked against the game yet.',
  },
};

/** The stronger of two statuses (unverified > inferred > verified) */
export function weakestStatus(...statuses: readonly SheetStatus[]): SheetStatus {
  if (statuses.includes('unverified')) return 'unverified';
  return statuses.includes('inferred') ? 'inferred' : 'verified';
}

// --- rows --------------------------------------------------------------------------------------------------------

export interface StatRow {
  readonly key: string;
  readonly label: string;
  readonly value: SheetValue;
  readonly text: string;
  /** The unbuffed value's text, only when a buff changed the number */
  readonly unbuffedText: string | null;
}

export interface RowSpec {
  readonly key: string;
  readonly label: string;
  readonly unit: RowUnit;
  readonly get: (sheet: CharacterSheet) => SheetValue | null;
}

function rowOf(spec: RowSpec, sheet: CharacterSheet, unbuffed: CharacterSheet | null, format: Intl.NumberFormat): StatRow | null {
  const value = spec.get(sheet);
  if (value === null) return null;
  const before = unbuffed === null ? null : spec.get(unbuffed);
  const changed = before !== null && before.value !== value.value;
  return {
    key: spec.key,
    label: spec.label,
    value,
    text: formatValue(value.value, spec.unit, format),
    unbuffedText: changed ? formatValue(before.value, spec.unit, format) : null,
  };
}

function rowsOf(
  specs: readonly RowSpec[],
  sheet: CharacterSheet,
  unbuffed: CharacterSheet | null,
  format: Intl.NumberFormat,
  keep: (row: StatRow) => boolean = () => true
): StatRow[] {
  return specs.flatMap((spec) => {
    const row = rowOf(spec, sheet, unbuffed, format);
    return row !== null && keep(row) ? [row] : [];
  });
}

const spec = (key: string, label: string, unit: RowUnit, get: RowSpec['get']): RowSpec => ({ key, label, unit, get });
/** A row of a stat a build's stats block also has: its label and unit come from the one shared table */
const shared = (key: StatKey, get: RowSpec['get']): RowSpec => spec(key, statLabel(key).label, statLabel(key).unit, get);
/** The same with the short form: "Increased attack speed (IAS)" */
const sharedShort = (key: StatKey, get: RowSpec['get']): RowSpec =>
  spec(key, `${statLabel(key).label} (${statLabel(key).short})`, statLabel(key).unit, get);

const DEFENSE_SPECS: readonly RowSpec[] = [
  shared('def', (s) => s.defense),
  shared('dr', (s) => s.damageReduction),
  shared('mdr', (s) => s.magicDamageReduction),
  shared('dod', (s) => s.defenseChances.dodge),
  shared('avo', (s) => s.defenseChances.avoid),
  shared('eva', (s) => s.defenseChances.evade),
  shared('blk', (s) => s.block),
];

const ABSORB_SPECS: readonly RowSpec[] = [
  spec('afp', 'Fire absorb', 'percent', (s) => s.absorb.firePercent),
  spec('af', 'Fire absorb', 'number', (s) => s.absorb.fire),
  spec('acp', 'Cold absorb', 'percent', (s) => s.absorb.coldPercent),
  spec('ac', 'Cold absorb', 'number', (s) => s.absorb.cold),
  spec('alp', 'Lightning absorb', 'percent', (s) => s.absorb.lightningPercent),
  spec('al', 'Lightning absorb', 'number', (s) => s.absorb.lightning),
  spec('amp', 'Magic absorb', 'percent', (s) => s.absorb.magicPercent),
  spec('am', 'Magic absorb', 'number', (s) => s.absorb.magic),
];

const SPEED_SPECS: readonly RowSpec[] = [
  sharedShort('ias', (s) => s.speed.attack),
  sharedShort('frw', (s) => s.speed.run),
  sharedShort('fhr', (s) => s.speed.hitRecovery),
  sharedShort('fbr', (s) => s.speed.block),
  sharedShort('fcr', (s) => s.speed.cast),
  spec('bas', 'Base attack speed', 'percent', (s) => s.speed.baseAttack),
  spec('brw', 'Base run/walk speed', 'percent', (s) => s.speed.baseRunWalk),
];

const OFFENSE_SPECS: readonly RowSpec[] = [
  shared('arp', (s) => s.attackRating.percent),
  shared('ds', (s) => s.offense.deadlyStrike),
  shared('cb', (s) => s.offense.crushingBlow),
  spec('ow', 'Open wounds', 'percent', (s) => s.offense.openWounds),
  shared('ll', (s) => s.leech.life),
  shared('ml', (s) => s.leech.mana),
  spec('td', 'Target defense', 'reduction', (s) => s.offense.targetDefense),
  spec('itd', "Ignore target's defense", 'flag', (s) => s.offense.ignoreTargetDefense),
];

const FIND_SPECS: readonly RowSpec[] = [
  shared('mf', (s) => s.find.magic),
  shared('gf', (s) => s.find.gold),
  shared('sk', (s) => s.skills.all),
  spec('cls', 'Class skills', 'bonus', (s) => s.skills.cls),
];

const RECOVERY_SPECS: readonly RowSpec[] = [
  spec('rl', 'Replenish life', 'number', (s) => s.regen.life),
  spec('rm', 'Mana regeneration', 'percent', (s) => s.regen.mana),
];

/** Every row of the Overview's defense, speed, offense, find and recovery lists, in card order (whatIfView.ts diffs them) */
export const OVERVIEW_ROW_SPECS: readonly RowSpec[] = [
  ...DEFENSE_SPECS,
  ...ABSORB_SPECS,
  ...SPEED_SPECS,
  ...OFFENSE_SPECS,
  ...FIND_SPECS,
  ...RECOVERY_SPECS,
];

export interface OverviewRows {
  readonly defense: readonly StatRow[];
  /** Only the absorbs above 0 */
  readonly absorb: readonly StatRow[];
  readonly speed: readonly StatRow[];
  readonly offense: readonly StatRow[];
  readonly find: readonly StatRow[];
  readonly recovery: readonly StatRow[];
}

export function overviewRows(sheet: CharacterSheet, unbuffed: CharacterSheet | null, format: Intl.NumberFormat = EN_NUMBERS): OverviewRows {
  return {
    // Dodge, avoid and evade only when the character has any (or a buff changed them): "0%" three times is noise
    defense: rowsOf(
      DEFENSE_SPECS,
      sheet,
      unbuffed,
      format,
      (row) => !['dod', 'avo', 'eva'].includes(row.key) || row.value.value !== 0 || row.unbuffedText !== null
    ),
    absorb: rowsOf(ABSORB_SPECS, sheet, unbuffed, format, (row) => row.value.value !== 0 || row.unbuffedText !== null),
    speed: rowsOf(SPEED_SPECS, sheet, unbuffed, format),
    offense: rowsOf(OFFENSE_SPECS, sheet, unbuffed, format),
    find: rowsOf(FIND_SPECS, sheet, unbuffed, format),
    recovery: rowsOf(RECOVERY_SPECS, sheet, unbuffed, format),
  };
}

// --- attributes and pools ------------------------------------------------------------------------------------------

export interface AttributeRow extends StatRow {
  readonly base: number;
  /** Final − base, signed text ("+776"); null when equal */
  readonly bonusText: string | null;
}

const ATTRIBUTE_KEYS = ['strength', 'dexterity', 'vitality', 'energy'] as const;

export function attributeRows(
  sheet: CharacterSheet,
  unbuffed: CharacterSheet | null,
  format: Intl.NumberFormat = EN_NUMBERS
): AttributeRow[] {
  return ATTRIBUTE_KEYS.map((key) => {
    const value: AttributeValue = sheet.attributes[key];
    const before = unbuffed?.attributes[key];
    const bonus = value.value - value.base;
    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      base: value.base,
      text: format.format(value.value),
      bonusText: bonus === 0 ? null : formatValue(bonus, 'bonus', format),
      unbuffedText: before !== undefined && before.value !== value.value ? format.format(before.value) : null,
    };
  });
}

export interface PoolRow extends StatRow {
  /** The current value the game wrote into the save (whole points) */
  readonly saved: number;
  readonly savedText: string;
  /** The save holds more than the computed maximum: a buff or a shape-shift was likely active when saving */
  readonly savedAbove: boolean;
}

type SavedPools = Pick<CharacterFile['baseAttributes'], 'life' | 'mana' | 'stamina'>;

export function poolRows(
  sheet: CharacterSheet,
  unbuffed: CharacterSheet | null,
  saved: SavedPools,
  format: Intl.NumberFormat = EN_NUMBERS
): PoolRow[] {
  const pools = [
    ['life', 'Life', sheet.life, unbuffed?.life, saved.life],
    ['mana', 'Mana', sheet.mana, unbuffed?.mana, saved.mana],
    ['stamina', 'Stamina', sheet.stamina, unbuffed?.stamina, saved.stamina],
  ] as const;
  return pools.map(([key, label, value, before, savedValue]) => {
    const whole = Math.floor(savedValue);
    return {
      key,
      label,
      value,
      text: format.format(value.value),
      unbuffedText: before !== undefined && before.value !== value.value ? format.format(before.value) : null,
      saved: whole,
      savedText: format.format(whole),
      // Compared with the unbuffed maximum: the save is what the game wrote, whatever is switched on here
      savedAbove: whole > (before ?? value).value,
    };
  });
}

// --- resistances -------------------------------------------------------------------------------------------------

export type ResistState =
  /** The raw sum is above the cap: the surplus is a buffer against curses and the penalty */
  | 'over'
  | 'at'
  /** Below the cap, 0 or above */
  | 'below'
  /** Below 0 */
  | 'negative';

export interface ResistReadout {
  readonly key: 'fire' | 'cold' | 'lightning' | 'poison' | 'magic' | 'physical';
  readonly label: string;
  readonly value: ResistValue;
  readonly shown: number;
  readonly raw: number;
  readonly cap: number;
  readonly penalty: number;
  readonly state: ResistState;
  /** How far from the cap: the surplus when over, the gap when below; 0 at the cap */
  readonly margin: number;
  /** "Over the cap by 32", "At the cap", "11 below the cap" */
  readonly stateText: string;
  /** "Sum 229, Hell penalty −150, raw 79, cap 79" */
  readonly detailText: string;
  readonly unbuffedText: string | null;
}

const RESISTS = [
  ['fire', statLabel('fr').label],
  ['cold', statLabel('cr').label],
  ['lightning', statLabel('lr').label],
  ['poison', statLabel('pr').label],
  ['magic', statLabel('mr').label],
  ['physical', statLabel('phr').label],
] as const;

export function resistReadout(
  key: ResistReadout['key'],
  label: string,
  value: ResistValue,
  difficulty: DifficultyIndex,
  before: ResistValue | null = null,
  format: Intl.NumberFormat = EN_NUMBERS
): ResistReadout {
  const { raw, cap, penalty } = value;
  const shown = value.value;
  const state: ResistState = raw > cap ? 'over' : raw === cap ? 'at' : shown < 0 ? 'negative' : 'below';
  const margin = state === 'over' ? raw - cap : state === 'at' ? 0 : cap - shown;
  const n = (amount: number) => formatValue(amount, 'number', format);
  const stateText = state === 'over' ? `Over the cap by ${n(margin)}` : state === 'at' ? 'At the cap' : `${n(margin)} below the cap`;
  const parts = [`Sum ${n(raw - penalty)}`];
  if (penalty !== 0) parts.push(`${DIFFICULTY_NAMES[difficulty]} penalty ${n(penalty)}`, `raw ${n(raw)}`);
  parts.push(`cap ${n(cap)}`);
  return {
    key,
    label,
    value,
    shown,
    raw,
    cap,
    penalty,
    state,
    margin,
    stateText,
    detailText: parts.join(', '),
    unbuffedText: before !== null && before.value !== shown ? `${n(before.value)}%` : null,
  };
}

export function resistReadouts(
  sheet: CharacterSheet,
  unbuffed: CharacterSheet | null,
  format: Intl.NumberFormat = EN_NUMBERS
): ResistReadout[] {
  return RESISTS.map(([key, label]) =>
    resistReadout(key, label, sheet.resists[key], sheet.difficulty, unbuffed?.resists[key] ?? null, format)
  );
}

/** The meter's scale: 0 to the highest cap any resist can reach (95), or the cap when it is higher */
export const RESIST_SCALE = 95;

// --- attack rating -----------------------------------------------------------------------------------------------

export interface HandRow {
  readonly key: string;
  /** The skill's name */
  readonly label: string;
  /** "Left mouse button" / "Right mouse button" */
  readonly hand: string;
  readonly level: number;
  readonly mainHand: number;
  readonly offHand: number | null;
  /** "61,474" or "61,474 / 68,978" */
  readonly text: string;
  readonly unbuffedText: string | null;
  /** "needs Werewolf form": why the skill cannot be used in the character's current form; null when it can */
  readonly formProblem: string | null;
  readonly status: SheetStatus;
  /** Where the main-hand number comes from: the base attack rating's parts with the skill's % */
  readonly value: SheetValue;
}

/** "it needs Werewolf form" → "needs Werewolf form" (the engine's reason reads after "is not counted:") */
const withoutIt = (reason: string) => reason.replace(/^it /, '');

export function handRows(sheet: CharacterSheet, unbuffed: CharacterSheet | null, format: Intl.NumberFormat = EN_NUMBERS): HandRow[] {
  const { base, percent } = sheet.attackRating;
  const flat = base.sources.filter((source) => source.kind !== 'percent');
  const flatSum = flat.reduce((sum, source) => sum + source.value, 0);
  const lineText = (main: number, off: number | null) =>
    off === null ? format.format(main) : `${format.format(main)} / ${format.format(off)}`;
  return sheet.attackRating.hands.map((hand) => {
    const before = unbuffed?.attackRating.hands.find((entry) => entry.hand === hand.hand && entry.skillId === hand.skillId);
    const text = lineText(hand.mainHand, hand.offHand);
    const beforeText = before === undefined ? null : lineText(before.mainHand, before.offHand);
    const total = percent.value + hand.skillPercent;
    const sources: SheetSource[] = [
      ...flat,
      {
        kind: 'percent',
        label: `Attack rating ${String(percent.value)}% + ${hand.name} ${String(hand.skillPercent)}%`,
        value: hand.mainHand - flatSum,
      },
    ];
    const notes = [`(${format.format(flatSum)}) × (100 + ${String(total)})%, rounded down`];
    if (hand.offHand !== null) notes.push("Second number: the other weapon's line, with its own attack rating bonuses");
    const formProblem = hand.formProblem === undefined ? null : withoutIt(hand.formProblem);
    if (formProblem !== null) notes.push(`You cannot use ${hand.name} right now: it ${formProblem}`);
    return {
      key: `${hand.hand}:${String(hand.skillId)}`,
      label: hand.name,
      hand: hand.hand === 'left' ? 'Left mouse button' : 'Right mouse button',
      level: hand.level,
      mainHand: hand.mainHand,
      offHand: hand.offHand,
      text,
      unbuffedText: beforeText !== null && beforeText !== text ? beforeText : null,
      formProblem,
      status: hand.status,
      value: { value: hand.mainHand, sources, status: hand.status, notes },
    };
  });
}

export interface AttackChoice {
  readonly key: string;
  readonly label: string;
  readonly attackRating: number;
  /** "−x% Target Defense" of that attack: the sheet's, plus the off-hand weapon's own on its line (INFERRED, D2's rule) */
  readonly targetDefense: number;
  /** The off-hand weapon's own share of `targetDefense` (0 on every other line) */
  readonly offHandTargetDefense: number;
}

/**
 * The Combat tab's attack rating choices: each hand skill's main-hand line and, dual wielding, its other weapon's line.
 * The off-hand line adds that weapon's own −% target defense, which the sheet keeps apart (it counts for its hits only).
 */
export function attackChoices(sheet: CharacterSheet, format: Intl.NumberFormat = EN_NUMBERS): AttackChoice[] {
  const targetDefense = sheet.offense.targetDefense.value;
  const offHandTargetDefense = sheet.offense.offHand?.targetDefense ?? 0;
  const choices = sheet.attackRating.hands.flatMap((hand): AttackChoice[] => {
    const button = hand.hand === 'left' ? 'left' : 'right';
    // A skill the current form does not allow stays listed (the save has it on that button), with the reason
    const form = hand.formProblem === undefined ? '' : ` (${withoutIt(hand.formProblem)})`;
    const main = { key: `${hand.hand}:${String(hand.skillId)}:main`, attackRating: hand.mainHand, targetDefense, offHandTargetDefense: 0 };
    if (hand.offHand === null) return [{ ...main, label: `${hand.name} (${button}), ${format.format(hand.mainHand)}${form}` }];
    return [
      { ...main, label: `${hand.name} (${button}), main hand ${format.format(hand.mainHand)}${form}` },
      {
        key: `${hand.hand}:${String(hand.skillId)}:off`,
        label: `${hand.name} (${button}), off hand ${format.format(hand.offHand)}${form}`,
        attackRating: hand.offHand,
        targetDefense: targetDefense + offHandTargetDefense,
        offHandTargetDefense,
      },
    ];
  });
  if (choices.length > 0) return choices;
  return [
    {
      key: 'base',
      label: `No skill, ${format.format(sheet.attackRating.base.value)}`,
      attackRating: sheet.attackRating.base.value,
      targetDefense,
      offHandTargetDefense: 0,
    },
  ];
}

/**
 * The off-hand weapon's own attack speed, deadly strike, crushing blow and target defense (not in the sheet's totals:
 * they belong to that weapon's attacks), as one line; null without a second weapon or when it has none of them
 */
export function offHandText(sheet: CharacterSheet, format: Intl.NumberFormat = EN_NUMBERS): string | null {
  const off = sheet.offense.offHand;
  if (off === null) return null;
  const parts = [
    off.attackSpeed === 0 ? null : `${statLabel('ias').short} ${format.format(off.attackSpeed)}%`,
    off.deadlyStrike === 0 ? null : `${statLabel('ds').label.toLowerCase()} ${format.format(off.deadlyStrike)}%`,
    off.crushingBlow === 0 ? null : `${statLabel('cb').label.toLowerCase()} ${format.format(off.crushingBlow)}%`,
    off.targetDefense === 0 ? null : `−${format.format(off.targetDefense)}% target defense`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(', ');
}

// --- sources -----------------------------------------------------------------------------------------------------

const KIND_LABELS: Readonly<Record<SheetSourceKind, string>> = {
  base: 'Save',
  item: 'Item',
  set: 'Set bonus',
  runic: 'Runic Insight',
  quest: 'Quest',
  passive: 'Passive skill',
  'item-aura': 'Item aura',
  buff: 'Buff',
  'what-if': 'What if',
  'per-level': 'Per level',
  percent: 'Percent',
  attribute: 'Attribute',
  class: 'Base',
  difficulty: 'Difficulty',
  cap: 'Cap',
};

export interface SourceLine {
  readonly key: string;
  readonly label: string;
  /** The engine's own label ("Head", "Charm 3,4", "Head defense (+50%)") when the label is the item's name */
  readonly where: string | null;
  readonly kind: string;
  /** Signed: "+50", "−150", "+12.5" (pools add up in fractions of a point) */
  readonly text: string;
  readonly item: number | null;
}

function signed(value: number, format: Intl.NumberFormat): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return value === 0 ? '0' : value > 0 ? '+<0.1' : '−<0.1';
  const text = format.format(Math.abs(rounded));
  return rounded > 0 ? `+${text}` : `−${text}`;
}

/**
 * A value's sources as lines. `itemName` names an item by its index in `character.items.player` (null: not known yet);
 * an item source then reads as the item's name with the engine's slot label beside it.
 */
export function sourceLines(
  value: Pick<SheetValue, 'sources'>,
  itemName: (index: number) => string | null,
  format: Intl.NumberFormat = EN_NUMBERS
): SourceLine[] {
  return value.sources.map((source, index) => {
    const name = source.item === undefined ? null : itemName(source.item);
    const useName = name !== null && (source.kind === 'item' || source.kind === 'runic');
    return {
      key: `${String(index)}:${source.kind}`,
      label: useName ? (source.kind === 'runic' ? `Runic Insight on ${name}` : name) : source.label,
      where: useName && source.kind === 'item' ? source.label.charAt(0).toUpperCase() + source.label.slice(1) : null,
      kind: KIND_LABELS[source.kind],
      text: signed(source.value, format),
      item: source.item ?? null,
    };
  });
}

// --- buffs -------------------------------------------------------------------------------------------------------

export interface BuffGroup {
  readonly kind: BuffKind;
  readonly title: string;
  readonly hint: string;
  readonly buffs: readonly AvailableBuff[];
}

const BUFF_GROUPS: readonly Omit<BuffGroup, 'buffs'>[] = [
  {
    kind: 'cast',
    title: 'Skills you use',
    hint: 'Warcries, armors and shape-shifts, and what some attacks give you while you use them (Frenzy’s charges, Whirlwind’s dodge), at the level you have',
  },
  { kind: 'aura', title: 'Auras', hint: 'Auras you can switch on yourself' },
  { kind: 'proc', title: 'From your items', hint: 'Skills your items cast on you on an event (on striking, when struck …)' },
];

const CHOICE_TITLES: Readonly<Record<string, string>> = { aura: 'One aura at a time', shapeshift: 'One form at a time' };

/** A single-choice group of buffs (AvailableBuff.exclusiveGroup): the engine counts only one of them */
export interface BuffChoice {
  readonly group: string;
  readonly title: string;
  readonly buffs: readonly AvailableBuff[];
}

/** A buff group's list split into plain switches and single-choice groups (in the order their first member comes) */
export function splitExclusive(buffs: readonly AvailableBuff[]): { singles: AvailableBuff[]; choices: BuffChoice[] } {
  const singles: AvailableBuff[] = [];
  const choices = new Map<string, AvailableBuff[]>();
  for (const buff of buffs) {
    if (buff.exclusiveGroup === undefined) singles.push(buff);
    else choices.set(buff.exclusiveGroup, [...(choices.get(buff.exclusiveGroup) ?? []), buff]);
  }
  return {
    singles,
    choices: [...choices].map(([group, members]) => ({ group, title: CHOICE_TITLES[group] ?? 'One at a time', buffs: members })),
  };
}

/** The selected member of a single-choice group (the last one selected, as the engine counts it), or null */
export function chosenInGroup(selections: readonly BuffSelection[], choice: BuffChoice): AvailableBuff | null {
  const ids = new Set(choice.buffs.map((buff) => buff.skillId));
  const last = selections.filter((entry) => ids.has(entry.skillId)).at(-1);
  return last === undefined ? null : (choice.buffs.find((buff) => buff.skillId === last.skillId) ?? null);
}

/** Chooses one member of a single-choice group (null: none), switching every other member off */
export function chooseInGroup(selections: readonly BuffSelection[], choice: BuffChoice, buff: AvailableBuff | null): BuffSelection[] {
  const ids = new Set(choice.buffs.map((member) => member.skillId));
  const rest = selections.filter((entry) => !ids.has(entry.skillId));
  return buff === null ? rest : toggleBuff(rest, buff, true);
}

/**
 * Selections the character can use: only skills of its buff list (a remembered selection of a replaced or respecced
 * character, or of another one with the same name, never changes the numbers), one per single-choice group (the last)
 */
export function usableSelections(selections: readonly BuffSelection[], available: readonly AvailableBuff[]): BuffSelection[] {
  const byId = new Map(available.map((buff) => [buff.skillId, buff]));
  const known = selections.filter((entry) => byId.has(entry.skillId));
  return known.filter((entry, index) => {
    const group = byId.get(entry.skillId)?.exclusiveGroup;
    if (group === undefined) return true;
    return !known.slice(index + 1).some((later) => byId.get(later.skillId)?.exclusiveGroup === group);
  });
}

export function buffGroups(available: readonly AvailableBuff[]): BuffGroup[] {
  return BUFF_GROUPS.flatMap((group) => {
    const buffs = available.filter((buff) => buff.kind === group.kind);
    return buffs.length === 0 ? [] : [{ ...group, buffs }];
  });
}

/** Whether the character has a shape-shift among its buffs (only then "not while shape-shifted" is worth saying) */
export const canShapeShift = (available: readonly AvailableBuff[]) => available.some((buff) => buff.exclusiveGroup === 'shapeshift');

/**
 * "needs Werewolf or Werebear form" / "not while shape-shifted": what a listed buff asks of the character's form, else
 * null. The second only for a character that can shape-shift (`shifter`): every melee skill of the others has it
 */
export function buffFormText(buff: Pick<AvailableBuff, 'needsForm' | 'unshiftedOnly'>, shifter: boolean): string | null {
  if (buff.needsForm !== undefined) return `needs ${buff.needsForm} form`;
  return shifter && buff.unshiftedOnly === true ? 'not while shape-shifted' : null;
}

/** "Not counted: it needs Werewolf form.": why a switched-on buff does not count in the character's form, else null */
export function blockedBuffText(sheet: Pick<CharacterSheet, 'blockedBuffs'>, skillId: number): string | null {
  const reason = sheet.blockedBuffs?.find((entry) => entry.skillId === skillId)?.reason;
  return reason === undefined ? null : `Not counted: ${reason}.`;
}

/** "cast on weapon set II" for a buff whose level comes from the other weapon set, else null */
export function castSetText(castSet: 1 | 2 | undefined): string | null {
  return castSet === undefined ? null : `cast on weapon set ${weaponSetName(castSet)}`;
}

/**
 * The Buffs card's one note when a listed buff comes from the other weapon set: cast there, then swap back. Null when
 * every buff is cast with the set in hand
 */
export function swapCastNote(available: readonly AvailableBuff[]): string | null {
  const set = available.find((buff) => buff.castSet !== undefined)?.castSet;
  return set === undefined
    ? null
    : `Cast on weapon set ${weaponSetName(set)}, then swap back: the level comes from that set’s gear. The rest of the sheet is for the set in hand.`;
}

export const isBuffOn = (selections: readonly BuffSelection[], skillId: number) => selections.some((entry) => entry.skillId === skillId);

/**
 * Switches a buff on or off. A proc is counted at its item's level (the engine needs it); a cast skill or an aura
 * follows the character's level of it (re-evaluated with the other buffs) until a level is chosen.
 */
export function toggleBuff(selections: readonly BuffSelection[], buff: AvailableBuff, on: boolean): BuffSelection[] {
  const rest = selections.filter((entry) => entry.skillId !== buff.skillId);
  if (!on) return rest;
  return [...rest, buff.kind === 'proc' ? { skillId: buff.skillId, level: buff.level } : { skillId: buff.skillId }];
}

/** Sets a selected buff's level (1 or more, whole); null goes back to the character's own level (procs keep theirs) */
export function setBuffLevel(selections: readonly BuffSelection[], buff: AvailableBuff, level: number | null): BuffSelection[] {
  return selections.map((entry) => {
    if (entry.skillId !== buff.skillId) return entry;
    if (level === null || !Number.isFinite(level))
      return buff.kind === 'proc' ? { skillId: buff.skillId, level: buff.level } : { skillId: buff.skillId };
    return { skillId: buff.skillId, level: Math.max(1, Math.min(99, Math.floor(level))) };
  });
}

/** A stable key of a buff selection (order does not matter) */
export function buffsKey(selections: readonly BuffSelection[]): string {
  return selections
    .map((entry) => (entry.level === undefined ? String(entry.skillId) : `${String(entry.skillId)}@${String(entry.level)}`))
    .sort()
    .join(',');
}

/** One character's remembered buffs, with the save they were chosen for (`buffMemorySave`) */
export interface BuffMemoryEntry {
  readonly save: string;
  readonly selections: readonly BuffSelection[];
}

/**
 * Which save a remembered buff choice belongs to: the save's time and when it was uploaded, so a replaced save (a new
 * game save, a respec) or a removed and uploaded again character starts with no buffs
 */
export function buffMemorySave(character: Pick<CharacterFile, 'lastSavedAt'>, uploadedAt: number | null): string {
  return `${String(character.lastSavedAt)}:${String(uploadedAt ?? 0)}`;
}

/**
 * Buff choices per character name, as kept in sessionStorage; anything malformed is dropped. A Map: a character may be
 * called "constructor" or "toString", which a plain object would answer with Object.prototype's function
 */
export function parseBuffMemory(text: string | null): Map<string, BuffMemoryEntry> {
  const memory = new Map<string, BuffMemoryEntry>();
  if (text === null) return memory;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return memory;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return memory;
  for (const [name, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { save, selections: list } = entry as { save?: unknown; selections?: unknown };
    if (typeof save !== 'string' || !Array.isArray(list)) continue;
    const selections = list.flatMap((item: unknown): BuffSelection[] => {
      if (typeof item !== 'object' || item === null) return [];
      const { skillId, level } = item as { skillId?: unknown; level?: unknown };
      if (typeof skillId !== 'number' || !Number.isInteger(skillId)) return [];
      return typeof level === 'number' && Number.isInteger(level) && level > 0 ? [{ skillId, level }] : [{ skillId }];
    });
    if (selections.length > 0) memory.set(name, { save, selections });
  }
  return memory;
}

/** The buff memory as sessionStorage keeps it (characters without a selection left out) */
export function serializeBuffMemory(memory: ReadonlyMap<string, BuffMemoryEntry>): string {
  const record: Record<string, BuffMemoryEntry> = Object.create(null) as Record<string, BuffMemoryEntry>;
  for (const [name, entry] of memory) if (entry.selections.length > 0) record[name] = entry;
  return JSON.stringify(record);
}

/** The remembered buffs of a character, only for the save they were chosen for */
export function rememberedBuffs(memory: ReadonlyMap<string, BuffMemoryEntry>, name: string, save: string): readonly BuffSelection[] | null {
  const entry = memory.get(name);
  return entry !== undefined && entry.save === save ? entry.selections : null;
}

/** The memory after a change for one character, keeping only the characters still stored */
export function updateBuffMemory(
  memory: ReadonlyMap<string, BuffMemoryEntry>,
  name: string,
  entry: BuffMemoryEntry,
  stored: (name: string) => boolean
): Map<string, BuffMemoryEntry> {
  const next = new Map([...memory].filter(([other]) => other !== name && stored(other)));
  if (entry.selections.length > 0) next.set(name, entry);
  return next;
}

// --- warnings ----------------------------------------------------------------------------------------------------

/** The engine's warnings with repeats folded into one line and a count, in first-seen order */
export function groupWarnings(warnings: readonly string[]): { readonly text: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const warning of warnings) counts.set(warning, (counts.get(warning) ?? 0) + 1);
  return [...counts].map(([text, count]) => ({ text, count }));
}

// --- skills ------------------------------------------------------------------------------------------------------

export interface SkillBonus {
  /** Effective level from the sheet */
  readonly level: number;
  readonly hard: number;
  /** level − hard */
  readonly bonus: number;
  /** The bonus parts (only the non-zero ones) */
  readonly parts: SkillLevel['bonus'];
  /** `unverified` when a selected buff changes the level */
  readonly status: SheetStatus;
}

const BONUS_PART_LABELS: Readonly<Record<keyof SkillLevel['bonus'], string>> = {
  all: 'all skills',
  cls: 'class skills',
  tab: 'skill tab',
  single: 'this skill',
  oskill: 'granted by items',
  buff: 'buffs',
};

/** "all skills +10, class skills +2" ('' without a bonus) */
export function bonusPartsText(parts: SkillLevel['bonus']): string {
  return (Object.keys(BONUS_PART_LABELS) as (keyof SkillLevel['bonus'])[])
    .flatMap((key) => {
      const value = parts[key];
      return value === undefined || value === 0 ? [] : [`${BONUS_PART_LABELS[key]} ${formatValue(value, 'bonus')}`];
    })
    .join(', ');
}

/**
 * Effective skill levels by skills.json id: the sheet's levels are by skills.txt row, `skillIds` (lootfilter.json
 * `skillNames`) maps a row to its id, the table the Skills tab already uses.
 */
export function skillBonusById(sheet: CharacterSheet, skillIds: readonly string[]): ReadonlyMap<string, SkillBonus> {
  const byId = new Map<string, SkillBonus>();
  for (const skill of sheet.skills.levels) {
    const id = skillIds.at(skill.skillId);
    if (id === undefined || id === '') continue;
    byId.set(id, {
      level: skill.level,
      hard: skill.hard,
      bonus: skill.level - skill.hard,
      parts: skill.bonus,
      status: skill.status ?? 'verified',
    });
  }
  return byId;
}

// --- level and experience ------------------------------------------------------------------------------------------

/** "16,034,768 to level 81", or null at the level cap */
export function experienceToNext(sheet: CharacterSheet, format: Intl.NumberFormat = EN_NUMBERS): string | null {
  const { experience, experienceNext, level } = sheet.facts;
  if (experienceNext === null) return null;
  return `${format.format(Math.max(0, experienceNext - experience))} to level ${String(level + 1)}`;
}

/** "Hell, act 5" */
export function whereText(sheet: CharacterSheet): string {
  return `${DIFFICULTY_NAMES[sheet.facts.saveDifficulty]}, act ${String(sheet.facts.act)}`;
}

// --- facts: mercenary, Kill Ledger, quests ----------------------------------------------------------------------------

export interface MercenaryView {
  /** "Rogue Scout (Elemental)", or "Mercenary type 41" for an id the data does not know */
  readonly title: string;
  /** "Act 1, hired in Nightmare" (null when the data does not know the type) */
  readonly hired: string | null;
  /** "Level 98", null when unknown; derived from the experience, not checked in game */
  readonly level: string | null;
  readonly experience: string;
}

export function mercenaryView(merc: MercenaryFacts, format: Intl.NumberFormat = EN_NUMBERS): MercenaryView {
  const title =
    merc.name === null ? `Mercenary type ${String(merc.typeId)}` : merc.subtype === null ? merc.name : `${merc.name} (${merc.subtype})`;
  const { difficulty: hiredIn } = merc;
  const difficulty = hiredIn === 0 || hiredIn === 1 || hiredIn === 2 ? DIFFICULTY_NAMES[hiredIn] : null;
  const hired = merc.act === null ? null : `Act ${String(merc.act)}${difficulty === null ? '' : `, hired in ${difficulty}`}`;
  return {
    title,
    hired,
    level: merc.level === null ? null : `Level ${String(merc.level)}`,
    experience: format.format(merc.experience),
  };
}

/** A Kill Ledger boss flag (`kill_ledger_<slug>` without the prefix) as a name: "lucion_whisper" → "Lucion Whisper" */
export function ledgerBossName(slug: string): string {
  return slug
    .split('_')
    .filter((word) => word !== '')
    .map((word, index) => (index > 0 && ['the', 'of', 'in', 'a'].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** The difficulties whose Anya scroll was read, by name ("Normal, Nightmare"), or null when none */
export function resistScrollsText(scrolls: SheetFacts['resistScrolls']): string | null {
  const read = ([0, 1, 2] as const).filter((difficulty) => scrolls[difficulty]).map((difficulty) => DIFFICULTY_NAMES[difficulty]);
  return read.length === 0 ? null : read.join(', ');
}

// --- copy as text ------------------------------------------------------------------------------------------------

interface CopyInput {
  readonly className: string;
}

/**
 * A tidy plain-text summary for pasting into a chat: the headline numbers, which difficulty the resists are for and
 * whether buffs are counted. Whole lines, no markup; the labels and short forms are the shared ones (statLabels.ts);
 * zero bonuses (deadly strike 0%, absorbs, dodge) are left out.
 */
export function sheetText(sheet: CharacterSheet, { className }: CopyInput): string {
  const f = (value: number) => EN_NUMBERS.format(value);
  const short = (key: StatKey, value: number) => `${statLabel(key).short} ${formatStat(value, statLabel(key).unit)}`;
  const listed = (entries: readonly (readonly [StatKey, number])[]) =>
    entries.filter(([key, value]) => value !== 0 || !OMIT_WHEN_ZERO.has(key)).map(([key, value]) => short(key, value));
  const buffed = sheet.buffs.length > 0;
  const { attributes: a, resists: r, speed, offense, leech, find } = sheet;
  const lines: string[] = [];
  const whatIf = sheet.whatIf === undefined ? '' : ', with what-if entries';
  lines.push(
    `${sheet.name}, level ${String(sheet.level)} ${className} (ESR, ${DIFFICULTY_NAMES[sheet.difficulty]} resists, ${buffed ? 'with buffs' : 'unbuffed'}${whatIf})`
  );
  lines.push(
    listed([
      ['str', a.strength.value],
      ['dex', a.dexterity.value],
      ['vit', a.vitality.value],
      ['ene', a.energy.value],
    ]).join(', ')
  );
  lines.push(`Life ${f(sheet.life.value)}, Mana ${f(sheet.mana.value)}, Stamina ${f(sheet.stamina.value)}`);
  const resistText = (key: StatKey, value: ResistValue, capped = true) =>
    `${statLabel(key).label} ${f(value.value)}%${capped && value.cap !== BASE_RESIST_CAP ? ` (max ${f(value.cap)})` : ''}`;
  lines.push(
    `Resists: ${[
      resistText('fr', r.fire),
      resistText('cr', r.cold),
      resistText('lr', r.lightning),
      resistText('pr', r.poison),
      resistText('mr', r.magic),
      resistText('phr', r.physical, false),
    ].join(', ')}`
  );
  const { dodge, avoid, evade } = sheet.defenseChances;
  const defense = [
    short('def', sheet.defense.value),
    ...listed([
      ['dr', sheet.damageReduction.value],
      ['mdr', sheet.magicDamageReduction.value],
    ]),
    ...(sheet.block === null ? [] : [`${short('blk', sheet.block.value)} (not yet compared with the game)`]),
    ...listed([
      ['dod', dodge.value],
      ['avo', avoid.value],
      ['eva', evade.value],
    ]),
  ];
  lines.push(defense.join(', '));
  lines.push(
    [
      short('ias', speed.attack.value),
      short('frw', speed.run.value),
      short('fhr', speed.hitRecovery.value),
      short('fbr', speed.block.value),
      short('fcr', speed.cast.value),
    ].join(', ')
  );
  // Each hand skill's line as the character screen shows it: "main / off hand" only for a skill that uses both
  const hands = sheet.attackRating.hands.map(
    (hand) => `${hand.name} AR ${f(hand.mainHand)}${hand.offHand === null ? '' : ` / ${f(hand.offHand)} (main / off hand)`}`
  );
  const offence = [
    ...(hands.length > 0 ? hands : [`AR ${f(sheet.attackRating.base.value)} (no skill)`]),
    ...listed([
      ['arp', sheet.attackRating.percent.value],
      ['ds', offense.deadlyStrike.value],
      ['cb', offense.crushingBlow.value],
      ['ll', leech.life.value],
      ['ml', leech.mana.value],
    ]),
  ];
  if (offense.targetDefense.value !== 0) offence.push(`-${f(offense.targetDefense.value)}% target defense`);
  if (offense.ignoreTargetDefense.value > 0) offence.push("ignores target's defense");
  lines.push(offence.join(', '));
  const findLine = listed([
    ['mf', find.magic.value],
    ['gf', find.gold.value],
  ]);
  const skills = sheet.skills.all.value === 0 ? [] : [`${formatStat(sheet.skills.all.value, 'bonus')} ${statLabel('sk').short}`];
  if (findLine.length + skills.length > 0) lines.push([...findLine, ...skills].join(', '));
  if (buffed)
    lines.push(
      `Buffs: ${sheet.buffs
        .map((buff) => {
          const where = castSetText(buff.castSet);
          return `${buff.name} ${String(buff.level)}${where === null ? '' : ` (${where})`}`;
        })
        .join(', ')} (buffed numbers not yet checked in game)`
    );
  if (sheet.whatIf !== undefined) {
    const entries = [
      ...sheet.whatIf.stats.map((entry) => entry.text),
      ...sheet.whatIf.skills.map((skill) => `${skill.name} ${String(skill.level)}`),
    ];
    lines.push(`What if: ${entries.length === 0 ? 'nothing counted' : entries.join(', ')} (not the character's real numbers)`);
  }
  return lines.join('\n');
}
