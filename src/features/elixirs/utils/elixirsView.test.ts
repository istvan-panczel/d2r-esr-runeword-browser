import { describe, expect, it } from 'vitest';
import type { ElixirInfo, ElixirPerk, ElixirsBundle } from '@/features/game-data/engine/schema';
import {
  defaultState,
  elixirValues,
  encodeElixirsState,
  fillTooltip,
  filterElixirs,
  needsPerk,
  oddsFor,
  oddsText,
  perkHref,
  readElixirsState,
  togglePerks,
} from './elixirsView';

const M = "*(100+stat('utilitypotionmultiplier'.accr)+(stat('alchemy_2'.accr)>0)*5)/100";
const LEN = "1125*(100+stat('utilitypotionduration'.accr))/100";

const elixir = (overrides: Partial<ElixirInfo> & Pick<ElixirInfo, 'code' | 'name'>): ElixirInfo => ({
  slug: overrides.name.toLowerCase().replace(/ /g, '-'),
  variant: 'regular',
  state: overrides.code,
  tooltip: 'Grants +%d%% Enhanced Damage for 45 seconds',
  tooltipFormula: `(25+stat('level'.accr)*5)${M}`,
  effects: [{ lines: ['+{v}% Enhanced Damage'], formula: `(25+stat('level'.accr)*5)${M}`, stats: ['damagepercent'], values: [30, 575] }],
  duration: LEN,
  seconds: 45,
  dropPerks: [],
  ...overrides,
});

const perk = (key: string, title: string): ElixirPerk => ({
  key,
  title,
  tree: 'Alchemist',
  slug: title.toLowerCase().replace(/ /g, '-'),
  row: 1,
  column: 1,
  description: '',
  facts: [],
});

const BUNDLE: ElixirsBundle = {
  maxLevel: 110,
  elixirs: [
    elixir({ code: '05p', name: 'Elixir of Slaughter' }),
    elixir({ code: '14p', name: 'Elixir of the Giant', dropPerks: ['alchemy_4'] }),
    elixir({ code: '22p', name: 'Greater Elixir of Slaughter', variant: 'greater', dropPerks: ['alchemy_12'] }),
    elixir({
      code: '35p',
      name: 'Elixir of Reincarnation',
      variant: 'special',
      tooltip: 'Brings you back',
      tooltipFormula: undefined,
      effects: [{ lines: [], formula: null, stats: ['elixir_of_reincarnation'], values: null }],
      duration: '2000000000',
      seconds: undefined,
      dropPerks: undefined,
      perk: 'alchemy_13',
    }),
  ],
  perks: [
    perk('alchemy_2', 'Volatile Concoctions'),
    perk('alchemy_4', 'Hidden Elixirs'),
    perk('alchemy_9', 'Compounded Synergy'),
    perk('alchemy_12', 'Alchemical Excellence'),
    perk('alchemy_13', 'Elixir of Reincarnation'),
  ],
  drops: {
    root: 'Utility Elixir',
    sources: [],
    odds: [
      { perks: [], chances: { '05p': 1 } },
      { perks: ['alchemy_4'], chances: { '05p': 0.5, '14p': 0.5 } },
      { perks: ['alchemy_12'], chances: { '05p': 0.75, '22p': 0.25 } },
      { perks: ['alchemy_4', 'alchemy_12'], chances: { '05p': 0.375, '14p': 0.375, '22p': 0.25 } },
    ],
  },
  recipes: [],
  otherUtilityPotions: [],
};

const read = (query: string) => readElixirsState(new URLSearchParams(query), BUNDLE);

describe('elixirs URL state', () => {
  it('defaults to the top level, no bonuses and no perks', () => {
    expect(read('')).toEqual(defaultState(BUNDLE));
  });

  it('reads and writes every param; unknown values fall back', () => {
    const state = read('name=elixir-of-the-giant&avail=perk&variant=greater&lvl=50&eff=20&dur=10&perks=hidden-elixirs,nope&search=crush');
    expect(state).toEqual({
      name: 'elixir-of-the-giant',
      search: 'crush',
      avail: 'perk',
      variant: 'greater',
      level: 50,
      effectiveness: 20,
      duration: 10,
      perks: ['alchemy_4'],
    });
    expect(encodeElixirsState(state, BUNDLE).toString()).toBe(
      'name=elixir-of-the-giant&avail=perk&variant=greater&lvl=50&eff=20&dur=10&perks=hidden-elixirs&search=crush'
    );
    expect(read('name=unknown&avail=x&variant=y&lvl=500&eff=-1')).toEqual(defaultState(BUNDLE));
  });

  it('offers the perks the formulas or the odds read, not the others', () => {
    expect(togglePerks(BUNDLE).map((entry) => entry.key)).toEqual(['alchemy_2', 'alchemy_4', 'alchemy_12']);
  });

  it('links a perk to the Specializations page', () => {
    expect(perkHref(perk('alchemy_4', 'Hidden Elixirs'))).toBe('/specializations?tree=alchemist&perk=hidden-elixirs');
  });
});

describe('elixir values', () => {
  const slaughter = BUNDLE.elixirs[0];

  it('evaluates the effect, tooltip and length at the chosen settings', () => {
    const values = elixirValues(slaughter, { level: 10, effectiveness: 0, duration: 0, perks: [] }, BUNDLE.maxLevel);
    expect(values).toEqual({
      tooltip: 'Grants +75% Enhanced Damage for 45 seconds',
      lines: [{ text: '+75% Enhanced Damage', range: [30, 575] }],
      seconds: 45,
    });
  });

  it('applies effectiveness, Volatile Concoctions and duration', () => {
    const values = elixirValues(slaughter, { level: 10, effectiveness: 15, duration: 10, perks: ['alchemy_2'] }, BUNDLE.maxLevel);
    // 75 × 120 / 100; the range follows the same bonuses
    expect(values.lines).toEqual([{ text: '+90% Enhanced Damage', range: [36, 690] }]);
    expect(values.seconds).toBe(49.5);
  });

  it('leaves a value-less effect out and has no length for an effect that waits for its trigger', () => {
    const values = elixirValues(BUNDLE.elixirs[3], { level: 90, effectiveness: 0, duration: 0, perks: [] }, BUNDLE.maxLevel);
    expect(values).toEqual({ tooltip: 'Brings you back', lines: [], seconds: null });
  });

  it('fills the tooltip', () => {
    expect(fillTooltip('Grants +%d%% to All Speeds', 12)).toBe('Grants +12% to All Speeds');
    expect(fillTooltip('Grants %+d to All Skills', null)).toBe('Grants ? to All Skills');
  });
});

describe('elixir drops and filters', () => {
  it('picks the odds of the switched-on perks; other perks do not matter', () => {
    expect(oddsFor(BUNDLE, [])).toEqual({ '05p': 1 });
    expect(oddsFor(BUNDLE, ['alchemy_12', 'alchemy_2', 'alchemy_4'])['22p']).toBe(0.25);
  });

  it('writes odds as "1 in N" when N is whole', () => {
    expect(oddsText(1 / 13)).toBe('1 in 13 (7.69%)');
    expect(oddsText(0.375)).toBe('37.5%');
    expect(oddsText(0)).toBe('never');
  });

  it('filters by availability, variant, search and the exact name', () => {
    const codes = (query: string) => filterElixirs(BUNDLE, read(query)).map((entry) => entry.code);
    expect(codes('')).toEqual(['05p', '14p', '22p', '35p']);
    expect(codes('avail=everyone')).toEqual(['05p']);
    expect(codes('avail=perk')).toEqual(['14p', '22p', '35p']);
    expect(codes('variant=greater')).toEqual(['22p']);
    expect(codes('search=hidden')).toEqual(['14p']);
    expect(codes('search="enhanced damage" greater')).toEqual(['22p']);
    expect(codes('name=elixir-of-reincarnation&avail=everyone')).toEqual(['35p']);
    expect(needsPerk(BUNDLE.elixirs[3])).toBe(true);
  });
});
