/**
 * crafting.json: the structured crafting options an equipped item of a build can be annotated with, from cubemain.txt.
 *
 * - Forgings (one per class, all skills, chipped gem, rune, aura stone): the rows of the guide's cube families
 *   (`skill-forging`, `all-skill-forging`, `stat-forging`, `rune-forging` + `rune-forging-slots`, `aura-forging`).
 * - Stacking crafts: D-stoning (family `dstoning`: a Dragon Stone form, sometimes with a switch item, repeated while a
 *   cap stat grows; the total it stops at from `cube/dstoneCaps.ts`) and gem melding (family `gem-meld`).
 * - Slots: the item input's type maps to the builds slot families (`weap` → weapon, `armo` → every armour slot,
 *   `any` → every slot). Like the game, the first row in file order that accepts a slot decides its bonus, so the
 *   weapon row of a stat forging beats its `any` row and the glove rune forging row beats the `armo` row.
 * - Skipped: jewel and charm rows (not equipment slots), rows for a weapon subtype (wand, staff, orb, two-handed: the
 *   builds slot cannot tell them apart), tiered D-stoning variants (`weap,eli`), blocker rows (`void` output) and
 *   D-stoning groups another group with the same ingredients shadows.
 * Corruption and anointment are in enhance.json. See docs/features/GAME-DATA.md "Crafting options".
 */
import {
  CRAFTING_SLOTS,
  type BaseItem,
  type ClassInfo,
  type CraftingBundle,
  type CraftingSlot,
  type ForgingKind,
  type ForgingOption,
  type StackingCraftOption,
  type StackingCraftStep,
} from '../engine/schema.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import { EXTRA_FAMILIES } from './cube/cubeCatalog.ts';
import { CUBE_FAMILIES } from './cube/cubeFamilies.ts';
import type { CubeMod, CubeRow } from './cube/cubeRows.ts';
import { dstoneBlockers, dstoneCap, isCapMod } from './cube/dstoneCaps.ts';
import { parseCubeCell } from './cube/cubeText.ts';

export interface CraftingInput {
  /** Enabled cubemain rows (`readCube`) */
  cube: readonly CubeRow[];
  /** Display name of an item code (`buildCubeNames`) */
  nameOf: (token: string) => string;
  classes: readonly Pick<ClassInfo, 'code' | 'name'>[];
  /** Item type ancestry of every base, to tell a weapon subtype (wand) or a jewel type from an unknown type */
  bases: readonly Pick<BaseItem, 'ancestors'>[];
  renderMods: ModsRenderer;
  /** itemstatcost ids a property sets, for the D-stoning cap stats; omitted: a cap mod raises its row's condition stat */
  statIdsOf?: (property: string) => readonly number[];
}

export interface CraftingBuildResult {
  bundle: CraftingBundle;
  /** Matched rows that went into an option / were left out (jewels, charms, subtypes, tiers, blockers, shadowed) */
  rowsUsed: number;
  rowsSkipped: number;
  warnings: string[];
}

/** Item types that are a builds slot family */
const SLOT_TYPES: Readonly<Record<string, CraftingSlot>> = {
  weap: 'weapon',
  shld: 'shield',
  helm: 'helmet',
  tors: 'armor',
  glov: 'gloves',
  boot: 'boots',
  belt: 'belt',
  amul: 'amulet',
  ring: 'ring',
};
const ARMOUR_SLOTS: readonly CraftingSlot[] = ['shield', 'helmet', 'armor', 'gloves', 'boots', 'belt'];
/** Base tier qualifiers of an input cell (the D-stoning summon/elemental rows have per-tier variants) */
const TIER_QUALIFIERS = new Set(['bas', 'exc', 'eli']);
const LEVEL_REQ = 'levelreq';

/** Markers and caps: they only gate the recipe, never a bonus */
function isMarker(mod: string): boolean {
  return /^(?:item_)?craftflag/.test(mod) || mod === 'meldflag' || isCapMod(mod);
}

type SlotMatch =
  | { kind: 'slots'; slots: readonly CraftingSlot[] }
  /** A narrower weapon/armour type (wand, staff, orb, two-handed weapons, Voodoo Heads) */
  | { kind: 'subtype' }
  /** Jewels, charms: not an equipment slot */
  | { kind: 'none' }
  | { kind: 'unknown' };

function slotMatcher(bases: CraftingInput['bases']): (type: string) => SlotMatch {
  const cache = new Map<string, SlotMatch>();
  const slotsOf = (ancestors: readonly string[]) => ancestors.flatMap((code) => (code in SLOT_TYPES ? [SLOT_TYPES[code]] : []));
  return (type) => {
    const cached = cache.get(type);
    if (cached !== undefined) return cached;
    let match: SlotMatch;
    if (type === 'any') match = { kind: 'slots', slots: CRAFTING_SLOTS };
    else if (type === 'armo') match = { kind: 'slots', slots: ARMOUR_SLOTS };
    else if (type in SLOT_TYPES) match = { kind: 'slots', slots: [SLOT_TYPES[type]] };
    else {
      const matching = bases.filter((base) => base.ancestors.includes(type));
      const slots = new Set(matching.flatMap((base) => slotsOf(base.ancestors)));
      match =
        matching.length === 0
          ? { kind: 'unknown' }
          : slots.size === 0
            ? { kind: 'none' }
            : slots.size === 1
              ? { kind: 'subtype' }
              : { kind: 'unknown' };
    }
    cache.set(type, match);
    return match;
  };
}

function familyPattern(ids: readonly string[]): (row: CubeRow) => boolean {
  const families = [...CUBE_FAMILIES, ...EXTRA_FAMILIES].filter((family) => ids.includes(family.id));
  if (families.length !== ids.length) throw new Error(`crafting: cube family missing (${ids.join(', ')})`);
  return (row) => families.some((family) => family.match.test(row.description) && (family.filter?.(row) ?? true));
}

const FORGING_FAMILIES: readonly { kind: ForgingKind; ids: string[] }[] = [
  { kind: 'skill', ids: ['skill-forging'] },
  { kind: 'all', ids: ['all-skill-forging'] },
  { kind: 'stat', ids: ['stat-forging'] },
  { kind: 'rune', ids: ['rune-forging', 'rune-forging-slots'] },
  { kind: 'aura', ids: ['aura-forging'] },
];

export function buildCraftingBundle(input: CraftingInput): CraftingBuildResult {
  const warnings: string[] = [];
  const slotOf = slotMatcher(input.bases);
  let rowsUsed = 0;
  let rowsSkipped = 0;

  const render = (row: CubeRow, mods: readonly CubeMod[]): string[] => {
    const result = input.renderMods(
      mods.map((mod) => ({ code: mod.mod, param: mod.param === '' ? null : mod.param, min: mod.min, max: mod.max }))
    );
    for (const warning of result.warnings) warnings.push(`crafting: cubemain line ${String(row.line)}: ${warning}`);
    if (result.lines.length === 0) warnings.push(`crafting: cubemain line ${String(row.line)} "${row.description}" renders no bonus line`);
    return result.lines;
  };
  /** The row's item slots, or null when it is skipped (counted; unknown types warned) */
  const rowSlots = (row: CubeRow): readonly CraftingSlot[] | null => {
    const output = row.outputs.at(0);
    const item = parseCubeCell(row.inputs[0] ?? '');
    const match = slotOf(item.token);
    if (match.kind === 'unknown')
      warnings.push(`crafting: cubemain line ${String(row.line)} "${row.description}": item type "${item.token}" maps to no slot`);
    if (output === undefined || output.spec !== 'useitem' || match.kind !== 'slots') {
      rowsSkipped++;
      return null;
    }
    return match.slots;
  };
  const bonusMods = (row: CubeRow) => (row.outputs.at(0)?.mods ?? []).filter((mod) => !isMarker(mod.mod) && mod.mod !== LEVEL_REQ);

  // --- forgings ---
  const classNames = new Map(input.classes.map((cls) => [cls.code as string, cls.name]));
  const forgings: ForgingOption[] = [];
  for (const { kind, ids } of FORGING_FAMILIES) {
    const matches = familyPattern(ids);
    const rows = input.cube.flatMap((row) => {
      if (!matches(row)) return [];
      const slots = rowSlots(row);
      return slots === null ? [] : [{ row, slots }];
    });
    // The ingredient that picks the option: the input not shared by every row (the chipped gem, rune or aura stone)
    const tokensOf = (row: CubeRow) => row.inputs.slice(1).map((cell) => parseCubeCell(cell).token);
    const shared = new Set(
      rows.length === 0 ? [] : tokensOf(rows[0].row).filter((token) => rows.every(({ row }) => tokensOf(row).includes(token)))
    );
    const options = new Map<string, { option: ForgingOption; types: Map<CraftingSlot, { type: string; lines: string[] }> }>();
    for (const { row, slots } of rows) {
      const mods = bonusMods(row);
      let key: string | undefined;
      let label = '';
      if (kind === 'skill') {
        key = mods.find((mod) => classNames.has(mod.mod))?.mod;
        label = key === undefined ? '' : (classNames.get(key) ?? key);
      } else if (kind === 'all') {
        key = 'all';
        label = 'All skills';
      } else {
        const picks = tokensOf(row).filter((token) => !shared.has(token));
        if (picks.length === 1) {
          key = picks[0];
          label = input.nameOf(key);
        }
      }
      if (key === undefined) {
        warnings.push(`crafting: cubemain line ${String(row.line)} "${row.description}": cannot tell which ${kind} forging it is`);
        rowsSkipped++;
        continue;
      }
      const lines = render(row, mods);
      const option: ForgingOption = { kind, key, label, bySlot: {} };
      const entry = options.get(key) ?? { option, types: new Map<CraftingSlot, { type: string; lines: string[] }>() };
      options.set(key, entry);
      const type = parseCubeCell(row.inputs[0] ?? '').token;
      for (const slot of slots) {
        const first = entry.types.get(slot);
        if (first === undefined) {
          entry.types.set(slot, { type, lines });
          entry.option.bySlot[slot] = lines;
        } else if (first.type === type && first.lines.join('\n') !== lines.join('\n')) {
          warnings.push(
            `crafting: ${kind} forging "${label}" on ${slot}: cubemain line ${String(row.line)} differs from an earlier ${type} row`
          );
        }
      }
      rowsUsed++;
    }
    const list = [...options.values()].map(({ option }) => ({ ...option, bySlot: sortSlots(option.bySlot) }));
    if (kind === 'skill') {
      const order = [...classNames.keys()];
      list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    } else if (kind === 'rune') list.sort((a, b) => a.key.localeCompare(b.key));
    forgings.push(...list);
  }

  // --- D-stoning and gem melding ---
  const stacking: StackingCraftOption[] = [];
  const blockers = dstoneBlockers(input.cube);
  for (const { kind, ids } of [
    { kind: 'dstone', ids: ['dstoning'] },
    { kind: 'meld', ids: ['gem-meld'] },
  ] as const) {
    const matches = familyPattern(ids);
    // Rows with the same ingredients, item type and bonus stats: the steps of one D-stoning
    const groups = new Map<string, { rows: CubeRow[]; slots: readonly CraftingSlot[]; material: string; switchItem: string | null }>();
    for (const row of input.cube) {
      if (!matches(row)) continue;
      const item = parseCubeCell(row.inputs[0] ?? '');
      if (item.qualifiers.some((qualifier) => TIER_QUALIFIERS.has(qualifier))) {
        rowsSkipped++;
        continue;
      }
      const slots = rowSlots(row);
      if (slots === null) continue;
      const material = parseCubeCell(row.inputs[1] ?? '').token;
      const switchItem = kind === 'dstone' && row.inputs.length > 2 ? parseCubeCell(row.inputs[2] ?? '').token : null;
      const signature = bonusMods(row)
        .map((mod) => mod.mod)
        .sort()
        .join('+');
      const key = [material, switchItem ?? '', row.inputs[0] ?? '', signature].join('|');
      const group = groups.get(key) ?? { rows: [], slots, material, switchItem };
      group.rows.push(row);
      groups.set(key, group);
    }

    const options = new Map<string, StackingCraftOption>();
    for (const group of groups.values()) {
      const optionKey = `${group.material}|${group.switchItem ?? ''}`;
      const option: StackingCraftOption = options.get(optionKey) ?? {
        kind,
        material: { code: group.material, label: input.nameOf(group.material) },
        ...(group.switchItem === null ? {} : { switchItem: { code: group.switchItem, label: input.nameOf(group.switchItem) } }),
        bySlot: {},
      };
      options.set(optionKey, option);
      const free = group.slots.filter((slot) => option.bySlot[slot] === undefined);
      if (free.length > 0) {
        const step = stackingStep(group.rows, kind, render, bonusMods, input.statIdsOf ?? (() => []), blockers, warnings);
        for (const slot of free) option.bySlot[slot] = step;
        rowsUsed += group.rows.length;
      } else {
        const first = group.rows[0];
        warnings.push(
          `crafting: cubemain line ${String(first.line)} "${first.description}" is shadowed by an earlier ${kind} row with the same ingredients`
        );
        rowsSkipped += group.rows.length;
      }
    }
    // File order, the D-stonings without a switch item first
    const list = [...options.values()].map((option) => ({ ...option, bySlot: sortSlots(option.bySlot) }));
    stacking.push(...list.filter((option) => option.switchItem === undefined), ...list.filter((option) => option.switchItem !== undefined));
  }

  return { bundle: { forgings, stacking }, rowsUsed, rowsSkipped, warnings };
}

/**
 * One slot of a stacking craft: the first row's lines and level requirement; for D-stoning the amounts per use and the
 * total it stops at (omitted when a row has no cap condition)
 */
function stackingStep(
  rows: readonly CubeRow[],
  kind: StackingCraftOption['kind'],
  render: (row: CubeRow, mods: readonly CubeMod[]) => string[],
  bonusMods: (row: CubeRow) => CubeMod[],
  statIdsOf: (property: string) => readonly number[],
  blockers: readonly CubeRow[],
  warnings: string[]
): StackingCraftStep {
  const first = rows[0];
  const levelReq = first.outputs.at(0)?.mods.find((mod) => mod.mod === LEVEL_REQ)?.min ?? 0;
  const step: StackingCraftStep = { lines: render(first, bonusMods(first)), levelReq };
  if (kind === 'meld') return step;
  // Rows repeating the same bonus under another cap condition (HS: one row per cap stat) are one step
  const amounts: number[] = [];
  let previous = '';
  for (const row of rows) {
    const mods = bonusMods(row);
    const text = JSON.stringify(mods);
    if (text === previous) continue;
    previous = text;
    amounts.push(mods.at(0)?.min ?? 0);
  }
  if (amounts.some((amount, i) => i > 0 && amount >= (amounts[i - 1] ?? amount))) {
    warnings.push(
      `crafting: D-stoning "${first.description}" (cubemain line ${String(first.line)}) steps ${amounts.join(', ')} are not decreasing`
    );
  }
  const result = dstoneCap(rows, bonusMods, statIdsOf, blockers);
  if (result.kind === 'unknown')
    warnings.push(`crafting: D-stoning "${first.description}" (cubemain line ${String(first.line)}): ${result.reason}`);
  if (result.kind !== 'capped') return { ...step, steps: amounts };
  const capMods = result.cap.mods;
  return { ...step, steps: amounts, cap: capMods.at(0)?.min ?? 0, capLines: render(first, capMods) };
}

function sortSlots<T>(bySlot: Partial<Record<CraftingSlot, T>>): Partial<Record<CraftingSlot, T>> {
  const sorted: Partial<Record<CraftingSlot, T>> = {};
  for (const slot of CRAFTING_SLOTS) {
    const value = bySlot[slot];
    if (value !== undefined) sorted[slot] = value;
  }
  return sorted;
}
