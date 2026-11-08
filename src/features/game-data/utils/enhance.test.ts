import { describe, it, expect } from 'vitest';
import type { CorruptionBrickResult, EnhanceBundle } from '../engine/schema';
import {
  anointmentGroups,
  brickSummary,
  encodeEnhanceState,
  filterCorruptionOutcomes,
  filterSanctificationOutcomes,
  filterStandardOutcomes,
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
  standardOfHeroes: { reagent: { code: 'std', name: 'Standard of Heroes' }, once: true },
  standardOfHeroesOutcomes: [
    { charm: { code: 'Hellfire Torch', name: 'Hellfire Torch' }, mods: [], lines: ['+(2 to 3)% Bonus to All Attributes'] },
    { charm: { code: 'Annihilus', name: 'Annihilus' }, mods: [], lines: ['Increase Maximum Life +(6 to 9)%'] },
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

  it('maps an ESR 3.2 anointment slot id to the first pool of that slot group', () => {
    const pools = {
      ...bundle,
      anointmentSlots: [
        { slot: 'ajav', group: 'weapon' },
        { slot: 'axe', group: 'weapon' },
        { slot: 'shie', group: 'shield' },
        { slot: 'helm', group: 'helm' },
      ],
    } as unknown as EnhanceBundle;
    const pool = (query: string) => readEnhanceState(new URLSearchParams(query), pools).slot;
    expect(pool('tab=anointment&slot=shield')).toBe('shie');
    expect(pool('tab=anointment&slot=weapon')).toBe('ajav');
    // a pool id that is also a group name stays itself; unknown ids fall back to the first pool
    expect(pool('tab=anointment&slot=helm')).toBe('helm');
    expect(pool('tab=anointment&slot=axe')).toBe('axe');
    expect(pool('tab=anointment&slot=nope')).toBe('ajav');
    expect(pool('tab=corruption&slot=shield')).toBe('weapon');
  });

  it('round-trips and only writes non-default values the tab uses', () => {
    const params = new URLSearchParams('tab=anointment&slot=ring&tier=2&search=life');
    const state = readEnhanceState(params, bundle);
    expect(encodeEnhanceState(state, bundle).toString()).toBe('tab=anointment&slot=ring&search=life');
    expect(encodeEnhanceState({ tab: 'corruption', slot: 'weapon', tier: '1', search: ' ' }, bundle).toString()).toBe('');
    expect(encodeEnhanceState({ tab: 'vessel', slot: 'weapon', tier: '2', search: '' }, bundle).toString()).toBe('tab=vessel&tier=2');
  });

  it('reads and writes the Standard of Heroes tab, which has no slot', () => {
    const state = readEnhanceState(new URLSearchParams('tab=standard&slot=ring&search=life'), bundle);
    expect(state).toEqual({ tab: 'standard', slot: '', tier: '1', search: 'life' });
    expect(encodeEnhanceState(state, bundle).toString()).toBe('tab=standard&search=life');
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

  it('matches Standard of Heroes outcomes by the charm name and the lines', () => {
    expect(filterStandardOutcomes(bundle.standardOfHeroesOutcomes, 'annihilus').map((outcome) => outcome.charm.code)).toEqual([
      'Annihilus',
    ]);
    expect(filterStandardOutcomes(bundle.standardOfHeroesOutcomes, 'attributes').map((outcome) => outcome.charm.code)).toEqual([
      'Hellfire Torch',
    ]);
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

describe('anointmentGroups', () => {
  it('groups the per-type pools by equipment slot, in pool order', () => {
    const slot = (code: string, group: string) => ({
      slot: code,
      typeCode: code,
      label: code,
      group,
      rollRange: 1,
      socketedRollRange: null,
    });
    const groups = anointmentGroups([slot('ajav', 'weapon'), slot('circ', 'helm'), slot('axe', 'weapon'), slot('zrin', 'ring')]);
    expect(groups.map((group) => [group.label, group.slots.map((entry) => entry.slot)])).toEqual([
      ['Weapons', ['ajav', 'axe']],
      ['Helms', ['circ']],
      ['Rings', ['zrin']],
    ]);
  });
});
