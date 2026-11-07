/**
 * ESR 3.3 specialisation perks in cube conditions. A perk is a character stat (itemstatcost `alchemy_1` … `_15`,
 * `blacksmithing_*`, `jeweler_*`, `archaeology_*`, 0 or 1); perk n of a tree is the tree's row ⌈n/3⌉, column
 * (n − 1) mod 3 + 1, named by the string `Specializations<Tree><row>_<col>Title` (item-modifiers.json). The numbering is
 * the one the d2rloader configs name (`# Steady Pliers (jeweler_15)`, `# Hidden Potential (jeweler_7, a Jeweler perk)`).
 *
 * cubemain checks perks two ways:
 * - on the row: `op 6` / `op 3` with value 1 (needs the perk), `op 6` / `op 4` with value 0 (only without it);
 * - by an earlier row with the same inputs that only matches without the perk (a "Trap" that voids the item, or
 *   "Gem Infusion (No Excellence)"): the game tries the rows in file order, so every later row with these inputs is
 *   reached only with the perk ("Crucible Trap" before the Crucible forgings, "True Master Trap" before True Master).
 * `op 4` appears only with value 0 (Alchemist rows); it is read as "no perk", the only reading under which the Gem
 * Infusion trap lets any player use the recipe. Other values of op 4 are left unworded.
 */
import type { CubeRow } from './cubeRows.ts';

export interface Perk {
  /** "True Master" */
  title: string;
  /** "Blacksmith" */
  tree: string;
}

export interface PerkCheck {
  perk: Perk;
  /** true: the row needs the perk; false: only without it */
  has: boolean;
  /** Set when an earlier row with the same inputs is what makes the row need the perk (not the row's own condition) */
  inherited?: true;
}

const TREES: Readonly<Record<string, string>> = {
  alchemy: 'Alchemist',
  blacksmithing: 'Blacksmith',
  jeweler: 'Jeweler',
  archaeology: 'Archaeologist',
};

const PERK_STAT = /^(alchemy|blacksmithing|jeweler|archaeology)_(\d+)$/;

/** Steady Pliers (Jeweler) for `jeweler_15`; null for other stats and perks without a title string */
export function perkOfStat(stat: string, strings: ReadonlyMap<string, string>): Perk | null {
  const match = PERK_STAT.exec(stat);
  if (match === null) return null;
  const n = Number(match[2]);
  if (n < 1 || n > 15) return null;
  const tree = TREES[match[1]];
  const title = strings.get(`Specializations${tree}${String(Math.ceil(n / 3))}_${String(((n - 1) % 3) + 1)}Title`);
  if (title === undefined) return null;
  return { title, tree: strings.get(`Specializations${tree}`) ?? tree };
}

/** The perk check of a row's own condition, null when it checks no perk (or in a way not worded) */
export function ownPerkCheck(
  row: CubeRow,
  statName: (id: number) => string | undefined,
  strings: ReadonlyMap<string, string>
): PerkCheck | null {
  const condition = row.condition;
  if (condition === null) return null;
  const perk = perkOfStat(statName(condition.param) ?? '', strings);
  if (perk === null) return null;
  if ((condition.op === 6 || condition.op === 3) && condition.value >= 1) return { perk, has: true };
  if ((condition.op === 6 || condition.op === 4) && condition.value === 0) return { perk, has: false };
  return null;
}

/** "Needs the True Master perk (Blacksmith)" / "Only without the … perk" */
export function perkCheckText({ perk, has }: PerkCheck): string {
  return `${has ? 'Needs' : 'Only without'} the ${perk.title} perk (${perk.tree})`;
}

/**
 * Every row's perk checks: its own, then the perks an earlier row with the same inputs takes away (see above), in
 * file order. Rows without a perk check are not in the map.
 */
export function perkChecks(
  rows: readonly CubeRow[],
  statName: (id: number) => string | undefined,
  strings: ReadonlyMap<string, string>
): Map<CubeRow, PerkCheck[]> {
  const checks = new Map<CubeRow, PerkCheck[]>();
  const without = new Map<string, Perk[]>();
  for (const row of [...rows].sort((a, b) => a.line - b.line)) {
    const key = row.inputs.join(' ; ');
    const own = ownPerkCheck(row, statName, strings);
    const inherited = (without.get(key) ?? [])
      .filter((perk) => perk.title !== own?.perk.title)
      .map((perk): PerkCheck => ({ perk, has: true, inherited: true }));
    const list = [...inherited, ...(own === null ? [] : [own])];
    if (list.length > 0) checks.set(row, list);
    if (own !== null && !own.has) without.set(key, [...(without.get(key) ?? []), own.perk]);
  }
  return checks;
}
