/**
 * Shape of the static game-data bundles under `public/game-data/`.
 * Bump GAME_DATA_SCHEMA whenever a bundle shape changes incompatibly.
 */
import type { ClassText, StatDef } from './stats/types.ts';

/**
 * The manifest carries it; a tab whose code expects another one shows "Reload the page" instead of reading bundles it
 * does not understand (bundle URLs are hash-busted, so it only guards old code against new bundles). 2: ESR 3.3
 * (`WeaponMastery.property` replaced `value`, anointment pools are item types instead of slots).
 */
export const GAME_DATA_SCHEMA = 2;

export type ClassCode = 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | 'war';
export type GameDataFile =
  | 'types'
  | 'bases'
  | 'runewords'
  | 'affixes'
  | 'sources'
  | 'lootfilter'
  | 'enhance'
  | 'cube'
  | 'materials'
  | 'sets'
  | 'skills'
  | 'skilldetails'
  | 'skillcalc'
  | 'crafting'
  | 'tiers'
  | 'areas'
  | 'stash'
  | 'stashnames'
  | 'itemtext'
  | 'terrorzones'
  | 'modifiers'
  | 'masteries'
  | 'specializations'
  | 'icons';

export interface GameDataManifest {
  schema: number;
  esrVersion: string;
  esrTag: string | null;
  esrCommit: string;
  generatedAt: string;
  files: Partial<Record<GameDataFile, { hash: string; bytes: number }>>;
  counts: Record<string, number>;
  warnings: string[];
}

export interface TypesBundle {
  types: ItemTypeInfo[];
  classes: ClassInfo[];
}

export interface ItemTypeInfo {
  code: string;
  name: string;
  parents: string[];
  /** Includes the type itself */
  ancestors: string[];
  sockets: [number, number, number];
  thresholds: [number, number];
  cls: ClassCode | null;
  ui: string | null;
  rwCats: string[];
  magic: boolean;
  rare: boolean;
  normal: boolean;
  bodyLoc: string | null;
}

export interface ClassInfo {
  code: ClassCode;
  name: string;
  tabs: [string, string, string];
}

export interface BasesBundle {
  bases: BaseItem[];
  /**
   * The automagic.txt rows some base can roll (`BaseItem.automods` ids), sorted by id. Always written by the generator;
   * optional only so hand-built test bundles can leave it out.
   */
  automods?: BaseAutomod[];
  /**
   * Superior affixes (see `SuperiorAffixes`, which these three keys make up): the plugin rules, the qualityitems.txt
   * rows with ESR's weights and the pools of rows the bases can roll. Separate top-level keys so the rows serialize one
   * per line. Always written by the generator; optional only so hand-built test bundles can leave them out.
   */
  superior?: SuperiorRules;
  superiorRows?: SuperiorRow[];
  superiorPools?: SuperiorPool[];
}

/** The stock item-class columns of qualityitems.txt, in file order (tested against the item's own `type`). */
export const SUPERIOR_COLUMNS = ['armor', 'weapon', 'shield', 'scepter', 'wand', 'staff', 'bow', 'boots', 'gloves', 'belt'] as const;
export type SuperiorColumn = (typeof SUPERIOR_COLUMNS)[number];

/**
 * Superior quality affixes: a Superior item rolls ONE qualityitems.txt row it may use, weighted by the D2RLoader
 * superior-affixes plugin (`celestialrayone.superior-affixes.toml`); the row's mods are rolled once and kept.
 */
export interface SuperiorAffixes extends SuperiorRules {
  rows: SuperiorRow[];
  /** Groups of bases that roll exactly the same rows, in bases.json order of their first base */
  pools: SuperiorPool[];
}

/** The superior-affixes plugin settings the rows' odds depend on */
export interface SuperiorRules {
  /** `[superior_affixes] enabled`; false (or no config) = the stock picker with equal odds */
  enabled: boolean;
  /**
   * Where the row weights come from: the qualityitems.txt `frequency` column (ESR 3.3), the plugin toml's weights table
   * (ESR ≤ 3.2), or equal odds (stock: the plugin is off or missing)
   */
  weightSource: 'frequency' | 'config' | 'equal';
  /** The weight of a row without one: 0 (an empty frequency cell never rolls) or the toml's `default_weight` */
  defaultWeight: number;
  /**
   * Base codes that only use rows 0-3 (`first_four_rows_for_throwing_and_nodurability = true`: own type Throwable or
   * nodurability). Omitted when the rule is off (ESR 3.2.24).
   */
  firstFourRowBases?: string[];
}

export interface SuperiorRow {
  /** 0-based qualityitems.txt row (row 0 = the first line under the header), the key of the weights table */
  row: number;
  /** Plugin weight (0 = never rolls) */
  weight: number;
  /** mod1 and mod2 (mod2 only when mod1code is set); empty for a row without a bonus */
  mods: AffixMod[];
  /** Rendered stat lines (the same renderer as affixes.json) */
  text: string[];
  /** Stock item-class columns set to 1 (used only when `itypes` is empty) */
  columns: SuperiorColumn[];
  /** `itype1-7`: the row rolls only on items whose type or type2 is one of these or below one (Equiv walk) */
  itypes: string[];
  /** `etype1-5`: never on items matching one of these */
  etypes: string[];
}

export interface SuperiorPool {
  /** Short name: the deepest type all its bases share, "(other types)" when that type also covers other pools */
  label: string;
  /** Own `type` codes of the pool's bases, in bases.json order */
  types: string[];
  /** Number of bases in the pool */
  bases: number;
  /** `SuperiorRow.row` values the pool rolls, ascending */
  rows: number[];
  /** Sum of the rows' weights: a row's chance is weight / total */
  total: number;
}

/** One automagic.txt row as shown on base cards (a subset of the affixes.json `Affix` with kind `a`). */
export interface BaseAutomod {
  /** 0-based automagic.txt row index (= `Affix.id` of the kind `a` affix) */
  id: number;
  /** String-resolved name; '' for ESR's "null" placeholder rows */
  name: string;
  lvl: number;
  /** 0 = no maximum */
  maxLvl: number;
  reqLvl: number;
  /** Rendered stat lines (same text as the Affixes page) */
  text: string[];
}

export interface BaseItem {
  code: string;
  name: string;
  kind: 'weapon' | 'armor' | 'misc';
  type: string;
  type2: string | null;
  /** Union over type + type2 */
  ancestors: string[];
  tier: 'normal' | 'exceptional' | 'elite' | 'mythical';
  /** norm / uber / ultra codes */
  family: [string, string, string];
  qlvl: number;
  reqLvl: number;
  reqStr: number;
  reqDex: number;
  gemSockets: number;
  /** min(gemSockets, own-type MaxSockets1/2/3) */
  socketCaps: [number, number, number];
  dmg1: [number, number] | null;
  dmg2: [number, number] | null;
  throwDmg: [number, number] | null;
  speed: number;
  /** weapons.txt `rangeadder`; omitted when 0 or blank */
  range?: number;
  strBonus: number;
  dexBonus: number;
  def: [number, number] | null;
  block: number | null;
  durability: number;
  indestructible: boolean;
  magicLvl: number;
  autoGroup: number | null;
  /**
   * ids of the `BasesBundle.automods` rows this base can roll: `group == autoGroup`, an itype among the ancestors and no
   * etype, class lock, and an affix level range reachable at some item level. One of them is picked per item. Omitted
   * when empty (no group, or a group with only invisible placeholder rows).
   */
  automods?: number[];
  /** itemtypes.txt `StaffMods` of the base's own `type` row: random +skill bonuses of this class; omitted when none */
  staffMods?: ClassCode;
  cls: ClassCode | null;
  inv: [number, number];
}

// Phase 2
export interface TxtRunewordsBundle {
  runewords: TxtRuneword[];
}

/** key = 'Runeword871' */
export interface TxtRuneword {
  key: string;
  name: string;
  rows: TxtRunewordRow[];
}

export interface TxtRunewordRow {
  /** Display names, jew/mjw removed and counted in `jewels` */
  ingredients: string[];
  codes: string[];
  jewels: number;
  sockets: number;
  itypes: string[];
  etypes: string[];
  /** Max ingredient levelreq */
  reqLvl: number;
  /** Runeword stats rendered from T1Code1-7 (incl. propertygroups pools); rune bonuses are not included */
  text: string[];
}

// Phase 3
export interface AffixesBundle {
  affixes: Affix[];
  /** Every item stat some affix writes (`Affix.stats`), by id; for the loot filter's affix browser */
  stats: AffixStat[];
}

/** An itemstatcost stat an affix writes. */
export interface AffixStat {
  /** itemstatcost `*ID` */
  id: number;
  /** itemstatcost `Stat` (what a loot filter stat check names) */
  name: string;
  /** Short label from `descstrpos` ("Enhanced Damage"); the stat name when there is no description */
  label: string;
}

export interface Affix {
  id: number;
  kind: 'p' | 's' | 'a';
  name: string;
  lvl: number;
  maxLvl: number;
  reqLvl: number;
  /** `classspecific`: only spawns on items of this class */
  cls: ClassCode | null;
  /** `class`: characters of this class need `clsReqLvl` instead of `reqLvl` */
  reqCls: ClassCode | null;
  clsReqLvl: number;
  freq: number;
  group: number;
  rare: boolean;
  itypes: string[];
  etypes: string[];
  mods: AffixMod[];
  /**
   * Distinct itemstatcost ids the mods write, ascending (enhanced damage = 17 and 18); ESR technical stats (tinkering,
   * jewel flag, `_display` companions) are left out. Empty for an affix that writes none (e.g. only `ethereal`).
   */
  stats: number[];
  /**
   * The params of the layered `stats` (skill tab, class, skill, event and charged stats; see engine/statLayers.ts),
   * by stat then param; omitted when none.
   */
  layers?: StatParam[];
  text: string[];
}

/** One param of a layered itemstatcost stat */
export interface StatParam {
  stat: number;
  param: number;
}

export interface AffixMod {
  prop: string;
  param: string | null;
  min: number;
  max: number;
}

export const CLASS_CODES: readonly ClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'war'];

export function isClassCode(value: string): value is ClassCode {
  return (CLASS_CODES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// sources.json: where an item comes from (qualitative labels derived from the game files)
// ---------------------------------------------------------------------------

/** Order of precedence when several labels apply: cube, boss, maps, drop, buy, gamble, plugin, unknown */
export type SourceKind = 'cube' | 'boss' | 'maps' | 'drop' | 'buy' | 'gamble' | 'plugin' | 'unknown';

export interface SourceLabel {
  kind: SourceKind;
  /** Player-facing text, e.g. "Cube: Ancient Coupon", "Drops from Diablo Clone", "Buy: Gheed" */
  text: string;
}

export interface ItemSource {
  /** Display name (unique/set item name, or the misc item's string name) */
  name: string;
  /** Base code (uniques/sets) or item code (misc) */
  code: string;
  item: 'unique' | 'set' | 'misc';
  labels: SourceLabel[];
}

export interface SourcesBundle {
  items: ItemSource[];
}

// ---------------------------------------------------------------------------
// lootfilter.json: reference data for the loot-filter editor (pickers + validator)
// ---------------------------------------------------------------------------

export interface LootFilterItem {
  code: string;
  /** Display name (namestr through the string table, else the `name` column) */
  name: string;
  kind: 'weapon' | 'armor' | 'misc';
  /** itemtypes.txt code of the `type` column */
  type: string;
  /** itemtypes.txt code of the `type2` column, when the row has one (the game treats the item as both types) */
  type2?: string;
  /**
   * Position in the weapons/armor tier family (`normcode`/`ubercode`/`ultracode`); only set when the three family codes
   * differ. Omitted for misc rows and for items without a tier family (rings, amulets, charms, jewels, arrows, ESR
   * mythical bases, quest rows), whose three family columns all hold the item's own code.
   */
  tier?: 'normal' | 'exceptional' | 'elite';
  /** `spawnable` = 1; non-spawnable rows are kept (uniques sit on non-spawnable "shadow" bases) */
  spawnable: boolean;
  /**
   * The item can drop: spawnable, or named by a treasureclassex.txt `Item*` cell (ESR drops non-spawnable rows a
   * treasure class names, e.g. the Ancient Scrolls `01b`…`50b`), or the base of a uniqueitems/setitems row a treasure
   * class names (Ore through "Uni Ore N"). False for items only a cube recipe makes or that nothing creates at all, and
   * for a spawnable rune without a gems.txt row (an unused row: `r48`).
   */
  drops: boolean;
}

/** A unique (uniqueitems.txt) or set item (setitems.txt) */
export interface LootFilterUniqueOrSet {
  /** 0-based data-row number as the game loads the table (what the plugin's uniqueOrSetIds match) */
  id: number;
  name: string;
  /** Base item code */
  code: string;
  /** `lvl req` (0 when blank) */
  reqLvl: number;
  /** Set items only: the set's display name (setitems.txt `set` through the string table) */
  set?: string;
  /** `disabled` = 1 (the game never creates the row); omitted otherwise */
  disabled?: true;
  /**
   * Uniques only: a coupon unique, the output of an enabled Ancient Coupon cube recipe that never rolls as a drop
   * (`rarity` 0); omitted otherwise. ESR 3.2.24: 382 rows (#699–1069 without Annihilus #1059, #1377–1388).
   */
  coupon?: true;
}

export interface LootFilterDataBundle {
  /** Every weapons/armor/misc row with a code, first row per code */
  items: LootFilterItem[];
  /**
   * Every itemstatcost.txt row: id = row number (= `*ID`), name = `Stat`; label = the affix browser's label
   * (affixes.json `stats[].label`, "Bonus to Strength %"), omitted when it would be the name
   */
  stats: { id: number; name: string; label?: string }[];
  /** Every levels.txt row with an `Id`; act is the 0-based `Act` column */
  areas: { id: number; name: string; act: number }[];
  /** sounds.txt `Sound` by row number (`sounds[row]`; row 0 is the blank "none" row) */
  sounds: string[];
  uniques: LootFilterUniqueOrSet[];
  sets: LootFilterUniqueOrSet[];
  /** Skills for the skill pickers: every class tree skill plus every skill a `knownLayers` param names, by id */
  skills?: LootFilterSkill[];
  /** Params the game data puts on items, per layered stat (skill, event and charged stats; see engine/statLayers.ts) */
  knownLayers?: LootFilterKnownLayers[];
  /**
   * skills.txt `skill` column by row (`skillNames[id]`, every row, '' for a blank one): the names a loot filter formula's
   * `stat('name', 'Skill')` takes. Unlike the display names of `skills` they are unique.
   */
  skillNames?: string[];
}

export interface LootFilterSkill {
  /** skills.txt row index (= `*Id`) */
  id: number;
  /** skilldesc `str name` through the strings, else the skills.txt `skill` column */
  name: string;
  /** Owning class; omitted for non-class skills */
  cls?: ClassCode;
}

export interface LootFilterKnownLayers {
  /** itemstatcost id */
  stat: number;
  /** Distinct params, ascending: the skill id (skill stats) or `skill << 6 | level` (event and charged stats) */
  layers: number[];
}

/** Item quality qualifiers of cubemain inputs (`weap,uni`), in display order */
export const ENHANCE_QUALITIES = ['uni', 'set', 'rar', 'crf', 'mag', 'hiq', 'nor', 'low'] as const;
export type EnhanceQuality = (typeof ENHANCE_QUALITIES)[number];

/** A cube output property as written in cubemain.txt */
export interface EnhanceMod {
  code: string;
  param: string | null;
  min: number;
  max: number;
  /** `mod N chance` when below 100 (the property is only added with that chance) */
  chance?: number;
}

/** Rendered properties of one outcome or recipe */
export interface EnhanceBonus {
  /** Visible properties (marker and dummy mods removed) */
  mods: EnhanceMod[];
  /** Rendered stat lines; a property with a chance below 100 % gets its own line ending in "(25% chance)" */
  lines: string[];
}

export interface EnhanceItemRef {
  code: string;
  name: string;
}

/** One corruption roll of a slot. Lists are shared by every quality of the slot except where `variants` say otherwise. */
export interface CorruptionOutcome extends EnhanceBonus {
  /** `CorruptionSlot.slot` */
  slot: string;
  /** 1-based position in the slot's roll range */
  roll: number;
  /** Qualities whose row at this roll has other values (e.g. Low/Normal/Superior body armor) */
  variants?: (EnhanceBonus & { qualities: EnhanceQuality[] })[];
}

export interface CorruptionBrickResult {
  quality: EnhanceQuality;
  /** Item type code of a more specific brick row (e.g. `ocha` Odd Charm); null for the slot itself */
  type: string | null;
  typeName: string | null;
  /** Readable output, e.g. "Rare item of the same type" or "Rare Grand Charm" */
  result: string;
}

export interface CorruptionSlot {
  /** URL id, e.g. `weapon`, `body`, `charm` */
  slot: string;
  /** cubemain input item type, e.g. `weap` */
  typeCode: string;
  label: string;
  /** Qualities with outcome rows for this slot (in ENHANCE_QUALITIES order) */
  qualities: EnhanceQuality[];
  /** Qualities that get the shard roll ("Add Corruption Dummy Stat") but have no outcome rows */
  rollOnlyQualities: EnhanceQuality[];
  /** Size of the dummy roll range (`corrupted_dummy` min..max) */
  rollRange: number;
  /** Number of outcome rolls (`corruptionOutcomes` of this slot) */
  outcomes: number;
  /** outcomes / rollRange, computed from the recipe rows */
  successRate: number;
  brick: { rolls: number; rate: number; results: CorruptionBrickResult[] };
}

/**
 * An equipment anointment pool. ESR 3.3 rolls one pool per item type (`axe`, `circ`, `zrin` …, 61 pools; ESR 3.2 had
 * one per equipment slot). Listed in cubemain order: the game takes the first pool whose type an item is (class types
 * before generic ones), so an item's pool is the first entry its type descends from.
 */
export interface AnointmentSlot {
  /** Pool id = the item type code */
  slot: string;
  typeCode: string;
  /** The item type's name ("Axe", "Circlet") */
  label: string;
  /** The equipment slot the type belongs to (`weapon`, `helm`, `shield`, `body`, `gloves`, `belt`, `boots`, `ring`, `amulet`) */
  group: string;
  rollRange: number;
  /** Roll range of socketed items ("… Socketed" dummy rows); null when the slot has none */
  socketedRollRange: number | null;
  /** The specialisation perk that allows a second anointment of this type (ESR 3.3 "Sanctimonious"); omitted: none */
  secondPerk?: { title: string; tree: string };
}

export interface AnointmentOutcome extends EnhanceBonus {
  /** An `AnointmentSlot.slot`, `charm` (unique charm) or `vessel` (Vessel of Souls) */
  pool: string;
  /** The row's dummy `value` (not the number in the description) */
  roll: number;
  /** The description suffix, e.g. "of Abyss" or "Sockets"; unique charm rows have none */
  label?: string;
}

/** One sanctification roll: the bonus of the outcome row the hidden roll picks (every roll equally likely) */
export interface SanctificationOutcome extends EnhanceBonus {
  /** The row's dummy `value` (1..rollRange) */
  roll: number;
}

/** A distinct sanctification bonus (property, param and range) and how many outcomes carry it */
export interface SanctificationBonus {
  /** The bonus rendered on its own, e.g. "+1% to Maximum Fire Resist" */
  line: string;
  outcomes: number;
}

export interface VesselMaterial {
  code: string;
  name: string;
  qty: number;
}

export interface VesselRecipe extends EnhanceBonus {
  tier: number;
  /** Every input but the Vessel itself */
  materials: VesselMaterial[];
  soulCost: number;
  /** From the recipe's `void` cap row (same materials, checks one of the recipe's stats) */
  maxTimes?: number;
  /** Rolls one of the Vessel anointments (`anointed_dummy` 1..N) */
  anointmentRolls?: number;
}

export interface VesselTier {
  tier: number;
  /** Souls when the tier starts / once it is used up */
  startSouls: number;
  endSouls: number;
}

export interface VesselTransform {
  materials: VesselMaterial[];
  output: EnhanceItemRef;
  /** `,mod` output: the weapon keeps the Vessel's bonuses */
  keepsMods: boolean;
}

/**
 * enhance.json: corruption, anointment, sanctification and Vessel of Souls outcomes from cubemain.txt. Flat top-level arrays so the
 * serializer writes one outcome / recipe per line.
 */
export interface EnhanceBundle {
  corruption: {
    reagent: EnhanceItemRef;
    /** Special rows derived from the data (repeatable corruption, items that cannot be corrupted, marker removal) */
    notes: string[];
  };
  corruptionSlots: CorruptionSlot[];
  corruptionOutcomes: CorruptionOutcome[];
  anointment: {
    reagent: EnhanceItemRef;
    /** Qualities blocked by `void` trap rows (Unique) */
    blockedQualities: EnhanceQuality[];
    /** Every equipment roll row requires `nru` (not a runeword) */
    noRunewords: boolean;
    /** Reagents of the unique charm anointment */
    charmReagents: EnhanceItemRef[];
    /** The item of the `vessel` pool (rolled by the Vessel tier 4 anointment recipe) */
    vesselItem: string;
  };
  anointmentSlots: AnointmentSlot[];
  anointmentOutcomes: AnointmentOutcome[];
  sanctification: {
    /** Lucion's Relic of Sanctification */
    reagent: EnhanceItemRef;
    /** The item type it works on without a perk (Jewel) */
    item: EnhanceItemRef;
    /**
     * Item types a specialisation perk lets you sanctify too, with the same outcomes (ESR 3.3: amulets and rings,
     * Jeweler perk "Hallowed Accessories"); omitted when none
     */
    perkItems?: { items: EnhanceItemRef[]; perk: { title: string; tree: string } };
    /** Size of the `sanctified-dummy` roll range; one outcome per roll */
    rollRange: number;
    /** A `void` "item + reagent" row blocks a second sanctification */
    once: boolean;
  };
  sanctificationOutcomes: SanctificationOutcome[];
  sanctificationBonuses: SanctificationBonus[];
  vessel: { item: string; startSouls: number };
  vesselTiers: VesselTier[];
  vesselRecipes: VesselRecipe[];
  vesselTransforms: VesselTransform[];
}

// --- cube.json ----------------------------------------------------------------------------------------------------

/** A group of families: a section of the official Cube Recipes page or another official page */
export interface CubeSection {
  id: string;
  label: string;
  /** Official docs page (file name on the ESR site), null when none covers it */
  doc: string | null;
  /** Anchor on that page */
  anchor: string | null;
  /** Short notes from the official page's footnotes for the section; omitted: none */
  notes?: string[];
  /** Guide note slugs that explain the section; omitted: none */
  guide?: string[];
}

export interface CubeFamilyInfo {
  /** Guide family id, a cube-only family id, or `other:<prefix>` for the fallback grouping */
  id: string;
  label: string;
  section: string;
  /** Display order (sections first, then definition order) */
  order: number;
  /** cubemain rows in the family */
  rowCount: number;
  /** True when `recipes` holds every row of the family (small families); false: only the merged `rows` */
  raw: boolean;
  /** Short notes: the official page's rules for the family and limits read from the rows (fail-safes); omitted: none */
  notes?: string[];
}

/** Recipes of one family that merge into the same rows (one recipe shape) */
export interface CubeGroup {
  /** Index in `groups` */
  id: number;
  family: string;
  /** The recipe shape: the first row's description with its numbers as `#` (a dev label), or "Secret Recipe N" */
  label: string;
  rowCount: number;
  /** Conditions every row of the group has ("Amazon only", "Hell only") */
  conditions: string[];
  /**
   * Unique and set item names the group's rows take, when the family has no `recipes` (the merged rows list only a few
   * of them), for the ingredient search; omitted otherwise
   */
  inputNames?: string[];
  /** The unique and set item names the group's rows give, as `inputNames`, for the result search */
  outputNames?: string[];
}

/** Output qualities of the Cube page's quality filter, in filter order */
export const CUBE_QUALITIES = ['unique', 'set', 'rare', 'magic', 'crafted'] as const;
export type CubeQuality = (typeof CUBE_QUALITIES)[number];

/** A merged recipe row (the guide's `::recipes` text, uncapped) and how many cubemain rows it stands for */
export interface CubeMergedRow {
  family: string;
  group: number;
  inputs: string[];
  output: string;
  variants: number;
  /**
   * The created item's level from the `lvl` / `plvl` / `ilvl` columns ("Item level 99", "Item level 60% of character
   * level"); variants with different levels are joined with " / "; omitted when no variant sets one
   */
  outputLevel?: string;
  /**
   * D-stoning family: what the row's D-stoning adds in total before its cap condition stops it, read like the bonus
   * ("+120% Increased Attack Speed"); one entry per distinct cap of the merged rows. Omitted when none has a cap
   */
  dstoneCaps?: string[];
  /** The Enhance tab listing every outcome behind this row (the sanctification pool); omitted otherwise */
  enhanceTab?: MaterialEnhanceTab;
  /**
   * Conditions of this row that its group does not show (all its cubemain rows share them; those only some have end
   * in "(some variants)"); omitted when none
   */
  conditions?: string[];
  /** Ingredients handed back unchanged ("Key", "Ancient Scroll 38"), options joined with " / "; omitted when none */
  returned?: string;
  /** Odds of a random pool read from its rolls ("50%: Ore Shards"), one line per band; omitted otherwise */
  odds?: string[];
  /** Qualities of the outputs (quality qualifiers and named unique / set items), for the quality filter */
  qualities: CubeQuality[];
}

export type CubeInputKind = 'item' | 'type' | 'unique' | 'any';

export interface CubeRecipeInput {
  text: string;
  /** Item code, item type code, unique/set name or `any` */
  code: string;
  qty: number;
  /** Qualifiers of the cell (`uni`, `nru`, `sock=2`, …) without `qty=` */
  quals: string[];
  kind: CubeInputKind;
}

export interface CubeRecipeOutput {
  text: string;
  /** Item code or unique/set name; null for `useitem` / `usetype` / `cloneitem` */
  code: string | null;
  /** Rendered bonus mods ("+5 to Life"), markers left out */
  bonus: string[];
  /** Qualities and notes ("Unique", "3 sockets", "socketed items come out", "item level 99", "to Cellar of Pain") */
  details: string[];
  /** The created item's level from the `lvl` / `plvl` / `ilvl` columns ("Item level 99"); omitted when unset */
  level?: string;
}

/** One cubemain row */
export interface CubeRecipe {
  /** Line number in cubemain.txt */
  id: number;
  family: string;
  group: number;
  /** The txt description (a dev label) */
  description: string;
  inputs: CubeRecipeInput[];
  outputs: CubeRecipeOutput[];
  /** Readable conditions: class only, minimum difficulty, a boss kill, the stat checks (forging, merc-only, …) */
  conditions: string[];
  /** Qualities of the outputs, for the quality filter (as CubeMergedRow) */
  qualities: CubeQuality[];
}

/** Enabled cubemain rows not listed, by reason */
export interface CubeHiddenCounts {
  /** Corruption, anointment and Vessel of Souls tier rows (the Enhance page) */
  enhance: number;
  /** `void` outputs and "Trap" blockers */
  traps: number;
  /** "OLD (Delete later)" rows */
  old: number;
  /** Stocker and can bookkeeping */
  stockers: number;
  /** "Add … Dummy Stat" roll rows no family lists */
  dummy: number;
}

export interface CubeBundle {
  sections: CubeSection[];
  families: CubeFamilyInfo[];
  groups: CubeGroup[];
  rows: CubeMergedRow[];
  recipes: CubeRecipe[];
  hidden: CubeHiddenCounts;
  /**
   * Item icons of the cells: the text of an ingredient or result without its count ("Heart", "Unique Ring",
   * "Assassin's Choker") → what it names, `i:<item code>` / `t:<item type code>` / `u:<unique name>` /
   * `s:<set item name>` (engine/cubeIcons.ts). Only the texts the rows and recipes show; a text that names different
   * things in different rows keeps the first (an item beats an item type). Omitted in older bundles.
   */
  icons?: Record<string, string>;
}

// --- materials.json -----------------------------------------------------------------------------------------------

/** A misc item group (the item type's topmost ancestor below `misc`) with its blocks (the type right below it) */
export interface MaterialGroup {
  code: string;
  label: string;
  blocks: { code: string; label: string }[];
}

/** A cube family that takes or gives an item, and how many of its listed cube.json rows do */
export interface MaterialFamilyUse {
  family: string;
  recipes: number;
}

export type MaterialEnhanceTab = 'corruption' | 'anointment' | 'sanctification' | 'vessel';

/** The item's role on the Enhance page (corruption reagent, anointment reagent, Vessel of Souls material) */
export interface MaterialEnhanceRole {
  tab: MaterialEnhanceTab;
  /** Anointment pool (`charm` for the unique charm reagents); omitted for the tab's default view */
  slot?: string;
  label: string;
}

export interface MaterialItem {
  /** Item code (the first variant's for a collapsed row) */
  code: string;
  name: string;
  group: string;
  block: string;
  /** Quality grade of a gem ladder (`type2` type name without the shared word: "Chipped", "Perfect") */
  grade?: string;
  level: number;
  levelreq: number;
  stackable: boolean;
  spawnable: boolean;
  /** Where it comes from (sources.json by code, else by name; computed for potions, scrolls, keys and tomes) */
  sources: SourceLabel[];
  /** Families that take the item (directly by code or through its misc item type); curated families first, then most recipes */
  usedIn: MaterialFamilyUse[];
  /** Families that give the item (rerolls and returned inputs left out); curated families first, then most recipes */
  madeBy: MaterialFamilyUse[];
  enhance?: MaterialEnhanceRole[];
  /** Number of misc.txt rows collapsed into this one (containers, same-named rows, coupon tiers) */
  variants?: number;
}

/**
 * materials.json: every misc item worth looking up (runes, gems, organs, Dragon Stones, coupons, potions …) with where
 * it comes from and which cube families and Enhance recipes use it. Guide notes are joined in the browser from
 * guide.json (`itemNotes`, `familyNotes`), since the guide build reads the game data.
 */
export interface MaterialsBundle {
  groups: MaterialGroup[];
  /** Labels of the cube families the items refer to, in cube.json display order */
  families: { id: string; label: string }[];
  items: MaterialItem[];
}

// --- sets.json ----------------------------------------------------------------------------------------------------

/** Bonus lines that need a number of the set's items worn */
export interface SetBonusGroup {
  /** Set items worn (2 = the bonus of the second piece) */
  pieces: number;
  lines: string[];
}

export interface SetItemInfo {
  /** Display name (strings table, setitems.txt `index` key) */
  name: string;
  /** Base item code */
  code: string;
  baseName: string;
  /** Item type name of the base (Staff, Belt, Amulet …) */
  category: string;
  level: number;
  reqLevel: number;
  /** The item's own properties (prop1..prop9) */
  lines: string[];
  /** Per-item bonuses (aprop1..5 a/b): group N needs N + 1 items of the set; empty groups left out */
  partial: SetBonusGroup[];
}

export interface SetInfo {
  /** sets.txt `index` (unique; hireling sets share the display name across difficulties) */
  id: string;
  name: string;
  /** sets.txt `UIClass`; null for a set any class can use */
  classCode: ClassCode | null;
  className: string | null;
  /** Range of the items' required levels */
  reqLevel: { min: number; max: number };
  /** setitems.txt order */
  items: SetItemInfo[];
  /** Set-wide partial bonuses (PCode2..5 a/b, a and b merged); empty groups left out */
  partial: SetBonusGroup[];
  /** Full-set bonuses (FCode1..8) */
  full: string[];
}

/** sets.json: every set (sets.txt) with its items (setitems.txt) and rendered bonuses; `_old` and itemless sets left out */
export interface SetsBundle {
  sets: SetInfo[];
}

// --- skills.json --------------------------------------------------------------------------------------------------

export interface SkillInfo {
  /** skills.txt `skill` column: the stable id, also what reqSkills reference */
  id: string;
  /** skilldesc.txt `str name` (strings table); the id when unresolved */
  name: string;
  /** skilldesc.txt `SkillRow` (1..6) and `SkillColumn` (1..3) of the skill tree */
  row: number;
  col: number;
  reqLevel: number;
  maxLevel: number;
  /** skills.txt reqskill1..3 (skill ids of the same class), empty entries dropped */
  reqSkills: string[];
}

export interface SkillTab {
  /** skilldesc.txt `SkillPage` (1..3), the charstats.txt StrSkillTab{page} tab */
  page: number;
  /** Tab name without "+%d to " and " Skills" ("Demon", "Curses") */
  name: string;
  /** Sorted by row, then column */
  skills: SkillInfo[];
}

export interface SkillClassTree {
  code: ClassCode;
  name: string;
  /** Pages 1..3 */
  tabs: SkillTab[];
}

/** skills.json: the class skill trees (skills.txt + skilldesc.txt), classes in types.json order */
export interface SkillsBundle {
  /** experience.txt `MaxLvl` row (the character level cap) */
  maxLevel: number;
  classes: SkillClassTree[];
}

// --- skilldetails.json --------------------------------------------------------------------------------------------

/**
 * How an item grants a skill: the uniqueitems / setitems / runes.txt property code. `skill` = +levels to a class skill
 * (class only), `oskill` = usable skill for any class, `aura` = aura when equipped, `charged` = charges, the rest = a
 * chance to cast on hit / attack / getting hit / kill / death / level up / cast / taking damage.
 */
export type SkillGrantHow =
  | 'skill'
  | 'oskill'
  | 'aura'
  | 'charged'
  | 'hit-skill'
  | 'att-skill'
  | 'gethit-skill'
  | 'kill-skill'
  | 'death-skill'
  | 'levelup-skill'
  | 'cast-skill'
  | 'takedmg-skill';

/** What page an item lives on: uniques (Uniques or Mythicals page), set items (Sets), runewords, gemwords */
export type SkillGrantItemKind = 'unique' | 'set' | 'runeword' | 'gemword';

export interface SkillGrantItem {
  kind: SkillGrantItemKind;
  /** Display name (string table); same-name rows (variants of one unique) share one entry */
  name: string;
}

export interface SkillGrant {
  /** Index into SkillDetailsBundle.items */
  item: number;
  how: SkillGrantHow;
  /** Skill level, or the [min, max] range of a rolled level */
  level: number | [number, number];
  /** Event skills (`*-skill` except `skill` / `oskill`): % chance to cast */
  chance?: number;
  /** `charged`: number of charges */
  charges?: number;
  /** Set items: a partial bonus (aprop*) that needs more pieces of the set worn */
  partial?: true;
}

export interface SkillSynergy {
  /** Display name of the synergy skill (dsc3textb) */
  name: string;
  /**
   * skills.txt id of that skill when the name resolves (same class first) and differs from `name`. The skill to link
   * is `id ?? name`, when the bundle has it ("Any Other Curse" has no skill).
   */
  id?: string;
  /** The bonus line without the skill name ("+12% Fire Damage per Level"); `?` where the value is a formula */
  text?: string;
}

export interface SkillDetail {
  /** skills.txt `skill`, the same id as skills.json */
  id: string;
  name: string;
  /** Class code; null for an item skill (no charclass) */
  cls: ClassCode | null;
  /** Skill tab (skilldesc SkillPage 1..3) for class skills, null for item skills */
  page: number | null;
  reqLevel: number;
  maxLevel: number;
  /** skills.txt reqskill1..3 (skill ids), omitted when none */
  reqSkills?: string[];
  /** skills.txt `aura` / `passive` flags */
  type?: 'aura' | 'passive';
  /** skills.txt EType as a label ("Fire", "Lightning"); omitted when none */
  element?: string;
  /** Mana cost at level 1 and per extra level ((mana | lvlmana) × 2^manashift / 256), omitted when both are 0 */
  mana?: [number, number];
  /** skilldesc `str long` (strings), one entry per line */
  description: string[];
  /** Description lines whose values are constants or skill params (formula lines are left out) */
  lines?: string[];
  /** dsc3 "Receives Bonuses From" lines */
  synergies?: SkillSynergy[];
  /** Other dsc3 text lines (special synergy rules) */
  notes?: string[];
  /** Icon key: `<class prefix>-<cel>` (e.g. `so-0`) or `gen-<cel>` for item skills; file icons/skills/<icon>.webp */
  icon?: string;
  /** Uniques, set items and runewords granting the skill; omitted when none */
  grantedBy?: SkillGrant[];
  /** ESR's skill information page (docs/skill_information.htm, Oskills table): the hand-written description */
  infoPage?: SkillInfoText;
  /** ESR's skill information page, Mercenaries table: the hirelings that use the skill */
  mercenaries?: SkillMercenary[];
}

/** An Oskills entry of ESR's skill information page */
export interface SkillInfoText {
  /** The entry's Skill cell as written; may name several skills ("Fire/Cold/Lightning Damage Aura") */
  heading: string;
  /** The Description cell: paragraphs, HTML stripped, whitespace normalised */
  text: string[];
}

/** A mercenary that uses a skill (ESR's skill information page) */
export interface SkillMercenary {
  /** "Desert Mercenary" */
  hireling: string;
  /** "Comb - Nightmare" (as written on the page) */
  subtype: string;
}

/** skilldetails.json: details of every class skill and of every described item skill some item grants */
export interface SkillDetailsBundle {
  /** Items referenced by SkillGrant.item, sorted by kind and name */
  items: SkillGrantItem[];
  /** Class skills (class order, tab, row, column), then item skills by name */
  skills: SkillDetail[];
}

// --- masteries.json -----------------------------------------------------------------------------------------------

/**
 * masteries.json: ESR's weapon mastery specialisations. The cubemain rows that set the `weaponmastery` stat (one value
 * per specialisation) give the bases, token and ingredients; the awakened token's description string gives the effects.
 * The Bases page shows them on the class weapons, the Skills page on the affected skills.
 */
export interface MasteriesBundle {
  /** The unawakened Weapon Mastery Token (misc code) */
  token: string;
  /** Display names of the tokens and ingredients by item code */
  names: Record<string, string>;
  /** Display names of the skills the effects name, by skill id */
  skillNames: Record<string, string>;
  /** In cubemain order */
  masteries: WeaponMastery[];
  /**
   * The specialisation perk with which any weapon takes any specialisation (ESR 3.3: "True Master", Blacksmith; the
   * "True Master - Apply …" rows); omitted when the rows have none
   */
  anyWeaponPerk?: { title: string; tree: string };
}

export interface WeaponMastery {
  /** The cube property the apply rows set (`weapon-mastery-stag-bow`): one per specialisation */
  property: string;
  /** The weapon as the cube rows name it ("Stag Bow", "Orb", "Void Blade") */
  label: string;
  cls: ClassCode;
  /** The item type when the rows take any item of a type (orb, claw, wswd); omitted for a base family */
  type?: string;
  /** Every base the apply rows take, in bases.json order */
  bases: string[];
  /** The awakened token (misc code) the apply rows take */
  token: string;
  /** Apply: the inputs after the weapon and the token, in cube order */
  inputs: MasteryInput[];
  /** Remove: the inputs after the weapon (the token is lost) */
  remove: MasteryInput[];
  /** Bases the rows can apply the mastery to but no remove row takes (an ESR data slip); omitted when none */
  noRemove?: string[];
  /** Bases the rows can apply the mastery to but no awaken row takes (no token for them; a data slip); omitted when none */
  noAwaken?: string[];
  /** The token description's effect blocks, in display order */
  effects: MasteryEffect[];
  /**
   * Other mods the apply rows add, rendered ("+20% Total Spell Damage"); a mod without item text (no descfunc) as a
   * written-out line ("-100% Magic Resist (no item line; …)") and a `masteries:` warning. Omitted when none
   */
  mods?: string[];
}

export interface MasteryInput {
  code: string;
  /** Omitted when 1 */
  qty?: number;
}

export interface MasteryEffect {
  /** The skills line as the token names it ("Strafe", "Curses", "Poison, Immolation, Freezing, Lightning Arrow") */
  heading: string;
  /** Affected class skills (skill ids), in skill tree order; empty when none could be resolved */
  skills: string[];
  /** The effect, one sentence group per entry */
  text: string[];
}

// --- skillcalc.json -----------------------------------------------------------------------------------------------

/**
 * A skills.txt or missiles.txt row reduced to the columns the shown lines' formulas can read (every branch, every
 * referenced row): numeric columns as numbers, formula columns (`calc1`, `aurastatcalc1`, `EDmgSymPerCalc`, …) as their
 * text, skilldesc `descmissile1..3` as missile names. Blank and zero cells are left out. `id` = the `skill` / `Missile`
 * column. Evaluated by `engine/skillCalc`.
 */
export interface SkillCalcRow {
  id: string;
  [column: string]: string | number | undefined;
}

/** One tooltip line of a skill: a skilldesc descline / dsc2line / dsc3line entry with its texts resolved */
export interface SkillCalcLine {
  /** `desc1`..`desc6` (the per-level block), `dsc2-1`..`dsc2-5` (fixed lines), `dsc3-1`..`dsc3-7` (synergy block) */
  key: string;
  /** skilldesc line function (74, 75, 36, 76, 40, 18, …) */
  type: number;
  /** texta / textb through the strings, as indexes into SkillCalcBundle.texts */
  a?: number;
  b?: number;
  /** calca / calcb formulas */
  ca?: string;
  cb?: string;
  /** The value changes with the character level (`ulvl`) */
  ulvl?: true;
  /** The value changes with the skill's own hard points at a fixed skill level (`blvl`): +skills do not raise that part */
  blvl?: true;
}

export interface SkillCalcSkill {
  /** skills.txt id (the skilldetails.json id) */
  id: string;
  /** Hard-point cap: skills.txt maxlvl for class skills, 0 for item skills (items grant levels, never hard points) */
  maxHardPoints: number;
  /** The lines that can be shown, in skilldesc order (desc, then dsc2, then dsc3); hidden lines are left out */
  lines: SkillCalcLine[];
  /** skills.txt ids of the synergies the dsc3 "Receives Bonuses From" lines name (inputs for hard points) */
  synergies?: string[];
  /**
   * skills.txt ids of other skills of the same class tree whose points the shown lines read (`skill('X'.blvl)`, often
   * through another row such as Attack's calc1) without the tooltip listing them; ascendancy / item passives and
   * `*Control` rows excluded. Inputs for hard points after the listed ones.
   */
  unlistedSynergies?: string[];
  /** Some line scales with the character level */
  scalesWithCharLevel?: true;
  /** Some line scales with the skill's own hard points (not with +skills) */
  scalesWithHardPointsOnly?: true;
  /** Lines left out because their value depends on character stats (strength, life, …) */
  hiddenStatLines?: number;
  /** Lines left out for any other reason (engine-computed, unsupported formula, always 0, …) */
  hiddenOtherLines?: number;
  /** skills.txt ItemEffect: the server function used when an item event (chance to cast) triggers the skill */
  itemEffect?: number;
}

/** skillcalc.json: what the skill-level calculator needs to evaluate every skilldetails.json skill's tooltip lines */
export interface SkillCalcBundle {
  /** One per skilldetails.json skill, same order */
  skills: SkillCalcSkill[];
  /** skills.txt rows the formulas read (the skills themselves, their synergies, `skill('X'.clc3)` targets, …) */
  rows: SkillCalcRow[];
  /** missiles.txt rows the formulas read (`miss('m'.rang)`, skilldesc descmissile) */
  missiles: SkillCalcRow[];
  /** The line texts (format strings and names), each once */
  texts: string[];
}

// --- crafting.json ------------------------------------------------------------------------------------------------

/** Equipment slot families of the builds feature (ring1/ring2 → ring, weapon swap → weapon/shield) */
export type CraftingSlot = 'weapon' | 'shield' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring';
export const CRAFTING_SLOTS: readonly CraftingSlot[] = ['weapon', 'shield', 'helmet', 'armor', 'gloves', 'boots', 'belt', 'amulet', 'ring'];

export type ForgingKind = 'skill' | 'all' | 'stat' | 'rune' | 'aura';

export interface ForgingOption {
  kind: ForgingKind;
  /** skill: class code; all: 'all'; stat: chipped gem item code; rune: rune item code; aura: aura stone item code */
  key: string;
  /** What the author picks: class name, "All skills", chipped gem name, rune name, aura stone name */
  label: string;
  /** Rendered bonus lines per slot family; a slot with no row is omitted (the forging cannot go on it) */
  bySlot: Partial<Record<CraftingSlot, string[]>>;
}

export interface StackingCraftStep {
  /** Rendered lines of the first (largest) step, cap/marker mods removed, e.g. ["+5% Increased Attack Speed"] */
  lines: string[];
  /** dstone: the per-use amounts in row order as the cap stat grows, e.g. [5,4,3,2,1]; omitted for meld */
  steps?: number[];
  /**
   * dstone: the most D-stoning adds to the bonus (its first stat), counting only what D-stoning added: the rows applied
   * from zero until no cap condition holds (e.g. 120 for Dragon Stone on a weapon). Omitted for meld and for a D-stoning
   * whose rows have no cap condition (Forging Hammer on a weapon)
   */
  cap?: number;
  /** dstone: `lines` at the cap, e.g. ["+120% Increased Attack Speed"]; present with `cap` */
  capLines?: string[];
  /** Added level requirement per use (`levelreq` mod) */
  levelReq: number;
}

export interface StackingCraftOption {
  kind: 'dstone' | 'meld';
  /** Dragon Stone form (dstone) or perfect gem (meld) */
  material: { code: string; label: string };
  /** dstone only: the extra switch ingredient some rows need (Key, Antidote Potion, ...) */
  switchItem?: { code: string; label: string };
  bySlot: Partial<Record<CraftingSlot, StackingCraftStep>>;
}

/** crafting.json: the forgings, D-stoning and gem melding an equipped item can be annotated with (cubemain.txt) */
export interface CraftingBundle {
  forgings: ForgingOption[];
  stacking: StackingCraftOption[];
}

// --- tiers.json ---------------------------------------------------------------------------------------------------

/**
 * tiers.json: the base tier of every weapons.txt / armor.txt row that has one, spawnable or not, for the tier badges
 * and filter of the unique and set item pages (their bases are often non-spawnable rows bases.json leaves out). Rows
 * without a tier (misc.txt, arrows, bolts, quest items) have no entry.
 */
export interface TiersBundle {
  /** By base code, in weapons.txt then armor.txt row order */
  codes: Record<string, BaseItem['tier']>;
}

/**
 * icons.json: the item icons extracted from the HD item sprites the ESR clone ships, with the vanilla D2R art as the
 * fallback source (scripts/generate-item-icons.ts). Written by its own generator; generate-game-data.ts only lists it
 * in the manifest.
 */
export interface IconsBundle {
  esrVersion: string;
  esrTag: string | null;
  /** The vanilla art folder the icons the clone lacks came from; absent when none did */
  vanilla?: IconsVanillaSource;
  /** By base code; codes whose art is in neither source have no entry */
  bases: Record<string, ItemIconInfo>;
  /**
   * By unique display name (lootfilter.json `uniques[].name`, mythical uniques included): the item's own HD art, else
   * its base's. Names without either have no entry.
   */
  uniques: Record<string, ItemIconInfo>;
  /** By set item display name (sets.json `items[].name`), own art else the base's */
  sets: Record<string, ItemIconInfo>;
  /**
   * Misc items in the icon scope (the socket fillers: gems, runes, crystals) by display name (lootfilter.json
   * `items[].name`); a name whose rows have different art (ESR's and the LoD Ko Rune) is keyed `name#code` per row.
   */
  misc: Record<string, ItemIconInfo>;
  /**
   * Quest items by item code (misc / weapons / armor.txt rows with a `quest` number or typed `ques` / `mmap`: the
   * campaign quest items, portal keys, organs, essences and endgame map items). Codes without art have no entry.
   */
  quest: Record<string, QuestIconInfo>;
  /**
   * Every other item by item code (codes `bases` or `quest` key are left out): the misc.txt items (organs, cube
   * materials, potions, scrolls, coupons, stockers, gems and runes again) and the weapons / armor.txt rows bases.json
   * leaves out (ESR's non-spawnable shadow bases and mythical weapons). A "(6 Pack)" row without art of its own has the
   * single item's (`6hrt` → Heart). Codes without art have no entry.
   */
  items: Record<string, ItemIconInfo>;
  /**
   * By item type code: the art every spawnable item of the type shares (`mcha` Large Charm, `jewl` Jewel), else a
   * curated representative item's (`ring` → Ring, `gem5` → Perfect Diamond; build/itemIcons.ts
   * `TYPE_ICON_REPRESENTATIVES`). Broad equipment types (Weapon, Any Armor …) have none.
   */
  types: Record<string, ItemIconInfo>;
}

/** A `quest` entry: the icon and the item's display name (as stashnames.json `bases` names it: `vip` "Top of the Horadric Staff") */
export interface QuestIconInfo extends ItemIconInfo {
  name: string;
}

export interface IconsVanillaSource {
  /** `root` of the install's steam-build.config (identifies the game build; there is no readable version number) */
  rootHash: string;
  /** Extraction date (YYYY-MM-DD, the steam-build.config modification date) */
  extractedAt: string;
  /** The icon files made from vanilla sprites (sorted); `--check` without the folder accepts these unverified */
  files: string[];
}

export interface ItemIconInfo {
  /** File name under public/game-data/icons/ (one per distinct HD asset, shared by every entry using it, whichever source) */
  file: string;
  /** Pixel size of the image (cropped to its opaque pixels, fit inside 128×128) */
  w: number;
  h: number;
  /**
   * Unique / set items only: the inventory colour transform baked into `file` (the base row's `InvTrans` colour-map
   * file without `.dat` and the item row's `invtransform` colour code), approximating the game's palette recolour
   */
  tint?: { map: string; color: string };
}

// --- areas.json ---------------------------------------------------------------------------------------------------

/**
 * areas.json: the areas of levels.txt (towns, act areas, endgame map zones) with their monster level, density and
 * unique pack counts per difficulty, waypoint and connections. The map entrances ("Prep Zone" rows), the null row 0
 * and the Expansion marker are left out.
 */
export interface AreasBundle {
  /** In levels.txt row order */
  areas: Area[];
  /** The endgame map bosses with their Hell rewards, in the order of their arenas (see MapBoss) */
  mapBosses: MapBoss[];
}

/**
 * An endgame map boss (a monstats row named by a boss arena's `*Map Boss` comment) and what its Hell treasure class
 * gives. Chances are worked out from treasureclassex.txt (`build/treasureClassOdds.ts`).
 */
export interface MapBoss {
  /** monstats `Id` */
  id: string;
  /** In-game name (`NameStr` through the string table) */
  name: string;
  /** levels.txt ids of the arenas it fights in (its own, plus a shared arena such as Chaos Rift's) */
  arenas: number[];
  /** The map tier of its own arena */
  tier: number;
  /** `TreasureClass(H)` */
  treasureClass: string;
  /** Map bosses of another zone with the same `TreasureClass(H)` (monstats ids): this boss drops their rewards */
  sameTableAs?: string[];
  rewards: MapBossReward[];
  /** Rolls of the generic loot table (gold, gear, jewellery, runes, gems, crafting materials) */
  otherRolls: number;
  /** Worldstone Shards a terrorized kill adds (`TreasureClassDesecrated(H)`); null when that column is blank */
  terrorShards: number | null;
  /** Rewards (`MapBossReward.label`) the terrorized table leaves out */
  terrorMissing?: string[];
  /** Launcher plugin set drop (boss-set-unique-drop): the unique the last of these monsters to die drops */
  setDrop?: { unique: string; with: string[] };
}

export type MapBossRewardKind = 'orb' | 'map' | 'key' | 'token' | 'soulstone' | 'item';

export interface MapBossReward {
  kind: MapBossRewardKind;
  /** Item name ("Orb of Anointment", "Frostmourne"); maps: "Tier 3 map"; keys: "Pandemonium key" */
  label: string;
  /** Chance of at least one, 0–1 (4 decimals), at players 1 and players 8 */
  chance: [number, number];
  /** Expected count at players 1, only when a drop can be more than one item (a whole key set: 3 × its chance) */
  expected?: number;
  /** Map rewards: the tiers the map can be */
  tiers?: number[];
  /** `ConditionCalc` of the roll (the Primordial Soulstone stops at ten) */
  condition?: string;
}

/** Normal, Nightmare, Hell */
export type PerDifficulty<T> = [T, T, T];

export interface Area {
  /** levels.txt `Id` */
  id: number;
  /** `LevelName` through the string table, else `Name` without its "Act N - " prefix */
  name: string;
  /** 0-based act (maps are act 4) */
  act: number;
  /** Map zone (`LevelGroup` without its "Tier N Map - " prefix; the unique map's `Name` without "Unique Map - ") */
  group?: string;
  /** Endgame map tier, from the "Tier N Map - " prefix */
  tier?: number;
  /** The unique map (Goblin Realm): a map without a tier */
  uniqueMap?: true;
  /** `*Map Boss`: the boss of a map boss arena */
  boss?: string;
  waypoint: boolean;
  /** Expansion monster level (`MonLvlEx`, `MonLvlEx(N)`, `MonLvlEx(H)`); null in towns and areas without any monster */
  level: PerDifficulty<number> | null;
  /** Monster density (`MonDen*`); null when 0 in every difficulty */
  density: PerDifficulty<number> | null;
  /** Unique / champion packs [min, max] (`MonUMin*` / `MonUMax*`); null when 0 in every difficulty */
  uniques: PerDifficulty<[number, number]> | null;
  /** Ids of the listed areas this one connects to (`Vis0`–`Vis7`, deduplicated, hidden rows and itself left out) */
  connections: number[];
  /** `PreventTownPortal` */
  preventTownPortal?: true;
  /** Kind of area, from `LevelType` (vanilla lvltypes ids) split by the `*IsInside` comment column */
  terrain: AreaTerrain;
  /** `Teleport`: 0 → 'off' (no teleport at all), 2 → 'restricted'; the default 1 is left out */
  teleport?: 'off' | 'restricted';
  /** `QuestFlagEx` (else `QuestFlag`): the quest that must be done before the area can be entered; labelled in the UI */
  questGate?: number;
  /** Item code of the endgame map item whose cube portal (cubemain `Red Portal,lvl=`) leads into this map's entry level */
  mapItem?: string;
  /** In-game name of `mapItem` */
  mapItemName?: string;
  /** Boss arenas: the map bosses fighting here (MapBoss ids); Chaos Rift lists every boss that may come */
  mapBosses?: string[];
  /** Only this many of `mapBosses` come (the `*Map Boss` comment "Double T1 Bosses") */
  mapBossPick?: number;
  /** The level name ends in ESR's " (Endgame Zone)" (an ESR special zone; the suffix stays in `name`) */
  endgameZone?: true;
}

export type AreaTerrain = 'town' | 'outdoor' | 'tower' | 'cave' | 'tomb' | 'dungeon' | 'temple' | 'special';

// --- stash.json ---------------------------------------------------------------------------------------------------

/** Bits of `StashItemInfo[1]`: what the save parser needs to know about an item code to walk its bits */
export const STASH_ITEM_FLAGS = {
  /** Descends from `armo`: defense + durability follow the realm data */
  armor: 1,
  /** Descends from `weap`: durability follows the realm data */
  weapon: 2,
  /** Descends from `gold` */
  gold: 4,
  /** Descends from `char`: a normal-quality charm stores one affix */
  charm: 8,
  /** Descends from `body` but not `play`: a normal-quality monster part stores its monster row */
  bodyPart: 16,
  /** Descends from `scro` or `book`: a normal-quality scroll or tome stores its spell */
  scrollOrBook: 32,
  /** `quest` and `questdiffcheck`: a compact quest item stores the difficulty it was found in */
  questDifficulty: 64,
} as const;

/** [code, STASH_ITEM_FLAGS bits, invwidth, invheight] (weapons.txt, armor.txt, misc.txt; the first row of a code wins) */
export type StashItemInfo = [string, number, number, number];

/** [Save Bits, Save Add, 1 when Save Param Bits > 0 else 0] */
export type StashStatInfo = [number, number, number];

export interface StashCoupon {
  code: string;
  /** String-table name ("Ancient Coupon (Buckler, Pelta Lunata)") */
  name: string;
  /** misc.txt `type` (cpn1, cpn2, cpn3; coup for the Wild Card) */
  type: string;
  /** The Coupon Wild Card (99j): a joker, not an Ancient Coupon */
  wildCard?: true;
  /** The coupon unique its cube recipe makes; absent for the Wild Card and the blank coupons (no recipe) */
  unique?: StashCouponUnique;
  /** The unique's base item (uniqueitems.txt `code`); set with `unique` when the code is a known item */
  base?: StashCouponBase;
  /** Coupons of this code the recipe takes ("01c,qty=3" → 3); set with `unique` */
  qty?: number;
  /** The alternative recipe: fewer coupons of this code plus Coupon Wild Cards ("02c,qty=2" + "99j,qty=2") */
  withWildCards?: {
    qty: number;
    wildCards: number;
    /** The row's `numinputs` differs from its item count (ESR 3.2.24: 06j), so the recipe likely does not work */
    suspect?: true;
  };
}

export interface StashCouponUnique {
  /** uniqueitems.txt row (the id a unique item stores in a save) */
  id: number;
  /** String-table display name of the cube output's uniqueitems.txt `index` ("War Bonnet" → "Biggin's Bonnet") */
  name: string;
}

export interface StashCouponBase {
  /** Item code ("vbl") */
  code: string;
  /** String-table name ("Light Belt") */
  name: string;
  /** Item type code (`type` column, "belt"); its names and ancestors are in types.json */
  type: string;
}

/** A coupon tier: the misc.txt item type of its coupons (itemtypes.txt "Coupon norm" …) */
export interface StashCouponTier {
  /** Item type code (cpn1, cpn2, cpn3) */
  type: string;
  /** itemtypes.txt name ("Coupon norm"), the label when `tier` is null */
  name: string;
  /**
   * The base tier of the uniques this type's coupons make (weapons.txt / armor.txt tier families, as in tiers.json): the
   * most common one, null when none of the bases has a tier (rings, amulets)
   */
  tier: 'normal' | 'exceptional' | 'elite' | null;
  /** Coupons of this tier (any codes) the cube turns into one Wild Card; null when no recipe does */
  wildCardFrom: number | null;
}

/** What the stash pages show for an item code (weapons.txt, armor.txt, misc.txt; the first row of a code wins) */
export interface StashBaseInfo {
  code: string;
  /** String-table name ("Light Belt") */
  name: string;
  /** Item type code (`type`); its names and ancestors are in types.json */
  type: string;
  /** `type2`, when set */
  type2?: string;
  /** The tiers.json base tier of a weapons.txt / armor.txt row (gearTier); absent for misc items and tierless gear */
  tier?: BaseItem['tier'];
}

/** A uniqueitems.txt row with a base code, by the row number a unique item stores in a save */
export interface StashUniqueInfo {
  /** uniqueitems.txt row (Expansion marker rows counted, like the game) */
  id: number;
  /** String-table display name of `index`; see `unnamed` */
  name: string;
  /** Base item code */
  code: string;
  /**
   * The Ancient Coupon whose cube recipe makes this row (coupon uniques drop only from coupons). Only the first row
   * of an `index` (what a cube output resolves to) carries it.
   */
  coupon?: string;
  /**
   * The string table has no name for `index`: `name` is the coupon's unique name when a coupon makes the row
   * ("Azurewrath" for `Azurewrath_old`), else the raw index
   */
  unnamed?: true;
}

/** A setitems.txt row with a base code, by the row number a set item stores in a save */
export interface StashSetItemInfo {
  /** setitems.txt row (Expansion marker rows counted, like the game) */
  id: number;
  name: string;
  /** Base item code (`item`) */
  code: string;
  /** sets.txt `index` of its set (sets.json `SetInfo.id`; may name a set sets.txt lacks, e.g. an `_old` one) */
  set: string;
}

/** A sets.txt row */
export interface StashSetInfo {
  /** `index` (sets.json `SetInfo.id`) */
  id: string;
  name: string;
}

/** A runes.txt `Name` key: what an item's runeword field stores (the key's string-table id) */
export interface StashRunewordInfo {
  /** The numeric string-table `id` of the key (63086 = Runeword584 "Cow"); the value of the item's runeword field */
  id: number;
  /** runes.txt `Name` ("Runeword584", "Holy"); runewords.json `TxtRuneword.key` for the runewords */
  key: string;
  /** String-table text of the key ("Cow"), the key itself without one */
  name: string;
  /** A charm gemword (a runes.txt key not named `Runeword…`, e.g. "Holy", "Rainbow"); not in runewords.json */
  gemword?: true;
}

/**
 * stash.json: the game data the shared stash (.d2i) parser needs to walk the item bits (src/features/stash/parser):
 * stat widths, per-code item kinds and sizes, the stash page grid, and the Ancient Coupons with the uniques their cube
 * recipes make (the My Stash coupons page). Loaded by every My Stash page; the names are in stashnames.json.
 */
export interface StashBundle {
  /** Shared stash page grid (inventory.txt "Big Bank Page 1") */
  /** Not read by the pages yet: kept (with the item sizes) for a future stash grid view */
  grid: { width: number; height: number };
  /** By itemstatcost.txt row (the stat id); null when Save Bits is 0 (never saved on items) */
  stats: (StashStatInfo | null)[];
  items: StashItemInfo[];
  /** misc.txt rows named "Coupon …": the Ancient Coupons, plus the Wild Card, with their cube recipes */
  coupons: StashCoupon[];
  /** The coupon item types, by code */
  couponTiers: StashCouponTier[];
  /** The runeword field values of the charm gemwords (stashnames.json `runewords` with `gemword`), for the counts */
  gemwords: number[];
}

/**
 * stashnames.json: for the All items page (lazy, loaded by that page only), the names, types and tiers of every item
 * code, and the unique, set item and runeword names by the ids a save stores.
 */
export interface StashNamesBundle {
  /** Every code of stash.json `items`, in the same order */
  bases: StashBaseInfo[];
  /** By id ascending; rows without a base code left out */
  uniques: StashUniqueInfo[];
  /** By id ascending; rows without a base code left out */
  setItems: StashSetItemInfo[];
  /** sets.txt order */
  sets: StashSetInfo[];
  /** One entry per runes.txt `Name` key, by id ascending; keys without a string-table id left out (warned about) */
  runewords: StashRunewordInfo[];
}

// --- itemtext.json ------------------------------------------------------------------------------------------------
// Read only by src/features/stash/engine/items/itemText.ts (renderItemText, statValues, the name tables); pages use
// those functions, never these fields.

/**
 * A stat's display columns (itemstatcost.txt), by stat id: what engine/stats/descfunc.ts and renderLines.ts read
 * (`StatDef`), with the blank / zero columns left out, and `descstrneg` / `dgrpstrneg` left out when they equal the
 * positive string. ValShift is not needed: a save stores the unshifted value (+52 life is saved as 52).
 */
export type ItemTextStatDef = Pick<StatDef, 'stat'> & Partial<Omit<StatDef, 'stat'>>;

/**
 * itemtext.json: what the All items page needs to write an item's tooltip text and name from its saved stats. Loaded
 * lazily, only on /stash/items (build/bundleItemText.ts).
 */
export interface ItemTextBundle {
  /**
   * By stat id (itemstatcost.txt row, Expansion rows counted): the stats a save can hold (Save Bits > 0), null for the
   * others. A stat with descfunc 0 is hidden (its line, if any, comes from a dgrp or a `_display` companion).
   */
  stats: (ItemTextStatDef | null)[];
  /** The string-table texts the stat descriptions and renderLines read, by key (colour codes stripped) */
  strings: Record<string, string>;
  /**
   * The skills a saved stat can name (class skills and every skill a game-data property names), by id ascending:
   * skills.txt row (the skill id a stat param stores), display name, owning class (charstats row; absent for others)
   */
  skills: { id: number; name: string; cls?: number }[];
  /** charstats.txt rows in order (0 Amazon … 7 Warlock): the class name and its skill strings */
  classes: ClassText[];
  /**
   * monstats.txt `NameStr` texts by monster id (the row without the Expansion row, = `hcIdx`), only for the ids a
   * descfunc 23 property names (ESR's mythical descriptions, reanimate); null for the others
   */
  monsters: (string | null)[];
  /** montype.txt `strplur` texts by row (descfunc 22) */
  monTypes: (string | null)[];
  /** Names by the 1-based ids a save stores (index 0 null): magicprefix.txt, magicsuffix.txt, automagic.txt */
  magicPrefixes: (string | null)[];
  magicSuffixes: (string | null)[];
  autoAffixes: (string | null)[];
  /**
   * The combined vanilla rare name table by id (index 0 null): raresuffix.txt (1–155), then rareprefix.txt (156–201).
   * ESR ships neither table; the keys are a generator constant, the texts ESR's.
   */
  rareNames: (string | null)[];
  /** Inferior name prefixes by quality variant (vanilla lowqualityitems.txt: Crude, Cracked, Damaged, Low Quality) */
  lowQuality: string[];
  /** The superior name prefix ("Superior") */
  superior: string;
  /**
   * Set items whose bonus lists are not the plain 2, 3, 4… pieces, by setitems.txt row: the pieces worn for each of the
   * item's bonus lists, in order (the k-th list a save stores is the k-th non-empty aprop group)
   */
  setBonusPieces?: Record<string, number[]>;
  /** Item codes with base tooltip data (weapons.txt damage, requirements, gem apply type); absent = none */
  bases: Record<string, ItemTextBase>;
  /**
   * Socket fillers by code (gems.txt: gems, runes …): the stats they give in an item of gem apply type 0 (weapon), 1
   * (helm column) and 2 (shield column), in the form a save stores them
   */
  socketables: Record<string, [ItemTextSavedStat[], ItemTextSavedStat[], ItemTextSavedStat[]]>;
  /** Required levels by the ids a save stores (0 = none): uniqueitems / setitems `lvl req`, magic affix `levelreq` (index 0 unused) */
  levels: {
    uniques: number[];
    setItems: number[];
    magicPrefixes: number[];
    magicSuffixes: number[];
    autoAffixes: number[];
  };
}

/** A stat as a save stores it: [itemstatcost id, param (event / charged `skill << 6 | level`, tab `class << 3 | tab`), value] */
export type ItemTextSavedStat = [number, number, number];

/** A base's tooltip data (weapons.txt / armor.txt / misc.txt); fields without a value are left out */
export interface ItemTextBase {
  /** One-hand damage min, max (`mindam` / `maxdam`; not on two-handed-only weapons) */
  d1?: [number, number];
  /** Two-hand damage min, max (`2handmindam` / `2handmaxdam`; two-handed or one-or-two-handed weapons) */
  d2?: [number, number];
  /** Throw damage min, max (`minmisdam` / `maxmisdam`) */
  dt?: [number, number];
  /** Required strength / dexterity / level */
  str?: number;
  dex?: number;
  lvl?: number;
  /** `gemapplytype` when not 0: 1 = socketed gems give their helm column, 2 = their shield column */
  gem?: number;
}

/**
 * terrorzones.json: the offline terror zone rotation of `data/hd/global/excel/desecratedzones.json` (the first config)
 * with each zone group's names. The schedule itself is worked out in the browser (src/features/terror-zones/engine/).
 * See docs/features/TERROR-ZONES.md.
 */
export interface TerrorZonesBundle {
  /** `metadata.modVersion` of the clone (the schedule changes when ESR changes the file) */
  esrVersion: string;
  config: TerrorZoneConfig;
  /** The terror boost per game version and difficulty (`game_difficulties` … `defaults`) */
  boosts: TerrorZoneBoost[];
  /** Zone groups in file order (the order is part of the rotation); duplicate ids left out like the game does */
  zones: TerrorZoneGroup[];
}

export interface TerrorZoneConfig {
  /** `start_time_utc` as Unix seconds */
  start: number;
  /** `end_time_utc` as Unix seconds; null when empty (never ends) */
  end: number | null;
  /** Unsigned 64-bit seed as a decimal string (above 2^53: a JSON number would round it and change every slot) */
  seed: string;
  zoneMinutes: number;
  breakMinutes: number;
}

export type TerrorZoneGameVersion = 'expansion' | 'rotw';

export interface TerrorZoneBoost {
  /** `expansion` (Lord of Destruction) or `rotw` (Reign of the Warlock) */
  version: TerrorZoneGameVersion;
  /** 0 Normal, 1 Nightmare, 2 Hell */
  difficulty: number;
  /** `bound_incl_min` / `bound_incl_max`: the monster level range of a terrorized area */
  minLevel: number;
  maxLevel: number;
  /** `boost_level`: monster levels added */
  levelBoost: number;
  /** `boost_experience_percent` */
  xpPercent: number;
}

export interface TerrorZoneGroup {
  /** The zone's `id` (ESR-Zone01 …) */
  id: string;
  /**
   * The names the game's terror zone display lists: each level group once (levelgroups.txt `NameString`, "Chasm of
   * Horrors (Tier 1)"), then the levels without a group (levels.txt `LevelName`), in level order
   */
  labels: string[];
  /** The zone's levels that areas.json lists (same names as the Areas page and the campaign map), in file order */
  areas: { id: number; name: string }[];
}

// --- modifiers.json -----------------------------------------------------------------------------------------------

/** Where a modifier stat appears: the item lists of the game files */
export type ModifierItemKind =
  'unique' | 'set' | 'setBonus' | 'runeword' | 'gemword' | 'prefix' | 'suffix' | 'automagic' | 'superior' | 'socketable' | 'cube';

export type ModifierCategory = 'offense' | 'defense' | 'speed' | 'procs' | 'resources' | 'find' | 'skills' | 'attributes' | 'other';

/** An itemstatcost.txt `op` (the stat feeds other stats) with a readable formula */
export interface ModifierStatOp {
  op: number;
  /** `op param` when not 0 (op 2-5: the value is divided by 2^param) */
  param?: number;
  /** `op base` (the stat the value is multiplied by: `level` = character level) */
  base?: string;
  /** `op stat1-3`: the stats it changes */
  stats: string[];
  /** "item_hp_perlevel: maxhp += value × level / 8" style text */
  formula: string;
}

/** An itemstatcost.txt item event: when the stat fires and what it does */
export interface ModifierStatEvent {
  /** `itemevent1/2` (domeleedamage, damagedbymissile, kill …) */
  event: string;
  /** Readable trigger ("on a melee hit") */
  trigger: string;
  /** `itemeventfunc1/2` */
  func: number;
  /** Readable function ("Crushing Blow", "cast a skill at the target") */
  action: string;
}

/** One itemstatcost.txt stat that ESR items carry (or that a key modifier kind names) */
export interface ModifierStat {
  /** itemstatcost.txt row (= `*ID`, the save / plugin stat id) */
  id: number;
  /** itemstatcost.txt `Stat` */
  stat: string;
  /** ModifiersBundle.kinds key */
  kind: string;
  /** descstrpos / descstrneg (when different) / descstr2 / dgrpstrpos through the strings */
  text?: string;
  textNeg?: string;
  text2?: string;
  group?: string;
  descfunc?: number;
  descval?: number;
  op?: ModifierStatOp;
  events?: ModifierStatEvent[];
  /** properties.txt codes that set the stat */
  properties: string[];
  /** ESR bookkeeping (tinkering cap / flag, `_display` / `_hidden` / `_cap` companion; affixStats.ts isTechnicalStat) */
  technical?: true;
  /**
   * `same`: a vanilla D2R stat with the same mechanic columns; `changed`: a vanilla stat whose columns ESR changed
   * (`changed` lists them, `id` when ESR moved it); `esr`: not in vanilla D2R (`reusesId` names the vanilla stat that had
   * this row id)
   */
  vanilla: 'same' | 'changed' | 'esr';
  changed?: string[];
  reusesId?: string;
  /** Items (rows of the item lists) carrying the stat, per list; every list counts an item once */
  usage: Partial<Record<ModifierItemKind, number>>;
  /** Sum of `usage` */
  items: number;
  /** Up to 12 example items, runewords / uniques / sets first, file order within a list */
  examples: [ModifierItemKind, string][];
}

/** A modifier kind: the stats one explanation covers ("deadly-strike" = item_deadlystrike + per-level variant) */
export interface ModifierKind {
  /** Stable key, joined with the explanation text */
  key: string;
  title: string;
  category: ModifierCategory;
  /** ModifierStat ids */
  stats: number[];
  /** A one-stat (or same-text) kind made by the generator, not from the reviewed key-kind table */
  generated?: true;
  /** Distinct items carrying any of its stats */
  items: number;
}

/**
 * `esr-config`: ESR's D2RLoader plugin configs and patches; `game-files`: ESR's txt tables; `vanilla-engine`: vanilla
 * D2 engine behaviour (D2MOO), not confirmed for ESR
 */
export type ModifierFactOrigin = 'esr-config' | 'game-files' | 'vanilla-engine';

/** A number per difficulty is `[Normal, Nightmare, Hell]`; a record is per class / target / setting */
export type ModifierFactValue = number | boolean | string | number[] | string[] | Record<string, number>;

export interface ModifierFact {
  key: string;
  label: string;
  value: ModifierFactValue;
  /** The vanilla D2R value in the same shape, when known */
  vanilla?: ModifierFactValue;
  unit?: 'percent' | 'divisor' | 'frames' | 'ratio' | 'count' | 'stat' | 'points';
  origin: ModifierFactOrigin;
  /** The file (path in the ESR repo, or the engine source) and its column / `section.key` */
  source: { file: string; key: string };
  note?: string;
}

/** modifiers.json: what the item modifiers do, for the /modifiers page, the modifier peek and the calculators */
export interface ModifiersBundle {
  kinds: ModifierKind[];
  stats: ModifierStat[];
  facts: ModifierFact[];
}

// --- specializations.json -----------------------------------------------------------------------------------------

/**
 * specializations.json: ESR 3.3's specialisation system (docs/specializations.htm). The rules and the perk order come
 * from the launcher plugin config `celestialrayone.specializations.toml`, titles and descriptions from the strings
 * (`Specializations<Tree><row>_<col>Title` / `Desc`), the unlock items from misc.txt and cubemain.txt, and each perk's
 * links from every file that reads its stat (cubemain conditions, treasure class ConditionCalc, misc.txt and skills.txt
 * formulas, the perk plugin configs, the Enhance and weapon mastery bundles). The official page is only compared with
 * them (`pageDiffs`); the tree summaries are the one thing taken from it.
 */
export interface SpecializationsBundle {
  rules: SpecializationRules;
  /** In tab order */
  trees: SpecializationTree[];
  /** Where the official page reads differently from the files (the bundle keeps the files' value); [] when none */
  pageDiffs: SpecializationPageDiff[];
}

export interface SpecializationRules {
  /** Character levels that add a point once the character is unlocked */
  pointLevels: number[];
  /** Points the unlock gives on its own (before the level points) */
  unlockPoints: number;
  /** Hard cap on owned points (spent and unspent) */
  maxPoints: number;
  perksPerRow: number;
  /** Respec points one unlearn costs; omitted when unlearning is switched off */
  unlearnCost?: number;
  /** The unlearn line under every perk ("Shift + Click to Unlearn. Costs 5 Respec Points.") */
  unlearnHint: string;
  /** The item that gives one respec point and its cube recipe, when the files have one (Token of Absolution: 4 Dragon Stones) */
  respecToken?: { code: string; name: string; recipe?: { code: string; name: string; qty: number } };
  /** Mystical Shard */
  shard: SpecializationItem;
  /** Mystical Tesseract */
  token: SpecializationItem & {
    /** Shards the cube recipe takes */
    shards?: number;
    /** cube.json family of the recipe */
    family?: string;
    /** Levels whose passing adds a point when the token is used late (read from its misc.txt formula) */
    levels: number[];
  };
  /** Shards drop only while the character has not used a token (the shard TC's ConditionCalc) */
  shardsOnlyBeforeUnlock: boolean;
  /** Monsters whose treasure classes roll the shard, most likely first */
  shardDrops: SpecializationShardDrop[];
}

export interface SpecializationItem {
  code: string;
  name: string;
  /** The item's description lines (misc.txt spelldescstr), colour codes removed */
  description: string[];
}

export interface SpecializationShardDrop {
  /** Monster or superunique display name */
  name: string;
  /** Chance per kill (one player, best difficulty), 0–1 */
  chance: number;
  /** The areas it spawns in (levels.txt), by level id with the areas.json name; omitted when none (superuniques) */
  areas?: { id: number; name: string }[];
}

export interface SpecializationTree {
  /** Lower-case kebab slug of the English name (`alchemist`): the `?tree=` value */
  slug: string;
  name: string;
  /** The official page's one-line summary ("Specialized in potions."); omitted when the page has none */
  summary?: string;
  /** Row by row, three per row */
  perks: SpecializationPerk[];
}

export interface SpecializationPerk {
  /** Lower-case kebab slug of the English title (`hidden-elixirs`): the `?perk=` value */
  slug: string;
  title: string;
  description: string;
  /** 1-based */
  row: number;
  /** 1-based, left to right */
  column: number;
  /** itemstatcost.txt id and name of the perk's stat (`alchemy_4`) */
  stat: number;
  statName: string;
  /** Icon key: `<tree slug>-<perk number>`; file icons/specializations/<icon>.webp. Omitted when the tree has no sheet */
  icon?: string;
  /** The perk plugin config section that implements it, with its scalar settings; omitted when none names the stat */
  plugin?: SpecializationPlugin;
  /** Cube families whose recipes check the perk */
  cube?: SpecializationCubeLink[];
  /** Treasure classes that drop only with the perk (ConditionCalc), with what they hold */
  drops?: SpecializationDrop[];
  /** misc.txt items whose formulas read the perk (the potions it strengthens), by name */
  items?: string[];
  /** Number of skills.txt rows (item auras and passives) whose formulas read the perk */
  skillRows?: number;
  /** Enhance page links: the perk allows a second anointment, or sanctifying more item types */
  enhance?: SpecializationEnhanceLink[];
  /** The perk lets any weapon take any weapon mastery (masteries.json `anyWeaponPerk`) */
  anyWeaponMastery?: true;
  /** Facts from the files worth knowing next to the description (nothing reads the stat, a drop without the perk) */
  notes?: string[];
}

export interface SpecializationPlugin {
  /** Config file name (`celestialrayone.blacksmith.toml`) */
  file: string;
  /** Section (`tempered_steel`) or `perks` for a plugin that lists its perk stats in one table */
  section: string;
  /** Number, boolean and short text-list settings, in file order (`perk_stat` and `enabled` left out) */
  values: { key: string; value: number | boolean | string }[];
}

export interface SpecializationCubeLink {
  family: string;
  /** The family's Cube page label */
  label: string;
  /** cubemain rows of the family that check the perk */
  rows: number;
  /** true: the rows need the perk; false: they only work without it */
  has: boolean;
}

export interface SpecializationDrop {
  /** treasureclassex.txt name */
  tc: string;
  /** Item names or treasure class names it holds */
  items: string[];
  /** How many picks the TC makes (2 for the "Double" TCs of the quantity perks) */
  picks: number;
  /**
   * The share of its parent TC's picks that lands on it, 0–1 (the perk's chance: "Potion 1" picks "Potion 1 Double" 1
   * time in 2); one value per distinct parent weighting. Omitted when no single-pick TC lists it
   */
  shares?: number[];
}

export interface SpecializationEnhanceLink {
  tab: 'anointment' | 'sanctification';
  /** What the perk adds there ("A second anointment on 18 item types", "Sanctify Amulets and Rings") */
  text: string;
}

export interface SpecializationPageDiff {
  /** What is compared ("Mystical Shards per Tesseract", "Jeweler › My Precious description") */
  subject: string;
  files: string;
  page: string;
  /** The tree and perk slugs when the difference is about one perk */
  tree?: string;
  perk?: string;
}
