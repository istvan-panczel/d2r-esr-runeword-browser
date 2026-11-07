/**
 * Pins the ESR facts hard-coded in runtime code (itemstatcost row ids, stat ops, descfuncs, class tabs) to the committed
 * bundles, so that a release which shifts them fails during the update (scripts/update-game-data.ts runs the whole
 * suite; this file is under game-data so a narrow `vitest run src/features/game-data` runs it too).
 *
 * Each assertion names the stat the code means; a failure says which constant now points at another row. Pinned
 * elsewhere (not repeated here): CLASS_CODES (bundleIntegrity.test.ts), CHARACTER_CLASSES and LEVEL_MAX
 * (builds/utils/skillTree.test.ts), the example rules' unique ids 418/973 and runes r74–r83
 * (loot-filter/utils/exampleRules.test.ts, exampleFilter.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { HANDLED_DESCFUNCS } from './engine/stats/descfunc.ts';
import { DAMAGE_PAIRS } from './engine/stats/renderLines.ts';
import { STAT_QUIRKS } from '@/features/loot-filter/engine/statQuirks';
import { isPerLevel, STAT_SCALES } from '@/features/loot-filter/engine/statScale';
import { PAIRED_STATS, STAT } from '@/features/stash/parser/parseItem';
import { LEVEL_REQ, REQ_PERCENT } from '@/features/stash/engine/items/baseLines';
import { DAMAGE_GROUPS } from '@/features/stash/engine/items/statValues';
import { STAT_ID } from '@/features/stash/engine/items/textData';
import { CHARACTER_LEVEL_RANGE } from './store/character';

const OUTPUT_DIR = resolve(__dirname, '../../../public/game-data');

function readBundle<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(OUTPUT_DIR, `${name}.json`), 'utf-8')) as T;
}

interface ItemTextStat {
  stat: string;
  op?: number;
  opParam?: number;
  descfunc?: number;
}

const lootfilter = readBundle<{ stats: { id: number; name: string }[] }>('lootfilter');
/** stats[id] = [saveBits, saveAdd, hasParam], null for rows an item cannot carry */
const stash = readBundle<{ stats: (readonly number[] | null)[] }>('stash');
/** stats[id], null for rows the item text does not render */
const itemText = readBundle<{ stats: (ItemTextStat | null)[]; classes: { name: string; tabs: string[] }[] }>('itemtext');

/** itemstatcost.txt `Stat` of a row id (lootfilter.json lists every row) */
const statNames = new Map(lootfilter.stats.map((stat) => [stat.id, stat.name]));
const statName = (id: number): string | undefined => statNames.get(id);
const namesOf = (ids: readonly number[]) => ids.map(statName);
const itemTextRows = itemText.stats.flatMap((row, id) => (row === null ? [] : [{ id, ...row }]));

describe('stash parser stat ids', () => {
  it('reads the item header stats from the rows it names', () => {
    expect({
      armorClass: statName(STAT.armorClass),
      durability: statName(STAT.durability),
      maxDurability: statName(STAT.maxDurability),
      numSockets: statName(STAT.numSockets),
      questDifficulty: statName(STAT.questDifficulty),
    }).toEqual({
      armorClass: 'armorclass',
      durability: 'durability',
      maxDurability: 'maxdurability',
      numSockets: 'item_numsockets',
      questDifficulty: 'questitemdifficulty',
    });
    // The header reads them with their Save Bits: each must still be saveable
    for (const id of Object.values(STAT)) expect(stash.stats[id], `stash.json stats[${String(id)}]`).not.toBeNull();
  });

  it('pairs the damage stats that are saved without ids of their own', () => {
    expect(Object.fromEntries([...PAIRED_STATS].map(([id, partners]) => [statName(id) ?? String(id), namesOf(partners)]))).toEqual({
      item_maxdamage_percent: ['item_mindamage_percent'],
      firemindam: ['firemaxdam'],
      lightmindam: ['lightmaxdam'],
      magicmindam: ['magicmaxdam'],
      coldmindam: ['coldmaxdam', 'coldlength'],
      poisonmindam: ['poisonmaxdam', 'poisonlength'],
    });
    for (const [id, partners] of PAIRED_STATS) {
      for (const stat of [id, ...partners]) expect(stash.stats[stat], `stash.json stats[${String(stat)}]`).not.toBeNull();
    }
  });
});

describe('stash item text stat ids', () => {
  it('treats the STAT_ID rows as the stats they are named after', () => {
    expect(Object.fromEntries(Object.entries(STAT_ID).map(([key, id]) => [key, statName(id)]))).toEqual({
      strength: 'strength',
      energy: 'energy',
      dexterity: 'dexterity',
      vitality: 'vitality',
      armorPercent: 'item_armor_percent',
      maxDamagePercent: 'item_maxdamage_percent',
      minDamagePercent: 'item_mindamage_percent',
      minDamage: 'mindamage',
      maxDamage: 'maxdamage',
      secondaryMinDamage: 'secondary_mindamage',
      secondaryMaxDamage: 'secondary_maxdamage',
      armorClass: 'armorclass',
      coldLength: 'coldlength',
    });
  });

  it('reads the requirement stats from their rows', () => {
    expect([statName(REQ_PERCENT), statName(LEVEL_REQ)]).toEqual(['item_req_percent', 'item_levelreq']);
  });

  it('groups min / max damage from the right rows', () => {
    expect(Object.fromEntries(DAMAGE_GROUPS.map((group) => [group.name, namesOf([group.min, group.max])]))).toEqual({
      phys: ['mindamage', 'maxdamage'],
      magic: ['magicmindam', 'magicmaxdam'],
      fire: ['firemindam', 'firemaxdam'],
      light: ['lightmindam', 'lightmaxdam'],
      cold: ['coldmindam', 'coldmaxdam'],
      pois: ['poisonmindam', 'poisonmaxdam'],
    });
    for (const group of DAMAGE_GROUPS) {
      if (group.pair !== undefined) expect(namesOf([group.min, group.max]), group.name).toEqual([group.pair.min, group.pair.max]);
    }
  });

  it('renders damage pairs whose stats exist', () => {
    const names = new Set(statNames.values());
    for (const pair of DAMAGE_PAIRS) {
      for (const name of [pair.min, pair.max, pair.length].filter((value) => value !== undefined)) {
        expect(names.has(name), `${name} in itemstatcost`).toBe(true);
      }
    }
  });

  it('has three skill tabs per class (tabNumber maps class << 3 | tab to class * 3 + tab)', () => {
    expect(itemText.classes.length).toBeGreaterThan(0);
    for (const cls of itemText.classes) expect(cls.tabs, cls.name).toHaveLength(3);
  });

  it('uses only descfuncs renderStat handles (others render as a plain number without a warning)', () => {
    const unhandled = itemTextRows.filter((row) => !HANDLED_DESCFUNCS.has(row.descfunc ?? 0));
    expect(unhandled.map((row) => `${String(row.id)} ${row.stat}: descfunc ${String(row.descfunc)}`)).toEqual([]);
  });
});

describe('loot filter stat constants', () => {
  it('names the STAT_QUIRKS rows by their itemstatcost names', () => {
    for (const quirk of STAT_QUIRKS) expect(statName(quirk.id), `quirk ${String(quirk.id)}`).toBe(quirk.name);
  });

  it('has a quirk for every op-13 stat (a percentage of a base stat, which the plugin reads as 0 on some items)', () => {
    const op13 = itemTextRows.filter((row) => row.op === 13).map((row) => row.id);
    expect(op13.sort((a, b) => a - b)).toEqual(STAT_QUIRKS.map((quirk) => quirk.id).sort((a, b) => a - b));
  });

  it('names the STAT_SCALES rows by their itemstatcost names', () => {
    for (const scale of STAT_SCALES) expect(statName(scale.id), `scale ${String(scale.id)}`).toBe(scale.name);
  });

  it('lists every per-level stat (op 2, 4 or 5 with op param 3) as a per-level scale', () => {
    const perLevelOps = new Set([2, 4, 5]);
    const perLevel = itemTextRows
      .filter((row) => row.op !== undefined && perLevelOps.has(row.op) && row.opParam === 3 && !row.stat.startsWith('unused'))
      .map((row) => row.id);
    const scaled = STAT_SCALES.filter(isPerLevel).map((scale) => scale.id);
    expect(perLevel.sort((a, b) => a - b)).toEqual(scaled.sort((a, b) => a - b));
  });
});

describe('character level cap', () => {
  const skills = readBundle<{ maxLevel: number }>('skills');

  it('Best Base allows the same level cap as the game files', () => {
    expect(CHARACTER_LEVEL_RANGE.max).toBe(skills.maxLevel);
  });
});
