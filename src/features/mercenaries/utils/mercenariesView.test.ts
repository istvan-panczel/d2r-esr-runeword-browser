import { describe, expect, it } from 'vitest';
import type { MercenariesBundle, MercenaryBand, MercenaryVariant } from '@/features/game-data/engine/schema';
import { mercenaryHref, parseMercenarySubtype } from '@/features/game-data/engine/mercenaryLinks';
import {
  damageText,
  goldText,
  hasDexterityTypo,
  mercenariesParams,
  mercenariesQuery,
  mercenaryCards,
  mercenaryTableRows,
  readMercenariesState,
  resistsText,
  variantView,
} from './mercenariesView';

const band = (level: number, extra: Partial<MercenaryBand> = {}): MercenaryBand => ({
  level,
  life: level * 10,
  defense: 1,
  strength: 1,
  dexterity: 1,
  attackRating: 1,
  damage: [3, 7],
  resists: { fire: 20, cold: 20, lightning: 20, poison: 20 },
  ...extra,
});

const ALL_DIFFICULTIES: MercenaryVariant = {
  subtype: 'Elemental',
  difficulty: null,
  offers: [
    { difficulty: 'normal', gold: 25, levels: [10, 40, 85] },
    { difficulty: 'nightmare', gold: 1500, levels: [40, 85] },
    { difficulty: 'hell', gold: 3125, levels: [85] },
  ],
  bands: [band(10), band(40), band(85)],
  skills: [{ id: 'Fend', name: 'Fend', cls: 'ama', page: 1, levels: [3, 15, 25] }],
};

const desert = (subtype: string, difficulty: 'normal' | 'nightmare' | 'hell', gold: number, level: number): MercenaryVariant => ({
  subtype,
  difficulty,
  offers: [{ difficulty, gold, levels: [level] }],
  bands: [band(level)],
  skills: [{ id: subtype, name: subtype, cls: 'pal', page: 1, levels: [level] }],
});

const BUNDLE: MercenariesBundle = {
  hirelings: [
    { slug: 'rogue-scout', name: 'Rogue Scout', act: 1, types: [{ slug: 'elemental', name: 'Elemental', variants: [ALL_DIFFICULTIES] }] },
    {
      slug: 'desert-mercenary',
      name: 'Desert Mercenary',
      act: 2,
      types: [
        {
          slug: 'combat',
          name: 'Combat',
          variants: [
            desert('Comb - Normal', 'normal', 25, 20),
            desert('Comb - Nightmare', 'nightmare', 1800, 50),
            desert('Comb - Hell', 'hell', 3500, 85),
          ],
        },
        { slug: 'defensive', name: 'Defensive', variants: [desert('Def - Normal', 'normal', 37, 20)] },
      ],
    },
  ],
};

const state = (query: string) => readMercenariesState(new URLSearchParams(query), BUNDLE);

describe('readMercenariesState', () => {
  it('defaults to the cards with no filter', () => {
    expect(state('')).toEqual({ view: 'cards', difficulty: null, hireling: null, type: null, unknown: null });
  });

  it('reads every parameter', () => {
    const read = state('hireling=desert-mercenary&type=combat&difficulty=nightmare&view=table');
    expect(read.view).toBe('table');
    expect(read.difficulty).toBe('nightmare');
    expect(read.hireling?.slug).toBe('desert-mercenary');
    expect(read.type?.slug).toBe('combat');
    expect(read.unknown).toBeNull();
  });

  it('reports a value that names nothing and ignores it', () => {
    expect(state('hireling=nope')).toMatchObject({ hireling: null, unknown: 'nope' });
    expect(state('hireling=rogue-scout&type=combat')).toMatchObject({ type: null, unknown: 'combat' });
    expect(state('difficulty=easy')).toMatchObject({ difficulty: null, unknown: 'easy' });
  });

  it('needs a hireling for a type', () => {
    expect(state('type=defensive')).toMatchObject({ hireling: null, type: null, unknown: 'defensive' });
  });

  it('falls back to the cards for an unknown view', () => {
    expect(state('view=grid').view).toBe('cards');
  });
});

describe('mercenariesParams', () => {
  it('leaves out the defaults and round-trips the rest', () => {
    expect(mercenariesParams({ view: 'cards', difficulty: null, hireling: null, type: null }).toString()).toBe('');
    const query = 'hireling=desert-mercenary&type=combat&difficulty=hell&view=table';
    expect(mercenariesParams(mercenariesQuery(state(query))).toString()).toBe(query);
  });

  it('drops a type without a hireling', () => {
    expect(mercenariesParams({ view: 'cards', difficulty: null, hireling: null, type: 'combat' }).toString()).toBe('');
  });
});

describe('variantView', () => {
  it('keeps everything without a difficulty', () => {
    expect(variantView(ALL_DIFFICULTIES, null)).toEqual({
      gold: [
        { difficulty: 'normal', gold: 25 },
        { difficulty: 'nightmare', gold: 1500 },
        { difficulty: 'hell', gold: 3125 },
      ],
      bands: ALL_DIFFICULTIES.bands,
      skills: ALL_DIFFICULTIES.skills,
    });
  });

  it('cuts the bands and the aligned skill levels down to a difficulty', () => {
    const view = variantView(ALL_DIFFICULTIES, 'nightmare');
    expect(view?.gold).toEqual([{ difficulty: 'nightmare', gold: 1500 }]);
    expect(view?.bands.map((entry) => entry.level)).toEqual([40, 85]);
    expect(view?.skills.at(0)?.levels).toEqual([15, 25]);
  });

  it('is null at a difficulty the variant is not offered at', () => {
    expect(variantView(desert('Comb - Hell', 'hell', 3500, 85), 'normal')).toBeNull();
  });
});

describe('mercenaryCards', () => {
  it('makes one card per hireling and type, Normal by default', () => {
    expect(mercenaryCards(BUNDLE, state('')).map((card) => [card.hireling.slug, card.type.slug, card.view?.gold.at(0)?.gold])).toEqual([
      ['rogue-scout', 'elemental', 25],
      ['desert-mercenary', 'combat', 25],
      ['desert-mercenary', 'defensive', 37],
    ]);
  });

  it('picks the Desert variant of the difficulty and has no view for a type not offered there', () => {
    const cards = mercenaryCards(BUNDLE, state('hireling=desert-mercenary&difficulty=hell'));
    expect(cards.map((card) => [card.type.slug, card.view?.skills.at(0)?.name ?? null])).toEqual([
      ['combat', 'Comb - Hell'],
      ['defensive', null],
    ]);
  });

  it('follows the hireling and type filters', () => {
    expect(
      mercenaryCards(BUNDLE, state('hireling=desert-mercenary&type=combat&difficulty=nightmare')).map((card) => card.view?.gold)
    ).toEqual([[{ difficulty: 'nightmare', gold: 1800 }]]);
  });
});

describe('mercenaryTableRows', () => {
  it('lists one row per variant without a difficulty', () => {
    expect(mercenaryTableRows(BUNDLE, state('view=table')).map((row) => row.key)).toEqual([
      'rogue-scout/Elemental',
      'desert-mercenary/Comb - Normal',
      'desert-mercenary/Comb - Nightmare',
      'desert-mercenary/Comb - Hell',
      'desert-mercenary/Def - Normal',
    ]);
  });

  it('keeps the variants offered at a difficulty and cuts them down', () => {
    const rows = mercenaryTableRows(BUNDLE, state('view=table&difficulty=hell'));
    expect(rows.map((row) => [row.key, row.difficulty, row.view.bands.map((entry) => entry.level)])).toEqual([
      ['rogue-scout/Elemental', null, [85]],
      ['desert-mercenary/Comb - Hell', 'hell', [85]],
    ]);
  });
});

describe('text helpers', () => {
  it('formats gold, damage and resists', () => {
    expect(goldText(1500)).toBe('1,500');
    expect(damageText(band(1))).toBe('3–7');
    expect(resistsText(band(1))).toBe('20');
    expect(resistsText(band(1, { resists: { fire: 1, cold: 2, lightning: 3, poison: 4 } }))).toBe('F 1 / C 2 / L 3 / P 4');
  });

  it('spots a flagged dexterity', () => {
    expect(hasDexterityTypo([band(1)])).toBe(false);
    expect(hasDexterityTypo([band(1), band(2, { dexterityTypo: true })])).toBe(true);
  });
});

describe('mercenary links', () => {
  it('parses the official subtype cells', () => {
    expect(parseMercenarySubtype('Comb - Nightmare')).toEqual({ label: 'Comb', name: 'Combat', difficulty: 'nightmare' });
    expect(parseMercenarySubtype('Elemental')).toEqual({ label: 'Elemental', name: 'Elemental', difficulty: null });
  });

  it('links a skill card to its hireling, type and difficulty, and the links read back', () => {
    const href = mercenaryHref('Desert Mercenary', 'Comb - Nightmare');
    expect(href).toBe('/mercenaries?hireling=desert-mercenary&type=combat&difficulty=nightmare');
    const read = state(href.slice(href.indexOf('?') + 1));
    expect(read.type?.slug).toBe('combat');
    expect(read.difficulty).toBe('nightmare');
    expect(mercenaryHref('Rogue Scout')).toBe('/mercenaries?hireling=rogue-scout');
  });
});
