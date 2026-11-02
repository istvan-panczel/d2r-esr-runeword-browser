import { STAT_SCALES, statScale, statScaleMessage } from './statScale';

describe('statScale', () => {
  it('finds a stat by name or id', () => {
    expect(statScale('maxhp')?.kind).toBe('shift');
    expect(statScale(7)?.name).toBe('maxhp');
    expect(statScale(220)?.kind).toBe('perLevel');
    expect(statScale('item_hp_perlevel')?.kind).toBe('shiftPerLevel');
    expect(statScale('strength')).toBeUndefined();
    expect(statScale('7')).toBeUndefined();
  });

  it('lists each stat once', () => {
    expect(new Set(STAT_SCALES.map((scale) => scale.id)).size).toBe(STAT_SCALES.length);
    expect(new Set(STAT_SCALES.map((scale) => scale.name)).size).toBe(STAT_SCALES.length);
  });
});

describe('statScaleMessage', () => {
  const scale = (stat: string | number) => {
    const found = statScale(stat);
    if (found === undefined) throw new Error(`no scale for ${String(stat)}`);
    return found;
  };

  it('gives the stored value of the check for a ×256 stat, or +40 for a presence check', () => {
    expect(statScaleMessage(scale('maxhp'), 40)).toBe(
      'The game stores "maxhp" ×256: +40 Life may read as 10240. Not verified in game; use "Check in game" on this rule to see what the plugin reads.'
    );
    expect(statScaleMessage(scale(9), 1)).toContain('+40 Mana may read as 10240');
    expect(statScaleMessage(scale(9), [100, 200])).toContain('+100 Mana may read as 25600');
  });

  it('gives eighths for a per-level stat, and both for Life per level', () => {
    expect(statScaleMessage(scale('item_strength_perlevel'), 1)).toBe(
      'The game stores "item_strength_perlevel" in eighths per character level (the tooltip shows stored × level / 8): +1 Strength per level may read as 8. Not verified in game; use "Check in game" on this rule to see what the plugin reads.'
    );
    expect(statScaleMessage(scale(216), 2)).toContain('in eighths per character level, ×256');
    expect(statScaleMessage(scale(216), 2)).toContain('+2 Life per level may read as 4096');
  });
});
