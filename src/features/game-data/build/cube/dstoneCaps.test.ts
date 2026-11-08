import { describe, expect, it } from 'vitest';
import type { CubeMod, CubeRow } from './cubeRows.ts';
import { dstoneBlockers, dstoneCap, MAX_DSTONE_USES } from './dstoneCaps.ts';

type Mod = [mod: string, min: number];

function row(mods: Mod[], condition: [op: number, param: number, value: number] | null, line = 1): CubeRow {
  return {
    line,
    description: 'D-stoning',
    cls: '',
    minDiff: 0,
    inputs: ['weap', 'ppp'],
    outputs: [{ spec: 'useitem', mods: mods.map(([mod, min]): CubeMod => ({ mod, param: '', min, max: min })) }],
    condition: condition === null ? null : { op: condition[0], param: condition[1], value: condition[2] },
  };
}

const bonusMods = (entry: CubeRow) => (entry.outputs[0]?.mods ?? []).filter((mod) => !mod.mod.endsWith('-cap') && mod.mod !== 'levelreq');
const STATS: Record<string, number[]> = { 'swing2-cap': [584], 'dmg-undead-cap': [597], 'dmg-demon-cap': [596], 'light-cap': [583] };
const statIdsOf = (property: string) => STATS[property] ?? [];

describe('dstoneCap', () => {
  it('stops on an earlier void blocker when the row condition never turns false (ESR 3.3.02 elemental Void Shard)', () => {
    const blocker = (param: number, value: number, line: number, inputs = ['weap', 'ppp']): CubeRow => ({
      ...row([], [15, param, value], line),
      inputs,
      outputs: [{ spec: 'void', mods: [] }],
    });
    const stacking = row(
      [
        ['extra-ele', 1],
        ['swing2-cap', 1],
      ],
      [16, 827, 3],
      10
    );
    expect(dstoneCap([stacking], bonusMods, statIdsOf, [blocker(584, 5, 3)])).toMatchObject({
      kind: 'capped',
      cap: { uses: 5, mods: [{ mod: 'extra-ele', min: 5, max: 5 }] },
    });
    // Later in the file, other ingredients or a stat this D-stoning does not raise: no stop
    for (const other of [blocker(584, 5, 20), blocker(584, 5, 3, ['weap', 'vvv']), blocker(597, 5, 3)])
      expect(dstoneCap([stacking], bonusMods, statIdsOf, [other]).kind).toBe('unknown');
    expect(dstoneBlockers([stacking, blocker(584, 5, 3)]).map((entry) => entry.line)).toEqual([3]);
  });

  it('applies the first row whose cap condition holds until none does (op 16: at most)', () => {
    const rows = [5, 4, 3, 2, 1].map((amount, i) =>
      row(
        [
          ['levelreq', 2],
          ['swing2', amount],
          ['swing2-cap', amount],
        ],
        [16, 584, 116 + i]
      )
    );
    // 0 → 115 by fives, 120, then only the "at most 120" row applies once more
    expect(dstoneCap(rows, bonusMods, statIdsOf)).toEqual({
      kind: 'capped',
      cap: { uses: 25, mods: [{ mod: 'swing2', param: '', min: 121, max: 121 }] },
    });
  });

  it('raises every cap stat a row adds, so two condition rows of one bonus share the count', () => {
    const mods: Mod[] = [
      ['dmg-undead', 12],
      ['dmg-demon', 12],
      ['dmg-undead-cap', 12],
      ['dmg-demon-cap', 12],
    ];
    const rows = [row(mods, [16, 597, 500]), row(mods, [16, 596, 500])];
    const result = dstoneCap(rows, bonusMods, statIdsOf);
    expect(result.kind === 'capped' && result.cap.mods.map((mod) => [mod.mod, mod.min])).toEqual([
      ['dmg-undead', 504],
      ['dmg-demon', 504],
    ]);
  });

  it('reads op 15 (at least) for the negative light radius and raises the condition stat for a cap mod without stats', () => {
    const light = row(
      [
        ['light', -2],
        ['light-cap', -2],
      ],
      [15, 583, -4]
    );
    expect(dstoneCap([light], bonusMods, statIdsOf)).toMatchObject({ kind: 'capped', cap: { uses: 3, mods: [{ min: -6 }] } });
    const unknownCap = row(
      [
        ['enr', 4],
        ['enr-cap', 4],
      ],
      [16, 532, 199]
    );
    expect(dstoneCap([unknownCap], bonusMods, () => [])).toMatchObject({ kind: 'capped', cap: { uses: 50, mods: [{ min: 200 }] } });
  });

  it('has no cap for a row without a condition, a counter condition or a cap stat that never grows', () => {
    expect(dstoneCap([row([['dmg%', 12]], null)], bonusMods, statIdsOf)).toEqual({ kind: 'uncapped' });
    expect(dstoneCap([row([['extra-ele', 3]], [18, 828, 1], 7)], bonusMods, statIdsOf)).toEqual({
      kind: 'unknown',
      reason: 'op 18 on cubemain line 7 is not a cap condition',
    });
    // The cap mod raises another stat than the one the condition checks
    const endless = row(
      [
        ['swing2', 5],
        ['swing2-cap', 5],
      ],
      [16, 589, 119]
    );
    expect(dstoneCap([endless], bonusMods, statIdsOf)).toEqual({
      kind: 'unknown',
      reason: `does not stop within ${String(MAX_DSTONE_USES)} uses`,
    });
  });
});
