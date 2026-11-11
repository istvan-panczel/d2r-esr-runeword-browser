/**
 * killledger.json: the Kill Ledger's bonuses and how each one unlocks. See `KillLedgerBundle`.
 *
 * - Bonuses: the cube families `kill-ledger-tiers` and `kill-ledger-bosses`. A boss row is grouped by its
 *   `kill-ledger-*` marker mod, so a boss with harder forms (Lich King, Rathma) is one entry.
 * - Which boss a row means: since ESR 3.3.04 the ascendancies plugin credits the kills, so its config's
 *   `[[kill_credit]]` tables say which monsters (monstats.txt `*hcIdx`) give which `value` (`value_above` for the
 *   stronger form, by maximum life). Before, and as a fallback without the config: the monsters whose `death-skill`
 *   (monprop.txt) sets `kill_check` to the row's value; a skill's value is its level for `Just Killed Boss`
 *   (`aurastatcalc1` = `lvl`) and `clc1?a:b` for the others. The dev label only picks a row's name when several
 *   monsters share it. A row labelled `A + B` needs both kills: its value is the sum of their two values, and the
 *   entry stays one boss.
 * - Map tier and area: areas.json `mapBosses` (the monstats ids match).
 * - The transmute window: the config's `kill_credit_frames`, else the `auralencalc` of the Just Killed skills, in frames.
 * - The source: the Starter Pack's cube rows. The tooltip: the item's `spelldescstr` string.
 * - The official page is parsed (`killLedgerPage.ts`) and compared; differences go to `pageDiffs`, the files win.
 */
import type {
  Area,
  CubeBundle,
  CubeRecipe,
  KillLedgerBoss,
  KillLedgerBossArea,
  KillLedgerBundle,
  KillLedgerIngredient,
  KillLedgerItem,
  KillLedgerPageDiff,
  KillLedgerTier,
  MapBoss,
} from '../engine/schema.ts';
import { withoutCount } from '../engine/cubeIcons.ts';
import type { CubeMod, CubeRow, ModRenderer } from './cube/cubeRows.ts';
import { parseKillLedgerPage, type KillLedgerPage } from './killLedgerPage.ts';
import { parseToml } from './toml.ts';
import type { TsvTable } from './tsv.ts';

const LEDGER_CODE = 'led';
const LEDGER_INPUT = 'Kill Ledger';
const STARTER_PACK = 'ag8';
const KILL_CHECK_STAT = 'kill_check';
const FRAMES_PER_SECOND = 25;
const MARKER_PREFIX = 'kill-ledger-';
const TIER_MARKER = /^kill-ledger-tier-\d+$/;
const DEATH_SKILL = 'death-skill';
/** The skills a boss casts when it dies; other `kill_check` skills are summons and buffs that use the stat as a marker */
const JUST_KILLED = /^Just Killed /;
const PROP_COLUMN = /^prop\d+(?: \([NH]\))?$/;

export interface KillLedgerInput {
  /** Raw docs/kill_ledger.htm; null when missing */
  page: string | null;
  cube: Pick<CubeBundle, 'recipes' | 'icons'>;
  /** Enabled cubemain rows (the recipes' source: conditions and mods by line) */
  cubeRows: readonly CubeRow[];
  renderMods: ModRenderer;
  monprop: TsvTable;
  /** monstats.txt without its Expansion rows (row index = hcIdx) */
  monstats: TsvTable;
  /** Raw d2rloader/config/celestialrayone.ascendancies.toml (the plugin's kill credit, ESR 3.3.04+); null when missing */
  ascendanciesConfig: string | null;
  /** skills.txt in row order (row n = skill id n) */
  skills: TsvTable;
  misc: TsvTable;
  strings: ReadonlyMap<string, string>;
  /** areas.json */
  areas: readonly Area[];
  mapBosses: readonly MapBoss[];
  /** Display name of an item code or unique name */
  nameOf: (code: string) => string;
}

export interface KillLedgerResult {
  bundle: KillLedgerBundle;
  warnings: string[];
  counts: Record<string, number>;
}

/** The numbers of a text, sorted: page and file wording differ, what counts is the values */
const numbersOf = (lines: readonly string[]) =>
  lines
    .flatMap((line) => [...line.matchAll(/\d+/g)].map((match) => Number(match[0])))
    .sort((a, b) => a - b)
    .join(',');
const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const ingredientText = (ingredient: Pick<KillLedgerIngredient, 'name' | 'qty'>) =>
  ingredient.qty > 1 ? `${String(ingredient.qty)}× ${ingredient.name}` : ingredient.name;

/**
 * A boss name in a form that survives the page's and the dev labels' spelling: lower case, no possessive `'s`, no
 * "the" or "any", singular, words sorted ("Fallen Ancient Angel" ≈ "Ancient Fallen Angel", "Any Eternal Ancient" ≈
 * "Eternal Ancients").
 */
export function bossKey(name: string): string {
  return normalise(name)
    .replace(/'s\b/g, '')
    .split(' ')
    .filter((word) => word !== 'the' && word !== 'any')
    .map((word) => word.replace(/s$/, ''))
    .sort()
    .join(' ');
}

/** "2x Flawed Tourmaline", "Any Perfect Gem x2" → name and count */
function pageIngredient(text: string): { name: string; qty: number } {
  const prefixed = /^(\d+)x\s+(.+)$/i.exec(text);
  if (prefixed !== null) return { name: prefixed[2], qty: Number(prefixed[1]) };
  const suffixed = /^(.+?)\s+x(\d+)$/i.exec(text);
  const base = suffixed === null ? text : suffixed[1];
  return { name: base.replace(/^Any\s+/i, ''), qty: suffixed === null ? 1 : Number(suffixed[2]) };
}

/** The ledger's description lines in reading order (the game draws multi-line strings bottom-up; "+1%%" is one %) */
function tooltipLines(misc: TsvTable, strings: ReadonlyMap<string, string>): string[] {
  const row = misc.rows.find((entry) => entry.str('code') === LEDGER_CODE);
  return (strings.get(row?.str('spelldescstr') ?? '') ?? '')
    .split('\n')
    .map((line) => line.replace(/%%/g, '%').trim())
    .filter((line) => line !== '')
    .reverse();
}

/** Value → monster ids, from each monster's `death-skill` entries that set `kill_check` (monprop.txt). */
export function readKillValues(monprop: TsvTable, skills: TsvTable, warn: (message: string) => void): Map<number, string[]> {
  const values = new Map<number, string[]>();
  const add = (value: number, monster: string) => {
    const list = values.get(value) ?? [];
    if (!list.includes(monster)) list.push(monster);
    values.set(value, list);
  };
  const props = monprop.columns.filter((column) => PROP_COLUMN.test(column));
  for (const row of monprop.rows) {
    for (const prop of props) {
      if (row.str(prop) !== DEATH_SKILL) continue;
      const skill = skills.rows.at(Number(row.str(prop.replace('prop', 'par'))));
      if (skill === undefined || !JUST_KILLED.test(skill.str('skill')) || skill.str('aurastat1') !== KILL_CHECK_STAT) continue;
      const calc = skill.str('aurastatcalc1');
      const fixed = /^clc1\?(\d+):(\d+)$/.exec(calc);
      if (calc === 'lvl') add(Number(row.str(prop.replace('prop', 'max'))), row.str('Id'));
      else if (fixed !== null)
        [fixed[1], fixed[2]].forEach((value) => {
          add(Number(value), row.str('Id'));
        });
      else warn(`${row.str('Id')}: kill_check formula "${calc}" not understood`);
    }
  }
  return values;
}

export interface KillCredit {
  /** Kill value → monster ids (monstats.txt `Id`) */
  values: Map<number, string[]>;
  /** How long a kill counts, in frames; null when the config has no number */
  frames: number | null;
}

/**
 * The plugin's kill credit (`[[kill_credit]]` of the ascendancies config): each entry's `monsters` (hcIdx) give `value`,
 * and `value_above` too when set (the uber form). Null when the config is missing or has no entry.
 */
export function readKillCredit(config: string | null, monstats: TsvTable, warn: (message: string) => void): KillCredit | null {
  if (config === null) return null;
  const { entries, errors } = parseToml(config);
  for (const error of errors) warn(`ascendancies.toml ${error}`);
  const values = new Map<number, string[]>();
  for (let i = 0; entries.has(`kill_credit[${String(i)}].name`); i++) {
    const at = (key: string) => entries.get(`kill_credit[${String(i)}].${key}`)?.value;
    const name = String(at('name'));
    const monsters = at('monsters');
    const ids = (Array.isArray(monsters) ? monsters : []).map((index) => monstats.rows.at(Number(index))?.str('Id') ?? '');
    if (ids.length === 0 || ids.includes('')) {
      warn(`ascendancies.toml kill credit "${name}": monsters ${JSON.stringify(monsters)} not all in monstats.txt`);
      continue;
    }
    for (const value of [at('value'), at('value_above')]) {
      if (typeof value !== 'number') continue;
      const list = values.get(value) ?? [];
      for (const id of ids) if (!list.includes(id)) list.push(id);
      values.set(value, list);
    }
  }
  if (values.size === 0) return null;
  const frames = entries.get('ascendancies.kill_credit_frames')?.value;
  return { values, frames: typeof frames === 'number' && frames > 0 ? frames : null };
}

/** Seconds from the `Just Killed` aura length; null when the skills disagree or have no number */
function readWindow(skills: TsvTable): number | null {
  const lengths = new Set(
    skills.rows
      .filter((row) => JUST_KILLED.test(row.str('skill')) && row.str('aurastat1') === KILL_CHECK_STAT)
      .map((row) => row.num('auralencalc'))
  );
  if (lengths.size !== 1) return null;
  const [length] = lengths;
  return length > 0 ? length / FRAMES_PER_SECOND : null;
}

const tierNumberOf = (row: CubeRow) =>
  row.outputs
    .flatMap((output) => output.mods)
    .find((mod) => TIER_MARKER.test(mod.mod))
    ?.mod.replace(/^kill-ledger-tier-/, '');

/** The bonus mods of a row: no markers, no tooltip hint lines (`mythicaldesc` swaps the "next milestone" text) */
function bonusMods(row: CubeRow): CubeMod[] {
  return row.outputs.flatMap((output) => output.mods).filter((mod) => mod.mod !== 'mythicaldesc' && !mod.mod.startsWith(MARKER_PREFIX));
}

const bossMarker = (row: CubeRow) =>
  row.outputs.flatMap((output) => output.mods).find((mod) => mod.mod.startsWith(MARKER_PREFIX) && !TIER_MARKER.test(mod.mod))?.mod;

export function buildKillLedgerBundle(input: KillLedgerInput): KillLedgerResult {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(`killledger: ${message}`);
  const icons = input.cube.icons ?? {};
  const iconOf = (text: string) => (Object.hasOwn(icons, withoutCount(text)) ? (icons[withoutCount(text)] ?? null) : null);
  const ingredient = (entry: CubeRecipe['inputs'][number]): KillLedgerIngredient => ({
    name: withoutCount(entry.text),
    qty: entry.qty,
    icon: iconOf(entry.text),
  });
  const ingredientsOf = (recipe: CubeRecipe) =>
    recipe.inputs.filter((entry) => withoutCount(entry.text) !== input.nameOf(LEDGER_INPUT)).map(ingredient);

  const rowsByLine = new Map(input.cubeRows.map((row) => [row.line, row]));
  const rowOf = (recipe: CubeRecipe) => rowsByLine.get(recipe.id);
  const recipesOf = (family: string) => input.cube.recipes.filter((recipe) => recipe.family === family);

  // --- item ---
  const packRecipes = recipesOf('starter-pack').filter((recipe) => recipe.outputs.some((output) => output.code === LEDGER_INPUT));
  const packInput = packRecipes.at(0)?.inputs.at(0);
  if (packRecipes.length === 0 || packInput === undefined) warn('no Starter Pack cube row gives the Kill Ledger');
  const remakeRecipe = recipesOf('starter-pack').find((recipe) => recipe.outputs.some((output) => output.code === STARTER_PACK));
  const item: KillLedgerItem = {
    name: input.nameOf(LEDGER_INPUT),
    icon: iconOf(input.nameOf(LEDGER_INPUT)),
    source: {
      pack: packInput === undefined ? { name: input.nameOf(STARTER_PACK), qty: 1, icon: null } : ingredient(packInput),
      classes: packRecipes.length,
      remake: remakeRecipe === undefined ? [] : remakeRecipe.inputs.map(ingredient),
    },
    tooltip: tooltipLines(input.misc, input.strings),
  };
  if (item.tooltip.length === 0) warn('no description lines for the Kill Ledger (misc.txt spelldescstr)');

  // --- kill bonuses ---
  const tiers: KillLedgerTier[] = [];
  for (const recipe of recipesOf('kill-ledger-tiers')) {
    const row = rowOf(recipe);
    const kills = row?.condition?.value;
    if (row === undefined || kills === undefined) {
      warn(`${recipe.description}: row not read`);
      continue;
    }
    tiers.push({
      tier: Number(tierNumberOf(row)),
      kills,
      ingredients: ingredientsOf(recipe),
      bonus: input.renderMods(bonusMods(row)),
    });
  }
  tiers.sort((a, b) => a.kills - b.kills);

  // --- boss bonuses ---
  const credit = readKillCredit(input.ascendanciesConfig, input.monstats, warn);
  const killValues = credit?.values ?? readKillValues(input.monprop, input.skills, warn);
  const mapBosses = new Map(input.mapBosses.map((boss) => [boss.id, boss]));
  const areaById = new Map(input.areas.map((area) => [area.id, area]));
  const areaOf = (id: number): KillLedgerBossArea | undefined => {
    const area = areaById.get(id);
    if (area === undefined) return undefined;
    return { id, name: area.name, tier: area.tier ?? 0, ...(area.mapBossPick === undefined ? {} : { random: true }) };
  };

  interface Draft {
    marker: string;
    label: string;
    recipe: CubeRecipe;
    row: CubeRow;
    values: number[];
    monsters: string[];
  }
  const drafts = new Map<string, Draft>();
  for (const recipe of recipesOf('kill-ledger-bosses')) {
    const row = rowOf(recipe);
    const marker = row === undefined ? undefined : bossMarker(row);
    const value = row?.condition?.value;
    if (row === undefined || marker === undefined || value === undefined) {
      warn(`${recipe.description}: row not read`);
      continue;
    }
    const label = recipe.description.replace(/^Kill Ledger /, '');
    const draft = drafts.get(marker) ?? { marker, label, recipe, row, values: [], monsters: [] };
    draft.values.push(value);
    const direct = killValues.get(value) ?? [];
    if (direct.length > 0) {
      for (const monster of direct) if (!draft.monsters.includes(monster)) draft.monsters.push(monster);
    } else if (!isPair(label, value, killValues)) {
      warn(`${recipe.description}: kill value ${String(value)} matches no monster`);
    }
    if (direct.length === 1 && !label.includes('+')) {
      const name = mapBosses.get(direct[0])?.name;
      if (name !== undefined && bossKey(label.replace(/ Uber$/, '')) !== bossKey(name))
        warn(`${recipe.description}: unknown boss label (the kill value belongs to ${name})`);
    }
    drafts.set(marker, draft);
  }

  const bosses: KillLedgerBoss[] = [];
  for (const draft of drafts.values()) {
    const known = draft.monsters.flatMap((id) => mapBosses.get(id) ?? []);
    if (known.length < draft.monsters.length) {
      const missing = draft.monsters.filter((id) => !mapBosses.has(id));
      warn(`${draft.label}: ${missing.join(', ')} not in the areas.json map bosses`);
    }
    const first = known.at(0);
    if (first === undefined) {
      warn(`${draft.label}: unknown boss label (no monster)`);
      continue;
    }
    const arenas = [...new Set(known.flatMap((boss) => boss.arenas))];
    bosses.push({
      id: draft.marker.slice(MARKER_PREFIX.length),
      name: known.length === 1 ? first.name : draft.label,
      monsters: known.map((boss) => ({ id: boss.id, name: boss.name })),
      tier: first.tier,
      areas: arenas.flatMap((id) => areaOf(id) ?? []),
      killValues: draft.values,
      ingredients: ingredientsOf(draft.recipe),
      bonus: input.renderMods(bonusMods(draft.row)),
    });
  }

  const windowSeconds = credit?.frames != null ? credit.frames / FRAMES_PER_SECOND : readWindow(input.skills);
  if (windowSeconds === null) warn('neither the kill credit config nor the Just Killed skills give a transmute window');
  const seconds = windowSeconds ?? 0;

  // --- official page ---
  let pageDiffs: KillLedgerPageDiff[] = [];
  if (input.page === null) {
    warn('docs/kill_ledger.htm missing in the ESR clone: no page comparison');
  } else {
    const page = parseKillLedgerPage(input.page);
    for (const message of page.warnings) warn(message);
    pageDiffs = comparePage(page, tiers, bosses, seconds, warn);
  }

  return {
    bundle: { item, windowSeconds: seconds, tiers, bosses, pageDiffs },
    warnings,
    counts: { killLedgerTiers: tiers.length, killLedgerBosses: bosses.length, killLedgerPageDiffs: pageDiffs.length },
  };
}

/** A label `A + B` whose value is the sum of two monsters' values (both bosses die in the same fight) */
function isPair(label: string, value: number, killValues: ReadonlyMap<number, readonly string[]>): boolean {
  if (!label.includes('+')) return false;
  for (const first of killValues.keys()) if (killValues.has(value - first)) return true;
  return false;
}

/** Where the official page reads differently from the files */
export function comparePage(
  page: KillLedgerPage,
  tiers: readonly KillLedgerTier[],
  bosses: readonly KillLedgerBoss[],
  windowSeconds: number,
  warn: (message: string) => void
): KillLedgerPageDiff[] {
  const diffs: KillLedgerPageDiff[] = [];
  const add = (subject: string, files: string, pageValue: string) => {
    if (normalise(files) !== normalise(pageValue)) diffs.push({ subject, files, page: pageValue });
  };
  const ingredientsText = (list: readonly Pick<KillLedgerIngredient, 'name' | 'qty'>[]) => list.map(ingredientText).join(' + ');
  const pageIngredients = (list: readonly string[]) => list.map(pageIngredient).map(ingredientText).join(' + ');
  const compareBonus = (subject: string, files: readonly string[], pageLines: readonly string[]) => {
    if (numbersOf(files) !== numbersOf(pageLines)) diffs.push({ subject, files: files.join(', '), page: pageLines.join(', ') });
  };

  if (page.windowSeconds !== undefined) add('Transmute window (seconds)', String(windowSeconds), String(page.windowSeconds));
  add('Kill bonuses', String(tiers.length), String(page.tiers.length));
  add('Boss bonuses', String(bosses.length), String(page.bosses.length));

  page.tiers.forEach((pageTier, i) => {
    const tier = tiers.at(i);
    if (tier === undefined) return;
    const where = `Kill bonus ${String(tier.tier)}`;
    add(`${where} kills needed`, String(tier.kills), String(pageTier.kills));
    add(`${where} ingredients`, ingredientsText(tier.ingredients), pageIngredients(pageTier.ingredients));
    compareBonus(`${where} bonus`, tier.bonus, pageTier.bonus);
  });

  const unmatched = new Set(bosses);
  for (const pageBoss of page.bosses) {
    const key = bossKey(pageBoss.name);
    const boss = bosses.find((entry) => bossKey(entry.name) === key);
    if (boss === undefined) {
      warn(`docs/kill_ledger.htm: boss row "${pageBoss.name}" matches no boss in the files`);
      continue;
    }
    unmatched.delete(boss);
    if (boss.monsters.length === 1) add(`${boss.name} name`, boss.name, pageBoss.name);
    add(`${boss.name} ingredients`, ingredientsText(boss.ingredients), pageIngredients(pageBoss.ingredients));
    compareBonus(`${boss.name} bonus`, boss.bonus, pageBoss.bonus);
  }
  for (const boss of unmatched) warn(`docs/kill_ledger.htm: no boss row for ${boss.name}`);
  return diffs;
}
