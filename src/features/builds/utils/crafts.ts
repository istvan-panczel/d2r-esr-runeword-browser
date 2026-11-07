import type {
  AnointmentOutcome,
  AnointmentSlot,
  BaseItem,
  CorruptionOutcome,
  CraftingBundle,
  CraftingSlot,
  EnhanceBundle,
  EnhanceQuality,
  ForgingKind,
  ForgingOption,
  StackingCraftOption,
} from '@/features/game-data/engine/schema';
import { CRAFT_USES_MAX, CRAFTS_MAX_PER_SLOT, type CraftAnnotation, type ItemRef } from '../buildData';
import { slotGroup, type PickerSlot } from './slotFit';

// Structured crafting annotations (BuildData *Crafts): rendering from the game-data bundles,
// the picker's option groups and the list edits the form applies. Everything here is pure.

/** Builds slot family → enhance.json corruption slot id. */
export const ENHANCE_SLOT_BY_FAMILY: Readonly<Record<CraftingSlot, string>> = {
  weapon: 'weapon',
  shield: 'shield',
  helmet: 'helm',
  armor: 'body',
  gloves: 'gloves',
  boots: 'boots',
  belt: 'belt',
  amulet: 'amulet',
  ring: 'ring',
};

/**
 * The anointment pool (item type) of a slot whose base is unknown (a freetext or gemword item): the slot's generic type,
 * which a plain item of that slot rolls; none for weapons and shields (one pool per weapon / shield type). ESR 3.3
 * rolls one pool per item type, so a class item (circlet, class ring …) needs its base to pick the right one.
 */
const FALLBACK_ANOINTMENT_TYPE: Readonly<Partial<Record<CraftingSlot, string>>> = {
  helmet: 'helm',
  armor: 'tors',
  gloves: 'glov',
  boots: 'boot',
  belt: 'belt',
  amulet: 'amul',
  ring: 'ring',
};

/** The enhance.json corruption slot id of a builds slot. */
export function enhanceSlotFor(slot: PickerSlot): string {
  return ENHANCE_SLOT_BY_FAMILY[slotGroup(slot)];
}

export const FORGING_KIND_LABELS: Readonly<Record<ForgingKind, string>> = {
  skill: 'Skill Forging',
  all: 'All Skills Forging',
  stat: 'Stat Forging',
  rune: 'Rune Forging',
  aura: 'Aura Forging',
};

const QUALITY_LABELS: Readonly<Record<EnhanceQuality, string>> = {
  uni: 'Unique',
  set: 'Set',
  rar: 'Rare',
  crf: 'Crafted',
  mag: 'Magic',
  hiq: 'Superior',
  nor: 'Normal',
  low: 'Low Quality',
};

/** O(1) lookups over the crafting / enhance bundles; build once per render pass. */
export interface CraftLookups {
  readonly forgings: ReadonlyMap<string, ForgingOption>;
  readonly stacking: ReadonlyMap<string, StackingCraftOption>;
  readonly corruption: ReadonlyMap<string, CorruptionOutcome>;
  readonly anointment: ReadonlyMap<string, AnointmentOutcome>;
  /** Picker lists: all forging / stacking options in bundle order, outcomes per enhance slot in roll order */
  readonly forgingList: readonly ForgingOption[];
  readonly stackingList: readonly StackingCraftOption[];
  readonly corruptionBySlot: ReadonlyMap<string, readonly CorruptionOutcome[]>;
  readonly anointmentByPool: ReadonlyMap<string, readonly AnointmentOutcome[]>;
  /** enhance.json anointment pools (one per item type), in bundle order: an item rolls the first its type is */
  readonly anointmentSlots: readonly AnointmentSlot[];
  /** bases.json bases by code and by name (the item's base, which picks its anointment pool) */
  readonly baseByCode: ReadonlyMap<string, BaseItem>;
  readonly baseByName: ReadonlyMap<string, BaseItem>;
}

const forgeId = (kind: string, key: string) => `${kind}:${key}`;
const stackingId = (kind: string, material: string, switchItem: string | undefined) => `${kind}:${material}:${switchItem ?? ''}`;
const rollId = (slot: string, roll: number) => `${slot}:${String(roll)}`;

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const list = result.get(id);
    if (list === undefined) result.set(id, [item]);
    else list.push(item);
  }
  return result;
}

/** Lookups over whichever bundles are loaded (a missing bundle gives empty maps, so its annotations render stale). */
export function craftLookups(
  crafting: CraftingBundle | undefined,
  enhance: EnhanceBundle | undefined,
  bases: readonly BaseItem[] = []
): CraftLookups {
  const forgingList = crafting?.forgings ?? [];
  const stackingList = crafting?.stacking ?? [];
  const corruptionOutcomes = enhance?.corruptionOutcomes ?? [];
  const anointmentOutcomes = enhance?.anointmentOutcomes ?? [];
  return {
    forgings: new Map(forgingList.map((option) => [forgeId(option.kind, option.key), option])),
    stacking: new Map(stackingList.map((option) => [stackingId(option.kind, option.material.code, option.switchItem?.code), option])),
    corruption: new Map(corruptionOutcomes.map((outcome) => [rollId(outcome.slot, outcome.roll), outcome])),
    anointment: new Map(anointmentOutcomes.map((outcome) => [rollId(outcome.pool, outcome.roll), outcome])),
    forgingList,
    stackingList,
    corruptionBySlot: groupBy(corruptionOutcomes, (outcome) => outcome.slot),
    anointmentByPool: groupBy(anointmentOutcomes, (outcome) => outcome.pool),
    anointmentSlots: enhance?.anointmentSlots ?? [],
    baseByCode: new Map(bases.map((base) => [base.code, base])),
    baseByName: new Map([...bases].reverse().map((base) => [base.name.toLowerCase(), base])),
  };
}

/** The base of a build item: a runeword's chosen base, a unique / mythical / set item's base by name; else undefined */
export function itemBase(item: ItemRef | null | undefined, lookups: CraftLookups): BaseItem | undefined {
  if (item === null || item === undefined) return undefined;
  switch (item.type) {
    case 'runeword':
      return item.base === undefined ? undefined : lookups.baseByCode.get(item.base.code);
    case 'unique':
    case 'mythical':
    case 'set':
      return lookups.baseByName.get(item.snapshot.baseItem.toLowerCase());
    default:
      return undefined;
  }
}

/**
 * The anointment pool of a slot's item: the first pool (bundle order, class types first) its base's type or type2 is
 * or descends from; without a known base, the slot's generic type (FALLBACK_ANOINTMENT_TYPE).
 */
export function anointmentPoolFor(
  base: Pick<BaseItem, 'ancestors'> | undefined,
  family: CraftingSlot,
  lookups: CraftLookups
): AnointmentSlot | undefined {
  if (base !== undefined) return lookups.anointmentSlots.find((slot) => base.ancestors.includes(slot.typeCode));
  const fallback = FALLBACK_ANOINTMENT_TYPE[family];
  return fallback === undefined ? undefined : lookups.anointmentSlots.find((slot) => slot.typeCode === fallback);
}

/** Shown for an ESR 3.2 anointment (one pool per slot), which no longer resolves since ESR 3.3 */
export const OUTDATED_ANOINTMENT = 'Anointment outdated, pick again';

export interface RenderedCraft {
  readonly title: string;
  readonly lines: readonly string[];
  /** A muted extra line (D-stoning per-use steps and cap, corruption quality variants) */
  readonly note?: string;
  /** The ids no longer resolve in the current bundles (or the bundles are unavailable): title from the ids, no lines */
  readonly stale: boolean;
}

const stale = (title: string): RenderedCraft => ({ title, lines: [], stale: true });
const levelLine = (levelReq: number, uses: number) => `+${String(levelReq * uses)} Level Required`;

/** Title and lines of an annotation on a slot family, from the bundles; never throws. */
export function renderCraft(craft: CraftAnnotation, family: CraftingSlot, lookups: CraftLookups | undefined): RenderedCraft {
  switch (craft.kind) {
    case 'corruption': {
      const outcome = lookups?.corruption.get(rollId(craft.slot, craft.roll));
      if (outcome === undefined) return stale(`Corruption (roll ${String(craft.roll)})`);
      const variantQualities = (outcome.variants ?? []).flatMap((variant) => variant.qualities.map((quality) => QUALITY_LABELS[quality]));
      return {
        title: 'Corruption',
        lines: outcome.lines,
        ...(variantQualities.length > 0 ? { note: `Other values on ${variantQualities.join(' / ')} items` } : {}),
        stale: false,
      };
    }
    case 'anointment': {
      if (!('itemType' in craft)) return stale(OUTDATED_ANOINTMENT);
      const outcome = lookups?.anointment.get(rollId(craft.itemType, craft.roll));
      if (outcome === undefined) return stale(`Anointment (roll ${String(craft.roll)})`);
      return { title: outcome.label !== undefined ? `Anointment · ${outcome.label}` : 'Anointment', lines: outcome.lines, stale: false };
    }
    case 'forge': {
      const option = lookups?.forgings.get(forgeId(craft.forge, craft.key));
      const lines = option?.bySlot[family];
      if (option === undefined || lines === undefined) return stale(`Forging (${craft.forge} ${craft.key})`);
      return { title: `${FORGING_KIND_LABELS[option.kind]} · ${option.label}`, lines, stale: false };
    }
    case 'dstone':
    case 'meld': {
      const switchItem = craft.kind === 'dstone' ? craft.switchItem : undefined;
      const option = lookups?.stacking.get(stackingId(craft.kind, craft.material, switchItem));
      const step = option?.bySlot[family];
      const uses = ` ×${String(craft.uses)}`;
      const kindLabel = craft.kind === 'dstone' ? 'D-stoning' : 'Gem melding';
      if (option === undefined || step === undefined) {
        return stale(`${kindLabel} (${craft.material}${switchItem !== undefined ? ` + ${switchItem}` : ''})${uses}`);
      }
      const switchLabel = option.switchItem !== undefined ? ` + ${option.switchItem.label}` : '';
      const steps = step.steps ?? [];
      // Per-use amounts and the cap, never a summed total: the amount per use shrinks as the cap stat grows
      const note = [
        ...(steps.length > 1 ? [`per use: ${steps.join(', ')}`] : []),
        ...(step.capLines !== undefined ? [`cap: ${step.capLines.join(', ')}`] : []),
      ].join(' · ');
      return {
        title: `${kindLabel} · ${option.material.label}${switchLabel}${uses}`,
        lines: [...step.lines, levelLine(step.levelReq, craft.uses)],
        ...(note !== '' ? { note } : {}),
        stale: false,
      };
    }
  }
}

// --- Editing ------------------------------------------------------------------------------------------------------

/**
 * One annotation per identity in a slot: a single corruption, anointment and forging, and one
 * D-stoning / meld entry per (material, switch item) whose `uses` grows instead.
 */
export function craftIdentity(craft: CraftAnnotation): string {
  switch (craft.kind) {
    case 'corruption':
    case 'anointment':
    case 'forge':
      return craft.kind;
    case 'dstone':
      return stackingId('dstone', craft.material, craft.switchItem);
    case 'meld':
      return stackingId('meld', craft.material, undefined);
  }
}

const clampUses = (uses: number) => Math.min(CRAFT_USES_MAX, Math.max(1, Math.round(uses)));

function withUses(craft: CraftAnnotation, uses: number): CraftAnnotation {
  return craft.kind === 'dstone' || craft.kind === 'meld' ? { ...craft, uses: clampUses(uses) } : craft;
}

/**
 * Adds an annotation: a D-stoning / meld already in the list gets its uses incremented, another
 * corruption / anointment / forging replaces the existing one; a new entry past the cap is ignored.
 */
export function addCraft(list: readonly CraftAnnotation[], craft: CraftAnnotation): readonly CraftAnnotation[] {
  const identity = craftIdentity(craft);
  const index = list.findIndex((entry) => craftIdentity(entry) === identity);
  if (index >= 0) {
    const existing = list[index];
    const next = existing.kind === 'dstone' || existing.kind === 'meld' ? withUses(existing, existing.uses + 1) : craft;
    return list.map((entry, position) => (position === index ? next : entry));
  }
  return list.length >= CRAFTS_MAX_PER_SLOT ? list : [...list, craft];
}

export function removeCraft(list: readonly CraftAnnotation[], index: number): readonly CraftAnnotation[] {
  return list.filter((_, position) => position !== index);
}

/** Sets the uses of the D-stoning / meld entry at `index` (clamped to 1..CRAFT_USES_MAX); other kinds are unchanged. */
export function setCraftUses(list: readonly CraftAnnotation[], index: number, uses: number): readonly CraftAnnotation[] {
  return list.map((entry, position) => (position === index ? withUses(entry, uses) : entry));
}

/** Drops slots with no annotations before saving (no empty lists are stored). */
export function compactCrafts<K extends string>(
  crafts: Partial<Record<K, readonly CraftAnnotation[]>>
): Partial<Record<K, readonly CraftAnnotation[]>> {
  const result: Partial<Record<K, readonly CraftAnnotation[]>> = {};
  for (const slot of Object.keys(crafts) as K[]) {
    const list = crafts[slot];
    if (list !== undefined && list.length > 0) result[slot] = list;
  }
  return result;
}

// --- Picker -------------------------------------------------------------------------------------------------------

export interface CraftPickerOption {
  /** Unique within the picker (cmdk value) */
  readonly id: string;
  readonly label: string;
  /** Muted text under the label (the bonus lines) */
  readonly detail: string;
  /** Lower-cased text the search matches */
  readonly search: string;
  readonly craft: CraftAnnotation;
}

export interface CraftPickerGroup {
  readonly heading: string;
  readonly options: readonly CraftPickerOption[];
}

const outcomeLabel = (outcome: { readonly lines: readonly string[]; readonly roll: number }): string =>
  outcome.lines.length > 0 ? outcome.lines[0] : `Roll ${String(outcome.roll)}`;

const option = (id: string, label: string, lines: readonly string[], craft: CraftAnnotation): CraftPickerOption => {
  const detail = lines.join(', ');
  return { id, label, detail, search: `${label} ${detail}`.toLowerCase(), craft };
};

/**
 * The picker groups for a slot: Corruption (the slot's enhance outcomes) and Anointment (the pool of the item's base
 * type, headed with its name), Forging, D-stoning and Gem melding (options with a row for the slot family). Corruption,
 * Anointment and Forging are left out once the slot has one (an outdated ESR 3.2 anointment does not count: a new pick
 * replaces it); empty groups are dropped.
 */
export function craftPickerGroups(
  slot: PickerSlot,
  lookups: CraftLookups,
  existing: readonly CraftAnnotation[],
  item?: ItemRef | null
): readonly CraftPickerGroup[] {
  const family = slotGroup(slot);
  const enhanceSlot = ENHANCE_SLOT_BY_FAMILY[family];
  const has = (kind: CraftAnnotation['kind']) =>
    existing.some((craft) => craft.kind === kind && (craft.kind !== 'anointment' || 'itemType' in craft));
  const pool = anointmentPoolFor(itemBase(item, lookups), family, lookups);

  const corruption = has('corruption')
    ? []
    : (lookups.corruptionBySlot.get(enhanceSlot) ?? []).map((outcome) =>
        option(`corruption:${String(outcome.roll)}`, outcomeLabel(outcome), outcome.lines.slice(1), {
          kind: 'corruption',
          slot: enhanceSlot,
          roll: outcome.roll,
        })
      );
  const anointment =
    has('anointment') || pool === undefined
      ? []
      : (lookups.anointmentByPool.get(pool.slot) ?? []).map((outcome) =>
          option(
            `anointment:${String(outcome.roll)}`,
            outcomeLabel(outcome),
            [...(outcome.label !== undefined ? [outcome.label] : []), ...outcome.lines.slice(1)],
            { kind: 'anointment', itemType: pool.slot, roll: outcome.roll }
          )
        );
  const forging = has('forge')
    ? []
    : lookups.forgingList.flatMap((forge) => {
        const lines = forge.bySlot[family];
        return lines === undefined
          ? []
          : [
              option(`forge:${forge.kind}:${forge.key}`, `${FORGING_KIND_LABELS[forge.kind]} · ${forge.label}`, lines, {
                kind: 'forge',
                forge: forge.kind,
                key: forge.key,
              }),
            ];
      });
  const stacking = (kind: 'dstone' | 'meld') =>
    lookups.stackingList.flatMap((stack) => {
      const step = stack.bySlot[family];
      if (stack.kind !== kind || step === undefined) return [];
      const switchItem = stack.switchItem;
      const label = `${stack.material.label}${switchItem !== undefined ? ` + ${switchItem.label}` : ''}`;
      const craft: CraftAnnotation =
        kind === 'dstone'
          ? { kind: 'dstone', material: stack.material.code, ...(switchItem !== undefined ? { switchItem: switchItem.code } : {}), uses: 1 }
          : { kind: 'meld', material: stack.material.code, uses: 1 };
      const cap = step.capLines !== undefined ? [`cap ${step.capLines.join(', ')}`] : [];
      return [option(stackingId(kind, stack.material.code, switchItem?.code), label, [...step.lines, ...cap], craft)];
    });

  return [
    { heading: 'Corruption', options: corruption },
    { heading: pool === undefined ? 'Anointment' : `Anointment · ${pool.label}`, options: anointment },
    { heading: 'Forging', options: forging },
    { heading: 'D-stoning', options: stacking('dstone') },
    { heading: 'Gem melding', options: stacking('meld') },
  ].filter((group) => group.options.length > 0);
}

/** Whether any slot of a crafts map carries an annotation. */
export function hasCrafts(crafts: Partial<Record<string, readonly CraftAnnotation[]>> | undefined): boolean {
  return crafts !== undefined && Object.values(crafts).some((list) => list !== undefined && list.length > 0);
}
