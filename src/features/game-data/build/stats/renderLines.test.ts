import { describe, it, expect } from 'vitest';
import type { ModInput } from './expandProperty.ts';
import { testRenderer } from './testContext.mock.ts';

const renderer = testRenderer();
const mod = (code: string, min: number, max = min, param: string | null = null): ModInput => ({ code, param, min, max });
const lines = (...mods: ModInput[]) => renderer.renderMods(mods).lines;

describe('renderLines', () => {
  it('merges fixed elemental min/max pairs, also across properties', () => {
    expect(lines(mod('dmg-fire', 10, 20))).toEqual(['Adds 10-20 Fire Damage to Attacks']);
    expect(lines(mod('fire-min', 7), mod('fire-max', 9))).toEqual(['Adds 7-9 Fire Damage to Attacks']);
    // rolled ranges stay two lines, as on prefixes.htm / suffixes.htm
    expect(lines(mod('fire-min', 3, 5), mod('fire-max', 8, 12))).toEqual([
      '+(3 to 5) to Minimum Fire Damage to Attacks',
      '+(8 to 12) to Maximum Fire Damage to Attacks',
    ]);
    expect(lines(mod('dmg-fire', 75, 75))).toEqual(['Adds 75 Fire Damage to Attacks']);
  });

  it('adds the duration to cold and computes poison totals over the length', () => {
    expect(lines(mod('dmg-cold', 30, 70, '75'))).toEqual(['Adds 30-70 Cold Damage to Attacks over 3 Seconds']);
    // 256 per frame × 50 frames / 256 = 50 over 2 seconds
    expect(lines(mod('dmg-pois', 256, 512, '50'))).toEqual(['Adds 50-100 Poison Damage to Attacks over 2 seconds']);
    expect(lines(mod('dmg-pois', 384, 384, '50'))).toEqual(['Adds 75 Poison Damage to Attacks over 2 seconds']);
  });

  it('keeps bleed min = max as a range (no %d-%d in its string) and physical/magic min/max as two lines', () => {
    expect(lines(mod('dmg-bleed', 1250, 1250, '125'))).toEqual(['Adds 1250%-1250% Bleed Damage over 5 seconds']);
    // the bleed plugin drops trailing zeros (ESR 3.3.04 docs pages: "over 0.12 seconds", "over 2.4 seconds")
    expect(lines(mod('dmg-bleed', 30, 40, '3'))).toEqual(['Adds 30%-40% Bleed Damage over 0.12 seconds']);
    expect(lines(mod('dmg-bleed', 30, 40, '60'))).toEqual(['Adds 30%-40% Bleed Damage over 2.4 seconds']);
    expect(lines(mod('dmg-norm', 40, 50))).toEqual(['+40 to Minimum Damage to Attacks', '+50 to Maximum Damage to Attacks']);
  });

  it('merges equal enhanced min/max damage into Enhanced Damage', () => {
    expect(lines(mod('dmg%', 100, 150))).toEqual(['+(100 to 150)% Enhanced Damage']);
  });

  it('collapses a full dgrp set with equal values and keeps partial or unequal sets', () => {
    expect(lines(mod('all-stats', 5))).toEqual(['+5 to All Attributes']);
    expect(lines(mod('res-all', 10, 15))).toEqual(['All Resists +(10 to 15)']);
    expect(lines(mod('str', 5), mod('dex', 5))).toEqual(['+5 to Strength', '+5 to Dexterity']);
  });

  it('adds up identical stats before collapsing', () => {
    expect(lines(mod('res-all', 40), mod('res-cold', 30))).toEqual([
      'Cold Resist +70%',
      'Lightning Resist +40%',
      'Fire Resist +40%',
      'Poison Resist +40%',
    ]);
  });

  it('shows class skill + oskill of the same skill as one "(All Classes)" line', () => {
    expect(lines(mod('skill', 17, 17, 'Teleport'), mod('oskill', 3, 3, 'Teleport'))).toEqual(['+20 to Teleport (All Classes)']);
  });

  it('sorts by descpriority (highest first) and hides stats without descfunc', () => {
    expect(lines(mod('str', 5), mod('tinkerflag2', 25, 35), mod('swing2', 20), mod('res-fire', 10))).toEqual([
      '+20% Increased Attack Speed',
      '+5 to Strength',
      'Fire Resist +10%',
    ]);
  });

  it('renders per-level stats with their divisor and S2', () => {
    expect(lines(mod('dmg/lvl', 0, 0, '16'))).toEqual(['+2 to Maximum Damage to Attacks (Based on Character Level)']);
  });

  it('collects warnings for unknown properties', () => {
    expect(renderer.renderMods([mod('nope', 1)])).toEqual({ lines: ['nope 1'], warnings: ['unknown property "nope"'] });
  });
});
