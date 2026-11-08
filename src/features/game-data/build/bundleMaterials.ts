/**
 * materials.json: the misc items a player finds or makes (runes, gems, organs, Dragon Stones, coupons, potions, quest
 * items used in recipes …) with where they come from and which cube families and Enhance recipes use them.
 *
 * Items: misc.txt rows that are spawnable or appear in an enabled cubemain row (by code, or through a misc item type),
 * minus the bases (bases.json, and same-named copies of a base of the same type), gold, quest items not used in a listed recipe, and the Fake Note / Magic Eraser rows
 * no listed recipe uses. Groups and blocks follow the item type ancestry like the loot filter's misc browser
 * (src/features/loot-filter/utils/miscBrowser.ts). Containers (types whose rows all share one name: stockers, cans,
 * Rerolling Orbs) go to one "Stockers and cans" group, one row each; same-named rows of a block collapse into one row;
 * coupons collapse per tier. See docs/features/GAME-DATA.md "Materials".
 */
import type {
  BaseItem,
  CubeFamilyInfo,
  EnhanceBundle,
  ItemTypeInfo,
  MaterialEnhanceRole,
  MaterialFamilyUse,
  MaterialGroup,
  MaterialItem,
  MaterialsBundle,
  SourceLabel,
  SourcesBundle,
} from '../engine/schema.ts';
import { orderLabels } from './bundleSources.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import { parseCubeCell } from './cube/cubeText.ts';
import type { TsvTable } from './tsv.ts';

/** Group roots shown first, in this order (the misc browser's PREFERRED_MISC_GROUPS); the others follow by label */
export const PREFERRED_GROUPS: readonly string[] = ['sock', 'cube', 'poti', 'ques', 'mmap'];
/** The synthetic group of the container types, shown last */
export const CONTAINER_GROUP = 'stockers';

/** Plural headings for the common groups; other groups use their item type name */
const GROUP_LABELS: Readonly<Partial<Record<string, string>>> = {
  sock: 'Socket Fillers',
  cube: 'Cube Materials',
  poti: 'Potions',
  ques: 'Quest Items',
  mmap: 'Mythical Maps',
  body: 'Body Parts (Organs)',
  scrl: 'Ancient Scrolls',
  coup: 'Coupons and Decals',
  char: 'Charms',
  [CONTAINER_GROUP]: 'Stockers and cans',
};

/** Coupon tier per coupon type; a tier's coupons collapse into one row */
const COUPON_TIERS: Readonly<Partial<Record<string, string>>> = { cpn1: 'normal', cpn2: 'exceptional', cpn3: 'elite' };
const COUPON_GROUP = 'coup';
/** "Ancient Decal (I -> El)" → "Ancient Decal" */
const namePrefix = (name: string) => name.replace(/\s*\(.*$/, '');

/** Unused misc rows left out unless a listed recipe uses them */
const UNUSED_NAMES: readonly string[] = ['Fake Note', 'Magic Eraser'];
const SPECIAL_TOKENS = new Set(['any', 'useitem', 'usetype', 'cloneitem']);
/** Fallback families of cube.json (grouped by description prefix) */
const isFallback = (family: string) => family.startsWith('other:');

export interface MaterialsInput {
  misc: TsvTable;
  types: readonly Pick<ItemTypeInfo, 'code' | 'name' | 'parents' | 'ancestors'>[];
  bases: readonly Pick<BaseItem, 'code' | 'name' | 'type' | 'type2'>[];
  /** Display name of an item code (the cube tables' nameOf: belt abbreviations such as "*Thaw" read in full) */
  nameOf: (code: string) => string;
  /** Every enabled cubemain row, hidden ones included (decides which non-spawnable rows are materials) */
  cubeRows: readonly CubeRow[];
  /** The listed rows of each family (assignCubeRows) */
  familyRows: ReadonlyMap<string, readonly CubeRow[]>;
  /** cube.json families (display order and labels) */
  families: readonly Pick<CubeFamilyInfo, 'id' | 'label' | 'order'>[];
  sources: SourcesBundle;
  /** Labels of one misc code (bundleSources), for the rows sources.json leaves out (potions, scrolls, keys, tomes) */
  miscLabels: (code: string) => SourceLabel[];
  enhance: Pick<EnhanceBundle, 'corruption' | 'anointment' | 'vesselRecipes' | 'vesselTransforms'> &
    Partial<Pick<EnhanceBundle, 'sanctification' | 'standardOfHeroes'>>;
}

export interface MaterialsExclusions {
  bases: number;
  gold: number;
  /** Neither spawnable nor in any enabled cubemain row */
  unlisted: number;
  /** Quest rows (`quest` set or the `ques` group) no listed recipe uses */
  quest: number;
  /** Fake Note / Magic Eraser rows no listed recipe uses */
  unused: number;
}

export interface MaterialsBuildResult {
  bundle: MaterialsBundle;
  excluded: MaterialsExclusions;
  /** misc rows folded into another row (containers, same names, coupon tiers) */
  collapsed: number;
  warnings: string[];
}

interface MiscRow {
  code: string;
  name: string;
  type: string;
  type2: string;
  level: number;
  levelreq: number;
  stackable: boolean;
  spawnable: boolean;
  quest: boolean;
}

/** Family id → the cubemain lines of that family using the item */
type Uses = Map<string, Set<number>>;

interface Draft extends MiscRow {
  group: string;
  block: string;
  usedIn: Uses;
  madeBy: Uses;
}

function readMiscRows(misc: TsvTable, nameOf: (code: string) => string): MiscRow[] {
  const seen = new Set<string>();
  const rows: MiscRow[] = [];
  const num = (row: TsvTable['rows'][number], column: string) => (row.has(column) ? Number(row.str(column)) || 0 : 0);
  for (const row of misc.rows) {
    const code = row.str('code');
    if (code === '' || seen.has(code)) continue;
    seen.add(code);
    rows.push({
      code,
      name: nameOf(code),
      type: row.has('type') ? row.str('type') : '',
      type2: row.has('type2') ? row.str('type2') : '',
      level: num(row, 'level'),
      levelreq: num(row, 'levelreq'),
      stackable: num(row, 'stackable') === 1,
      spawnable: num(row, 'spawnable') === 1,
      quest: num(row, 'quest') !== 0,
    });
  }
  return rows;
}

/** The item type's chain up `parents[0]` to the topmost ancestor below `misc` (the type itself first) */
function typeChain(code: string, typeByCode: ReadonlyMap<string, Pick<ItemTypeInfo, 'parents'>>): string[] {
  const chain = [code];
  let parent = typeByCode.get(code)?.parents[0];
  while (parent !== undefined && parent !== 'misc' && !chain.includes(parent)) {
    chain.push(parent);
    parent = typeByCode.get(parent)?.parents[0];
  }
  return chain;
}

/** How many words the names share at the end ("Chipped Gem", "Flawed Gem" → 1), leaving at least one word each */
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

function addUse(uses: Uses, family: string, line: number): void {
  const lines = uses.get(family) ?? new Set<number>();
  lines.add(line);
  uses.set(family, lines);
}

export function buildMaterialsBundle(input: MaterialsInput): MaterialsBuildResult {
  const warnings: string[] = [];
  const typeByCode = new Map(input.types.map((type) => [type.code, type]));
  const ancestorsOf = (type: string) => typeByCode.get(type)?.ancestors ?? (type === '' ? [] : [type]);
  const baseCodes = new Set(input.bases.map((base) => base.code));
  // A type token that also covers a base (equipment, rings, amulets, charms, jewels, `misc` itself) is a generic item
  // slot, not a material input: only the other type tokens (rune, gem5, body, scrl …) match items through ancestry.
  const baseTypes = new Set(
    input.bases.flatMap((base) => [...ancestorsOf(base.type), ...(base.type2 === null ? [] : ancestorsOf(base.type2))])
  );
  const isMaterialType = (token: string) => typeByCode.has(token) && !baseTypes.has(token);

  // Copies of an accessory base under another code (the drop-only `cx1`-`cx3` charms, a non-spawnable Odd Charm)
  const baseNames = new Set(input.bases.map((base) => `${base.type}|${base.name}`));
  const isBaseCopy = (row: MiscRow) => baseNames.has(`${row.type}|${row.name}`);

  const rows = readMiscRows(input.misc, input.nameOf);
  const byCode = new Map(rows.map((row) => [row.code, row]));
  /** Material type token → the codes of the misc rows of that type (own type or type2, with ancestors) */
  const typeMembers = new Map<string, string[]>();
  for (const row of rows) {
    for (const type of new Set([...ancestorsOf(row.type), ...ancestorsOf(row.type2)])) {
      if (!isMaterialType(type)) continue;
      typeMembers.set(type, [...(typeMembers.get(type) ?? []), row.code]);
    }
  }
  const codesOf = (spec: string): string[] => {
    const { token } = parseCubeCell(spec);
    if (SPECIAL_TOKENS.has(token)) return [];
    if (byCode.has(token)) return [token];
    return typeMembers.get(token) ?? [];
  };

  const inCube = new Set<string>();
  for (const row of input.cubeRows) {
    for (const spec of [...row.inputs, ...row.outputs.map((output) => output.spec)]) for (const code of codesOf(spec)) inCube.add(code);
  }

  const usedIn = new Map<string, Uses>();
  const madeBy = new Map<string, Uses>();
  const usesOf = (map: Map<string, Uses>, code: string) => {
    const uses = map.get(code) ?? new Map<string, Set<number>>();
    map.set(code, uses);
    return uses;
  };
  for (const [family, familyRows] of input.familyRows) {
    for (const row of familyRows) {
      const inputTokens = new Set(row.inputs.map((spec) => parseCubeCell(spec).token));
      for (const spec of row.inputs) for (const code of codesOf(spec)) addUse(usesOf(usedIn, code), family, row.line);
      for (const output of row.outputs) {
        // Rerolls and returned inputs (the Ancient Scroll of a secret recipe) do not make the item
        if (inputTokens.has(parseCubeCell(output.spec).token)) continue;
        for (const code of codesOf(output.spec)) if (!inputTokens.has(code)) addUse(usesOf(madeBy, code), family, row.line);
      }
    }
  }

  // Inclusion and exclusions
  const excluded: MaterialsExclusions = { bases: 0, gold: 0, unlisted: 0, quest: 0, unused: 0 };
  const drafts: Draft[] = [];
  for (const row of rows) {
    const used = (usedIn.get(row.code)?.size ?? 0) + (madeBy.get(row.code)?.size ?? 0) > 0;
    const chain = typeChain(row.type, typeByCode);
    const root = chain[chain.length - 1] ?? row.type;
    if (baseCodes.has(row.code) || isBaseCopy(row)) excluded.bases++;
    else if (ancestorsOf(row.type).includes('gold')) excluded.gold++;
    else if (!row.spawnable && !inCube.has(row.code)) excluded.unlisted++;
    else if ((row.quest || root === 'ques') && !used) excluded.quest++;
    else if (UNUSED_NAMES.includes(row.name) && !used) excluded.unused++;
    else {
      drafts.push({
        ...row,
        group: root,
        block: chain[chain.length - 2] ?? root,
        usedIn: usedIn.get(row.code) ?? new Map<string, Set<number>>(),
        madeBy: madeBy.get(row.code) ?? new Map<string, Set<number>>(),
      });
    }
  }

  // Containers: a type with more than one row, all of one name (Rune Stocker ×47, Gem Can, Rerolling Orb …)
  const byType = new Map<string, Draft[]>();
  for (const draft of drafts) byType.set(draft.type, [...(byType.get(draft.type) ?? []), draft]);
  const containerTypes = new Set(
    [...byType].filter(([, items]) => items.length > 1 && items.every((item) => item.name === items[0]?.name)).map(([type]) => type)
  );
  for (const draft of drafts) {
    if (!containerTypes.has(draft.type)) continue;
    draft.group = CONTAINER_GROUP;
    draft.block = draft.type;
  }

  // Grades of a quality ladder: the item types the drafts use as type2 ("Chipped Gem" → "Chipped")
  const ladderCodes = [...new Set(drafts.map((draft) => draft.type2))].filter((code) => typeByCode.has(code));
  const grades = new Map<string, string>();
  if (ladderCodes.length >= 2) {
    const words = ladderCodes.map((code) => (typeByCode.get(code)?.name ?? code).split(/\s+/));
    const shared = commonTrailingWords(words);
    ladderCodes.forEach((code, i) => {
      const typeWords = words[i] ?? [];
      grades.set(code, typeWords.slice(0, typeWords.length - shared).join(' '));
    });
  }

  // Collapse: same-named rows of a block; coupons per tier (rings and amulets included); decals by name prefix
  const collapseKey = (draft: Draft) => {
    if (draft.group !== COUPON_GROUP) return `${draft.group}|${draft.block}|${draft.name}`;
    if (COUPON_TIERS[draft.block] !== undefined) return `${draft.group}|${draft.block}`;
    return `${draft.group}|${draft.block}|${namePrefix(draft.name)}`;
  };
  const clusters = new Map<string, Draft[]>();
  for (const draft of drafts) {
    const key = collapseKey(draft);
    clusters.set(key, [...(clusters.get(key) ?? []), draft]);
  }

  const enhanceRoles = enhanceRolesByCode(input.enhance);
  const sourceByCode = new Map<string, SourceLabel[]>();
  const sourceByName = new Map<string, SourceLabel[]>();
  for (const source of input.sources.items) {
    if (source.item !== 'misc') continue;
    if (!sourceByCode.has(source.code)) sourceByCode.set(source.code, source.labels);
    if (!sourceByName.has(source.name)) sourceByName.set(source.name, source.labels);
  }
  const familyOrder = new Map(input.families.map((family) => [family.id, family.order]));
  const toUses = (uses: Uses): MaterialFamilyUse[] =>
    [...uses]
      .map(([family, lines]) => ({ family, recipes: lines.size }))
      // Curated families before the fallback ones (`other:*`), then most recipes first (the page links "Cube" to the first
      // family that makes the item), then cube.json order
      .sort(
        (a, b) =>
          Number(isFallback(a.family)) - Number(isFallback(b.family)) ||
          b.recipes - a.recipes ||
          (familyOrder.get(a.family) ?? Infinity) - (familyOrder.get(b.family) ?? Infinity)
      );

  let collapsed = 0;
  const items: MaterialItem[] = [];
  for (const cluster of clusters.values()) {
    const first = cluster.at(0);
    if (first === undefined) continue;
    collapsed += cluster.length - 1;
    const merge = (pick: (draft: Draft) => Uses) => {
      const uses: Uses = new Map();
      for (const draft of cluster) for (const [family, lines] of pick(draft)) for (const line of lines) addUse(uses, family, line);
      return uses;
    };
    const used = merge((draft) => draft.usedIn);
    const made = merge((draft) => draft.madeBy);
    const found = cluster.flatMap((draft) => sourceByCode.get(draft.code) ?? sourceByName.get(draft.name) ?? input.miscLabels(draft.code));
    // "Cube" without a listed family making it comes from stocker bookkeeping (taking the item back out)
    const sources = orderLabels(made.size === 0 ? found.filter((entry) => entry.kind !== 'cube') : found);
    const roles = dedupeRoles(cluster.flatMap((draft) => enhanceRoles.get(draft.code) ?? []));
    const tier = first.group === COUPON_GROUP ? COUPON_TIERS[first.block] : undefined;
    const grade = grades.get(first.type2);
    items.push({
      code: first.code,
      name:
        tier === undefined
          ? cluster.length > 1 && first.group === COUPON_GROUP
            ? namePrefix(first.name)
            : first.name
          : `Ancient Coupons (${tier} tier)`,
      group: first.group,
      // The tier rows share the coupon block: one row per tier needs no block heading
      block: tier === undefined ? first.block : COUPON_GROUP,
      ...(grade === undefined ? {} : { grade }),
      level: Math.min(...cluster.map((draft) => draft.level)),
      levelreq: Math.min(...cluster.map((draft) => draft.levelreq)),
      stackable: cluster.some((draft) => draft.stackable),
      spawnable: cluster.some((draft) => draft.spawnable),
      sources,
      usedIn: toUses(used),
      madeBy: toUses(made),
      ...(roles.length === 0 ? {} : { enhance: roles }),
      ...(cluster.length > 1 ? { variants: cluster.length } : {}),
    });
  }

  const groups = buildGroups(items, typeByCode, containerTypes, input.nameOf, byType);
  const groupIndex = new Map(groups.map((group, i) => [group.code, i]));
  const blockIndex = new Map(groups.flatMap((group) => group.blocks.map((block, i) => [`${group.code}|${block.code}`, i] as const)));
  // Stable: misc.txt order within a block
  const ordered = items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        (groupIndex.get(a.item.group) ?? 0) - (groupIndex.get(b.item.group) ?? 0) ||
        (blockIndex.get(`${a.item.group}|${a.item.block}`) ?? 0) - (blockIndex.get(`${b.item.group}|${b.item.block}`) ?? 0) ||
        a.i - b.i
    )
    .map(({ item }) => item);

  const referenced = new Set(ordered.flatMap((item) => [...item.usedIn, ...item.madeBy].map((use) => use.family)));
  for (const family of referenced) if (!familyOrder.has(family)) warnings.push(`materials: family "${family}" is not in cube.json`);
  const families = [...input.families]
    .filter((family) => referenced.has(family.id))
    .sort((a, b) => a.order - b.order)
    .map((family) => ({ id: family.id, label: family.label }));

  return { bundle: { groups, families, items: ordered }, excluded, collapsed, warnings };
}

function buildGroups(
  items: readonly MaterialItem[],
  typeByCode: ReadonlyMap<string, Pick<ItemTypeInfo, 'name'>>,
  containerTypes: ReadonlySet<string>,
  nameOf: (code: string) => string,
  byType: ReadonlyMap<string, readonly { code: string }[]>
): MaterialGroup[] {
  const typeName = (code: string) => typeByCode.get(code)?.name ?? code;
  const blockLabel = (code: string) => {
    // A container block reads as its items' name ("Rune Stocker"), not the type name ("Gem Can 2")
    const first = byType.get(code)?.[0];
    return containerTypes.has(code) && first !== undefined ? nameOf(first.code) : typeName(code);
  };
  const drafts = new Map<string, MaterialGroup>();
  for (const item of items) {
    const group = drafts.get(item.group) ?? { code: item.group, label: GROUP_LABELS[item.group] ?? typeName(item.group), blocks: [] };
    drafts.set(item.group, group);
    if (!group.blocks.some((block) => block.code === item.block)) group.blocks.push({ code: item.block, label: blockLabel(item.block) });
  }
  const rank = (code: string) => {
    if (code === CONTAINER_GROUP) return PREFERRED_GROUPS.length + 1;
    const index = PREFERRED_GROUPS.indexOf(code);
    return index === -1 ? PREFERRED_GROUPS.length : index;
  };
  return [...drafts.values()].sort((a, b) => rank(a.code) - rank(b.code) || a.label.localeCompare(b.label));
}

function dedupeRoles(roles: readonly MaterialEnhanceRole[]): MaterialEnhanceRole[] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = `${role.tab}|${role.slot ?? ''}|${role.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Item code → its Enhance roles (corruption, anointment, sanctification and Standard of Heroes reagents, Vessel of Souls materials) */
export function enhanceRolesByCode(enhance: MaterialsInput['enhance']): Map<string, MaterialEnhanceRole[]> {
  const roles = new Map<string, MaterialEnhanceRole[]>();
  const add = (code: string, role: MaterialEnhanceRole) => {
    roles.set(code, dedupeRoles([...(roles.get(code) ?? []), role]));
  };
  add(enhance.corruption.reagent.code, { tab: 'corruption', label: 'Corruption reagent' });
  add(enhance.anointment.reagent.code, { tab: 'anointment', label: 'Anointment reagent' });
  for (const reagent of enhance.anointment.charmReagents)
    add(reagent.code, { tab: 'anointment', slot: 'charm', label: 'Unique charm anointment' });
  const sanctifier = enhance.sanctification?.reagent.code ?? '';
  if (sanctifier !== '') add(sanctifier, { tab: 'sanctification', label: 'Sanctification reagent' });
  const standard = enhance.standardOfHeroes?.reagent.code ?? '';
  if (standard !== '') add(standard, { tab: 'standard', label: 'Unique charm upgrade' });
  for (const recipe of [...enhance.vesselRecipes, ...enhance.vesselTransforms]) {
    for (const material of recipe.materials) add(material.code, { tab: 'vessel', label: 'Vessel of Souls material' });
  }
  return roles;
}
