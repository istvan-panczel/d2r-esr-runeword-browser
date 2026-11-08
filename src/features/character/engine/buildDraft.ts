/**
 * Character save → editable build draft (docs/features/CHARACTER-SAVE.md "Start a build from a save"). Pure: the draft
 * is plain BuildFormValues for the existing form, plus the session-only report of what still needs a look. Nothing is
 * stored until the user saves the form.
 */
import {
  asLevel,
  asSkillPoints,
  type EquipmentSlot,
  type ItemRef,
  type VariantData,
  type WeaponSwapSlot,
} from '@/features/builds/buildData';
import { BUILD_NAME_MAX_LENGTH, CHARACTER_CLASSES } from '@/features/builds/constants';
import type { BuildFormValues, GearSection } from '@/features/builds/components/buildFormModel';
import { normalizeName } from '@/features/game-data/engine/matchRunewords';
import { describeStashItem } from '@/features/stash/engine/describeItem';
import { itemDisplayName } from '@/features/stash/engine/items/itemNames';
import { renderItemText } from '@/features/stash/engine/items/itemText';
import type { CharacterSectionName } from '../parser/errors';
import type { CharacterFile, CharacterItem, EquippedGear, SkillBinding } from '../parser/types';
import {
  createDraftItemIndex,
  matchDraftItem,
  type BuildDraftData,
  type DraftItemIndex,
  type DraftItemKind,
  type DraftItemOutcome,
} from './buildDraftItems';

export type { BuildDraftData, DraftItemKind, DraftItemOutcome } from './buildDraftItems';

/** Charm-inventory items that are not charms */
const KILL_LEDGER_CODE = 'led';
const ASCENDANCY_STONE_CODE = 'ast';
const ASCENDANCY_STONE_SUFFIX = / ascendancy stone$/;
/** skills.txt row of Attack, the default of an unassigned hand */
const ATTACK_ROW = 0;

const KIND_LABELS: Readonly<Record<DraftItemKind, string>> = {
  unique: 'Unique',
  mythical: 'Mythical',
  set: 'Set item',
  runeword: 'Runeword',
  gemword: 'Gemword',
  rare: 'Rare',
  crafted: 'Crafted',
  tempered: 'Tempered',
  magic: 'Magic',
  superior: 'Superior',
  inferior: 'Inferior',
  normal: 'Plain',
  coupon: 'Coupon',
  simple: 'Item',
  quest: 'Quest item',
};

export type DraftSlot = EquipmentSlot | WeaponSwapSlot;

/** One equipped item: what the measured match rates count. */
export interface DraftItemResult {
  readonly section: GearSection;
  readonly slot: DraftSlot;
  readonly kind: DraftItemKind;
  readonly outcome: DraftItemOutcome;
}

/** A row of the import panel: `fix` is a custom item, `check` a named item worth a look. Session only, never stored. */
export interface DraftReviewRow {
  readonly id: string;
  readonly severity: 'fix' | 'check';
  readonly section: GearSection;
  readonly slot: DraftSlot;
  readonly name: string;
  readonly base: string;
  readonly kindLabel: string;
  /** The item's rolled stat lines: visible while drafting, never saved */
  readonly stats: readonly string[];
  readonly message: string | null;
  /** What the import put in the slot; the row resolves when the slot holds anything else */
  readonly ref: ItemRef;
}

export interface SaveImportReport {
  readonly fileName: string;
  /** Equipped items that became named refs */
  readonly matched: number;
  readonly total: number;
  readonly items: readonly DraftItemResult[];
  readonly rows: readonly DraftReviewRow[];
  /** Unix seconds */
  readonly lastSavedAt: number;
  /** Set when the parse stopped early: the parts that stayed empty */
  readonly incompleteNote: string | null;
  readonly corpses: number;
}

export interface BuildDraft {
  readonly values: BuildFormValues;
  readonly report: SaveImportReport;
}

/** The gear in form order, with the hands of `weaponSets[0]`. */
function mainSlots(gear: EquippedGear): readonly (readonly [EquipmentSlot, CharacterItem | null])[] {
  const [hands] = gear.weaponSets;
  return [
    ['helmet', gear.head],
    ['amulet', gear.neck],
    ['armor', gear.torso],
    ['weapon', hands.rightHand],
    ['shield', hands.leftHand],
    ['ring1', gear.rightRing],
    ['ring2', gear.leftRing],
    ['belt', gear.belt],
    ['boots', gear.feet],
    ['gloves', gear.gloves],
  ];
}

function swapSlots(gear: EquippedGear): readonly (readonly [WeaponSwapSlot, CharacterItem | null])[] {
  const [, hands] = gear.weaponSets;
  return [
    ['weapon2', hands.rightHand],
    ['shield2', hands.leftHand],
  ];
}

interface SectionResult<K extends DraftSlot> {
  readonly items: Partial<Record<K, ItemRef>>;
  readonly notes: Partial<Record<K, string>>;
  readonly results: readonly DraftItemResult[];
  readonly rows: readonly DraftReviewRow[];
}

function mapSection<K extends DraftSlot>(
  section: GearSection,
  slots: readonly (readonly [K, CharacterItem | null])[],
  index: DraftItemIndex,
  data: BuildDraftData
): SectionResult<K> {
  const items: Partial<Record<K, ItemRef>> = {};
  const notes: Partial<Record<K, string>> = {};
  const results: DraftItemResult[] = [];
  const rows: DraftReviewRow[] = [];
  for (const [slot, item] of slots) {
    if (item === null) continue;
    const match = matchDraftItem(item, slot, index, data);
    items[slot] = match.ref;
    if (match.note !== null) notes[slot] = match.note;
    results.push({ section, slot, kind: match.kind, outcome: match.outcome });
    if (match.outcome === 'matched') continue;
    const described = describeStashItem(item, data.catalog);
    const text = renderItemText(item, data.text);
    rows.push({
      id: `${section}:${slot}`,
      severity: match.outcome === 'custom' ? 'fix' : 'check',
      section,
      slot,
      name: itemDisplayName(item, data.catalog, data.text, described),
      base: described.baseName,
      kindLabel: KIND_LABELS[match.kind],
      stats: [...new Set([...text.stats, ...text.runeword])],
      message: match.message,
      ref: match.ref,
    });
  }
  return { items, notes, results, rows };
}

const isCharmInventory = (item: CharacterItem): boolean => item.location.kind === 'charm';

/** A charm as one text line: its name and its stats at the character's level ("Coral Small Charm: Lightning Resist +11%"). */
function charmLine(item: CharacterItem, level: number, data: BuildDraftData): string {
  const name = itemDisplayName(item, data.catalog, data.text);
  const { stats } = renderItemText(item, data.text, { characterLevel: level });
  return stats.length > 0 ? `${name}: ${stats.join(', ')}` : name;
}

/** One line per charm of the charm inventory. Only charms with the same name and the same rolls are merged ("2x …"). */
function charmLines(items: readonly CharacterItem[], level: number, data: BuildDraftData): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!isCharmInventory(item) || item.code === KILL_LEDGER_CODE || item.code === ASCENDANCY_STONE_CODE) continue;
    if (describeStashItem(item, data.catalog).category !== 'charm') continue;
    const line = charmLine(item, level, data);
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return [...counts].map(([line, count]) => (count > 1 ? `${String(count)}x ${line}` : line));
}

/** The ascendancy of the stone in the charm inventory (a stone anywhere else does nothing). */
function ascendancyOf(items: readonly CharacterItem[], data: BuildDraftData): string | null {
  const stone = items.find((item) => isCharmInventory(item) && item.code === ASCENDANCY_STONE_CODE);
  if (stone === undefined) return null;
  const name = describeStashItem(stone, data.catalog).unique?.name;
  if (name === undefined) return null;
  const wanted = normalizeName(name).replace(ASCENDANCY_STONE_SUFFIX, '');
  return data.ascendancies.find((candidate) => normalizeName(candidate) === wanted) ?? null;
}

/** Hard points by skills.json id, zero entries dropped. */
function skillPointsOf(file: CharacterFile, data: BuildDraftData): Readonly<Record<string, number>> | undefined {
  const entries = file.skills.flatMap(({ skillId, points }) => {
    const id = data.skillIds.at(skillId);
    return points > 0 && id !== undefined && id !== '' ? [[id, points] as const] : [];
  });
  return asSkillPoints(Object.fromEntries(entries));
}

/**
 * The editable skills-in-use line: "Left: Frenzy · Right: Whirlwind. Hotkeys: Battle Command, Battle Orders". Attack and
 * duplicates are dropped, item-granted skills kept (they show how the build plays), the swap pair added only when it differs.
 */
export function skillsInUseLine(bindings: Pick<CharacterFile, 'hotkeys' | 'handSkills'>, skillNames: ReadonlyMap<number, string>): string {
  const rowOf = ({ skillId }: SkillBinding): number | null => (skillId === null || skillId === ATTACK_ROW ? null : skillId);
  const { left, right, swapLeft, swapRight } = bindings.handSkills;
  const main = [rowOf(left), rowOf(right)];
  const swap = [rowOf(swapLeft), rowOf(swapRight)];
  const swapDiffers = swap[0] !== main[0] || swap[1] !== main[1];
  const labelled: readonly (readonly [string, number | null])[] = [
    ['Left', main[0]],
    ['Right', main[1]],
    ...(swapDiffers
      ? ([
          ['Swap left', swap[0]],
          ['Swap right', swap[1]],
        ] as const)
      : []),
  ];
  const nameOf = (row: number | null): string | null => (row === null ? null : (skillNames.get(row) ?? null));
  const hands = labelled.flatMap(([label, row]) => {
    const name = nameOf(row);
    return name === null ? [] : [`${label}: ${name}`];
  });

  const seen = new Set<number>(labelled.flatMap(([, row]) => (row === null ? [] : [row])));
  const hotkeys: string[] = [];
  for (const binding of bindings.hotkeys) {
    const row = rowOf(binding);
    if (row === null || seen.has(row)) continue;
    seen.add(row);
    const name = nameOf(row);
    if (name !== null) hotkeys.push(name);
  }

  const parts = [hands.join(' · '), hotkeys.length > 0 ? `Hotkeys: ${hotkeys.join(', ')}` : ''].filter((part) => part !== '');
  return parts.length === 0 ? '' : `${parts.join('. ')}.`;
}

/** What each early stop leaves empty, for the report */
const EMPTY_AFTER: Partial<Readonly<Record<CharacterSectionName, string>>> = {
  corpses: 'corpse items and mercenary gear',
  'merc-items': 'mercenary gear',
  golem: 'only the golem and summons, so nothing in this draft',
  'bound-demon': 'only the bound demon and summons, so nothing in this draft',
  summons: 'only the summons, so nothing in this draft',
};

function incompleteNote(file: CharacterFile): string | null {
  if (file.incomplete === null) return null;
  return `This save could only be read up to the ${file.incomplete.section} part; what stayed empty: ${EMPTY_AFTER[file.incomplete.section] ?? 'the rest of the file'}.`;
}

export function createBuildDraft(file: CharacterFile, data: BuildDraftData, fileName: string): BuildDraft {
  const index = createDraftItemIndex(data);
  const player = mapSection('player', mainSlots(file.gear), index, data);
  const swap = mapSection('swap', swapSlots(file.gear), index, data);
  const merc = mapSection('merc', mainSlots(file.mercGear), index, data);
  const charms = charmLines(file.items.player, file.level, data);
  const ascendancy = ascendancyOf(file.items.player, data);
  const skillPoints = skillPointsOf(file, data);
  const skills = skillsInUseLine(file, data.skillNames);
  const level = asLevel(file.level);

  const variant: VariantData = {
    items: player.items,
    weaponSwap: swap.items,
    mercenary: merc.items,
    itemNotes: player.notes,
    weaponSwapNotes: swap.notes,
    mercenaryNotes: merc.notes,
    ...(charms.length > 0 ? { charms } : {}),
    ...(ascendancy !== null ? { ascendancy } : {}),
    ...(skills !== '' ? { skills } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(skillPoints !== undefined ? { skillPoints } : {}),
  };

  const items = [...player.results, ...swap.results, ...merc.results];
  return {
    values: {
      name: file.name.slice(0, BUILD_NAME_MAX_LENGTH),
      description: '',
      characterClass: CHARACTER_CLASSES.find((name) => name === file.className) ?? '',
      variants: [variant],
    },
    report: {
      fileName,
      matched: items.filter((item) => item.outcome !== 'custom').length,
      total: items.length,
      items,
      rows: [...player.rows, ...swap.rows, ...merc.rows],
      lastSavedAt: file.lastSavedAt,
      incompleteNote: incompleteNote(file),
      corpses: file.items.corpses.length,
    },
  };
}
