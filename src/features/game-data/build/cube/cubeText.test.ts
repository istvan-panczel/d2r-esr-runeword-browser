import { describe, expect, it } from 'vitest';
import type { CubeMod } from './cubeRows.ts';
import {
  bonusLines,
  clusterVariantsCounted,
  describeOutput,
  describeOutputLevel,
  formatInput,
  formatOutput,
  socketText,
  type OutputTables,
} from './cubeText.ts';

const NAMES: Readonly<Partial<Record<string, string>>> = { weap: 'Weapon', key: 'Key', 'Red Portal': 'Red Portal', gem5: 'Perfect Gem' };
const tables: OutputTables = { nameOf: (token) => NAMES[token] ?? token, renderMods: () => [] };

describe('cube cell text', () => {
  it('writes `rem` as "socketed items come out"', () => {
    expect(formatOutput({ spec: 'useitem,rem', mods: [] }, tables)).toBe('The same item (socketed items come out)');
    expect(formatOutput({ spec: 'useitem,rem', mods: [{ mod: 'sock', param: '', min: 3, max: 3 }] }, tables)).toBe(
      'The same item (socketed items come out, 3 sockets)'
    );
  });

  it('writes `lvl=N` as the item level, or as the map a Red Portal opens when level names are known', () => {
    expect(describeOutput({ spec: 'weap,lvl=99', mods: [] }, tables)).toEqual({ name: 'Weapon', details: ['item level 99'] });
    expect(describeOutput({ spec: 'Red Portal,lvl=147,qty=1', mods: [] }, tables)).toEqual({
      name: 'Red Portal',
      details: ['item level 147'],
    });
    const withLevels: OutputTables = { ...tables, levelName: (id) => (id === 147 ? 'Cellar of Pain' : null) };
    expect(describeOutput({ spec: 'Red Portal,lvl=147,qty=1', mods: [] }, withLevels)).toEqual({
      name: 'Red Portal',
      details: ['to Cellar of Pain'],
    });
    expect(describeOutput({ spec: 'Red Portal,lvl=999', mods: [] }, withLevels).details).toEqual(['item level 999']);
  });

  it('keeps inputs without qualifiers it does not know', () => {
    expect(formatInput('gem5,qty=2', tables)).toBe('2× Perfect Gem');
  });

  it('counts the variants each merged row stands for', () => {
    const merged = clusterVariantsCounted([
      { inputs: ['a', 'Key'], output: 'x' },
      { inputs: ['b', 'Key'], output: 'x' },
      { inputs: ['c', 'Key'], output: 'y' },
      { inputs: ['c', 'Key'], output: 'y' },
    ]);
    expect(merged).toEqual([
      { variant: { inputs: ['a / b', 'Key'], output: 'x' }, count: 2, indices: [0, 1] },
      { variant: { inputs: ['c', 'Key'], output: 'y' }, count: 2, indices: [2, 3] },
    ]);
  });

  it('describes the item level of an output from its lvl / plvl / ilvl columns', () => {
    expect(describeOutputLevel({})).toBeUndefined();
    expect(describeOutputLevel({ lvl: 99 })).toBe('Item level 99');
    expect(describeOutputLevel({ plvl: 60 })).toBe('Item level 60% of character level');
    expect(describeOutputLevel({ plvl: 60, ilvl: 60 })).toBe('Item level 60% of character level + 60% of input item level');
    expect(describeOutputLevel({ ilvl: 100 })).toBe('Item level 100% of input item level');
  });

  it('writes a socket range as a range ("1-2 sockets"), not its maximum', () => {
    expect(socketText(1, 2)).toBe('1-2 sockets');
    expect(socketText(2, 2)).toBe('2 sockets');
    expect(socketText(1, 1)).toBe('1 socket');
    expect(formatOutput({ spec: 'usetype,mag', mods: [{ mod: 'sock', param: '', min: 1, max: 2 }] }, tables)).toBe(
      'Magic item of the same type (1-2 sockets)'
    );
  });

  it('writes the removals as removals: flags, the corruption status, and the bonuses of a removed forging', () => {
    // Stub renderer: flags have no number in their line, the rest do
    const FLAGS: Readonly<Partial<Record<string, string>>> = { rip: 'Slain Monsters Rest in Peace', knock: 'Knockback' };
    const render = (mods: readonly CubeMod[]) =>
      mods.map((mod) => FLAGS[mod.mod] ?? `${mod.max > 0 ? '+' : ''}${String(mod.max)}% to ${mod.mod}`);
    const mod = (code: string, value: number): CubeMod => ({ mod: code, param: '', min: value, max: value });
    expect(bonusLines([mod('rip', -1)], { renderMods: render })).toEqual(['Removes Slain Monsters Rest in Peace']);
    expect(bonusLines([mod('knock', 1)], { renderMods: render })).toEqual(['Knockback']);
    expect(bonusLines([mod('corrupted', -1)], { renderMods: render })).toEqual([
      'Removes the corruption status, so the item can be corrupted again',
    ]);
    // A negative bonus stays a malus, unless the output also takes the forging marker off (Secret Recipe 8)
    expect(bonusLines([mod('addxp', -25)], { renderMods: render })).toEqual(['-25% to addxp']);
    expect(bonusLines([mod('addxp', -25), mod('craftflag', -175)], { renderMods: render })).toEqual(['Removes +25% to addxp']);
  });

  it('reads an item type that is named like an item as "Any …", qualities after "Any"', () => {
    const names = {
      nameOf: (token: string) => ({ helm: 'Helm', armo: 'Any Armor', cap: 'Helm' })[token] ?? token,
      anyType: (token: string) => token === 'helm',
    };
    expect(formatInput('helm,mag', names)).toBe('Any Magic Helm');
    expect(formatInput('cap,mag', names)).toBe('Magic Helm');
    expect(formatInput('armo,eth,rar,qty=2', names)).toBe('2× Any Ethereal Rare Armor');
    expect(formatInput('any,set', names)).toBe('Any Set item');
  });
});
