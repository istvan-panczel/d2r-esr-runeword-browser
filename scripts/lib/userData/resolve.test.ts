import { describe, expect, it } from 'vitest';
import { buildCurrentData, type CurrentData, type GameDataBundles, type HtmNames } from './currentData.ts';
import { formatScanText, ScanCollector } from './report.ts';
import { buildRecipeKeys, checkBuild, checkFavorite, checkLootFilter, reviewMentions } from './resolve.ts';

// Synthetic bundles: only the fields the resolution reads
const BUNDLES = {
  bases: { bases: [{ code: 'rin' }, { code: 'cap' }] },
  sets: { sets: [{ items: [{ name: "Tal Rasha's Lidless Eye" }] }] },
  skills: { classes: [{ name: 'Paladin', tabs: [{ skills: [{ id: 'Zeal' }, { id: 'Smite' }] }] }] },
  crafting: {
    forgings: [{ kind: 'rune', key: 'r19' }],
    stacking: [
      { kind: 'dstone', material: { code: 'sss' }, switchItem: { code: 'cap' } },
      { kind: 'meld', material: { code: 'gpv' } },
    ],
  },
  enhance: { corruptionOutcomes: [{ slot: 'weapon', roll: 1 }], anointmentOutcomes: [{ pool: 'ring', roll: 2 }] },
  lootfilter: {
    items: [{ code: 'rin', type: 'ring' }],
    stats: [
      { id: 0, name: 'strength' },
      { id: 107, name: 'item_singleskill' },
      { id: 195, name: 'item_skillonattack' },
    ],
    areas: [{ id: 1, name: 'Rogue Encampment', act: 0 }],
    sounds: ['', 'item_ring'],
    uniques: [{ id: 120, name: 'Nagelring', code: 'rin', reqLvl: 7 }],
    sets: [],
    skills: [{ id: 6, name: 'Magic Arrow' }],
  },
  types: { types: [{ code: 'ring', ancestors: ['ring', 'misc'] }], classes: [] },
  itemTextSkills: [{ id: 36 }],
} as unknown as GameDataBundles;

const HTM: HtmNames = {
  runewords: [
    { name: 'Spirit', variant: 1, sockets: 4, runes: ['Tal', 'Thul', 'Ort', 'Amn'], gems: [] },
    { name: 'Spirit', variant: 2, sockets: 4, runes: ['Tal', 'Thul', 'Ort', 'Amn'], gems: [] },
    { name: 'Insight', variant: 1, sockets: 4, runes: ['Ral', 'Tir', 'Tal', 'Sol'], gems: [] },
  ],
  gemwords: [{ name: 'Holy', variant: 1, sockets: 1, gems: ['Chipped Diamond'] }],
  uniques: [{ name: 'Nagelring', baseItemCode: 'rin' }],
  mythicals: [{ name: 'Mythic Thing' }],
  ascendancies: ['Battlemage'],
};

const DATA: CurrentData = buildCurrentData(BUNDLES, HTM);
const NO_HTM: CurrentData = buildCurrentData(BUNDLES, null);

describe('checkFavorite', () => {
  it('resolves runeword, gemword and unique ids', () => {
    for (const id of ['runeword:Spirit:2', 'gemword:Holy:1', 'htmUnique:Nagelring:rin']) {
      expect(checkFavorite(id, DATA), id).toEqual({ checked: 1, unchecked: 0, problems: [] });
    }
  });

  it('reports a missing variant with the variants that exist', () => {
    expect(checkFavorite('runeword:Spirit:3', DATA).problems).toEqual([
      { kind: 'runeword', ref: 'runeword:Spirit:3', reason: 'not on runewords.htm (variants 1–2 exist)' },
    ]);
    expect(checkFavorite('gemword:Gone:1', DATA).problems[0]?.reason).toBe('not on gemwords.htm (no row has that name)');
  });

  it('reports a unique whose name or base code changed', () => {
    expect(checkFavorite('htmUnique:Nagelring:amu', DATA).problems[0]?.reason).toContain('base code amu is now rin');
    expect(checkFavorite('htmUnique:Renamed:rin', DATA).problems[0]?.reason).toBe('not on the unique pages');
  });

  it('keeps names with colons and flags unknown id kinds', () => {
    expect(checkFavorite('runeword:A:B:1', DATA).problems[0]?.ref).toBe('runeword:A:B:1');
    expect(checkFavorite('mystery:x', DATA).problems[0]).toMatchObject({ kind: 'favourite', reason: 'unknown item id kind "mystery"' });
  });

  it('counts HTM references as unchecked without HTM data', () => {
    expect(checkFavorite('runeword:Spirit:9', NO_HTM)).toEqual({ checked: 0, unchecked: 1, problems: [] });
  });
});

describe('checkBuild', () => {
  const resolving = {
    items: {
      weapon: {
        type: 'runeword',
        name: 'Spirit',
        variant: 1,
        snapshot: { sockets: 4, runes: ['Tal', 'Thul', 'Ort', 'Amn'] },
        base: { code: 'rin' },
      },
      ring1: { type: 'unique', id: 3, snapshot: { name: 'Nagelring' } },
      amulet: { type: 'freetext', name: 'anything' },
    },
    mercenary: { helmet: { type: 'set', name: "Tal Rasha's Lidless Eye", snapshot: {} } },
    itemCrafts: {
      weapon: [
        { kind: 'forge', forge: 'rune', key: 'r19' },
        { kind: 'corruption', slot: 'weapon', roll: 1 },
        { kind: 'dstone', material: 'sss', switchItem: 'cap', uses: 2 },
        { kind: 'meld', material: 'gpv', uses: 1 },
      ],
      ring1: [{ kind: 'anointment', pool: 'ring', roll: 2 }],
    },
    skillPoints: { Zeal: 20 },
    ascendancy: 'Battlemage',
  };

  it('resolves every kind of reference', () => {
    const result = checkBuild('Paladin', resolving, DATA);
    expect(result.problems).toEqual([]);
    expect(result.checked).toBe(12);
  });

  it('reports each reference that no longer resolves', () => {
    const stale = {
      items: {
        weapon: { type: 'runeword', name: 'Spirit', variant: 5, snapshot: {}, base: { code: 'zzz' } },
        ring1: { type: 'unique', snapshot: { name: 'Gone Ring' } },
        ring2: { type: 'mythical', snapshot: { name: 'Gone Myth' } },
      },
      weaponSwap: { shield2: { type: 'set', name: 'Gone Set Item', snapshot: {} } },
      itemCrafts: {
        weapon: [
          { kind: 'forge', forge: 'rune', key: 'r99' },
          { kind: 'corruption', slot: 'weapon', roll: 7 },
        ],
      },
      skillPoints: { 'Old Skill': 1 },
      ascendancy: 'Gone',
    };
    const kinds = checkBuild('Necromancer', stale, DATA).problems.map((problem) => `${problem.kind}: ${problem.ref}`);
    expect(kinds).toEqual([
      'class: Necromancer',
      'runeword: items.weapon runeword:Spirit:5',
      'base: items.weapon base zzz',
      'unique: items.ring1 "Gone Ring"',
      'mythical: items.ring2 "Gone Myth"',
      'set item: weaponSwap.shield2 "Gone Set Item"',
      'craft: itemCrafts.weapon forge rune:r99',
      'craft: itemCrafts.weapon corruption weapon:7',
      'skill: Old Skill',
      'ascendancy: Gone',
    ]);
  });

  it('reports a variant that now points at another recipe', () => {
    const shifted = {
      items: { weapon: { type: 'runeword', name: 'Insight', variant: 1, snapshot: { sockets: 4, runes: ['Tal', 'Thul', 'Ort', 'Amn'] } } },
    };
    expect(checkBuild('Paladin', shifted, DATA).problems).toEqual([
      {
        kind: 'runeword',
        ref: 'items.weapon runeword:Insight:1',
        reason: 'variant 1 is now a different recipe (Amn+Ort+Tal+Thul (4 sockets) → Ral+Sol+Tal+Tir (4 sockets))',
      },
    ]);
  });

  it('ignores malformed build data', () => {
    expect(checkBuild(null, 'oops', DATA)).toEqual({ checked: 0, unchecked: 0, problems: [] });
    expect(checkBuild('Paladin', { items: { weapon: 7, ring1: { type: 'runeword' } } }, DATA).problems).toEqual([]);
  });

  it('lists the recipe keys for the review cross-reference', () => {
    expect(buildRecipeKeys(resolving)).toEqual(['runeword:Spirit:1']);
  });
});

describe('checkLootFilter', () => {
  const filter = (rules: unknown[]) => JSON.stringify({ formatVersion: 1, rules });

  it('passes a filter whose ids all resolve', () => {
    const result = checkLootFilter(
      filter([
        { itemCodes: ['rin'], uniqueOrSetIds: [120], areas: [1], itemStats: [{ stat: 'strength', value: 1 }], sound: 1 },
        { itemStats: [{ stat: 'item_singleskill', param: 6, value: 1 }], itemTypes: ['ring'] },
      ]),
      DATA
    );
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(7);
  });

  it('reports unknown codes, types, ids, stats, sounds and skills', () => {
    const result = checkLootFilter(
      filter([
        {
          itemCodes: ['xyz'],
          itemTypes: ['nope'],
          uniqueOrSetIds: [999],
          areas: [500],
          itemStats: [{ stat: 'gone_stat', value: 1 }],
          sound: 77,
        },
        { itemStats: [{ stat: 195, param: (900 << 6) | 3, value: 1 }] },
      ]),
      DATA
    );
    expect(result.problems.map((problem) => problem.kind).sort()).toEqual([
      'area',
      'item code',
      'item type',
      'skill id',
      'sound',
      'stat',
      'unique or set id',
    ]);
  });

  it('reports a file that does not parse', () => {
    expect(checkLootFilter('{ nope', DATA).problems[0]?.kind).toBe('parse');
  });
});

describe('reviewMentions', () => {
  it('finds whole-token mentions in the details of checks that are not ok', () => {
    const review = {
      checks: [
        { id: 'variants.runewords', status: 'finding', details: ['runeword:Spirit:2 "a" -> "b"', 'runeword:Spirit:20 gone'] },
        { id: 'other', status: 'ok', details: ['runeword:Insight:1'] },
      ],
    };
    const mentions = reviewMentions(review, ['runeword:Spirit:2', 'runeword:Insight:1', 'runeword:Spirit:1']);
    expect([...mentions]).toEqual([['runeword:Spirit:2', ['variants.runewords: runeword:Spirit:2 "a" -> "b"']]]);
  });
});

describe('ScanCollector + formatScanText', () => {
  it('counts per category and kind and lists the affected items', () => {
    const collector = new ScanCollector();
    collector.add('favourite', 'runeword:Spirit:3 (2 favourites)', checkFavorite('runeword:Spirit:3', DATA));
    collector.add('favourite', 'runeword:Spirit:1 (1 favourite)', checkFavorite('runeword:Spirit:1', DATA));
    collector.add('build', '"B" by Someone#1234', checkBuild('Necromancer', {}, DATA));
    collector.version('build', '3.2.24');
    const report = collector.report(['ctx'], new Date(0));
    expect(report.counts.favourite).toEqual({ rows: 2, checked: 2, unchecked: 0, affectedRows: 1, problems: 1 });
    expect(report.byKind).toEqual({ 'build class': 1, 'favourite runeword': 1 });
    const text = formatScanText(report, 1);
    expect(text).toContain(
      '  favourite: runeword:Spirit:3 (2 favourites) → runeword runeword:Spirit:3: not on runewords.htm (variants 1–2 exist)'
    );
    expect(text).toContain('… +1 more (--limit 0 lists all)');
    expect(text).toContain('ESR version stamps of builds: 3.2.24: 1');
  });
});
