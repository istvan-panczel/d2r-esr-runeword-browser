/**
 * Curated groups of beginner-relevant cube recipes for the guide's `::recipes[family-id]` (and the first families of
 * the cube bundle, see bundleCube.ts), matched against the `description` column of cubemain.txt (enabled rows only). Families that collapse merge the mechanical variants of a recipe (one
 * row per base type, quality, class or socket count) into one row; the others list each distinct recipe once.
 *
 * Every family must match at least one row: `::recipes` fails the build otherwise, and a test checks the table
 * against the ESR clone, so a renamed recipe shows up instead of silently emptying a block.
 */
import {
  bonusLines,
  capGroup,
  clusterVariantsCounted,
  clusterWithBonusCounted,
  countValues,
  formatInput,
  formatOutput,
  joinOptions,
  parseCubeCell,
  type CountedVariant,
  type CubeRecipeRow,
  type OutputTables,
  type RecipeVariant,
} from './cubeText.ts';
import type { CubeRow, CubeTables } from './cubeRows.ts';
import { perkCheckText } from './perks.ts';

/** A family as a guide `recipes` block (structurally the guide schema's RecipesBlock) */
export interface CubeFamilyBlock {
  kind: 'recipes';
  caption: string;
  rows: CubeRecipeRow[];
}

/** What families read: the cube rows, display names and the item list (internal names, e.g. a coupon's tier) */
export type FamilyTables = Pick<CubeTables, 'cube' | 'nameOf' | 'anyType' | 'items' | 'renderMods' | 'counterName' | 'perkChecks'>;

export interface CubeFamily {
  id: string;
  /** Block caption */
  label: string;
  /** Tested against the cubemain `description` */
  match: RegExp;
  /** Further narrows the matched rows, for descriptions other recipes share (e.g. the Crystal Can's "Moon Rune") */
  filter?: (row: CubeRow) => boolean;
  /** Rewrites a recipe's formatted text before merging, e.g. to make the per-item rows of one recipe generic */
  rewrite?: (recipe: RecipeVariant, row: CubeRow, esr: FamilyTables) => RecipeVariant;
  /**
   * Rows with the same key (`true`: the description; a function computes it) and number of inputs are merged by
   * clusterVariants and shown as at most MAX_GROUP_ROWS rows. Omitted: the whole family is one group, uncapped.
   */
  collapse?: true | ((row: CubeRow, esr: FamilyTables) => string);
  /** Formats the outputs of a random pool (same inputs, several outputs), most frequent first */
  pool?: (ranked: string[]) => string;
  /**
   * `show` (default): outputs carry their bonus mods ("The same item (+5 to Life)"). `hide`: for families with one
   * bonus per ingredient that would list hundreds of rows (rune forging); the rewrite names the bonus generically.
   */
  outputBonus?: 'show' | 'hide';
  /** Rows the block shows before the caption counts the rest (default MAX_FAMILY_ROWS), for lookup lists */
  maxRows?: number;
  /**
   * Cube page group header of a collapse group (its rows, in file order); omitted: the first row's description shape,
   * or the group's shared ingredients when the description names an ingredient the rows do not take (bundleCube.ts)
   */
  groupLabel?: (rows: readonly CubeRow[], esr: FamilyTables) => string;
}

/** A family block shows at most this many rows; the caption counts the rest. */
export const MAX_FAMILY_ROWS = 12;

const internalNames = new WeakMap<FamilyTables, Map<string, string>>();

/** misc/armor/weapons `name` column of an item code */
function internalName(esr: FamilyTables, code: string): string | undefined {
  let names = internalNames.get(esr);
  if (names === undefined) {
    names = new Map();
    for (const item of esr.items) if (!names.has(item.code)) names.set(item.code, item.internalName);
    internalNames.set(esr, names);
  }
  return names.get(code);
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

// --- coupons -----------------------------------------------------------------------------------------------------

const COUPON_TIERS: Readonly<Partial<Record<string, string>>> = {
  nor: 'normal',
  exc: 'exceptional',
  eli: 'elite',
  amu: 'amulet or ring',
  rin: 'amulet or ring',
};

/**
 * Tier of a coupon code from its internal name ("Coupon exc Armor 12", "Coupon Ring 3") or of a coupon item type
 * ("Coupon norm"); null for anything else (the Wild Card is "Coupon Wild Card").
 */
function couponTier(token: string, esr: FamilyTables): string | null {
  const name = internalName(esr, token) ?? esr.nameOf(token);
  const match = /^Coupon (nor|exc|eli|amu|rin)/i.exec(name);
  return match === null ? null : (COUPON_TIERS[match[1].toLowerCase()] ?? null);
}

function isWildCard(token: string, esr: FamilyTables): boolean {
  return /^Coupon Wild Card$/.test(internalName(esr, token) ?? '');
}

/** A coupon item (names one unique), as opposed to a coupon item type (any coupon of a tier) */
function isNamedCoupon(token: string, esr: FamilyTables): boolean {
  return internalName(esr, token) !== undefined && couponTier(token, esr) !== null;
}

/** One generic row per coupon recipe shape instead of one per unique (~380 each). */
function genericCoupons(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const cells = row.inputs.map(parseCubeCell);
  const withWildCard = cells.some((cell) => isWildCard(cell.token, esr));
  const redeems = cells.some((cell) => isNamedCoupon(cell.token, esr));
  const inputs = cells.map((cell, i) => {
    const tier = couponTier(cell.token, esr);
    if (isWildCard(cell.token, esr)) return plural(cell.qty, 'Wild Card');
    if (tier === null) return recipe.inputs[i] ?? '';
    if (isNamedCoupon(cell.token, esr)) {
      return withWildCard ? `${String(cell.qty)}× matching ${tier} coupons` : `${String(cell.qty)}× matching coupons (any tier)`;
    }
    return cell.qty === 1 ? `1 ${tier} coupon (any)` : `${String(cell.qty)}× ${tier} coupons (any)`;
  });
  const out = row.outputs
    .map((output) => parseCubeCell(output.spec).token)
    .find((token) => !row.inputs.some((spec) => parseCubeCell(spec).token === token));
  const outTier = out === undefined || !isNamedCoupon(out, esr) ? null : couponTier(out, esr);
  const output = outTier !== null ? `A random ${outTier} coupon` : redeems ? 'The LoD unique named on the coupons' : recipe.output;
  return { inputs, output };
}

function couponKey(row: CubeRow, esr: FamilyTables): string {
  const cells = row.inputs.map(parseCubeCell);
  // Redeeming with Wild Cards: one row per tier (the Wild Card count depends on it)
  const tier = cells.some((cell) => isWildCard(cell.token, esr))
    ? cells.map((cell) => (isNamedCoupon(cell.token, esr) ? couponTier(cell.token, esr) : null)).find((found) => found !== null)
    : undefined;
  const toWildCard = row.outputs.some((output) => isWildCard(parseCubeCell(output.spec).token, esr));
  return `${row.description}|${tier ?? ''}|${toWildCard ? 'wild card' : ''}`;
}

/** "A random exceptional coupon (sometimes elite / amulet or ring)" */
function couponPool(ranked: string[]): string {
  const tiers = ranked.map((output) => /^A random (.+) coupon$/.exec(output)?.[1]);
  if (tiers.some((tier) => tier === undefined)) return joinOptions(ranked);
  const [first, ...rest] = tiers;
  return `A random ${first ?? ''} coupon${rest.length > 0 ? ` (sometimes ${rest.join(' / ')})` : ''}`;
}

// --- sockets -----------------------------------------------------------------------------------------------------

const SOCKET_QUALITY: Readonly<Partial<Record<string, string>>> = {
  nor: 'Normal or Superior',
  hiq: 'Normal or Superior',
  mag: 'Magic',
  rar: 'Rare or Crafted',
  crf: 'Rare or Crafted',
  set: 'Set',
  uni: 'Unique',
};
const BASE_TIER: Readonly<Partial<Record<string, string>>> = { bas: 'normal', exc: 'exceptional', eli: 'elite' };
const SMALL_PARTS = new Set(['belt', 'boot', 'glov']);

/** ESR 3.3 perk-only copies of a recipe ("… - Archaeology 13 Special", "… - Jeweler 15 Special") */
const PERK_ROW = / - (?:Alchemy|Blacksmithing|Jeweler|Archaeology) \d+ Special$/;

/** "Rare or Crafted belt, boots or gloves", "Magic item", "Normal quiver"; null for other rows (charms, donuts) */
function socketBase(row: CubeRow): { label: string; tier: string | null } | null {
  const first = row.inputs.at(0);
  if (first === undefined || !/Socket Donut/.test(row.description) || /^Socket Donut:|Odd Charm/.test(row.description)) return null;
  const { token, qualifiers } = parseCubeCell(first);
  const quality = qualifiers.map((part) => SOCKET_QUALITY[part]).find((found) => found !== undefined);
  const tier = qualifiers.map((part) => BASE_TIER[part]).find((found) => found !== undefined) ?? null;
  if (quality === undefined) return null;
  if (/Quiver/.test(row.description)) return { label: `${qualifiers.includes('mag') ? 'Magic' : 'Normal'} quiver`, tier: null };
  return { label: `${quality} ${SMALL_PARTS.has(token) ? 'belt, boots or gloves' : 'item'}`, tier };
}

function socketCount(text: string): number | null {
  const match = /(\d+) sockets?\)/.exec(text);
  return match === null ? null : Number(match[1]);
}

/** Generic base and gem text; "N× gem → N sockets" when the gem count equals the socket count. */
function genericSockets(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const base = socketBase(row);
  if (base === null) return recipe;
  const sockets = socketCount(recipe.output);
  const perGem = row.inputs.some((spec) => {
    const cell = parseCubeCell(spec);
    return /^gem\d$/.test(cell.token) && cell.qty === sockets && cell.qty > 1;
  });
  const inputs = row.inputs.map((spec, i) => {
    const text = recipe.inputs[i] ?? '';
    if (i === 0) return `${base.label} (no sockets)`;
    const cell = parseCubeCell(spec);
    if (!/^gem\d$/.test(cell.token)) return text;
    const name = esr.nameOf(cell.token);
    const where = base.tier === null ? '' : ` (${base.tier} base)`;
    return `${perGem || (sockets !== null && cell.qty === sockets && /^Normal or/.test(base.label)) ? 'N× ' : cell.qty > 1 ? `${String(cell.qty)}× ` : ''}${name}${where}`;
  });
  const generic = /^Normal or/.test(base.label) && sockets !== null;
  const output = generic
    ? recipe.output.replace(/\(\d+ sockets?\)/, '(N sockets, one per gem)')
    : /quiver/.test(base.label)
      ? `The same quiver (${plural(sockets ?? 1, 'socket')})`
      : recipe.output;
  return { inputs, output };
}

// --- maps --------------------------------------------------------------------------------------------------------

function mapTier(token: string, esr: FamilyTables): number | null {
  const match = /^Tier (\d+) Map/.exec(internalName(esr, token) ?? '');
  return match === null ? null : Number(match[1]);
}

/** "3× Tier N map → Tier N+1 map", "Randomizing Stone + 2× Tier N map → A random Tier N map" */
function genericMaps(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const cells = row.inputs.map(parseCubeCell);
  const tiers = cells.map((cell) => mapTier(cell.token, esr));
  const tier = tiers.find((found): found is number => found !== null);
  const outTier = row.outputs
    .map((output) => mapTier(parseCubeCell(output.spec).token, esr))
    .find((found): found is number => found !== null);
  if (tier === undefined || outTier === undefined || tiers.some((t) => t !== null && t !== tier)) return recipe;
  const maps = cells.filter((_, i) => tiers[i] !== null);
  const inputs = cells.map((cell, i) => {
    if (tiers[i] === null) return recipe.inputs[i] ?? '';
    if (cell.qty > 1) return `${String(cell.qty)}× Tier N map (the same map)`;
    return maps.length > 1 && maps.indexOf(cell) > 0 ? 'Another Tier N map' : 'Tier N map';
  });
  if (outTier === tier + 1) return { inputs, output: 'Tier N+1 map (each map has a fixed upgrade)' };
  if (outTier === tier) return { inputs, output: 'A random Tier N map' };
  return recipe;
}

// --- gems, crystals, forging -------------------------------------------------------------------------------------

const GEM = /^(\d+× )?(?:(Chipped|Flawed|Flawless|Blemished|Perfect) )?(?:Amethyst|Topaz|Sapphire|Emerald|Ruby|Diamond|Skull|Obsidian)$/;

function genericGems({ inputs, output }: RecipeVariant): RecipeVariant {
  const generic = (text: string) =>
    text.replace(GEM, (_, qty: string | undefined, grade: string | undefined) => `${qty ?? ''}${grade ?? 'Standard'} gem`);
  return { inputs: inputs.map(generic), output: GEM.test(output) ? `${generic(output)} of the same colour` : output };
}

const CRYSTAL = /^(\d+× )?(Chipped|Flawed) .+$/;

function genericCrystals({ inputs, output }: RecipeVariant): RecipeVariant {
  const grade = /^(Chipped|Flawed) /.exec(output)?.[1] ?? 'Standard';
  return { inputs: inputs.map((input) => input.replace(CRYSTAL, '$1$2 crystal')), output: `${grade} crystal of the same kind` };
}

/** Removing a rune forging hands back the runes that were forged in, whichever they were. */
function genericRuneRemoval({ inputs, output }: RecipeVariant): RecipeVariant {
  return {
    inputs,
    output: output
      .split(' + ')
      .map((part) => (/ Rune$/.test(part) ? part.replace(/^(\d+× )?.*$/, '$1the forged rune') : part))
      .join(' + '),
  };
}

// --- runes -------------------------------------------------------------------------------------------------------

const RUNE_CODE = /^r(\d\d)$/;

function runeNumber(token: string): number | null {
  const match = RUNE_CODE.exec(token);
  return match === null ? null : Number(match[1]);
}

/** Item code of a rune number: 1 → `r01` */
function runeCode(n: number): string {
  return `r${String(n).padStart(2, '0')}`;
}

const runesByDescription = new WeakMap<FamilyTables, Map<string, number[]>>();

/**
 * The rune numbers of the rune input cells with this `qty`, over every row with this description (sorted, distinct);
 * the quantity keeps "2× I Rune → U Rune" apart from "Wo Rune + Full Rejuv Potion" under one description.
 */
function runesOf(esr: FamilyTables, description: string, qty: number): number[] {
  let cache = runesByDescription.get(esr);
  if (cache === undefined) {
    cache = new Map();
    runesByDescription.set(esr, cache);
  }
  const key = `${description}\u0000${String(qty)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const numbers = new Set<number>();
  for (const row of esr.cube) {
    if (row.description !== description) continue;
    for (const cell of row.inputs.map(parseCubeCell)) {
      const rune = runeNumber(cell.token);
      if (rune !== null && cell.qty === qty) numbers.add(rune);
    }
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  cache.set(key, sorted);
  return sorted;
}

/** "I Rune to Wo Rune, Moon Rune to God Rune": runs of consecutive rune codes; "N kinds" past three runs */
function runeRuns(numbers: readonly number[], esr: FamilyTables): string {
  const runs: [number, number][] = [];
  for (const n of numbers) {
    const last = runs.at(-1);
    if (last !== undefined && last[1] === n - 1) last[1] = n;
    else runs.push([n, n]);
  }
  if (runs.length > 3) return `${String(numbers.length)} kinds`;
  const name = (n: number) => esr.nameOf(runeCode(n));
  return runs.map(([from, to]) => (from === to ? name(from) : `${name(from)} to ${name(to)}`)).join(', ');
}

/** Rune forging: one row per rune becomes "2× the same rune (I Rune to Wo Rune, …)" per slot. */
export function genericRuneForging(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const inputs = row.inputs.map((spec, i) => {
    const cell = parseCubeCell(spec);
    if (runeNumber(cell.token) === null) return recipe.inputs[i] ?? '';
    return `${String(cell.qty)}× the same rune (${runeRuns(runesOf(esr, row.description, cell.qty), esr)})`;
  });
  return { inputs, output: `${recipe.output} (that rune's bonus)` };
}

/** "Ancient Decal (Ho -> Pul)" → ["Ho", "Pul"] */
function decalPair(name: string): [string, string] | null {
  const match = /\((\S+) -> (\S+)\)$/.exec(name);
  return match === null ? null : [match[1], match[2]];
}

function runeStem(name: string): string {
  return name.replace(/ Rune$/, '');
}

/**
 * Rune conversions, one generic row per recipe: "2× the same rune (…)" → "The next rune", and the Decal rows as
 * "Ancient Decal (X -> Y) + X Rune → Y Rune", but only after checking that each Decal names the runes of its row.
 */
function genericRuneConversion(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const cells = row.inputs.map(parseCubeCell);
  const outputs = row.outputs.map((output) => parseCubeCell(output.spec).token);
  const only = cells.length === 1 ? cells[0] : undefined;
  const runes = () => runeRuns(runesOf(esr, row.description, only?.qty ?? 1), esr);
  if (row.description === 'rune upgrade' && only !== undefined && only.qty > 1 && runeNumber(only.token) !== null) {
    return { inputs: [`${String(only.qty)}× the same rune (${runes()})`], output: 'The next rune' };
  }
  if (row.description === 'rune downgrade' && only !== undefined && runeNumber(only.token) !== null) {
    return { inputs: [`A rune (${runes()})`], output: 'The rune one grade lower' };
  }
  if (row.description === 'decal upgrade' && only !== undefined && only.qty > 1) {
    return { inputs: [`${String(only.qty)}× the same Ancient Decal`], output: 'The next Ancient Decal' };
  }
  const [decal, rune, lod] = [cells.at(0), cells.at(1), outputs.at(0)];
  if (row.description === 'decal ON' && cells.length === 2 && decal !== undefined && rune !== undefined && lod !== undefined) {
    const pair = decalPair(esr.nameOf(decal.token));
    if (pair !== null && pair[0] === runeStem(esr.nameOf(rune.token)) && pair[1] === runeStem(esr.nameOf(lod))) {
      return { inputs: ['Ancient Decal (X -> Y)', 'X Rune (the ES rune named on the Decal)'], output: 'Y Rune (an LoD rune)' };
    }
  }
  const [es, decalOut] = [outputs.at(0), outputs.at(1)];
  if (row.description === 'decal OFF' && only !== undefined && es !== undefined && decalOut !== undefined) {
    const pair = decalPair(esr.nameOf(decalOut));
    if (pair !== null && pair[0] === runeStem(esr.nameOf(es)) && pair[1] === runeStem(esr.nameOf(only.token))) {
      return { inputs: [`An LoD rune (${runes()})`], output: 'The ES rune and the Ancient Decal named after it' };
    }
  }
  return recipe;
}

const KANJI_SOURCE = 'r50';

/**
 * The quality/slot variants of a forging (set, unique, magic, rare, crafted, white, socketed; weapon, armor, ring,
 * amulet) as one generic item; jewels stay as they are.
 */
function anyEquipment(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const first = parseCubeCell(row.inputs[0] ?? '').token;
  if (first === 'jewl') return recipe;
  return { inputs: recipe.inputs.map((input, i) => (i === 0 ? 'Equipment of any quality (no runeword)' : input)), output: recipe.output };
}

/** The chipped gem of a forging row (its last input), which picks the class or stat */
function forgingGem(row: CubeRow): string {
  return parseCubeCell(row.inputs.at(-1) ?? '').token;
}

/** The slots a stat forging row is for, when its bonus differs from the one on any equipment */
function statForgingSlot(row: CubeRow): string | null {
  if (/Mag\/Rar Jewel$/.test(row.description)) return 'magic or rare jewels';
  if (/Unique Jewel$/.test(row.description)) return 'unique jewels';
  const slot = /_(weap|armo)$/.exec(row.description)?.[1];
  return slot === 'weap' ? 'weapons' : slot === 'armo' ? 'armor' : null;
}

/**
 * Stat forging, one row per chipped gem: equipment of any quality and jewels as one input, the output the gem's
 * bonus with the slots that get another one ("on weapons +48% Bonus to Attack Rating"); statForgingBonuses joins them.
 */
function genericStatForging(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const slot = statForgingSlot(row);
  const bonus = row.outputs.flatMap((output) => bonusLines(output.mods, esr)).join(', ');
  return {
    inputs: recipe.inputs.map((input, i) => (i === 0 ? 'Equipment of any quality or a jewel (no runeword)' : input)),
    output: slot === null ? bonus : `on ${slot} ${bonus}`,
  };
}

/**
 * The per-slot bonuses of one gem (not a random pool: each option names its slots), the bonus on any equipment
 * first; a slot with that same bonus is not repeated.
 */
function statForgingBonuses(ranked: string[]): string {
  const general = ranked.filter((option) => !option.startsWith('on '));
  const slots = ranked.filter((option) => option.startsWith('on ') && !general.some((bonus) => option.endsWith(` ${bonus}`)));
  return `The same item (${[...general, ...slots].join('; ')})`;
}

// --- shared helpers for the generic rewrites below ----------------------------------------------------------------

const valuesCache = new WeakMap<FamilyTables, Map<string, string[]>>();

/**
 * The distinct values `pick` returns over the cube rows `accept` takes, in file order, cached per table set and
 * `key` (a rewrite sees one row at a time, but its generic text often names what all rows of the recipe accept).
 */
function valuesOver(
  esr: FamilyTables,
  key: string,
  accept: (row: CubeRow) => boolean,
  pick: (row: CubeRow) => readonly (string | null)[]
): string[] {
  let cache = valuesCache.get(esr);
  if (cache === undefined) {
    cache = new Map();
    valuesCache.set(esr, cache);
  }
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const values = new Set<string>();
  for (const row of esr.cube) {
    if (!accept(row)) continue;
    for (const value of pick(row)) if (value !== null) values.add(value);
  }
  const list = [...values];
  cache.set(key, list);
  return list;
}

/** "a", "a or b", "a, b or c" */
function orList(values: readonly string[]): string {
  return values.length <= 1 ? values.join('') : `${values.slice(0, -1).join(', ')} or ${values.at(-1) ?? ''}`;
}

/** "1 to 25" for a run of numbers, otherwise the numbers listed */
function numberRange(numbers: readonly number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const [first, last] = [sorted.at(0), sorted.at(-1)];
  if (first === undefined || last === undefined) return '';
  if (first === last) return String(first);
  return last - first + 1 === sorted.length ? `${String(first)} to ${String(last)}` : sorted.join(', ');
}

/** The max of the first output mod with this name, null when the row has none */
function outputMod(row: CubeRow, name: string | RegExp): number | null {
  for (const output of row.outputs) {
    const mod = output.mods.find((candidate) => (typeof name === 'string' ? candidate.mod === name : name.test(candidate.mod)));
    if (mod !== undefined) return mod.max;
  }
  return null;
}

/** Every option of a random pool, unshortened ("a / b / c / d") */
function allOptions(ranked: string[]): string {
  return ranked.join(' / ');
}

// --- mercenaries -------------------------------------------------------------------------------------------------

const PERFECT_GEM = /^Perfect (?:Amethyst|Topaz|Sapphire|Emerald|Ruby|Diamond|Skull|Obsidian)$/;

/** "The same item (+1 to All Skills)" → ["+1 to All Skills"]; null for another output */
function sameItemDetails(text: string): string[] | null {
  const match = /^The same item(?: \((.*)\))?$/.exec(text);
  if (match === null) return null;
  // The details group is optional: undefined for a plain "The same item"
  const details = match.at(1);
  return details === undefined ? [] : [details];
}

/**
 * Merc Only Conversion: one row per Perfect Gem colour with its bonus (weapon and armor merged), and one row to
 * remove it (the bonus comes off; the Anvil Stone and gem come back).
 */
function genericMercOnly(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const flag = outputMod(row, 'mercflag');
  const inputs = recipe.inputs.map((input, i) => (i === 0 ? 'Weapon or armor (no runeword)' : input));
  if (flag === null) return { inputs, output: recipe.output };
  const output = recipe.output
    .split(' + ')
    .map((part) => {
      const details = sameItemDetails(part);
      if (details === null) return PERFECT_GEM.test(part) ? 'the Perfect Gem' : part;
      return flag > 0 ? `The same item (${['mercenary only', ...details].join(', ')})` : 'The same item (no longer mercenary only)';
    })
    .join(' + ');
  return { inputs, output };
}

// --- weapon mastery ----------------------------------------------------------------------------------------------

/**
 * ESR 3.3 added "True Master - Apply Awaken …" (any weapon, Blacksmith perk) and "Remove Weapon Mastery - …" (any
 * weapon with that mastery); the "Remove Awaken …" rows still clear the ESR 3.2 `weaponmastery` stat.
 */
const MASTERY_VERB =
  /^(Awaken|Apply Awaken|Remove Awaken|Unawaken|True Master - Apply Awaken) Weapon Mastery Token|^(Remove) Weapon Mastery - /;

function masteryVerb(row: CubeRow): string {
  const match = MASTERY_VERB.exec(row.description);
  return match?.[1] ?? match?.[2] ?? row.description;
}

/**
 * The per-base rows of a weapon mastery recipe as one: any class weapon with a mastery, its class's Dragon Stone
 * form; awakening shows that the token becomes one for that weapon type.
 */
function genericMastery(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const verb = masteryVerb(row);
  if (verb === 'Unawaken') return recipe;
  const bases = valuesOver(
    esr,
    'mastery bases',
    (candidate) => masteryVerb(candidate) === 'Awaken',
    (candidate) => [parseCubeCell(candidate.inputs[0] ?? '').token]
  );
  const applies = verb === 'Apply Awaken' || verb === 'True Master - Apply Awaken';
  const first: Readonly<Record<string, string>> = {
    Awaken: `A class weapon (any of ${String(bases.length)} bases)`,
    'True Master - Apply Awaken': 'Any weapon (no runeword)',
    Remove: 'A weapon with that mastery',
  };
  const inputs = recipe.inputs.map((text, i) => {
    if (i === 0) return first[verb] ?? 'The class weapon (no runeword)';
    if (verb !== 'Awaken' && i === (applies ? 2 : 1)) return "Its class's Dragon Stone form";
    return text;
  });
  if (verb === 'Awaken')
    return { inputs, output: recipe.output.replace(/^The same item \+ (.+)$/, 'The same weapon + $1 (for that weapon type)') };
  if (applies) return { inputs, output: 'The same weapon with its mastery' };
  return { inputs, output: 'The same weapon without the mastery (the token is not returned)' };
}

// --- sockets: Key and Lucion's Essence ----------------------------------------------------------------------------

const SLOT_WORDS: Readonly<Partial<Record<string, string>>> = {
  weap: 'weapon',
  armo: 'armor',
  tors: 'body armor',
  helm: 'helm',
  shld: 'shield',
  glov: 'gloves',
  belt: 'belt',
  boot: 'boots',
  ring: 'ring',
  amul: 'amulet',
  char: 'charm',
  misl: 'quiver',
  aq2: 'quiver',
  cq2: 'quiver',
};

function slotWord(token: string, esr: FamilyTables): string {
  return SLOT_WORDS[token] ?? esr.nameOf(token).toLowerCase();
}

/** "Any socketed weapon, armor, ring, amulet, charm or quiver" + Key → the item emptied and its socketables */
function genericUnsocket(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const slots = valuesOver(
    esr,
    'unsocket slots',
    (candidate) => /^Unsocket /.test(candidate.description) && candidate.outputs.some((output) => /,rem\b/.test(output.spec)),
    (candidate) => [slotWord(parseCubeCell(candidate.inputs[0] ?? '').token, esr)]
  );
  if (!row.outputs.some((output) => /^useitem,rem\b/.test(output.spec))) return recipe;
  const inputs = recipe.inputs.map((input, i) => (i === 0 ? `Any socketed ${orList(slots)}` : input));
  return { inputs, output: 'The same item with empty sockets + everything that was socketed in it' };
}

const LUCION_ROW = /^Adds Socket\(\d\): .* \+ Lucion's Essence(?: Remove)?$/;

const LUCION_QUALITY: Readonly<Partial<Record<string, string>>> = {
  mag: 'Magic',
  rar: 'Rare',
  crf: 'Crafted',
  set: 'Set',
  uni: 'Unique',
};

/** Quality and socket count: the slots sharing them are one row */
function lucionKey(row: CubeRow): string {
  const { qualifiers } = parseCubeCell(row.inputs[0] ?? '');
  const quality = qualifiers.map((part) => LUCION_QUALITY[part]).find((found) => found !== undefined) ?? '';
  return `${quality}|${String(outputMod(row, 'sock') ?? 0)}`;
}

/**
 * "Rare weapon, body armor, helm or shield" + Lucion's Essence → "The same item with 3 sockets": the rows for items
 * without sockets and for socketed ones (whose socketables come out) are one row.
 */
function genericLucion(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const key = lucionKey(row);
  const quality = key.split('|')[0] ?? '';
  const slots = valuesOver(
    esr,
    `lucion ${key}`,
    (candidate) => LUCION_ROW.test(candidate.description) && lucionKey(candidate) === key,
    (candidate) => [slotWord(parseCubeCell(candidate.inputs[0] ?? '').token, esr)]
  );
  const sockets = plural(outputMod(row, 'sock') ?? 0, 'socket');
  // Socketed items of this quality and count are emptied by a sibling row: the row is for either kind of item
  const emptied = valuesOver(
    esr,
    `lucion emptied ${key}`,
    (candidate) => LUCION_ROW.test(candidate.description) && lucionKey(candidate) === key,
    (candidate) => (candidate.outputs.some((output) => /^useitem,rem\b/.test(output.spec)) ? ['rem'] : [])
  );
  const inputs = recipe.inputs.map((input, i) => (i === 0 ? `${quality} ${orList(slots)}` : input));
  return { inputs, output: `The same item with ${sockets}${emptied.length > 0 ? ' (anything socketed in it comes out)' : ''}` };
}

// --- Kill Ledger -------------------------------------------------------------------------------------------------

/** "Kill Ledger (at least 500 kills)" from the row's kill count condition; the bonus number from its mod */
function genericKillTier(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const kills = row.condition !== null && row.condition.value > 0 ? row.condition.value : null;
  const tier = row.outputs.flatMap((output) => output.mods).find((mod) => /^kill-ledger-tier-\d+$/.test(mod.mod));
  const inputs = recipe.inputs.map((input, i) =>
    i === 0 && kills !== null ? `${input} (at least ${kills.toLocaleString('en-US')} kills)` : input
  );
  const details = sameItemDetails(recipe.output);
  if (tier === undefined || details === null) return { inputs, output: recipe.output };
  const name = `The Kill Ledger with kill bonus ${tier.mod.replace(/^kill-ledger-tier-/, '')}`;
  return { inputs, output: details.length === 0 ? name : `${name} (${details.join(', ')})` };
}

/** "The Kill Ledger (+10% to Spell Damage)": the crystals pick the boss, whose name is only in the dev label */
function genericKillBoss(recipe: RecipeVariant): RecipeVariant {
  const details = sameItemDetails(recipe.output);
  if (details === null) return recipe;
  return {
    inputs: recipe.inputs,
    output: details.length === 0 ? "The Kill Ledger with that boss's bonus" : `The Kill Ledger (${details.join(', ')})`,
  };
}

// --- Ancient Scrolls ---------------------------------------------------------------------------------------------

/** Number of an identified Ancient Scroll ("Scroll 12"), null for anything else */
function scrollNumber(token: string, esr: FamilyTables): number | null {
  const match = /^Scroll (\d+)$/.exec(internalName(esr, token) ?? '');
  return match === null ? null : Number(match[1]);
}

function scrollVerb(row: CubeRow): string {
  return row.description.replace(/ \d+$/, '');
}

/** The scroll numbers over the inputs (or outputs) of every row of this recipe */
function scrollNumbers(esr: FamilyTables, row: CubeRow, side: 'inputs' | 'outputs'): string {
  const verb = scrollVerb(row);
  const numbers = valuesOver(
    esr,
    `scrolls ${verb} ${side}`,
    (candidate) => scrollVerb(candidate) === verb,
    (candidate) =>
      (side === 'inputs' ? candidate.inputs : candidate.outputs.map((output) => output.spec)).map((spec) => {
        const n = scrollNumber(parseCubeCell(spec).token, esr);
        return n === null ? null : String(n);
      })
  );
  return numberRange(numbers.map(Number));
}

/** The scroll numbers of an item type (Ancient Scroll Low / High) */
function scrollTypeRange(type: string, esr: FamilyTables): string | null {
  const numbers = esr.items
    .filter((item) => item.type === type)
    .map((item) => scrollNumber(item.code, esr))
    .filter((n): n is number => n !== null);
  return numbers.length === 0 ? null : numberRange(numbers);
}

/** One generic row per scroll recipe: identify, upgrade, downgrade, the two rerolls */
function genericScrolls(recipe: RecipeVariant, row: CubeRow, esr: FamilyTables): RecipeVariant {
  const verb = scrollVerb(row);
  const cells = row.inputs.map(parseCubeCell);
  if (verb === 'Identify Scroll') {
    return {
      inputs: ['Ancient Scroll (unidentified)', ...recipe.inputs.slice(1)],
      output: `Ancient Scroll N (its number, ${scrollNumbers(esr, row, 'outputs')})`,
    };
  }
  if (verb === 'Scroll Upgrade') {
    return { inputs: [`2× Ancient Scroll N (N = ${scrollNumbers(esr, row, 'inputs')})`], output: 'Ancient Scroll N+1' };
  }
  if (verb === 'Scroll Downgrade') {
    return { inputs: [`Ancient Scroll N (N = ${scrollNumbers(esr, row, 'inputs')})`], output: 'Ancient Scroll N-1' };
  }
  if (/^Scroll Reroll /.test(verb)) {
    const inputs = cells.map((cell, i) => {
      const range = scrollTypeRange(cell.token, esr);
      return range === null ? (recipe.inputs[i] ?? '') : `${String(cell.qty)}× Ancient Scroll (any of ${range})`;
    });
    return { inputs, output: `A random Ancient Scroll ${scrollNumbers(esr, row, 'outputs')}` };
  }
  return recipe;
}

// --- unique charms and Maple Leaves ------------------------------------------------------------------------------

/** Rerolls hand the charm back as itself: "The same charm, rerolled"; Standard of Heroes marks it upgraded */
function genericCharmUpgrade(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const first = parseCubeCell(row.inputs[0] ?? '').token;
  if (row.outputs.length === 1 && row.outputs[0]?.spec === first) return { inputs: recipe.inputs, output: 'The same charm, rerolled' };
  if (outputMod(row, 'item-upgraded') !== null) return { inputs: recipe.inputs, output: 'The same charm (upgraded)' };
  return recipe;
}

// --- class crafts, gem melding -----------------------------------------------------------------------------------

const CRAFT_CLASSES: Readonly<Partial<Record<string, string>>> = {
  amazon: 'Amazon',
  assassin: 'Assassin',
  barb: 'Barbarian',
  druid: 'Druid',
  necro: 'Necromancer',
  paladin: 'Paladin',
  sorceress: 'Sorceress',
  warlock: 'Warlock',
};

export function craftClass(row: CubeRow): string {
  const tag = /-> (\w+) \w+$/.exec(row.description)?.[1] ?? '';
  return CRAFT_CLASSES[tag] ?? tag;
}

/** One row per class: the magic base of any slot, the class's Dragon Stone form and Perfect Gem */
function genericClassCraft(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  return {
    inputs: recipe.inputs.map((input, i) => (i === 0 ? 'Magic item (any slot)' : input)),
    output: `${recipe.output} (${craftClass(row)} craft)`,
  };
}

/** Gem melding per slot group: the gem colour picks the bonus, the slot sets the level requirement added */
function genericGemMeld(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const base = parseCubeCell(row.inputs[0] ?? '').token;
  const levelreq = outputMod(row, 'levelreq');
  const inputs = recipe.inputs.map((input, i) => {
    if (i === 0 && /^(?:wand|staf|orb)$/.test(base)) return 'Wand, Staff or Orb';
    return PERFECT_GEM.test(input) ? 'Perfect Gem (the colour picks the bonus)' : input;
  });
  return { inputs, output: levelreq === null ? recipe.output : `The same item (+${String(levelreq)} level requirement)` };
}

// --- ascendancies, Vessel of Souls -------------------------------------------------------------------------------

const BLEMISHED = /^(?:(\d+)× )?Blemished (\w+)$/;
/** A stone with its gem colours, as genericAscendancy writes it: "Battlemage (Obsidian, Sapphire)" */
const STONE_COLOURS = /^[\w ]+ \(\w+(?:, \w+)*\)$/;

/**
 * Ascendancy Stones by gem pattern (the class only changes the stone's mods), each pool listing the stones with
 * their colours; the tier upgrades for any stone.
 */
function genericAscendancy(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  const tier = row.outputs.flatMap((output) => output.mods).find((mod) => /^ascendancy-tier-\d$/.test(mod.mod));
  if (tier !== undefined) {
    return {
      inputs: recipe.inputs.map((input, i) => (i === 0 ? 'Your Ascendancy Stone' : input)),
      output: `The stone at tier ${tier.mod.replace(/^ascendancy-tier-/, '')}`,
    };
  }
  const gems = recipe.inputs.map((input) => BLEMISHED.exec(input)).filter((match) => match !== null);
  if (gems.length === 0) return recipe;
  const colours = gems.map((match) => match[2]);
  // No count prefix: one gem (Number(undefined) is NaN)
  const counts = gems.map((match) => Number(match[1]) || 1);
  const pattern =
    gems.length === 1
      ? `${String(counts[0])}× Blemished gems of one colour`
      : counts.every((count) => count === 1)
        ? `${String(gems.length)} Blemished gems of different colours`
        : counts.map((count, i) => `${String(count)}× Blemished gems${i > 0 ? ' of another colour' : ''}`).join(' + ');
  const stone = recipe.output.replace(/ Ascendancy Stone$/, '');
  return { inputs: [recipe.inputs[0] ?? '', pattern], output: `${stone} (${colours.join(', ')})` };
}

/** "Ascendancy Stone: Berserker (Obsidian) / Starborn (Sapphire) / …" (every stone, not shortened) */
function ascendancyPool(ranked: string[]): string {
  return ranked.every((option) => STONE_COLOURS.test(option)) ? `Ascendancy Stone: ${allOptions(ranked)}` : allOptions(ranked);
}

/** Every transformation as one row: the three gems pick the weapon */
function genericVessel(recipe: RecipeVariant): RecipeVariant {
  const gems = recipe.inputs.filter((input) => BLEMISHED.test(input)).length;
  return {
    inputs: [recipe.inputs[0] ?? '', `${String(gems)} Blemished gems of different colours (they pick the weapon)`],
    output: recipe.output,
  };
}

/**
 * Lucion's Relic of Sanctification takes two transmutes: the Relic gives the jewel a hidden roll, then the jewel alone
 * becomes one of the "Jewel Sanctification N" rows (N being the roll).
 */
function genericSanctification(recipe: RecipeVariant, row: CubeRow): RecipeVariant {
  // ESR 3.3: amulets and rings too, with the Jeweler perk Hallowed Accessories
  const item = /(Jewel|Amulet|Ring)(?: Sanctification \d+)?$/.exec(row.description)?.[1]?.toLowerCase() ?? 'jewel';
  if (/^Add Sanctification Dummy Stat/.test(row.description)) {
    return { inputs: recipe.inputs, output: `The same ${item}, ready to sanctify (transmute it again on its own)` };
  }
  if (/^(?:Jewel|Amulet|Ring) Sanctification \d+$/.test(row.description))
    return { inputs: [`That ${item}, on its own`], output: recipe.output };
  return recipe;
}

/** "Mythical Razor Axe / … (29 variants), each keeps its stats": details every option shares are written once */
function sharedSuffixPool(ranked: string[]): string {
  const match = / \(([^()]+)\)$/.exec(ranked[0] ?? '');
  if (match === null || ranked.length < 2 || !ranked.every((option) => option.endsWith(match[0]))) return joinOptions(ranked);
  return `${joinOptions(ranked.map((option) => option.slice(0, -match[0].length)))}, each ${match[1]}`;
}

export const CUBE_FAMILIES: readonly CubeFamily[] = [
  { id: 'dstone-cycle', label: 'Dragon Stone cycle (one material into the next)', match: /^Dstone Transformation$/ },
  { id: 'anvil-stone', label: 'Making Anvil Stones', match: /^"?(?:Anvil Stone|Multi Stocker .*\+1 Anvil Stone)"?$/ },
  {
    id: 'remove-forging',
    label: 'Removing a forging (Thawing Potions)',
    match: /^Remove .*Forging/,
    rewrite: genericRuneRemoval,
    // Removal takes off what the forging added: the bonus is the negated forging bonus, one per gem, rune or aura
    outputBonus: 'hide',
    collapse: (row) => /(All Skill|Skill|Stat|Rune|Aura) Forging/.exec(row.description)?.[1] ?? row.description,
  },
  {
    id: 'skill-forging',
    label: 'Class skill forging',
    match: /^(?:(?:Weapon|Armor|Ring|Amulet|Unique Charm) Skill Forging \w+|Skill Forging Unique Jewel)$/,
    // One row per class (its bonus): the gem picks the class, the rows only differ in the item slot (jewels too).
    collapse: forgingGem,
  },
  {
    id: 'all-skill-forging',
    label: 'All skills forging',
    match: /^All Skill Forging /,
    rewrite: anyEquipment,
    collapse: () => 'all',
  },
  { id: 'aura-forging', label: 'Aura forging (amulets)', match: /^Aura Forging$/ },
  {
    id: 'rune-forging',
    label: 'Rune forging',
    // The wand, staff, glove, torso, shield and belt rows only change the bonus of some runes on those items; the
    // weapon and armor rows already accept those items, so they are left out to keep the rune lists honest.
    match: /^Rune Forging (?:weap|armo|ring|amul|Jewel [WH])$/,
    rewrite: genericRuneForging,
    // Each rune has its own bonus per slot (hundreds of rows): the output names it generically
    outputBonus: 'hide',
  },
  {
    id: 'stat-forging',
    label: 'Stat forging',
    match: /^(?!Remove )(?:\w+ )*Stat Forging (?:\w{3}_\w+|Unique Jewel|Mag\/Rar Jewel)$/,
    rewrite: genericStatForging,
    // One row per chipped gem, the slots with another bonus (weapons, armor, jewels) named in its output.
    collapse: forgingGem,
    pool: statForgingBonuses,
  },
  {
    id: 'socket',
    label: 'Adding sockets with a Socket Donut',
    match: /^(?:Adds Socket\(\d+\): .*Socket Donut|Socket Donut: )/,
    rewrite: genericSockets,
    // The odd charm rows (one more socket per use) differ only in a hidden socket-count condition: one pooled row.
    // The ESR 3.3 "… - Archaeology 13 Special" rows (magic items as if normal, Archaeologist perk) are their own groups
    collapse: (row) =>
      `${socketBase(row)?.label ?? (/Odd Charm/.test(row.description) ? 'odd charm' : row.description)}${PERK_ROW.test(row.description) ? ' (perk)' : ''}`,
  },
  {
    id: 'coupon-tiers',
    label: 'Coupons and Wild Cards',
    match: /^(?:Coupon|Coupon Reroll|\d+ Decipherers: Wild Card \+ Key)$/,
    rewrite: genericCoupons,
    collapse: couponKey,
    pool: couponPool,
  },
  {
    id: 'gem-upgrade',
    label: 'Gem upgrades',
    match: /^[LNFBP]-(?:Ame|Top|Sap|Eme|Rub|Dia|Sku|Obs): \d+ [CLNFB]-\w+(?: \+ \d* ?Wildcards?)?$/,
    rewrite: genericGems,
    collapse: (row) => row.description.replace(/\b(?:Ame|Top|Sap|Eme|Rub|Dia|Sku|Obs)\b/g, '*'),
  },
  {
    id: 'crystal-upgrade',
    label: 'Crystal upgrades',
    match: /^Upgrade Crystal \d+$/,
    rewrite: genericCrystals,
    collapse: () => 'crystal',
  },
  {
    id: 'legendary-consumables',
    label: 'Legendary consumables',
    match:
      /^(?:Inarius' Everburning Halo|Astrogha's Petrified Heart|Lilith's Crystallized Tear|Tyrael's Eternal Feather|Add Sanctification Dummy Stat|(?:Jewel|Amulet|Ring) Sanctification \d+$)/,
    rewrite: genericSanctification,
    // The sanctifications (one per value of the Relic's hidden roll) are one random pool
    collapse: (row) =>
      row.description.replace(/\s*(?:-\s*)?(?:Weapon|Armor|Ring|Amulet|Arrow Quiver|Bolt Quiver|Melee|Throw|Jewel|\d+)$/, ''),
  },
  { id: 'respec-token', label: 'Token of Absolution', match: /^Token of Absolution$/ },
  { id: 'starter-pack', label: "Adventurer's Pack", match: /^(?:Another )?Adventurer's Pack$/ },
  {
    id: 'map-upgrade',
    label: 'Map upgrades and rerolls',
    match: /^Tier \d+ (?:-> \d+ |Map Randomization$)/,
    rewrite: genericMaps,
    collapse: (row) => (row.description.includes('->') ? 'upgrade' : 'reroll'),
  },
  {
    id: 'charm-reroll',
    label: 'Charm rerolls and upgrades',
    match: /^(?:(?:\[SECRET\d+\] )?(?:Magic|Rare) Charm(?: Reroll)?: |Reset Nor Odd Charm$)/,
    collapse: true,
  },
  {
    id: 'rune-conversion',
    label: 'Rune upgrades and conversions',
    match: /^(?:rune upgrade|rune downgrade|decal upgrade|decal ON|decal OFF|Nul -> Wo|Wo -> Nul|\w+ Rune)$/,
    // "Moon Rune" … "God Rune" also name the Crystal Can rows; the Kanji recipes start from a Null Rune.
    filter: (row) => !/^\w+ Rune$/.test(row.description) || parseCubeCell(row.inputs[0] ?? '').token === KANJI_SOURCE,
    rewrite: genericRuneConversion,
    // Wo ↔ Null (also listed as a rune upgrade) is one group; the Kanji runes are one capped group.
    collapse: (row) =>
      /^(?:Nul -> Wo|Wo -> Nul)$/.test(row.description) || row.inputs.includes('rvl')
        ? 'null'
        : /^\w+ Rune$/.test(row.description)
          ? 'kanji'
          : row.description,
  },
  // One row per organ, weapon and armor merged (the bonus is in the row's mods, not shown)
  {
    id: 'tinkering',
    label: 'Tinkering with organs',
    match: /^Tinkering Adds /,
    collapse: (row) => parseCubeCell(row.inputs[1] ?? '').token,
  },
  {
    id: 'uber-keys',
    label: 'Pandemonium keys and portals',
    match: /^(?:Key of \w+ \+ Blemished Gem \+ .+ Conversion|Pandemonium Key Set (?:Wrap|Unwrap)|1 Key of Terror \+ |1 Diablo's Horn \+ )/,
  },
  {
    id: 'merc-only',
    label: 'Merc Only Conversion',
    match: /^(?:Remove )?Merc Only Conversion$/,
    rewrite: genericMercOnly,
  },
  {
    id: 'weapon-mastery',
    label: 'Weapon mastery',
    match:
      /^(?:(?:Apply |Remove |True Master - Apply )?Awaken Weapon Mastery Token - .+|Unawaken Weapon Mastery Token|Remove Weapon Mastery - .+)$/,
    rewrite: genericMastery,
    // One row per step (the bases merged); applying with a chipped gem (orbs, Voidblades) is its own row.
    collapse: masteryVerb,
  },
  {
    id: 'unsocket',
    label: 'Removing socketables with a Key',
    // "… - Jeweler 15 Special": the Jeweler perk Steady Pliers (gemwords keep their gems), its own group
    match: /^Unsocket (?:Weap|Armo|Ring|Amulet|Charm|Quiver)(?: - Jeweler 15 Special)?$/,
    rewrite: genericUnsocket,
    collapse: (row) => (PERK_ROW.test(row.description) ? 'perk' : 'plain'),
  },
  {
    id: 'lucion-essence',
    label: "Adding sockets with Lucion's Essence",
    match: LUCION_ROW,
    rewrite: genericLucion,
    // The tiers and slots of one quality and socket count merged; qualities with the same count share a row.
  },
  {
    id: 'kill-ledger-tiers',
    label: 'Kill Ledger kill bonuses',
    match: /^Kill Ledger Tier \d+$/,
    rewrite: genericKillTier,
  },
  {
    id: 'kill-ledger-bosses',
    label: 'Kill Ledger boss bonuses',
    match: /^Kill Ledger (?!Tier )(?!.*Trap).+$/,
    // One row per boss bonus (the crystals pick it), in file order; every boss shown so a player can look theirs up
    maxRows: 20,
    rewrite: genericKillBoss,
  },
  {
    id: 'ancient-scrolls',
    label: 'Ancient Scrolls',
    match: /^(?:Identify Scroll \d+|Scroll Upgrade \d+|Scroll Downgrade \d+|Scroll Reroll (?:Low|High))$/,
    rewrite: genericScrolls,
    collapse: scrollVerb,
  },
  {
    id: 'unique-charm-upgrades',
    label: 'Upgrading, rerolling and recycling unique charms',
    match:
      /^(?:Standard of Heroes .+|Unique Reroll ES Charm (?:Exc|Eli)|Maple Leaf: Unique Charm \+ Key \+ any rejuv pot|2 Broken Hourglass Shards \+ .+)$/,
    rewrite: genericCharmUpgrade,
  },
  {
    id: 'maple-leaf',
    label: 'Making Maple Leaves',
    match: /^(?:Maple Leaf: Unique Charm \+ Key \+ any rejuv pot|\[SECRET(?:26|40)\] .*Maple Leaf.*)$/,
  },
  {
    id: 'class-craft',
    label: 'Class crafts',
    // Not the Legacy crafts, which take a rune instead of a Dragon Stone form
    match: /^magic [\w' ]+ \+ jewel \+ (?!rune )[\w' ]+ \+ [\w' ]+ -> \w+ \w+$/,
    rewrite: genericClassCraft,
    collapse: craftClass,
    // The bonuses depend on the slot as well as the class (80 sets): one row per class cannot list them
    outputBonus: 'hide',
  },
  {
    id: 'gem-meld',
    label: 'Gem melding',
    match: /^P-(?:Ame|Top|Sap|Eme|Rub|Dia|Sku|Obs) \+ Any \w+ \+ 3 ddd$/,
    rewrite: genericGemMeld,
  },
  {
    id: 'ascendancy',
    label: 'Ascendancy Stones and tiers',
    match: /^(?!.*Trap)(?:Orb of Creation: 5 Orb of Elements|[\w ]+ Ascendancy: Orb of Creation \+ .+|[\w ]+ Ascend to Tier \d.*)$/,
    rewrite: genericAscendancy,
    pool: ascendancyPool,
    // A stone's mods depend on the class it was made for (the class rows are merged)
    outputBonus: 'hide',
  },
  {
    id: 'vessel-transform',
    label: 'Turning the Vessel of Souls into a mythical weapon',
    match: /^Vessel of Souls Transform to Mythical (?!.*Trap)/,
    rewrite: genericVessel,
    pool: sharedSuffixPool,
  },
];

export function findCubeFamily(id: string): CubeFamily | undefined {
  return CUBE_FAMILIES.find((family) => family.id === id);
}

export function familyRows(family: CubeFamily, esr: Pick<CubeTables, 'cube'>): CubeRow[] {
  return esr.cube.filter((row) => family.match.test(row.description) && (family.filter?.(row) ?? true));
}

/** Output qualifiers that make a new random item (an output cell `cx1,mag` equal to its input is a reroll) */
const NEW_ITEM_QUALIFIERS = new Set(['low', 'nor', 'hiq', 'mag', 'set', 'rar', 'uni', 'crf', 'tmp']);

/**
 * The outputs that are inputs handed back unchanged (a Key, a Scroll of Identify, an Ancient Scroll): outputs equal
 * to an input that name a plain item code, unless every output is one. An output with a quality (`cx1,mag`) or a
 * unique name equal to an input is a new item (a reroll), not the input handed back.
 */
export function returnedOutputs(row: CubeRow): CubeRow['outputs'] {
  const returned = row.outputs.filter((output) => {
    if (!row.inputs.includes(output.spec)) return false;
    const { token, qualifiers } = parseCubeCell(output.spec);
    return /^[a-z0-9]{3,4}$/.test(token) && !qualifiers.some((part) => NEW_ITEM_QUALIFIERS.has(part));
  });
  return returned.length === row.outputs.length ? [] : returned;
}

/** Output text; an item handed back unchanged (returnedOutputs) is left out, repeats are counted. */
function rowOutput(row: CubeRow, esr: OutputTables, bonus: boolean): string {
  const returned = returnedOutputs(row);
  const kept = row.outputs.filter((output) => !returned.includes(output));
  const texts = kept.map((output) => formatOutput(output, esr, { bonus }));
  return [...countValues(texts)].map(([text, count]) => (count > 1 ? `${String(count)}× ${text}` : text)).join(' + ');
}

/** One collapse group of a family: its txt rows and their merged rows (uncapped), with the variants each stands for */
export interface FamilyGroup {
  /** The collapse key ('' for a family without `collapse`) */
  key: string;
  rows: CubeRow[];
  merged: CountedVariant[];
}

/**
 * The family's collapse groups in file order (of each group's first row), merged as configured. `rows` defaults to
 * every row the family matches (familyRows); the cube bundle passes the rows assigned to the family.
 */
export function groupFamily(
  family: CubeFamily,
  esr: FamilyTables,
  rows: readonly CubeRow[] = familyRows(family, esr),
  /** `full`: always merge with the output bonuses (the uncapped cube reference); default: clusterWithBonus */
  bonuses: 'fit' | 'full' = 'fit'
): FamilyGroup[] {
  const groups = new Map<string, { rows: CubeRow[]; withBonus: RecipeVariant[]; plain: RecipeVariant[] }>();
  const bonus = family.outputBonus !== 'hide';
  for (const row of rows) {
    const inputs = row.inputs.map((input) => formatInput(input, esr));
    const variant = (output: string) => {
      const text = { inputs, output };
      return family.rewrite === undefined ? text : family.rewrite(text, row, esr);
    };
    const withBonus = variant(rowOutput(row, esr, bonus));
    const collapse = family.collapse;
    const key =
      collapse === undefined ? '' : `${String(withBonus.inputs.length)}\u0000${collapse === true ? row.description : collapse(row, esr)}`;
    const group = groups.get(key) ?? { rows: [], withBonus: [], plain: [] };
    group.rows.push(row);
    group.withBonus.push(withBonus);
    group.plain.push(bonus ? variant(rowOutput(row, esr, false)) : withBonus);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({
    key,
    rows: group.rows,
    merged:
      family.collapse === undefined || bonuses === 'full'
        ? clusterVariantsCounted(group.withBonus, family.pool)
        : clusterWithBonusCounted(group.withBonus, group.plain, family.pool),
  }));
}

/**
 * The family's rows in file order (of each group's first row), merged as configured, before the row cap. Notes stay
 * empty (the txt descriptions are dev labels) except for "… and N more" on a capped group. A collapsed group whose
 * bonuses would split it past MAX_GROUP_ROWS is shown without them (clusterWithBonus).
 */
export function collectFamily(family: CubeFamily, esr: FamilyTables): CubeRecipeRow[] {
  return groupFamily(family, esr).flatMap(({ rows, merged }) => {
    const variants = merged.map(({ variant }) => variant);
    const note = (i: number) =>
      perkNote(
        (merged[i]?.indices ?? []).flatMap((index) => rows[index] ?? []),
        esr
      );
    if (family.collapse === undefined) return variants.map((row, i) => ({ ...row, note: note(i) }));
    return capGroup(variants, note);
  });
}

/**
 * The perk a merged row needs (ESR 3.3 specialisation perks, cube/perks.ts): "Needs the Jeweler perk Steady Pliers"
 * when every row it merges needs it, null otherwise (or without perk data)
 */
function perkNote(rows: readonly CubeRow[], esr: FamilyTables): string | null {
  if (esr.perkChecks === undefined || rows.length === 0) return null;
  const lists = rows.map((row) => esr.perkChecks?.(row).filter((check) => check.has) ?? []);
  const shared = (lists[0] ?? []).filter((check) => lists.every((list) => list.some((other) => other.perk.title === check.perk.title)));
  return shared.length === 0 ? null : shared.map(perkCheckText).join('; ');
}

/** The `recipes` block of a family: at most `maxRows` (default MAX_FAMILY_ROWS) rows, the caption counting the rest. */
export function familyBlock(family: CubeFamily, esr: FamilyTables): CubeFamilyBlock {
  const rows = collectFamily(family, esr);
  const maxRows = family.maxRows ?? MAX_FAMILY_ROWS;
  const more = rows.length - maxRows;
  return {
    kind: 'recipes',
    caption: more > 0 ? `${family.label} (… and ${String(more)} more)` : family.label,
    rows: rows.slice(0, maxRows),
  };
}
