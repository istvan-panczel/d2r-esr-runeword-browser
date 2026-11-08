import { describe, expect, it } from 'vitest';
import { splitCharmLine } from './charms';

describe('splitCharmLine', () => {
  it('splits a name from its stats at the first separator', () => {
    expect(splitCharmLine('Coral Small Charm: Lightning Resist +11%')).toEqual({
      name: 'Coral Small Charm',
      stats: 'Lightning Resist +11%',
    });
    expect(splitCharmLine('Vlad: Physical Resist: +13%, All Resists +22')).toEqual({
      name: 'Vlad',
      stats: 'Physical Resist: +13%, All Resists +22',
    });
  });

  it('keeps a merged count with the name', () => {
    expect(splitCharmLine('2x Grand Charm of Vita: +20 to Life')).toEqual({ name: '2x Grand Charm of Vita', stats: '+20 to Life' });
  });

  it('leaves name-only and hand-typed lines whole', () => {
    expect(splitCharmLine('Annihilus')).toEqual({ name: 'Annihilus', stats: null });
    expect(splitCharmLine('9x Java GCs')).toEqual({ name: '9x Java GCs', stats: null });
    expect(splitCharmLine('Odd:name')).toEqual({ name: 'Odd:name', stats: null });
    expect(splitCharmLine(': no name')).toEqual({ name: ': no name', stats: null });
  });
});
