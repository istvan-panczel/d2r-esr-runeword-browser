/**
 * The computed sheet as the My Character tabs show it: rows with display text, the unbuffed value beside a buffed one,
 * the resist read-out against the cap, where a number comes from, the buff switches, the hand skills' attack ratings
 * and the "Copy as text" summary. Pure: the components stay thin over these.
 */
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import { DIFFICULTY_NAMES, EN_NUMBERS, SHEET_STAT_LABELS, formatStat, type StatUnit } from './sheet/statLabels';
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
    short: 'Inferred',
    long: 'Worked out from the game files and the game rules, not yet compared with the in-game screen.',
  },
  unverified: {
    short: 'Not yet checked in game',
    long: 'Changed by a buff you switched on. Buffed numbers have not been checked against the game yet.',
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

interface RowSpec {
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

const L = SHEET_STAT_LABELS;
const spec = (key: string, label: string, unit: RowUnit, get: RowSpec['get']): RowSpec => ({ key, label, unit, get });

const DEFENSE_SPECS: readonly RowSpec[] = [
  spec('def', L.def.label, 'number', (s) => s.defense),
  spec('dr', 'Damage reduced by', 'number', (s) => s.damageReduction),
  spec('mdr', 'Magic damage reduced by', 'number', (s) => s.magicDamageReduction),
  spec('dod', 'Dodge chance', 'percent', (s) => s.defenseChances.dodge),
  spec('avo', 'Avoid chance', 'percent', (s) => s.defenseChances.avoid),
  spec('eva', 'Evade chance', 'percent', (s) => s.defenseChances.evade),
  spec('blk', L.blk.label, 'percent', (s) => s.block),
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
  spec('ias', `${L.ias.label} (${L.ias.short})`, 'percent', (s) => s.speed.attack),
  spec('frw', `${L.frw.label} (${L.frw.short})`, 'percent', (s) => s.speed.run),
  spec('fhr', `${L.fhr.label} (${L.fhr.short})`, 'percent', (s) => s.speed.hitRecovery),
  spec('fbr', `${L.fbr.label} (${L.fbr.short})`, 'percent', (s) => s.speed.block),
  spec('fcr', `${L.fcr.label} (${L.fcr.short})`, 'percent', (s) => s.speed.cast),
  spec('bas', 'Base attack speed', 'percent', (s) => s.speed.baseAttack),
  spec('brw', 'Base run/walk speed', 'percent', (s) => s.speed.baseRunWalk),
];

const OFFENSE_SPECS: readonly RowSpec[] = [
  spec('arp', L.arp.label, 'percent', (s) => s.attackRating.percent),
  spec('ds', L.ds.label, 'percent', (s) => s.offense.deadlyStrike),
  spec('cb', L.cb.label, 'percent', (s) => s.offense.crushingBlow),
  spec('ow', 'Open wounds', 'percent', (s) => s.offense.openWounds),
  spec('ll', 'Life stolen per hit', 'percent', (s) => s.leech.life),
  spec('ml', 'Mana stolen per hit', 'percent', (s) => s.leech.mana),
  spec('td', 'Target defense', 'reduction', (s) => s.offense.targetDefense),
  spec('itd', "Ignore target's defense", 'flag', (s) => s.offense.ignoreTargetDefense),
];

const FIND_SPECS: readonly RowSpec[] = [
  spec('mf', 'Magic find', 'percent', (s) => s.find.magic),
  spec('gf', 'Extra gold', 'percent', (s) => s.find.gold),
  spec('sk', 'All skills', 'bonus', (s) => s.skills.all),
  spec('cls', 'Class skills', 'bonus', (s) => s.skills.cls),
];

const RECOVERY_SPECS: readonly RowSpec[] = [
  spec('rl', 'Replenish life', 'number', (s) => s.regen.life),
  spec('rm', 'Mana regeneration', 'percent', (s) => s.regen.mana),
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
    defense: rowsOf(DEFENSE_SPECS, sheet, unbuffed, format),
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
  ['fire', 'Fire'],
  ['cold', 'Cold'],
  ['lightning', 'Lightning'],
  ['poison', 'Poison'],
  ['magic', 'Magic'],
  ['physical', 'Physical'],
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
  readonly status: SheetStatus;
  /** Where the main-hand number comes from: the base attack rating's parts with the skill's % */
  readonly value: SheetValue;
}

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
    return {
      key: `${hand.hand}:${String(hand.skillId)}`,
      label: hand.name,
      hand: hand.hand === 'left' ? 'Left mouse button' : 'Right mouse button',
      level: hand.level,
      mainHand: hand.mainHand,
      offHand: hand.offHand,
      text,
      unbuffedText: beforeText !== null && beforeText !== text ? beforeText : null,
      status: hand.status,
      value: { value: hand.mainHand, sources, status: hand.status, notes },
    };
  });
}

export interface AttackChoice {
  readonly key: string;
  readonly label: string;
  readonly attackRating: number;
}

/** The Combat tab's attack rating choices: each hand skill's main-hand line and, dual wielding, its other weapon's line */
export function attackChoices(sheet: CharacterSheet, format: Intl.NumberFormat = EN_NUMBERS): AttackChoice[] {
  const choices = sheet.attackRating.hands.flatMap((hand): AttackChoice[] => {
    const button = hand.hand === 'left' ? 'left' : 'right';
    const main = { key: `${hand.hand}:${String(hand.skillId)}:main`, attackRating: hand.mainHand };
    if (hand.offHand === null) return [{ ...main, label: `${hand.name} (${button}), ${format.format(hand.mainHand)}` }];
    return [
      { ...main, label: `${hand.name} (${button}), main hand ${format.format(hand.mainHand)}` },
      {
        key: `${hand.hand}:${String(hand.skillId)}:off`,
        label: `${hand.name} (${button}), off hand ${format.format(hand.offHand)}`,
        attackRating: hand.offHand,
      },
    ];
  });
  if (choices.length > 0) return choices;
  return [{ key: 'base', label: `No skill, ${format.format(sheet.attackRating.base.value)}`, attackRating: sheet.attackRating.base.value }];
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
  { kind: 'cast', title: 'Skills you cast', hint: 'Warcries, armors, shapes and other self buffs, at the level you have' },
  { kind: 'aura', title: 'Auras', hint: 'Auras you can switch on yourself' },
  { kind: 'proc', title: 'From your items', hint: 'Skills your items cast on you on an event (on striking, when struck …)' },
];

export function buffGroups(available: readonly AvailableBuff[]): BuffGroup[] {
  return BUFF_GROUPS.flatMap((group) => {
    const buffs = available.filter((buff) => buff.kind === group.kind);
    return buffs.length === 0 ? [] : [{ ...group, buffs }];
  });
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

/** Buff choices per character name, as kept in sessionStorage; anything malformed is dropped */
export function parseBuffMemory(text: string | null): Record<string, BuffSelection[]> {
  if (text === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const memory: Record<string, BuffSelection[]> = {};
  for (const [name, list] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const selections = list.flatMap((entry: unknown): BuffSelection[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { skillId, level } = entry as { skillId?: unknown; level?: unknown };
      if (typeof skillId !== 'number' || !Number.isInteger(skillId)) return [];
      return typeof level === 'number' && Number.isInteger(level) && level > 0 ? [{ skillId, level }] : [{ skillId }];
    });
    if (selections.length > 0) memory[name] = selections;
  }
  return memory;
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
    byId.set(id, { level: skill.level, hard: skill.hard, bonus: skill.level - skill.hard, parts: skill.bonus });
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
 * whether buffs are counted. Whole lines, no markup; zero values that rarely matter (absorbs, dodge) are left out.
 */
export function sheetText(sheet: CharacterSheet, { className }: CopyInput): string {
  const f = (value: number) => EN_NUMBERS.format(value);
  const p = (value: number) => `${f(value)}%`;
  const buffed = sheet.buffs.length > 0;
  const { attributes: a, resists: r, speed, offense, leech, find } = sheet;
  const lines: string[] = [];
  lines.push(
    `${sheet.name}, level ${String(sheet.level)} ${className} (ESR, ${DIFFICULTY_NAMES[sheet.difficulty]} resists, ${buffed ? 'with buffs' : 'unbuffed'})`
  );
  lines.push(`Str ${f(a.strength.value)}, Dex ${f(a.dexterity.value)}, Vit ${f(a.vitality.value)}, Ene ${f(a.energy.value)}`);
  lines.push(`Life ${f(sheet.life.value)}, Mana ${f(sheet.mana.value)}, Stamina ${f(sheet.stamina.value)}`);
  const capNote = (value: ResistValue) => (value.cap === 75 ? '' : ` (max ${f(value.cap)})`);
  lines.push(
    `Resists: Fire ${p(r.fire.value)}${capNote(r.fire)}, Cold ${p(r.cold.value)}${capNote(r.cold)}, Lightning ${p(r.lightning.value)}${capNote(r.lightning)}, Poison ${p(r.poison.value)}${capNote(r.poison)}, Magic ${p(r.magic.value)}, Physical ${p(r.physical.value)}`
  );
  const defense = [
    `Defense ${f(sheet.defense.value)}`,
    `DR ${f(sheet.damageReduction.value)}`,
    `MDR ${f(sheet.magicDamageReduction.value)}`,
  ];
  if (sheet.block !== null) defense.push(`Block ${p(sheet.block.value)} (inferred)`);
  const { dodge, avoid, evade } = sheet.defenseChances;
  if (dodge.value + avoid.value + evade.value > 0)
    defense.push(`Dodge ${p(dodge.value)}, Avoid ${p(avoid.value)}, Evade ${p(evade.value)}`);
  lines.push(defense.join(', '));
  lines.push(
    `IAS ${p(speed.attack.value)}, FRW ${p(speed.run.value)}, FHR ${p(speed.hitRecovery.value)}, FBR ${p(speed.block.value)}, FCR ${p(speed.cast.value)}`
  );
  const hands = sheet.attackRating.hands.map(
    (hand) => `${hand.name} AR ${f(hand.mainHand)}${hand.offHand === null ? '' : ` / ${f(hand.offHand)}`}`
  );
  const offence = [
    ...hands,
    `AR ${p(sheet.attackRating.percent.value)}`,
    `DS ${p(offense.deadlyStrike.value)}`,
    `CB ${p(offense.crushingBlow.value)}`,
    `LL ${p(leech.life.value)}`,
    `ML ${p(leech.mana.value)}`,
  ];
  if (offense.targetDefense.value !== 0) offence.push(`-${p(offense.targetDefense.value)} target defense`);
  if (offense.ignoreTargetDefense.value > 0) offence.push("ignores target's defense");
  lines.push(offence.join(', '));
  lines.push(`MF ${p(find.magic.value)}, GF ${p(find.gold.value)}, +${f(sheet.skills.all.value)} all skills`);
  if (buffed)
    lines.push(
      `Buffs: ${sheet.buffs.map((buff) => `${buff.name} ${String(buff.level)}`).join(', ')} (buffed numbers not yet checked in game)`
    );
  return lines.join('\n');
}
