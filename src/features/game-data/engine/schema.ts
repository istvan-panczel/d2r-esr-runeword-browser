/**
 * Shape of the static game-data bundles under `public/game-data/`.
 * Bump GAME_DATA_SCHEMA whenever a bundle shape changes incompatibly.
 */
export const GAME_DATA_SCHEMA = 1;

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
  | 'crafting'
  | 'tiers'
  | 'areas'
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
  /** Every itemstatcost.txt row: id = row number (= `*ID`), name = `Stat` */
  stats: { id: number; name: string }[];
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

export interface AnointmentSlot {
  slot: string;
  typeCode: string;
  label: string;
  rollRange: number;
  /** Roll range of socketed items ("… Socketed" dummy rows); null when the slot has none */
  socketedRollRange: number | null;
}

export interface AnointmentOutcome extends EnhanceBonus {
  /** An `AnointmentSlot.slot`, `charm` (unique charm) or `vessel` (Vessel of Souls) */
  pool: string;
  /** The row's dummy `value` (not the number in the description) */
  roll: number;
  /** The description suffix, e.g. "of Abyss" or "Sockets"; unique charm rows have none */
  label?: string;
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
 * enhance.json: corruption, anointment and Vessel of Souls outcomes from cubemain.txt. Flat top-level arrays so the
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

export type MaterialEnhanceTab = 'corruption' | 'anointment' | 'vessel';

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
}

/** skilldetails.json: details of every class skill and of every described item skill some item grants */
export interface SkillDetailsBundle {
  /** Items referenced by SkillGrant.item, sorted by kind and name */
  items: SkillGrantItem[];
  /** Class skills (class order, tab, row, column), then item skills by name */
  skills: SkillDetail[];
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
}
