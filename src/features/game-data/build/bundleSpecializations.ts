/**
 * specializations.json: ESR 3.3's specialisation system (docs/specializations.htm). See `SpecializationsBundle`.
 *
 * - Rules and perk order: the launcher plugin config `celestialrayone.specializations.toml` (`points_stat`,
 *   `point_levels`, `unlock_points`, `max_points`, `perks_per_row`, `respec_stat` / `unlearn_cost`, `unlearn_hint`,
 *   `unlock_stat`, one `[[specialization]]` block per tab with its perk `stats`, `titles` and `descriptions` as
 *   `@d2r:<string key>`). Perk n of a tree sits in row ⌈n / perks_per_row⌉.
 * - Unlock items: the misc.txt item whose stat is `unlock_stat` (the Mystical Tesseract, its formula gives the late
 *   points), the cubemain row that makes it (its input is the shard), the treasure classes that roll the shard
 *   (monsters and chances from `treasureClassOdds.ts`). The respec item: the misc.txt item whose stat is `respec_stat`
 *   (Token of Absolution) and the cubemain row that makes it.
 * - Per perk, everything in the files that reads its stat: cube rows (`cube/perks.ts` checks, grouped by family),
 *   treasure classes (`ConditionCalc`), misc.txt and skills.txt formulas, the perk plugin configs (`perk_stat = <id>`,
 *   or the alchemy plugin's `[perks]` table), the Enhance bundle (Sanctimonious, Hallowed Accessories) and the weapon
 *   mastery bundle (True Master). A perk nothing reads gets a note and a `specializations:` warning.
 * - `PERK_ITEMS`: perks whose text promises an item; the files are checked for it (a recipe that makes it, a drop
 *   behind the perk) and the result is a note.
 * - The official page is parsed (`specializationsPage.ts`) and compared; differences go to `pageDiffs`, the files win.
 */
import type {
  CubeBundle,
  EnhanceBundle,
  MasteriesBundle,
  SpecializationCubeLink,
  SpecializationDrop,
  SpecializationEnhanceLink,
  SpecializationPageDiff,
  SpecializationPerk,
  SpecializationPlugin,
  SpecializationRules,
  SpecializationShardDrop,
  SpecializationsBundle,
  SpecializationTree,
} from '../engine/schema.ts';
import { specializationSlug } from '../engine/specializationLinks.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import type { PerkCheck } from './cube/perks.ts';
import { resolveName } from './itemNames.ts';
import { parseSpecializationsPage, type SpecializationsPage } from './specializationsPage.ts';
import { stripColorCodes } from './strings.ts';
import { parseToml, type TomlEntry, type TomlValue } from './toml.ts';
import { chanceOfAny, createTcOdds, readTcRows } from './treasureClassOdds.ts';
import { createTreasureClassIndex, refOf } from './treasureClasses.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

/** Raw files of the clone the bundle reads besides the tables */
export interface SpecializationsSources {
  /** celestialrayone.specializations.toml; null when the clone has none (no bundle content then) */
  config: string | null;
  /** The perk plugin configs (alchemy, blacksmith, jeweler, archaeology) by file name; text null when missing */
  perkConfigs: readonly { file: string; text: string | null }[];
  /** docs/specializations.htm; null when missing */
  page: string | null;
  /** File names in the HD perk icon folder (`alchemist.sprite`, …) */
  sheets: readonly string[];
}

export interface SpecializationsInput {
  sources: SpecializationsSources;
  /** Row-numbered (row n = stat id n) */
  itemstatcost: TsvTable;
  misc: TsvTable;
  skills: TsvTable;
  treasureclassex: TsvTable;
  monstats: TsvTable;
  superuniques: TsvTable;
  /** levels.txt: the areas a shard-dropping monster spawns in (`mon` / `nmon` / `umon` columns) */
  levels: TsvTable;
  /** areas.json names by level id */
  areaNames: ReadonlyMap<number, string>;
  cubeRows: readonly CubeRow[];
  /** cube.json rows by family (bundleCube assignCubeRows) */
  familyRows: ReadonlyMap<string, readonly CubeRow[]>;
  perkChecks: (row: CubeRow) => readonly PerkCheck[];
  cube: Pick<CubeBundle, 'families'>;
  enhance: Pick<EnhanceBundle, 'anointmentSlots' | 'sanctification'>;
  masteries: Pick<MasteriesBundle, 'anyWeaponPerk'>;
  strings: ReadonlyMap<string, string>;
  /** Display name of an item code */
  nameOf: (code: string) => string;
}

export interface SpecializationsResult {
  bundle: SpecializationsBundle;
  warnings: string[];
  counts: Record<string, number>;
}

/** The plugin config of the specialisation system */
export const SPECIALIZATIONS_CONFIG_FILE = 'celestialrayone.specializations.toml';
/** The perk plugin configs whose sections name perk stats */
export const PERK_CONFIG_FILES = [
  'celestialrayone.alchemy.toml',
  'celestialrayone.blacksmith.toml',
  'celestialrayone.jeweler.toml',
  'celestialrayone.archaeology.toml',
] as const;
/** The HD perk icon sheets: one `.sprite` per tree, one frame per perk in row order */
export const ESR_HD_SPECIALIZATION_SPRITES_DIR = 'Eastern_Sun_Resurrected.mpq/data/hd/global/ui/specializations';

/**
 * Perks whose description promises an item, by perk stat: the item codes and how the text says it is had. "cube": a
 * cubemain row must make one of them; "drop": a treasure class on the way to them must check the perk. The check's
 * outcome is a note on the perk (and a warning when the files do not have it).
 */
const PERK_ITEMS: Readonly<Record<string, { codes: readonly string[]; how: 'cube' | 'drop' }>> = {
  // "You can craft Elixir of Reincarnation by transmuting 5 Dragon Stones …"
  alchemy_13: { codes: ['35p'], how: 'cube' },
  // "Every rare monster and boss you kill has a 2% chance to drop a very powerful ancient artefact."
  archaeology_15: { codes: ['aa1', 'aa2', 'aa3', 'aa4', 'aa5'], how: 'drop' },
};

/** Plugin settings never shown: the switch and the stat id the section is found by, and the log switch */
const HIDDEN_PLUGIN_KEYS = new Set(['enabled', 'perk_stat', 'diagnostics']);
/** A text list longer than this (item code lists) is left out of the plugin settings */
const MAX_LIST_SETTING = 12;

/** `@d2r:Key` → the string, other text as written */
function stringRef(value: TomlValue | undefined, strings: ReadonlyMap<string, string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^@[\w.-]+:(.+)$/.exec(value);
  if (match === null) return value;
  const text = strings.get(match[1]);
  return text === undefined ? undefined : stripColorCodes(text).trim();
}

const numberOf = (value: TomlValue | undefined): number | undefined => (typeof value === 'number' ? value : undefined);
const numbersOf = (value: TomlValue | undefined): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
const listOf = (value: TomlValue | undefined): TomlValue[] => (Array.isArray(value) ? value : []);

/** The settings of a plugin section worth showing: numbers, booleans and short text lists */
function settingValue(value: TomlValue): number | boolean | string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length <= 40 ? value : null;
  if (value.length === 0 || value.length > MAX_LIST_SETTING || !value.every((item) => typeof item === 'string')) return null;
  return value.join(', ');
}

/** Per perk stat id, the plugin section that implements it */
function readPerkPlugins(
  configs: SpecializationsSources['perkConfigs'],
  warn: (message: string) => void
): Map<number, SpecializationPlugin> {
  const plugins = new Map<number, SpecializationPlugin>();
  for (const { file, text } of configs) {
    if (text === null) {
      warn(`${file} missing in the ESR clone`);
      continue;
    }
    const { entries, errors } = parseToml(text);
    for (const error of errors) warn(`${file}: ${error}`);
    const bySection = new Map<string, TomlEntry[]>();
    for (const entry of entries.values()) {
      const dot = entry.path.lastIndexOf('.');
      const section = dot === -1 ? '' : entry.path.slice(0, dot);
      bySection.set(section, [...(bySection.get(section) ?? []), entry]);
    }
    const keyOf = (entry: TomlEntry) => entry.path.slice(entry.path.lastIndexOf('.') + 1);
    const settings = (list: readonly TomlEntry[], name: (key: string) => string | null) =>
      list.flatMap((entry) => {
        const key = name(keyOf(entry));
        const value = settingValue(entry.value);
        return key === null || value === null || HIDDEN_PLUGIN_KEYS.has(key) ? [] : [{ key, value }];
      });
    for (const [section, list] of bySection) {
      const perkStat = list.find((entry) => keyOf(entry) === 'perk_stat');
      const stat = numberOf(perkStat?.value);
      if (stat !== undefined) plugins.set(stat, { file, section, values: settings(list, (key) => key) });
    }
    // The alchemy plugin: `[perks] name = stat`, its numbers in `[values]` as `<name>_<setting>`
    for (const entry of bySection.get('perks') ?? []) {
      const stat = numberOf(entry.value);
      if (stat === undefined) continue;
      const name = keyOf(entry);
      const values = [...bySection.entries()]
        .filter(([section]) => section !== 'perks')
        .flatMap(([, list]) => settings(list, (key) => (key.startsWith(`${name}_`) ? key.slice(name.length + 1) : null)));
      plugins.set(stat, { file, section: `perks.${name}`, values });
    }
  }
  return plugins;
}

/** The perk stat names a formula or ConditionCalc reads (`stat('alchemy_4'.accr)`) */
function statsRead(text: string): string[] {
  return [...text.matchAll(/stat\('([a-z]+_\d+)'\.(?:accr|base)\)/g)].map((match) => match[1]);
}

/** "Potion 1 Double" → its item names; sub-TCs keep their own name */
function tcItems(refs: readonly string[], tcNames: ReadonlySet<string>, nameOf: (code: string) => string): string[] {
  return [...new Set(refs.map((ref) => (tcNames.has(ref) ? ref : nameOf(ref))))];
}

/** Monsters whose treasure classes can roll `code`, with the best per-kill chance (one player) and their areas */
function shardDrops(input: SpecializationsInput, code: string): SpecializationShardDrop[] {
  const odds = createTcOdds(readTcRows(input.treasureclassex));
  const byName = new Map<string, { chance: number; ids: Set<string> }>();
  const add = (name: string, id: string | null, tc: string) => {
    if (tc === '' || !odds.reachableRefs(tc).has(code)) return;
    const chance = chanceOfAny(odds.picks(tc, 1), new Set([code]));
    if (chance <= 0) return;
    const entry = byName.get(name) ?? { chance: 0, ids: new Set<string>() };
    entry.chance = Math.max(entry.chance, chance);
    if (id !== null) entry.ids.add(id);
    byName.set(name, entry);
  };
  const monsterColumns = input.monstats.columns.filter((column) => column.startsWith('TreasureClass'));
  for (const row of input.monstats.rows) {
    const id = row.str('Id');
    if (id === '') continue;
    const name = resolveName(input.strings, row.str('NameStr'), id);
    for (const column of monsterColumns) add(name, id, row.str(column));
  }
  const superColumns = input.superuniques.columns.filter((column) => column.startsWith('TC'));
  for (const row of input.superuniques.rows) {
    const id = row.str('Superunique');
    if (id === '') continue;
    const name = resolveName(input.strings, row.str('Name'), id);
    for (const column of superColumns) add(name, null, row.str(column));
  }
  const spawnColumns = input.levels.columns.filter((column) => /^[nu]?mon\d+$/.test(column));
  const areasOf = (ids: ReadonlySet<string>) =>
    input.levels.rows
      .filter((row) => row.str('Id') !== '' && spawnColumns.some((column) => ids.has(row.str(column))))
      .map((row) => ({
        id: row.num('Id'),
        name: input.areaNames.get(row.num('Id')) ?? resolveName(input.strings, row.str('LevelName'), row.str('Name')),
      }));
  return [...byName]
    .map(([name, entry]) => {
      const areas = areasOf(entry.ids);
      return {
        name,
        chance: Math.round(entry.chance * 1e6) / 1e6,
        ...(areas.length === 0 ? {} : { areas }),
      };
    })
    .sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
}

/** `stat1`, `stat2`, … as the table has them */
function numberedColumns(table: TsvTable, prefix: string): string[] {
  return table.columns.filter((column) => new RegExp(`^${prefix}\\d+$`).test(column));
}

/** The item references of a treasure class row (`Item1` … `Item10`) */
function tcRefs(row: TsvRow): string[] {
  return row
    .list('Item', 10)
    .map(refOf)
    .filter((ref) => ref !== '');
}

/** The misc.txt row of an item code */
function miscRow(misc: TsvTable, code: string) {
  return misc.rows.find((row) => row.str('code') === code);
}

/** misc.txt items setting a stat on use (`stat1` … `stat12`) */
function itemsSettingStat(misc: TsvTable, stat: string): string[] {
  const columns = numberedColumns(misc, 'stat');
  return misc.rows.filter((row) => columns.some((column) => row.str(column) === stat)).map((row) => row.str('code'));
}

/** The first enabled cubemain row whose first output is `code` */
function recipeMaking(rows: readonly CubeRow[], code: string): CubeRow | undefined {
  return rows.find((row) => row.outputs.length > 0 && refOf(row.outputs[0].spec) === code);
}

function cellQty(spec: string): number {
  return Number(/qty=(\d+)/.exec(spec)?.[1] ?? '1');
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** The percentages a description states ("by 20%" → 20) */
export function describedNumbers(description: string): number[] {
  return [...new Set([...description.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1])))];
}

/**
 * The numbers the files give a perk: its plugin settings (a `…per_percent` setting means 1 %), the numbers of the
 * formulas reading it and the drop shares of its treasure classes, in percent
 */
export function fileNumbers(
  plugin: SpecializationPlugin | undefined,
  formulas: ReadonlySet<number> | undefined,
  drops: readonly SpecializationDrop[]
): Set<number> {
  const numbers = new Set<number>(formulas);
  for (const { key, value } of plugin?.values ?? []) {
    if (typeof value === 'number') numbers.add(Math.abs(value));
    if (key.endsWith('per_percent')) numbers.add(1);
  }
  for (const drop of drops) for (const share of drop.shares ?? []) numbers.add(round(share * 100));
  return numbers;
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

export function buildSpecializationsBundle(input: SpecializationsInput): SpecializationsResult {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(`specializations: ${message}`);
  const { strings, nameOf } = input;
  const empty: SpecializationsResult = {
    bundle: {
      rules: {
        pointLevels: [],
        unlockPoints: 0,
        maxPoints: 0,
        perksPerRow: 0,
        unlearnHint: '',
        shard: { code: '', name: '', description: [] },
        token: { code: '', name: '', description: [], levels: [] },
        shardsOnlyBeforeUnlock: false,
        shardDrops: [],
      },
      trees: [],
      pageDiffs: [],
    },
    warnings,
    counts: { specializationTrees: 0, specializationPerks: 0 },
  };
  if (input.sources.config === null) {
    warn(`${SPECIALIZATIONS_CONFIG_FILE} missing in the ESR clone: no specialisations`);
    return empty;
  }
  const { entries, errors } = parseToml(input.sources.config);
  for (const error of errors) warn(`${SPECIALIZATIONS_CONFIG_FILE}: ${error}`);
  const setting = (key: string) => entries.get(`specializations.${key}`)?.value;
  const statName = (id: number) => input.itemstatcost.rows[id]?.str('Stat') ?? '';
  const describe = (code: string) => {
    const row = miscRow(input.misc, code);
    const key = row?.str('spelldescstr') ?? '';
    const text = key === '' ? undefined : strings.get(key);
    return text === undefined
      ? []
      : stripColorCodes(text)
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '');
  };
  const item = (code: string) => ({ code, name: nameOf(code), description: describe(code) });

  // --- rules ---
  const perksPerRow = numberOf(setting('perks_per_row')) ?? 3;
  const unlearnCost = numberOf(setting('unlearn_cost'));
  const unlockStat = statName(numberOf(setting('unlock_stat')) ?? -1);
  const tokenCode = unlockStat === '' ? undefined : itemsSettingStat(input.misc, unlockStat)[0];
  const tokenRecipe = tokenCode === undefined ? undefined : recipeMaking(input.cubeRows, tokenCode);
  const shardSpec = tokenRecipe?.inputs[0];
  const shardCode = shardSpec === undefined ? '' : refOf(shardSpec);
  const tokenRow = tokenCode === undefined ? undefined : miscRow(input.misc, tokenCode);
  const tokenFormula =
    tokenRow === undefined
      ? ''
      : numberedColumns(input.misc, 'calc')
          .map((column) => tokenRow.str(column))
          .join(' ');
  const tokenLevels = [...tokenFormula.matchAll(/stat\('level'\.accr\)>(\d+)/g)].map((match) => Number(match[1]) + 1);
  const familyOf = (row: CubeRow | undefined) =>
    row === undefined ? undefined : [...input.familyRows].find(([, rows]) => rows.includes(row))?.[0];
  if (tokenCode === undefined) warn(`no misc.txt item sets the unlock stat ${unlockStat || '(unset)'}`);
  if (tokenCode !== undefined && tokenRecipe === undefined) warn(`no cubemain row makes the unlock item ${tokenCode}`);

  const respecStat = statName(numberOf(setting('respec_stat')) ?? -1);
  const respecCode = respecStat === '' ? undefined : itemsSettingStat(input.misc, respecStat)[0];
  const respecRecipe = respecCode === undefined ? undefined : recipeMaking(input.cubeRows, respecCode);
  const respecInput = respecRecipe?.inputs.length === 1 ? respecRecipe.inputs[0] : undefined;

  const shardTcs = input.treasureclassex.rows.filter((row) => tcRefs(row).includes(shardCode));
  const unlockHint = stringRef(setting('unlearn_hint'), strings) ?? '';
  const rules: SpecializationRules = {
    pointLevels: numbersOf(setting('point_levels')),
    unlockPoints: numberOf(setting('unlock_points')) ?? 0,
    maxPoints: numberOf(setting('max_points')) ?? 0,
    perksPerRow,
    ...(unlearnCost === undefined || unlearnCost < 0 ? {} : { unlearnCost }),
    unlearnHint: unlearnCost === undefined ? unlockHint : unlockHint.replace('%d', String(unlearnCost)),
    ...(respecCode === undefined
      ? {}
      : {
          respecToken: {
            code: respecCode,
            name: nameOf(respecCode),
            ...(respecInput === undefined
              ? {}
              : { recipe: { code: refOf(respecInput), name: nameOf(refOf(respecInput)), qty: cellQty(respecInput) } }),
          },
        }),
    shard: item(shardCode),
    token: {
      ...item(tokenCode ?? ''),
      ...(shardSpec === undefined ? {} : { shards: cellQty(shardSpec) }),
      ...(familyOf(tokenRecipe) === undefined ? {} : { family: familyOf(tokenRecipe) }),
      levels: tokenLevels,
    },
    shardsOnlyBeforeUnlock: shardTcs.length > 0 && shardTcs.every((row) => row.str('ConditionCalc').includes(unlockStat)),
    shardDrops: shardCode === '' ? [] : shardDrops(input, shardCode),
  };
  if (tokenLevels.join(',') !== rules.pointLevels.join(',')) {
    warn(`the ${rules.token.name} formula gives points at levels ${tokenLevels.join(', ')}, the config at ${rules.pointLevels.join(', ')}`);
  }
  if (rules.shardDrops.length === 0) warn(`nothing drops the shard ${shardCode || '(unknown)'}`);

  // --- what reads each perk stat ---
  const plugins = readPerkPlugins(input.sources.perkConfigs, warn);
  const tcNames = new Set(input.treasureclassex.rows.map((row) => row.str('Treasure Class')).filter((name) => name !== ''));
  // The share of a parent's picks that lands on a sub-TC behind a perk, the parent's other sub-TCs behind the same
  // perk added (two "Rejuvenation Transmutation" entries of 25 % each are one 50 % chance)
  const gatedBy = new Map<string, Set<string>>();
  for (const row of input.treasureclassex.rows) {
    const stats = statsRead(row.has('ConditionCalc') ? row.str('ConditionCalc') : '');
    if (stats.length > 0) gatedBy.set(row.str('Treasure Class'), new Set(stats));
  }
  const shares = new Map<string, Set<number>>();
  for (const row of input.treasureclassex.rows) {
    const entries = row.list('Item', 10).map((cell, i) => ({ ref: refOf(cell), prob: row.num(`Prob${String(i + 1)}`) }));
    const total = entries.reduce((sum, entry) => sum + entry.prob, 0) + row.num('NoDrop');
    if (row.num('Picks') !== 1 || total <= 0) continue;
    for (const entry of entries) {
      for (const stat of gatedBy.get(entry.ref) ?? []) {
        const gated = entries.filter((other) => gatedBy.get(other.ref)?.has(stat) === true).reduce((sum, other) => sum + other.prob, 0);
        shares.set(`${entry.ref}|${stat}`, (shares.get(`${entry.ref}|${stat}`) ?? new Set()).add(round(gated / total)));
      }
    }
  }
  const dropsByStat = new Map<string, SpecializationDrop[]>();
  for (const row of input.treasureclassex.rows) {
    const condition = row.has('ConditionCalc') ? row.str('ConditionCalc') : '';
    for (const stat of new Set(statsRead(condition))) {
      const tc = row.str('Treasure Class');
      const own = [...(shares.get(`${tc}|${stat}`) ?? [])].sort((a, b) => a - b);
      const list = dropsByStat.get(stat) ?? [];
      list.push({
        tc,
        items: tcItems(tcRefs(row), tcNames, nameOf),
        picks: row.num('Picks'),
        ...(own.length === 0 ? {} : { shares: own }),
      });
      dropsByStat.set(stat, list);
    }
  }
  // Items and the numbers their formulas give a perk: `(stat('alchemy_1'.accr)>0)*20` → 20, `…>0)?11:10` → 10 (%)
  const itemsByStat = new Map<string, string[]>();
  const formulaNumbers = new Map<string, Set<number>>();
  const addFormulaNumbers = (formula: string) => {
    for (const match of formula.matchAll(/\(stat\('([a-z]+_\d+)'\.accr\)>0\)\*(\d+)/g)) {
      formulaNumbers.set(match[1], (formulaNumbers.get(match[1]) ?? new Set()).add(Number(match[2])));
    }
    for (const match of formula.matchAll(/\(stat\('([a-z]+_\d+)'\.accr\)>0\)\?(\d+):(\d+)/g)) {
      const [on, off] = [Number(match[2]), Number(match[3])];
      if (off > 0) formulaNumbers.set(match[1], (formulaNumbers.get(match[1]) ?? new Set()).add(round(((on - off) / off) * 100)));
    }
  };
  const calcColumns = numberedColumns(input.misc, 'calc');
  for (const row of input.misc.rows) {
    const formulas = calcColumns.map((column) => row.str(column));
    formulas.forEach(addFormulaNumbers);
    for (const stat of new Set(formulas.flatMap(statsRead))) {
      // ESR shortens the potion names in game ("*HP1"); the name column reads better there
      const display = stripColorCodes(resolveName(strings, row.str('namestr'), row.str('name')));
      const name = display.startsWith('*') ? row.str('name') : display;
      itemsByStat.set(stat, [...new Set([...(itemsByStat.get(stat) ?? []), name])]);
    }
  }
  const skillRowsByStat = new Map<string, number>();
  for (const row of input.skills.rows) {
    const formulas = input.skills.columns.map((column) => row.str(column));
    formulas.forEach(addFormulaNumbers);
    for (const stat of new Set(formulas.flatMap(statsRead))) skillRowsByStat.set(stat, (skillRowsByStat.get(stat) ?? 0) + 1);
  }
  const familyLabel = new Map(input.cube.families.map((family) => [family.id, family.label]));
  const cubeByPerk = new Map<string, Map<string, SpecializationCubeLink>>();
  for (const [family, rows] of input.familyRows) {
    for (const row of rows) {
      for (const check of input.perkChecks(row)) {
        const key = `${check.perk.tree}|${check.perk.title}`;
        const links = cubeByPerk.get(key) ?? new Map<string, SpecializationCubeLink>();
        const linkKey = `${family}|${String(check.has)}`;
        const link = links.get(linkKey) ?? { family, label: familyLabel.get(family) ?? family, rows: 0, has: check.has };
        link.rows++;
        links.set(linkKey, link);
        cubeByPerk.set(key, links);
      }
    }
  }
  const secondAnointment = input.enhance.anointmentSlots.filter((slot) => slot.secondPerk !== undefined);
  const sanctifyPerk = input.enhance.sanctification.perkItems;

  // --- trees ---
  const blocks = [...entries.values()].filter((entry) => entry.path.startsWith('specialization['));
  const blockCount = new Set(blocks.map((entry) => entry.path.slice(0, entry.path.indexOf(']') + 1))).size;
  const trees: SpecializationTree[] = [];
  for (let b = 0; b < blockCount; b++) {
    const block = (key: string) => entries.get(`specialization[${String(b)}].${key}`)?.value;
    const configName = typeof block('name') === 'string' ? String(block('name')) : `Tree ${String(b + 1)}`;
    const name = strings.get(`Specializations${configName}`) ?? configName;
    const slug = specializationSlug(name);
    const sheet = input.sources.sheets.includes(`${slug}.sprite`);
    const titles = listOf(block('titles'));
    const descriptions = listOf(block('descriptions'));
    const perks: SpecializationPerk[] = numbersOf(block('stats')).map((stat, i) => {
      const statText = statName(stat);
      const title = stringRef(titles[i], strings);
      const description = stringRef(descriptions[i], strings);
      if (title === undefined) warn(`${name} perk ${String(i + 1)} (${statText}): no title string ${String(titles[i] ?? '(none)')}`);
      if (description === undefined) {
        warn(`${name} perk ${String(i + 1)} (${statText}): no description string ${String(descriptions[i] ?? '(none)')}`);
      }
      const perkTitle = title ?? statText;
      const plugin = plugins.get(stat);
      const cube = [...(cubeByPerk.get(`${name}|${perkTitle}`)?.values() ?? [])].sort(
        (a, c) => c.rows - a.rows || a.label.localeCompare(c.label)
      );
      const drops = dropsByStat.get(statText) ?? [];
      const items = itemsByStat.get(statText) ?? [];
      const skillRows = skillRowsByStat.get(statText) ?? 0;
      const enhance: SpecializationEnhanceLink[] = [];
      const own = (perk: { title: string; tree: string } | undefined) => perk?.title === perkTitle && perk.tree === name;
      const seconds = secondAnointment.filter((slot) => own(slot.secondPerk));
      if (seconds.length > 0) enhance.push({ tab: 'anointment', text: `A second anointment on ${plural(seconds.length, 'item type')}` });
      if (sanctifyPerk !== undefined && own(sanctifyPerk.perk)) {
        enhance.push({ tab: 'sanctification', text: `Sanctify ${sanctifyPerk.items.map((entry) => `${entry.name}s`).join(' and ')} too` });
      }
      const anyWeaponMastery = own(input.masteries.anyWeaponPerk);
      const notes: string[] = [];
      const read =
        plugin !== undefined ||
        cube.length > 0 ||
        drops.length > 0 ||
        items.length > 0 ||
        skillRows > 0 ||
        enhance.length > 0 ||
        anyWeaponMastery;
      const claim = PERK_ITEMS[statText] as (typeof PERK_ITEMS)[string] | undefined;
      if (claim !== undefined) notes.push(...checkPerkItems(input, claim, statText, warn, `${name} › ${perkTitle}`));
      else if (!read) {
        notes.push(
          `Nothing in the game tables or the launcher configs reads its stat (${statText}), so the files do not show how it works.`
        );
        warn(`${name} › ${perkTitle} (${statText}): no table or launcher config reads it`);
      }
      const mismatch = describedNumbers(description ?? '').filter((value) => {
        const known = fileNumbers(plugin, formulaNumbers.get(statText), drops);
        return known.size > 0 && !known.has(value);
      });
      if (mismatch.length > 0) {
        const known = [...fileNumbers(plugin, formulaNumbers.get(statText), drops)].sort((a, c) => a - c).join(', ');
        notes.push(`The description says ${mismatch.map((value) => `${String(value)}%`).join(', ')}; the files give ${known}.`);
        warn(`${name} › ${perkTitle} (${statText}): the description says ${mismatch.join(', ')} %, the files ${known}`);
      }
      const n = i + 1;
      return {
        slug: specializationSlug(perkTitle),
        title: perkTitle,
        description: description ?? '',
        row: Math.ceil(n / perksPerRow),
        column: ((n - 1) % perksPerRow) + 1,
        stat,
        statName: statText,
        ...(sheet ? { icon: `${slug}-${String(n)}` } : {}),
        ...(plugin === undefined ? {} : { plugin }),
        ...(cube.length === 0 ? {} : { cube }),
        ...(drops.length === 0 ? {} : { drops }),
        ...(items.length === 0 ? {} : { items }),
        ...(skillRows === 0 ? {} : { skillRows }),
        ...(enhance.length === 0 ? {} : { enhance }),
        ...(anyWeaponMastery ? { anyWeaponMastery: true as const } : {}),
        ...(notes.length === 0 ? {} : { notes }),
      };
    });
    if (!sheet) warn(`${name}: no icon sheet ${slug}.sprite`);
    trees.push({ slug, name, perks });
  }
  if (trees.length === 0) warn(`${SPECIALIZATIONS_CONFIG_FILE} has no [[specialization]] block`);
  const slugs = trees.flatMap((tree) => [tree.slug, ...tree.perks.map((perk) => `${tree.slug}/${perk.slug}`)]);
  for (const slug of new Set(slugs.filter((value, i) => slugs.indexOf(value) !== i))) warn(`duplicate slug ${slug}`);

  // --- the official page ---
  let pageDiffs: SpecializationPageDiff[] = [];
  if (input.sources.page === null) warn('docs/specializations.htm missing in the ESR clone');
  else {
    const page = parseSpecializationsPage(input.sources.page);
    for (const message of page.warnings) warn(message);
    for (const tree of trees) {
      const summary = page.intro.summaries.get(tree.name);
      if (summary !== undefined) tree.summary = summary;
    }
    pageDiffs = comparePage(page, trees, rules);
  }

  const perkCount = trees.reduce((sum, tree) => sum + tree.perks.length, 0);
  const allPerks = trees.flatMap((tree) => tree.perks);
  return {
    bundle: { rules, trees, pageDiffs },
    warnings,
    counts: {
      specializationTrees: trees.length,
      specializationPerks: perkCount,
      specializationIcons: allPerks.filter((perk) => perk.icon !== undefined).length,
      specializationCubePerks: allPerks.filter((perk) => perk.cube !== undefined).length,
      specializationDropPerks: allPerks.filter((perk) => perk.drops !== undefined).length,
      specializationPluginPerks: allPerks.filter((perk) => perk.plugin !== undefined).length,
      specializationShardMonsters: rules.shardDrops.length,
      specializationPageDiffs: pageDiffs.length,
    },
  };
}

/** The PERK_ITEMS check of one perk: notes for the perk; a warning when the files do not back the text */
function checkPerkItems(
  input: SpecializationsInput,
  claim: (typeof PERK_ITEMS)[string],
  stat: string,
  warn: (message: string) => void,
  label: string
): string[] {
  const names = [...new Set(claim.codes.map((code) => input.nameOf(code)))].join(', ');
  const codes = claim.codes.join(', ');
  if (claim.how === 'cube') {
    const rows = input.cubeRows.filter((row) => row.outputs.some((output) => claim.codes.includes(refOf(output.spec))));
    if (rows.length === 0) {
      warn(`${label} (${stat}): no cubemain row makes ${names} (${codes}), nothing else reads the stat`);
      return [`No cube recipe in the files makes ${names} (${codes}), and nothing else reads the perk's stat (${stat}).`];
    }
    const gated = rows.filter((row) => input.perkChecks(row).some((check) => check.has));
    return [`${plural(rows.length, 'cube recipe')} make ${names}; ${String(gated.length)} of them check the perk.`];
  }
  const index = createTreasureClassIndex(input.treasureclassex, input.monstats, input.superuniques, input.strings);
  const monsters = new Set(claim.codes.flatMap((code) => index.monstersFor(code).map((monster) => monster.name)));
  const gated = input.treasureclassex.rows.some((row) => {
    const condition = row.has('ConditionCalc') ? row.str('ConditionCalc') : '';
    return statsRead(condition).includes(stat);
  });
  if (monsters.size === 0) {
    warn(`${label} (${stat}): no treasure class drops ${names} (${codes})`);
    return [`No treasure class in the files drops ${names}.`];
  }
  if (!gated) {
    warn(`${label} (${stat}): ${names} (${codes}) drop from ${plural(monsters.size, 'monster')} with no perk condition`);
    return [
      `In the files, ${names} drops from ${plural(monsters.size, 'monster')} without the perk: no treasure class checks its stat (${stat}).`,
    ];
  }
  return [`${names} drops from ${plural(monsters.size, 'monster')}; a treasure class on the way checks the perk.`];
}

const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Where the official page reads differently from the files */
export function comparePage(
  page: SpecializationsPage,
  trees: readonly SpecializationTree[],
  rules: SpecializationRules
): SpecializationPageDiff[] {
  const diffs: SpecializationPageDiff[] = [];
  const add = (subject: string, files: string, pageValue: string, extra: { tree?: string; perk?: string } = {}) => {
    if (normalise(files) !== normalise(pageValue)) diffs.push({ subject, files, page: pageValue, ...extra });
  };
  add('Trees', trees.map((tree) => tree.name).join(', '), page.trees.map((tree) => tree.name).join(', '));
  for (const [t, tree] of trees.entries()) {
    const pageTree = page.trees.find((entry) => entry.name === tree.name) ?? page.trees.at(t);
    if (pageTree === undefined) continue;
    if (pageTree.perks.length !== tree.perks.length)
      add(`${tree.name} perks`, String(tree.perks.length), String(pageTree.perks.length), { tree: tree.slug });
    for (const [p, perk] of tree.perks.entries()) {
      const pagePerk = pageTree.perks.at(p);
      if (pagePerk === undefined) continue;
      const where = { tree: tree.slug, perk: perk.slug };
      add(`${tree.name} › perk ${String(p + 1)} title`, perk.title, pagePerk.title, where);
      add(`${tree.name} › ${perk.title} description`, perk.description, pagePerk.text, where);
      add(`${tree.name} › ${perk.title} unlearn line`, rules.unlearnHint, pagePerk.hint, where);
    }
  }
  const { intro } = page;
  const num = (value: number | undefined) => (value === undefined ? undefined : String(value));
  const check = (subject: string, files: string | undefined, pageValue: string | undefined) => {
    if (files !== undefined && pageValue !== undefined) add(subject, files, pageValue);
  };
  check('Mystical Shards per Tesseract', num(rules.token.shards), num(intro.shards));
  check('Point levels', rules.pointLevels.join(', '), intro.pointLevels?.join(', '));
  if (intro.example !== undefined) {
    const { level } = intro.example;
    const points = rules.unlockPoints + rules.token.levels.filter((at) => at <= level).length;
    check(`Points from a Tesseract used at level ${String(level)}`, String(points), String(intro.example.points));
  }
  check(
    'Perks per tree',
    trees.length === 0 ? undefined : String(Math.max(...trees.map((tree) => tree.perks.length))),
    num(intro.perksPerTree)
  );
  check('Perks per row', String(rules.perksPerRow), num(intro.perksPerRow));
  check('Maximum points', String(rules.maxPoints), num(intro.maxPoints));
  check('Respec points per unlearn', num(rules.unlearnCost), num(intro.respecPoints));
  const recipe = rules.respecToken?.recipe;
  if (recipe !== undefined && rules.unlearnCost !== undefined) {
    check(`${recipe.name}s per unlearn`, String(rules.unlearnCost * recipe.qty), num(intro.respecDragonStones));
  }
  return diffs;
}
