import { isPerLevel, STAT_SCALES, statScale, statScaleMessage } from './statScale';

describe('statScale', () => {
  it('finds a stat by name or id', () => {
    expect(statScale('maxhp')?.kind).toBe('shift');
    expect(statScale(7)?.name).toBe('maxhp');
    expect(statScale(220)?.kind).toBe('perLevel');
    expect(statScale('item_hp_perlevel')?.kind).toBe('shiftPerLevel');
    expect(statScale('item_howl')?.kind).toBe('percent');
    expect(statScale(213)?.name).toBe('item_fear');
    expect(statScale('strength')).toBeUndefined();
    expect(statScale('7')).toBeUndefined();
  });

  it('lists each stat once', () => {
    expect(new Set(STAT_SCALES.map((scale) => scale.id)).size).toBe(STAT_SCALES.length);
    expect(new Set(STAT_SCALES.map((scale) => scale.name)).size).toBe(STAT_SCALES.length);
  });
});

describe('statScaleMessage (plugin 1.8.2 reads tooltip numbers)', () => {
  const scale = (stat: string | number) => {
    const found = statScale(stat);
    if (found === undefined) throw new Error(`no scale for ${String(stat)}`);
    return found;
  };

  it('says nothing for the stats that read the tooltip number', () => {
    expect(statScaleMessage(scale('maxhp'))).toBeUndefined();
    expect(statScaleMessage(scale('item_howl'))).toBeUndefined();
  });

  it('warns that a per-level stat reads the value at the character level', () => {
    expect(isPerLevel(scale(216))).toBe(true);
    expect(statScaleMessage(scale('item_strength_perlevel'))).toBe(
      '"item_strength_perlevel" (Strength per level) reads the value at your character\'s level, as the tooltip\'s "(Based on Character Level)" shows: 0.5 per level reads 0 at level 1 and 49 at level 99, so this check depends on the character level (plugin 1.8.2, the guide).'
    );
  });
});
