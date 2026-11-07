import { describe, it, expect } from 'vitest';
import type { CorruptionBrickResult, EnhanceBundle } from '../engine/schema';
import {
  brickSummary,
  encodeEnhanceState,
  filterCorruptionOutcomes,
  filterSanctificationOutcomes,
  filterVesselRecipes,
  formatRate,
  readEnhanceState,
  VESSEL_COMPLETION,
} from './enhance';

const bundle = {
  corruption: { reagent: { code: 'wss', name: 'Worldstone Shard' }, notes: [] },
  corruptionSlots: [{ slot: 'weapon' }, { slot: 'charm' }],
  corruptionOutcomes: [
    { slot: 'weapon', roll: 1, mods: [], lines: ['+150% Enhanced Damage'] },
    {
      slot: 'weapon',
      roll: 2,
      mods: [],
      lines: ['+400 to Attack Rating'],
      variants: [{ qualities: ['nor'], mods: [], lines: ['Magic Resist +25%'] }],
    },
  ],
  anointment: { reagent: { code: 'um7', name: 'Orb' }, blockedQualities: [], noRunewords: true, charmReagents: [], vesselItem: 'Vessel' },
  anointmentSlots: [{ slot: 'weapon' }, { slot: 'ring' }],
  anointmentOutcomes: [],
  sanctificationOutcomes: [
    { roll: 1, mods: [], lines: ['+(15 to 25) to Strength', '+1% to Maximum Fire Resist'] },
    { roll: 2, mods: [], lines: ['+(15 to 25) to Dexterity', '+1% to Maximum Fire Resist'] },
  ],
  vessel: { item: 'Vessel', startSouls: 2000 },
  vesselTiers: [{ tier: 1 }, { tier: 2 }],
  vesselRecipes: [
    { tier: 1, materials: [{ code: 'hrt', name: 'Heart', qty: 2 }], soulCost: 350, mods: [], lines: ['+5 to Strength'] },
    { tier: 1, materials: [{ code: 'brz', name: 'Brain', qty: 1 }], soulCost: 350, mods: [], lines: ['+5 to Dexterity'] },
  ],
  vesselTransforms: [],
} as unknown as EnhanceBundle;

describe('enhance URL state', () => {
  it('falls back to the first tab, slot and tier', () => {
    expect(readEnhanceState(new URLSearchParams('tab=nope&slot=helm&tier=9'), bundle)).toEqual({
      tab: 'corruption',
      slot: 'weapon',
      tier: '1',
      search: '',
    });
  });

  it('reads the anointment extra pools and the vessel completion', () => {
    expect(readEnhanceState(new URLSearchParams('tab=anointment&slot=vessel'), bundle).slot).toBe('vessel');
    expect(readEnhanceState(new URLSearchParams(`tab=vessel&tier=${VESSEL_COMPLETION}`), bundle).tier).toBe(VESSEL_COMPLETION);
  });

  it('round-trips and only writes non-default values the tab uses', () => {
    const params = new URLSearchParams('tab=anointment&slot=ring&tier=2&search=life');
    const state = readEnhanceState(params, bundle);
    expect(encodeEnhanceState(state, bundle).toString()).toBe('tab=anointment&slot=ring&search=life');
    expect(encodeEnhanceState({ tab: 'corruption', slot: 'weapon', tier: '1', search: ' ' }, bundle).toString()).toBe('');
    expect(encodeEnhanceState({ tab: 'vessel', slot: 'weapon', tier: '2', search: '' }, bundle).toString()).toBe('tab=vessel&tier=2');
  });

  it('reads and writes the sanctification tab, which has no slot', () => {
    const state = readEnhanceState(new URLSearchParams('tab=sanctification&slot=ring&search=fire'), bundle);
    expect(state).toEqual({ tab: 'sanctification', slot: '', tier: '1', search: 'fire' });
    expect(encodeEnhanceState(state, bundle).toString()).toBe('tab=sanctification&search=fire');
  });
});

describe('enhance search and texts', () => {
  it('matches outcome lines and variant lines with AND terms', () => {
    expect(filterCorruptionOutcomes(bundle.corruptionOutcomes, 'attack rating').map((outcome) => outcome.roll)).toEqual([2]);
    expect(filterCorruptionOutcomes(bundle.corruptionOutcomes, '"magic resist"').map((outcome) => outcome.roll)).toEqual([2]);
    expect(filterCorruptionOutcomes(bundle.corruptionOutcomes, '')).toHaveLength(2);
  });

  it('matches sanctification outcomes by their lines', () => {
    expect(filterSanctificationOutcomes(bundle.sanctificationOutcomes, 'dexterity fire').map((outcome) => outcome.roll)).toEqual([2]);
    expect(filterSanctificationOutcomes(bundle.sanctificationOutcomes, '"maximum fire"')).toHaveLength(2);
  });

  it('matches vessel recipes by material name or bonus', () => {
    expect(filterVesselRecipes(bundle.vesselRecipes, 'brain').map((recipe) => recipe.lines[0])).toEqual(['+5 to Dexterity']);
    expect(filterVesselRecipes(bundle.vesselRecipes, 'strength heart')).toHaveLength(1);
  });

  it('formats computed rates', () => {
    expect(formatRate(0.75)).toBe('75%');
    expect(formatRate(2 / 3)).toBe('66.7%');
  });

  it('summarises bricks: the common result, kept qualities and subtype rows', () => {
    const result = (quality: CorruptionBrickResult['quality'], text: string, type: string | null = null): CorruptionBrickResult => ({
      quality,
      type,
      typeName: type === null ? null : 'Odd Charm',
      result: text,
    });
    expect(
      brickSummary([
        result('uni', 'Rare item of the same type'),
        result('rar', 'Rare item of the same type'),
        result('crf', 'Crafted item of the same type'),
        result('nor', 'Normal item of the same type'),
        result('low', 'Low Quality item of the same type'),
      ])
    ).toEqual({ main: 'Rare item of the same type', exceptions: ['Crafted, Normal and Low Quality keep their quality'] });
    expect(brickSummary([result('uni', 'Rare item of the same type'), result('uni', 'Rare Grand Charm', 'ocha')])).toEqual({
      main: 'Rare item of the same type',
      exceptions: ['Odd Charm → Rare Grand Charm'],
    });
  });
});
