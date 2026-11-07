/**
 * elixirs.json (ESR 3.3): the drinkable utility elixirs.
 *
 * - Items: misc.txt rows of type `upot` (type2 `relx` regular, `gelx` greater, none: special). Effects come from
 *   `stat1` … `stat6` / `calc1` … `calc6`, rendered once with a marker value so the page can put in its own value (a
 *   formula's stats render together, so stats the game groups, like the four maximum resistances, read as one line).
 *   The tooltip is `spelldescstr` (with the `calc1` value when `spelldesc` is 2), the length `len` in frames.
 * - Drops: every elixir drop goes through the treasure class ROOT_TC. The classes that reference it are the sources
 *   (a potion pick that becomes an elixir roll instead); a source whose own `ConditionCalc` is a perk check is followed
 *   one level up (Unstable Mixtures on the rejuvenation potions). Below the root, a class with a perk check is left out
 *   of the roll when the killer lacks the perk: that is how the Alchemist perk texts' numbers come out (Alchemical
 *   Excellence "25%" = Greater 1 of Regular 3 + Greater 1, Bountiful Brews "+50%" = Single 1 / Double 1 with 2 picks).
 * - Perks: every Alchemist perk the formulas, the drop classes, the recipes or the alchemy plugin config read, with
 *   what the files do with it in `facts`. A perk check is a ConditionCalc that is 0 without the stat and not 0 with it.
 *
 * Warnings start with `elixirs:`.
 */
import { calcStatNames, evaluateElixirCalc, ELIXIR_STATS, framesToSeconds } from '../engine/elixirs.ts';
import type {
  CubeRecipe,
  ElixirDropSource,
  ElixirEffect,
  ElixirInfo,
  ElixirPerk,
  ElixirRecipe,
  ElixirsBundle,
  ElixirVariant,
} from '../engine/schema.ts';
import type { StatEntry } from '../engine/stats/types.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import { itemRowName, resolveName } from './itemNames.ts';
import { parseToml, type TomlEntry, type TomlValue } from './toml.ts';
import { readTcRows, type TcRow } from './treasureClassOdds.ts';
import type { TsvTable } from './tsv.ts';

/** The treasure class every elixir drop goes through */
export const ROOT_TC = 'Utility Elixir';
/** misc.txt item type of the utility potions that are elixirs, and the type2 of each variant */
const ELIXIR_TYPE = 'upot';
const VARIANT_TYPES: Readonly<Record<string, ElixirVariant>> = { relx: 'regular', gelx: 'greater' };
/** The value an effect is rendered with; replaced by `{v}` */
const MARKER = 7919;
/** A `len` above this many frames is "until it triggers" (Elixir of Reincarnation: 2,000,000,000) */
const UNTIL_TRIGGERED_FRAMES = 100_000_000;
/** The perk stats (itemstatcost names) of the Alchemist tree */
const ALCHEMY_STAT = /^alchemy_(\d+)$/;
const TREE_KEY = 'Alchemist';
/** cubemain `item_randomize` roll range (0 … 511) the Randomizing Stone recipes read */
const ROLL_RANGE = 512;
/** Alchemy plugin perks that act on utility potions (`[perks]` keys), with the `[values]` key of their number */
const PLUGIN_PERKS = ['compounded_synergy', 'savvy_elixirs', 'serendipity'] as const;

export interface ElixirsInputs {
  misc: TsvTable;
  treasureclassex: TsvTable;
  /** Row-numbered (stat id = row) */
  itemstatcost: TsvTable;
  experience: TsvTable;
  shrines: TsvTable;
  strings: ReadonlyMap<string, string>;
  cubeRows: readonly CubeRow[];
  /** cube.json raw recipes (their conditions are worded already) */
  cubeRecipes: readonly CubeRecipe[];
  /** celestialrayone.alchemy.toml; null when missing */
  alchemyConfig: string | null;
  renderStats: (entries: readonly StatEntry[]) => string[];
}

export interface ElixirsResult {
  bundle: ElixirsBundle;
  warnings: string[];
}

/** "Greater Elixir of the Giant" → "greater-elixir-of-the-giant" */
export function kebabSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "12.5" / "25" — a percent to at most two decimals */
export function formatPercent(fraction: number): string {
  return String(Math.round(fraction * 10000) / 100);
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** The perk stat a ConditionCalc checks (0 without it, not 0 with it), else null */
export function perkGate(condition: string): string | null {
  if (condition === '') return null;
  const names = calcStatNames(condition);
  if (names.length !== 1 || !ALCHEMY_STAT.test(names[0])) return null;
  const name = names[0];
  return evaluateElixirCalc(condition, {}) === 0 && evaluateElixirCalc(condition, { [name]: 1 }) !== 0 ? name : null;
}

/** experience.txt `MaxLvl` row (first class column) */
function readMaxLevel(experience: TsvTable): number {
  const row = experience.rows.find((entry) => entry.str('Level') === 'MaxLvl');
  const column = experience.columns.find((name) => name !== 'Level');
  return row === undefined || column === undefined ? 99 : row.num(column);
}

/** The cells as an itemstatcost name → id map and id → name */
function readStatNames(itemstatcost: TsvTable): Map<number, string> {
  return new Map(itemstatcost.rows.map((row, id) => [id, row.str('Stat')]));
}

interface PerkLookup {
  get(key: string): ElixirPerk | null;
}

function createPerkLookup(strings: ReadonlyMap<string, string>): PerkLookup {
  const cache = new Map<string, ElixirPerk | null>();
  return {
    get(key) {
      if (cache.has(key)) return cache.get(key) ?? null;
      const match = ALCHEMY_STAT.exec(key);
      let perk: ElixirPerk | null = null;
      if (match !== null) {
        const n = Number(match[1]);
        const row = Math.ceil(n / 3);
        const column = ((n - 1) % 3) + 1;
        const base = `Specializations${TREE_KEY}${String(row)}_${String(column)}`;
        const title = strings.get(`${base}Title`);
        if (title !== undefined && n >= 1 && n <= 15)
          perk = {
            key,
            title,
            tree: strings.get(`Specializations${TREE_KEY}`) ?? TREE_KEY,
            slug: kebabSlug(title),
            row,
            column,
            description: strings.get(`${base}Desc`) ?? '',
            facts: [],
          };
      }
      cache.set(key, perk);
      return perk;
    },
  };
}

// --- items --------------------------------------------------------------------------------------------------------

interface ElixirRow {
  info: ElixirInfo;
  type2: string;
}

function readEffects(
  row: ElixirsInputs['misc']['rows'][number],
  name: string,
  maxLevel: number,
  renderStats: ElixirsInputs['renderStats'],
  warnings: string[]
): ElixirEffect[] {
  const groups = new Map<string, string[]>();
  for (let i = 1; i <= 6; i++) {
    const stat = row.str(`stat${String(i)}`);
    if (stat === '') continue;
    const calc = row.str(`calc${String(i)}`);
    groups.set(calc, [...(groups.get(calc) ?? []), stat]);
  }
  return [...groups].map(([calc, stats]) => {
    const fixed = /^-?\d+$/.test(calc) ? Number(calc) : null;
    const value = fixed ?? MARKER;
    const rendered = renderStats(stats.map((stat) => ({ stat, param: '', min: value, max: value })));
    if (fixed !== null) return { lines: rendered, formula: null, stats, values: null };
    const lines = rendered.map((line) => line.replaceAll(String(MARKER), '{v}'));
    if (lines.length === 0 || lines.some((line) => !line.includes('{v}')))
      warnings.push(`elixirs: ${name} (${stats.join(', ')}) renders without its value: ${rendered.join(' / ') || '(no line)'}`);
    const at = (level: number) => evaluateElixirCalc(calc, { [ELIXIR_STATS.level]: level });
    const low = at(1);
    const high = at(maxLevel);
    if (low === null || high === null) warnings.push(`elixirs: ${name} formula reads more than stats: ${calc}`);
    return { lines, formula: calc, stats, values: low === null || high === null ? null : [low, high] };
  });
}

function readElixirs(input: ElixirsInputs, maxLevel: number, warnings: string[]): ElixirRow[] {
  const rows: ElixirRow[] = [];
  for (const row of input.misc.rows) {
    if (row.str('type') !== ELIXIR_TYPE) continue;
    const code = row.str('code');
    const name = resolveName(input.strings, row.str('namestr'), row.str('name'));
    const type2 = row.str('type2');
    const len = row.str('len');
    const frames = evaluateElixirCalc(len, {});
    if (frames === null) warnings.push(`elixirs: ${name} length reads more than stats: ${len}`);
    const tooltipKey = row.str('spelldescstr');
    const tooltip = resolveName(input.strings, tooltipKey, '');
    if (tooltip === '') warnings.push(`elixirs: ${name} has no tooltip string (${tooltipKey || 'blank spelldescstr'})`);
    const usage = row.str('UsageConditionCalc');
    const info: ElixirInfo = {
      code,
      name,
      slug: kebabSlug(name),
      variant: VARIANT_TYPES[type2] ?? 'special',
      state: row.str('state'),
      tooltip,
      ...(row.num('spelldesc') === 2 && row.str('calc1') !== '' ? { tooltipFormula: row.str('calc1') } : {}),
      effects: readEffects(row, name, maxLevel, input.renderStats, warnings),
      duration: len,
      ...(frames !== null && frames < UNTIL_TRIGGERED_FRAMES ? { seconds: framesToSeconds(frames) } : {}),
      ...(usage === '' ? {} : { usageCondition: usage }),
    };
    rows.push({ info, type2 });
  }
  // A regular and a greater elixir with the same state are one effect
  for (const { info } of rows) {
    if (info.variant === 'special') continue;
    const other = rows.find(
      (entry) => entry.info.state === info.state && entry.info.variant !== info.variant && entry.info.variant !== 'special'
    );
    if (other !== undefined) info.pair = other.info.code;
  }
  return rows;
}

// --- drops --------------------------------------------------------------------------------------------------------

interface DropWalk {
  /** Elixir code → the perks on its way down from the root */
  perks: Map<string, string[]>;
  /** The perk-gated classes below the root, with their parent */
  gated: { tc: TcRow; parent: TcRow; perk: string }[];
}

function walkDrops(rows: ReadonlyMap<string, TcRow>, warnings: string[]): DropWalk {
  const perks = new Map<string, string[]>();
  const gated: DropWalk['gated'] = [];
  const seen = new Set<string>();
  const go = (row: TcRow, path: string[]) => {
    if (seen.has(row.name)) return;
    seen.add(row.name);
    for (const entry of row.entries) {
      const sub = rows.get(entry.ref);
      if (sub === undefined) {
        perks.set(entry.ref, path);
        continue;
      }
      const perk = perkGate(sub.condition);
      if (sub.condition !== '' && perk === null)
        warnings.push(`elixirs: treasure class "${sub.name}" checks "${sub.condition}", not a perk; counted as met`);
      if (perk !== null) gated.push({ tc: sub, parent: row, perk });
      go(sub, perk === null ? path : [...path, perk]);
    }
  };
  const root = rows.get(ROOT_TC);
  if (root !== undefined) go(root, []);
  return { perks, gated };
}

/** Code → chance of one roll of `tc`, with the perk-gated classes the killer lacks left out */
export function rollChances(rows: ReadonlyMap<string, TcRow>, tc: string, has: (perk: string) => boolean): Map<string, number> {
  const chances = new Map<string, number>();
  const go = (name: string, share: number, depth: number) => {
    const row = rows.get(name);
    if (row === undefined || depth > 20) return;
    const entries = row.entries.filter((entry) => {
      const perk = perkGate(rows.get(entry.ref)?.condition ?? '');
      return perk === null || has(perk);
    });
    const total = entries.reduce((sum, entry) => sum + entry.prob, 0) + Math.max(row.noDrop, 0);
    if (total <= 0) return;
    for (const entry of entries) {
      const part = (share * entry.prob) / total;
      if (rows.has(entry.ref)) go(entry.ref, part, depth + 1);
      else chances.set(entry.ref, (chances.get(entry.ref) ?? 0) + part);
    }
  };
  go(tc, 1, 0);
  return chances;
}

function parentsOf(rows: ReadonlyMap<string, TcRow>): Map<string, TcRow[]> {
  const parents = new Map<string, TcRow[]>();
  for (const row of rows.values()) for (const entry of row.entries) parents.set(entry.ref, [...(parents.get(entry.ref) ?? []), row]);
  return parents;
}

const DIFFICULTIES: readonly { key: string; label: string }[] = [
  { key: '', label: 'Normal' },
  { key: 'N', label: 'Nightmare' },
  { key: 'H', label: 'Hell' },
];

/**
 * Where a potion class drops, from the names of the classes up to three levels above it: "Act 1 Junk" → Normal Act 1,
 * "Act 2 (N) Cpot A" → Nightmare Act 2, "Endgame Map Junk" → Endgame maps. All five acts of a difficulty read as the
 * difficulty. Falls back to the class name.
 */
export function sourceLabel(tc: string, parents: ReadonlyMap<string, readonly TcRow[]>): string {
  const acts = new Map<string, Set<number>>();
  let endgame = false;
  let level = [tc];
  const seen = new Set(level);
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = [];
    for (const name of level)
      for (const parent of parents.get(name) ?? []) {
        if (seen.has(parent.name)) continue;
        seen.add(parent.name);
        next.push(parent.name);
        const act = /^Act (\d)(?: \(([NH])\))? /.exec(parent.name);
        if (act !== null) {
          // The difficulty group is optional: undefined on a Normal class
          const difficulty = act.at(2) ?? '';
          acts.set(difficulty, (acts.get(difficulty) ?? new Set()).add(Number(act[1])));
        }
        if (/^Endgame Map /.test(parent.name)) endgame = true;
      }
    level = next;
  }
  const parts = DIFFICULTIES.flatMap(({ key, label }) => {
    const set = acts.get(key);
    if (set === undefined) return [];
    const list = [...set].sort((a, b) => a - b);
    return list.length === 5 ? [label] : [`${label} Act ${list.join(', ')}`];
  });
  if (endgame) parts.push('Endgame maps');
  return parts.length === 0 ? tc : parts.join(' · ');
}

// --- bundle -------------------------------------------------------------------------------------------------------

const listNames = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;

function configNumber(entries: ReadonlyMap<string, { value: TomlValue }>, path: string): number | null {
  const value = entries.get(path)?.value;
  return typeof value === 'number' ? value : null;
}

function configList(entries: ReadonlyMap<string, { value: TomlValue }>, path: string): TomlValue[] {
  const value = entries.get(path)?.value;
  return Array.isArray(value) ? value : [];
}

export function buildElixirsBundle(input: ElixirsInputs): ElixirsResult {
  const warnings: string[] = [];
  const { strings } = input;
  const maxLevel = readMaxLevel(input.experience);
  const statNames = readStatNames(input.itemstatcost);
  const perkLookup = createPerkLookup(strings);
  const perks = new Map<string, ElixirPerk>();
  const addFact = (key: string, fact: string) => {
    const perk = perkLookup.get(key);
    if (perk === null) {
      warnings.push(`elixirs: perk stat ${key} has no Alchemist title string`);
      return;
    }
    if (!perks.has(key)) perks.set(key, perk);
    const entry = perks.get(key);
    if (entry !== undefined && !entry.facts.includes(fact)) entry.facts.push(fact);
  };

  const items = readElixirs(input, maxLevel, warnings);
  const elixirs = items.map((entry) => entry.info);
  const byCode = new Map(elixirs.map((elixir) => [elixir.code, elixir]));
  const miscNames = new Map(input.misc.rows.map((row) => [row.str('code'), itemRowName(strings, row.str('namestr'), row.str('name'))]));
  const nameOf = (code: string) => byCode.get(code)?.name ?? miscNames.get(code) ?? code;
  if (elixirs.length === 0) warnings.push(`elixirs: misc.txt has no item of type ${ELIXIR_TYPE}`);

  // Utility potions that are not elixirs (Stamina, Antidote, Thawing): type2 upot
  const otherUtilityPotions = input.misc.rows
    .filter((row) => row.str('type') !== ELIXIR_TYPE && row.str('type2') === ELIXIR_TYPE)
    .map((row) => miscNames.get(row.str('code')) ?? row.str('name'));

  // --- formula perks: the shift of the effectiveness percent a perk is worth in every formula
  const formulas = elixirs.flatMap((elixir) => elixir.effects.flatMap((effect) => (effect.formula === null ? [] : [effect.formula])));
  const formulaPerks = [...new Set(formulas.flatMap((formula) => calcStatNames(formula)).filter((name) => ALCHEMY_STAT.test(name)))];
  for (const perk of formulaPerks) {
    const levels = [1, 10, 25, 50, maxLevel];
    const worth = Array.from({ length: 101 }, (_, k) => k).find((k) =>
      formulas.every((formula) =>
        levels.every(
          (level) =>
            evaluateElixirCalc(formula, { level, [perk]: 1 }) === evaluateElixirCalc(formula, { level, [ELIXIR_STATS.effectiveness]: k })
        )
      )
    );
    addFact(
      perk,
      worth === undefined
        ? 'Every elixir formula in misc.txt reads it.'
        : `Every elixir formula in misc.txt counts it as +${String(worth)}% Utility Potion Effectiveness.`
    );
  }

  // --- drops
  const tcRows = readTcRows(input.treasureclassex);
  const parents = parentsOf(tcRows);
  const walk = walkDrops(tcRows, warnings);
  if (!tcRows.has(ROOT_TC)) warnings.push(`elixirs: treasureclassex.txt has no "${ROOT_TC}" class`);
  for (const [code, path] of walk.perks) {
    const elixir = byCode.get(code);
    if (elixir === undefined) warnings.push(`elixirs: "${ROOT_TC}" can drop ${code}, which is not an elixir`);
    else elixir.dropPerks = path;
  }
  for (const { tc, parent, perk } of walk.gated) {
    const reachable = [...rollChances(tcRows, tc.name, () => true).keys()];
    const total = parent.entries.reduce((sum, entry) => sum + entry.prob, 0);
    const prob = parent.entries.find((entry) => entry.ref === tc.name)?.prob ?? 0;
    const variants = new Set(reachable.map((code) => byCode.get(code)?.variant));
    const variant = variants.size === 1 ? [...variants][0] : undefined;
    const names =
      reachable.length <= 6
        ? listNames(reachable.map(nameOf))
        : `the ${String(reachable.length)} ${variant === undefined || variant === 'special' ? '' : `${variant} `}elixirs`;
    addFact(
      perk,
      `Drops only with it: ${names} (treasure class ${tc.name}, ${String(prob)} of ${String(total)} in ${parent.name}; without the perk it is left out of the roll).`
    );
  }
  const gatePerks = [...new Set(walk.gated.map((entry) => entry.perk))].sort((a, b) => perkOrder(a) - perkOrder(b));
  const odds = subsets(gatePerks).map((set) => {
    const chances = rollChances(tcRows, ROOT_TC, (perk) => set.includes(perk));
    return { perks: set, chances: Object.fromEntries([...chances].map(([code, value]) => [code, round6(value)])) };
  });

  const sources: ElixirDropSource[] = [];
  for (const parent of parents.get(ROOT_TC) ?? []) {
    const share = (row: TcRow, ref: string) => {
      const total = row.entries.reduce((sum, entry) => sum + entry.prob, 0) + Math.max(row.noDrop, 0);
      return total <= 0 ? 0 : ((row.entries.find((entry) => entry.ref === ref)?.prob ?? 0) * 100) / total;
    };
    const perk = perkGate(parent.condition);
    if (perk === null) {
      sources.push({ tc: parent.name, label: sourceLabel(parent.name, parents), chance: round6(share(parent, ROOT_TC)) });
      continue;
    }
    // A perk route (Unstable Mixtures): the classes above it are the sources
    for (const grand of parents.get(parent.name) ?? []) {
      const potions = grand.entries.filter((entry) => !tcRows.has(entry.ref)).map((entry) => nameOf(entry.ref));
      const chance = round6(share(grand, parent.name));
      sources.push({ tc: grand.name, label: listNames(potions) || grand.name, chance, perk });
      addFact(perk, `${String(chance)}% of the ${listNames(potions) || grand.name} picks become an elixir roll instead (${grand.name}).`);
    }
  }
  // Perk classes above the sources (Bountiful Brews: Potion N Double makes more picks of Potion N Single)
  const sourceNames = new Set(sources.filter((source) => source.perk === undefined).map((source) => source.tc));
  const extraPicks = new Map<string, { roll: string; picks: number }[]>();
  for (const name of sourceNames)
    for (const parent of parents.get(name) ?? []) {
      const perk = perkGate(parent.condition);
      if (perk === null) continue;
      for (const roll of parents.get(parent.name) ?? []) {
        const total = roll.entries.reduce((sum, entry) => sum + entry.prob, 0);
        if (total <= 0) continue;
        const average = roll.entries.reduce((sum, entry) => sum + entry.prob * Math.max(tcRows.get(entry.ref)?.picks ?? 1, 1), 0) / total;
        extraPicks.set(perk, [...(extraPicks.get(perk) ?? []), { roll: roll.name, picks: average }]);
      }
    }
  for (const [perk, list] of extraPicks) {
    const averages = [...new Set(list.map((entry) => entry.picks))];
    const rolls = list.map((entry) => entry.roll);
    addFact(
      perk,
      averages.length === 1
        ? `With it, the potion rolls (${rolls[0] ?? ''} … ${rolls[rolls.length - 1] ?? ''}) make ${String(averages[0])} picks on average instead of 1, so elixirs drop that much more often too.`
        : `With it, the potion rolls (${rolls.join(', ')}) make more picks, so elixirs drop more often too.`
    );
  }

  // --- recipes
  const elixirCodes = new Set(elixirs.map((elixir) => elixir.code));
  const elixirTypes = new Set([ELIXIR_TYPE, ...Object.keys(VARIANT_TYPES)]);
  const cubeByLine = new Map(input.cubeRows.map((row) => [row.line, row]));
  const recipes: ElixirRecipe[] = input.cubeRecipes
    .filter((recipe) =>
      recipe.outputs.some((output) => output.code !== null && (elixirCodes.has(output.code) || elixirTypes.has(output.code)))
    )
    .map((recipe) => ({
      id: recipe.id,
      description: recipe.description,
      inputs: recipe.inputs.map((entry) => ({ text: entry.text, ...(entry.code === '' ? {} : { code: entry.code }), qty: entry.qty })),
      outputs: recipe.outputs.map((output) => ({ text: output.text, ...(output.code === null ? {} : { code: output.code }) })),
      conditions: recipe.conditions,
    }));
  const perkTitles = new Map(
    Array.from({ length: 15 }, (_, i) => `alchemy_${String(i + 1)}`).flatMap((key) => {
      const perk = perkLookup.get(key);
      return perk === null ? [] : [[perk.title, key] as const];
    })
  );
  const neededPerks = (recipe: ElixirRecipe) =>
    recipe.conditions.flatMap((condition) => {
      const title = /^Needs the \S+ perk (.+)$/.exec(condition)?.[1];
      const key = title === undefined ? undefined : perkTitles.get(title);
      return key === undefined ? [] : [key];
    });
  const inputText = (recipe: ElixirRecipe) =>
    recipe.inputs.map((entry) => (entry.qty > 1 ? `${String(entry.qty)}× ${entry.text}` : entry.text)).join(' + ');
  for (const recipe of recipes) {
    const outputCodes = recipe.outputs.flatMap((output) => (output.code === undefined ? [] : [output.code]));
    for (const { info, type2 } of items)
      if (outputCodes.includes(info.code) || outputCodes.includes(type2) || outputCodes.includes(ELIXIR_TYPE))
        info.recipes = [...(info.recipes ?? []), recipe.id];
  }
  // Per input set: the perks each row needs, worded once per perk ("Cube: Randomizing Stone + Perfect Gem → …")
  const byInputs = new Map<string, ElixirRecipe[]>();
  for (const recipe of recipes) byInputs.set(inputText(recipe), [...(byInputs.get(inputText(recipe)) ?? []), recipe]);
  for (const [inputs, group] of byInputs) {
    const shared = group.map(neededPerks).reduce((common, list) => common.filter((key) => list.includes(key)));
    for (const key of new Set(group.flatMap(neededPerks))) {
      const outputs = [
        ...new Set(
          group.filter((recipe) => neededPerks(recipe).includes(key)).flatMap((recipe) => recipe.outputs.map((output) => output.text))
        ),
      ];
      addFact(key, `Needed for the cube recipe ${inputs} → ${outputs.join(' or ')}.`);
    }
    // A Randomizing Stone roll threshold on a row (Alchemical Excellence: roll ≥ 384 of 0 … 511 = 25%) belongs to the
    // perks that row needs and the other rows with these inputs do not
    for (const recipe of group) {
      const condition = cubeByLine.get(recipe.id)?.condition;
      if (condition === undefined || condition === null || condition.op !== 15 || statNames.get(condition.param) !== 'item_randomize')
        continue;
      const chance = (ROLL_RANGE - condition.value) / ROLL_RANGE;
      for (const key of neededPerks(recipe).filter((entry) => !shared.includes(entry)))
        addFact(
          key,
          `With it, ${formatPercent(chance)}% of these transmutes give ${recipe.outputs.map((output) => output.text).join(', ')} (a Randomizing Stone roll of at least ${String(condition.value)} of 0 to ${String(ROLL_RANGE - 1)}, cubemain line ${String(recipe.id)}).`
        );
    }
  }

  // --- the item named like a perk (Elixir of Reincarnation) and the alchemy plugin config
  const config = input.alchemyConfig === null ? null : parseToml(input.alchemyConfig);
  if (config === null) warnings.push('elixirs: d2rloader/config/celestialrayone.alchemy.toml missing; plugin perks left out');
  for (const error of config?.errors ?? []) warnings.push(`elixirs: alchemy.toml ${error}`);
  const entries: ReadonlyMap<string, TomlEntry> = config?.entries ?? new Map<string, TomlEntry>();
  for (let n = 1; n <= 15; n++) {
    const key = `alchemy_${String(n)}`;
    const perk = perkLookup.get(key);
    const elixir = perk === null ? undefined : elixirs.find((entry) => entry.name === perk.title);
    if (perk === null || elixir === undefined) continue;
    elixir.perk = key;
    const recipeNote =
      elixir.recipes === undefined
        ? 'cubemain.txt has no recipe that makes it and no treasure class drops it.'
        : `cubemain lines ${elixir.recipes.join(', ')} make it.`;
    addFact(key, `Gives the ${elixir.name}; ${recipeNote}`);
  }
  for (let i = 0; entries.has(`reincarnation[${String(i)}].state`); i++) {
    const prefix = `reincarnation[${String(i)}]`;
    const codes = configList(entries, `${prefix}.sweep_items`).filter((value): value is string => typeof value === 'string');
    const cooldown = configNumber(entries, `${prefix}.cooldown_seconds`);
    const frames = configNumber(entries, `${prefix}.invulnerable_frames`);
    for (const code of codes) {
      const elixir = byCode.get(code);
      if (elixir === undefined) continue;
      const parts = ['On a hit that would kill you it restores full life and mana instead'];
      if (frames !== null) parts.push(`makes you invulnerable for ${String(framesToSeconds(frames))} s`);
      if (cooldown !== null) parts.push(`and starts a ${String(cooldown)} s cooldown`);
      if (elixir.perk !== undefined) addFact(elixir.perk, `${parts.join(', ')} (alchemy plugin).`);
    }
  }
  const perkStat = (path: string) => {
    const id = configNumber(entries, path);
    return id === null ? undefined : statNames.get(id);
  };
  const values = (key: string) => configNumber(entries, `values.${key}`);
  const shrineNames = new Map(input.shrines.rows.map((row) => [row.num('Code'), row.str('Name')]));
  for (const name of PLUGIN_PERKS) {
    const key = perkStat(`perks.${name}`);
    if (key === undefined) {
      if (config !== null) warnings.push(`elixirs: alchemy.toml [perks] ${name} missing`);
      continue;
    }
    if (name === 'savvy_elixirs') {
      const chance = values('savvy_elixirs_chance');
      addFact(
        key,
        `${chance === null ? 'A' : `${String(chance)}%`} chance that a utility potion is not used up; its effect still applies (alchemy plugin).`
      );
    } else if (name === 'serendipity') {
      const chance = values('serendipity_chance');
      const shrines = configList(entries, 'serendipity.shrine_codes').flatMap((code) =>
        typeof code === 'number' ? [shrineNames.get(code) ?? `shrine ${String(code)}`] : []
      );
      addFact(
        key,
        `${chance === null ? 'A' : `${String(chance)}%`} chance that a utility potion also gives the effect of one random shrine${shrines.length === 0 ? '' : `: ${listNames(shrines)}`} (alchemy plugin).`
      );
    } else {
      const percent = values('compounded_synergy_percent');
      addFact(
        key,
        `Every potion effect is ${percent === null ? 'stronger' : `${String(percent)}% stronger`} for each different potion effect running on you, itself included (alchemy plugin; not in the values on this page).`
      );
    }
  }
  const findPotion = ['rvs', 'rvl'].filter((code) => typeof entries.get(`find_potion.${code}`)?.value === 'string');
  const unstable = sources.find((source) => source.perk !== undefined)?.perk;
  if (unstable !== undefined && findPotion.length > 0 && entries.get('find_potion.enabled')?.value !== false)
    addFact(
      unstable,
      'It works on the rejuvenation potions Find Potion makes too: the alchemy plugin sends them through the same treasure classes.'
    );

  const sortedPerks = [...perks.values()].sort((a, b) => perkOrder(a.key) - perkOrder(b.key));
  return {
    bundle: { maxLevel, elixirs, perks: sortedPerks, drops: { root: ROOT_TC, sources, odds }, recipes, otherUtilityPotions },
    warnings,
  };
}

function perkOrder(key: string): number {
  return Number(ALCHEMY_STAT.exec(key)?.[1] ?? 99);
}

/** Every subset, the empty one first, then by size and input order */
export function subsets<T>(items: readonly T[]): T[][] {
  const all: T[][] = [[]];
  for (const item of items) all.push(...all.map((set) => [...set, item]));
  return all.sort((a, b) => a.length - b.length);
}
