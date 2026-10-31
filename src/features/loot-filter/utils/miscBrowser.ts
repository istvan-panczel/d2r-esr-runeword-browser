import type { BasesBundle, ItemTypeInfo, LootFilterDataBundle, LootFilterItem, TypesBundle } from '@/features/game-data/engine/schema';
import {
  displayCodes,
  type BrowserColumn,
  type BrowserGroup,
  type BrowserItem,
  type BrowserModel,
  type BrowserRow,
  type BrowserType,
} from './browserModel';

/**
 * The Misc tab of the item browser: every misc item that drops (`drops`: spawnable or named by a treasure class, like
 * the non-spawnable Ancient Scrolls and Ore) and is not a base (runes, gems, potions, cube materials, quest items,
 * coupons…), grouped by the item type's topmost ancestor below `misc`, with a block per type
 * below that group root. Quality families (Chipped / Flawed / … Perfect X) form a grid by quality.
 */

/** Group roots shown first, in this order; every other group follows alphabetically by label. */
export const PREFERRED_MISC_GROUPS: readonly string[] = ['sock', 'cube', 'poti', 'ques', 'mmap'];

/** An item type left out because it is a stack of identically named containers (Rune Stocker ×47…). */
export interface ExcludedMiscType {
  readonly code: string;
  readonly name: string;
  /** The items' shared name. */
  readonly itemName: string;
  readonly count: number;
}

export interface MiscBrowserModel extends BrowserModel {
  readonly excluded: readonly ExcludedMiscType[];
}

// --- Quality ladder ---

interface Ladder {
  /** One column per ladder type (`gem0`…), in the order the items first use them as `type2`. */
  readonly columns: readonly BrowserColumn[];
  readonly byType: ReadonlyMap<string, BrowserColumn>;
  /** The column of a family's unprefixed member without a ladder `type2` (Standard: its items carry no prefix). */
  readonly base: BrowserColumn | null;
}

const EMPTY_LADDER: Ladder = { columns: [], byType: new Map(), base: null };

/** How many words the names share at the end ("Chipped Gem", "Flawed Gem" → 1), leaving at least one word each. */
function commonTrailingWords(names: readonly (readonly string[])[]): number {
  const shortest = Math.min(...names.map((words) => words.length));
  let count = 0;
  while (count < shortest - 1) {
    const word = names[0]?.at(-1 - count);
    if (word === undefined || names.some((words) => words.at(-1 - count) !== word)) break;
    count++;
  }
  return count;
}

/**
 * The quality ladder: the item types the candidates use as `type2` (the gem grades), each labelled with its type name
 * minus the words all of them share ("Chipped Gem" → "Chipped").
 */
function buildLadder(items: readonly LootFilterItem[], typeByCode: ReadonlyMap<string, ItemTypeInfo>): Ladder {
  const codes = [...new Set(items.flatMap((item) => (item.type2 === undefined ? [] : [item.type2])))].filter((code) =>
    typeByCode.has(code)
  );
  if (codes.length < 2) return EMPTY_LADDER;
  const words = codes.map((code) => (typeByCode.get(code)?.name ?? code).split(/\s+/));
  const shared = commonTrailingWords(words);
  const grades = codes.map((code, index) => {
    const typeWords = words[index] ?? [];
    return { code, column: { key: code, label: typeWords.slice(0, typeWords.length - shared).join(' ') } };
  });
  // The grade whose items carry no prefix (Amethyst, Topaz… are `gem2`, Standard).
  const base = grades.find(({ code, column }) => {
    const graded = items.filter((item) => item.type2 === code);
    return graded.length > 0 && graded.every((item) => !item.name.startsWith(`${column.label} `));
  });
  const columns = grades.map((grade) => grade.column);
  const byType = new Map(grades.map((grade) => [grade.code, grade.column]));
  return { columns, byType, base: base?.column ?? null };
}

// --- Model ---

/** The item type's chain up `parents[0]` to the topmost ancestor below `misc` (the type itself first). */
function typeChain(code: string, typeByCode: ReadonlyMap<string, ItemTypeInfo>): string[] {
  const chain = [code];
  let parent = typeByCode.get(code)?.parents[0];
  while (parent !== undefined && parent !== 'misc' && !chain.includes(parent)) {
    chain.push(parent);
    parent = typeByCode.get(parent)?.parents[0];
  }
  return chain;
}

/** Item types whose candidates (more than one) all share one name: stacks of containers, not worth a browser block. */
function containerTypes(items: readonly LootFilterItem[]): Map<string, LootFilterItem[]> {
  const byType = new Map<string, LootFilterItem[]>();
  for (const item of items) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  return new Map(
    [...byType].filter(([, typeItems]) => typeItems.length > 1 && typeItems.every((item) => item.name === typeItems[0]?.name))
  );
}

interface Block {
  readonly code: string;
  readonly items: LootFilterItem[];
}

interface GroupDraft {
  readonly code: string;
  readonly blocks: Map<string, Block>;
}

export function buildMiscBrowserModel(
  lootfilterItems: readonly LootFilterItem[],
  types: readonly ItemTypeInfo[],
  baseCodes: ReadonlySet<string>
): MiscBrowserModel {
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const typeName = (code: string) => typeByCode.get(code)?.name ?? code;
  const candidates = lootfilterItems.filter((item) => item.kind === 'misc' && item.drops && !baseCodes.has(item.code));

  const containers = containerTypes(candidates);
  const excluded = [...containers].map(([code, typeItems]): ExcludedMiscType => ({
    code,
    name: typeName(code),
    itemName: typeItems[0]?.name ?? '',
    count: typeItems.length,
  }));
  const listed = candidates.filter((item) => !containers.has(item.type));
  const ladder = buildLadder(listed, typeByCode);

  // Group root = the chain's last type; block = the type right below the root (the root itself for a one-type chain).
  const groupDrafts = new Map<string, GroupDraft>();
  for (const item of listed) {
    const chain = typeChain(item.type, typeByCode);
    const root = chain[chain.length - 1] ?? item.type;
    const blockCode = chain[chain.length - 2] ?? root;
    const group = groupDrafts.get(root) ?? { code: root, blocks: new Map<string, Block>() };
    groupDrafts.set(root, group);
    const block = group.blocks.get(blockCode) ?? { code: blockCode, items: [] };
    group.blocks.set(blockCode, block);
    block.items.push(item);
  }

  const preferredIndex = (code: string) => {
    const index = PREFERRED_MISC_GROUPS.indexOf(code);
    return index === -1 ? PREFERRED_MISC_GROUPS.length : index;
  };
  const orderedGroups = [...groupDrafts.values()].sort(
    (a, b) => preferredIndex(a.code) - preferredIndex(b.code) || typeName(a.code).localeCompare(typeName(b.code))
  );

  const codes: string[] = [];
  const groups = orderedGroups.map((group): BrowserGroup => {
    const label = typeName(group.code);
    const blocks = [...group.blocks.values()].map((block) => buildBlock(block, label));
    for (const block of blocks) codes.push(...displayCodes(block));
    return { label, types: blocks };
  });
  return { groups, codes, excluded };

  function buildBlock(block: Block, groupLabel: string): BrowserType {
    const toItem = (item: LootFilterItem, column: BrowserColumn | null): BrowserItem => ({
      code: item.code,
      name: item.name,
      column,
      search: [item.name, item.code, typeName(item.type), item.type, typeName(block.code), block.code, column?.label ?? '', groupLabel]
        .join(' ')
        .toLowerCase(),
    });

    // Family members: `<ladder word> X` where X names another item of the block, plus X itself.
    const names = new Set(block.items.map((item) => item.name));
    const membership = new Map<LootFilterItem, { key: string; column: BrowserColumn }>();
    for (const item of block.items) {
      for (const column of ladder.columns) {
        const rest = item.name.startsWith(`${column.label} `) ? item.name.slice(column.label.length + 1) : null;
        if (rest !== null && names.has(rest)) {
          membership.set(item, { key: rest, column });
          break;
        }
      }
    }
    const familyKeys = new Set([...membership.values()].map((member) => member.key));
    for (const item of block.items) {
      if (membership.has(item) || !familyKeys.has(item.name)) continue;
      const column = (item.type2 === undefined ? undefined : ladder.byType.get(item.type2)) ?? ladder.base;
      if (column !== null) membership.set(item, { key: item.name, column });
    }

    // One row per family (first member's position), one cell per column; a duplicate cell goes to the extras.
    const rowCells = new Map<string, Map<string, BrowserItem>>();
    const extras: BrowserItem[] = [];
    for (const item of block.items) {
      const member = membership.get(item);
      const cells = member === undefined ? undefined : (rowCells.get(member.key) ?? new Map<string, BrowserItem>());
      if (member === undefined || cells === undefined || cells.has(member.column.key)) {
        extras.push(toItem(item, null));
        continue;
      }
      cells.set(member.column.key, toItem(item, member.column));
      rowCells.set(member.key, cells);
    }

    const base = { code: block.code, name: typeName(block.code), extrasColumn: null };
    if (rowCells.size === 0) return { ...base, layout: 'list', columns: [], rows: [], extras: [], items: extras };
    const used = new Set([...rowCells.values()].flatMap((cells) => [...cells.keys()]));
    const columns = ladder.columns.filter((column) => used.has(column.key));
    const rows = [...rowCells].map(([key, cells]): BrowserRow => ({ key, cells: columns.map((column) => cells.get(column.key) ?? null) }));
    return { ...base, layout: 'grid', columns, rows, extras, items: [] };
  }
}

// One model per loaded bundle triple (the bundles are cached for the page's lifetime).
let cached: { lootfilter: LootFilterDataBundle; types: TypesBundle; bases: BasesBundle; model: MiscBrowserModel } | null = null;

export function getMiscBrowserModel(lootfilter: LootFilterDataBundle, types: TypesBundle, bases: BasesBundle): MiscBrowserModel {
  if (cached?.lootfilter !== lootfilter || cached.types !== types || cached.bases !== bases) {
    const baseCodes = new Set(bases.bases.map((base) => base.code));
    cached = { lootfilter, types, bases, model: buildMiscBrowserModel(lootfilter.items, types.types, baseCodes) };
  }
  return cached.model;
}
