import { EMPTY_LOOKUP } from './lookup';
import { levelsBadge, locationBadge, plainText, ruleActionHint, ruleMatchesSearch, ruleSearchText, ruleSummary } from './ruleSummary';
import { TEST_LOOKUP } from './testLookup.mock';

describe('ruleSummary', () => {
  it('names items, conditions and the main action', () => {
    const rule = {
      itemCodes: ['r33', 'r32', 'r31', 'xxx'],
      quality: 7,
      sockets: { min: 3 },
      useStyle: 'Mythical',
    } as const;
    expect(ruleSummary(rule, TEST_LOOKUP)).toBe('Zod Rune, Cham Rune +2 · unique · ≥3 sockets · → style Mythical');
  });

  it('falls back to codes without game data', () => {
    expect(ruleSummary({ itemCodes: ['r33'], hide: true }, EMPTY_LOOKUP)).toBe('r33 · hide');
  });

  it('summarizes the other conditions', () => {
    const rule = {
      itemTypes: ['axe'],
      excludeItemCodes: ['hax'],
      uniqueOrSetIds: [5],
      baseTier: 'elite',
      isEthereal: true,
      isIdentified: false,
      itemLevel: [85, 86],
      itemStats: [{ stat: 194, value: 2 }],
      playerStatsAnyOf: [
        { stat: 'strength', op: '<', value: 10 },
        { stat: 0, value: 1 },
      ],
      difficulty: { min: 'nightmare' },
      areas: [1],
      excludeAreas: [1, 2, 40],
    } as const;
    expect(ruleSummary(rule, TEST_LOOKUP)).toBe(
      "Axe · Harlequin Crest / Civerb's Ward · not Hand Axe · elite tier · eth · unidentified · ilvl 85, 86 · item_numsockets ≥2 · " +
        'character any of strength <10 +1 · ≥nightmare · in Rogue Encampment · not in 3 areas'
    );
  });

  it('counts more than two areas and names excluded types and uniques', () => {
    expect(ruleSummary({ areas: [1, 2, 40] }, TEST_LOOKUP)).toBe('in 3 areas');
    expect(ruleSummary({ areas: [1, 2] }, TEST_LOOKUP)).toBe('in Rogue Encampment, Blood Moor');
    expect(ruleSummary({ excludeItemTypes: ['axe', 'nope'] }, TEST_LOOKUP)).toBe('not Axe, nope');
    expect(ruleSummary({ excludeUniqueOrSetIds: [0, 9] }, TEST_LOOKUP)).toBe('not The Gnasher, #9');
  });

  it('reads a hide rule’s <, <= and != item stat checks as exceptions', () => {
    const demon = { stat: 'item_demondamage_percent', op: '<', value: 1 } as const;
    expect(ruleSummary({ itemTypes: ['axe'], quality: 'magic', itemStats: [demon], hide: true }, TEST_LOOKUP)).toBe(
      'Axe · magic · unless item_demondamage_percent ≥1 · hide'
    );
    expect(
      ruleSummary(
        {
          itemStats: [{ stat: 194, value: 2 }, demon, { stat: 'a', op: '<=', value: 5 }, { stat: 'b', op: '!=', value: 0 }],
          hide: true,
        },
        TEST_LOOKUP
      )
    ).toBe('item_numsockets ≥2 · unless item_demondamage_percent ≥1 or a >5 +1 · hide');
    expect(ruleSummary({ itemStatsAnyOf: [demon, { stat: 'a', op: '<', value: 3 }], hide: true }, TEST_LOOKUP)).toBe(
      'unless item_demondamage_percent ≥1 and a ≥3 · hide'
    );
    // A mixed any-of list and rules that do not hide read as plain checks.
    expect(ruleSummary({ itemStatsAnyOf: [demon, { stat: 'a', value: 3 }], hide: true }, TEST_LOOKUP)).toBe(
      'any of item_demondamage_percent <1 +1 · hide'
    );
    expect(ruleSummary({ itemStats: [demon], namePrefix: 'x' }, TEST_LOOKUP)).toBe('item_demondamage_percent <1 · prefix “x”');
  });

  it('says "any item" for a rule without conditions', () => {
    expect(ruleSummary({}, TEST_LOOKUP)).toBe('any item');
    expect(ruleSummary({ comment: 'note' }, TEST_LOOKUP)).toBe('any item');
  });
});

describe('ruleActionHint', () => {
  it('prefers hide, then style and the stripped name change', () => {
    expect(ruleActionHint({ hide: true, useStyle: 'X' })).toBe('hide');
    expect(ruleActionHint({ useStyle: 'X', replaceName: 'ÿc4Big ÿc0{name}' })).toBe('→ style X · “Big {name}”');
    expect(ruleActionHint({ namePrefix: { enUS: 'ÿc1* ' } })).toBe('prefix “*”');
    expect(ruleActionHint({ chatMessage: 'Found\nit' })).toBe('chat “Found it”');
    expect(ruleActionHint({ hideIfOtherConditionsFail: true })).toBe('hide if other conditions fail');
    expect(ruleActionHint({ notify: true })).toBeUndefined();
  });

  it('strips colour codes from texts', () => {
    expect(plainText('ÿc1A ÿc2B\nC')).toBe('A B C');
    expect(plainText(undefined)).toBeUndefined();
  });
});

describe('ruleSearchText', () => {
  it('holds codes, names, comment, style and stats in lowercase', () => {
    const text = ruleSearchText(
      { itemCodes: ['r33'], comment: 'High Runes', useStyle: 'Jackpot', itemStats: [{ stat: 194, value: 1 }], areas: [40] },
      TEST_LOOKUP
    );
    for (const term of ['r33', 'zod rune', 'high runes', 'jackpot', 'item_numsockets', 'lut gholein']) expect(text).toContain(term);
  });

  it('reuses a given summary', () => {
    expect(ruleSearchText({ itemCodes: ['r33'] }, TEST_LOOKUP, 'Precomputed')).toBe('precomputed r33 zod rune');
  });

  it('holds "disabled" for a disabled rule only', () => {
    expect(ruleSearchText({ itemCodes: ['r33'], disabled: true }, TEST_LOOKUP, 'Zod')).toBe('zod disabled r33 zod rune');
    expect(ruleSearchText({ itemCodes: ['r33'] }, TEST_LOOKUP)).not.toContain('disabled');
  });

  it('matches every query term', () => {
    const text = ruleSearchText({ itemCodes: ['r33'], useStyle: 'Jackpot' }, TEST_LOOKUP);
    expect(ruleMatchesSearch(text, 'ZOD jack')).toBe(true);
    expect(ruleMatchesSearch(text, 'zod cham')).toBe(false);
    expect(ruleMatchesSearch(text, '')).toBe(true);
  });
});

describe('row badges', () => {
  it('shows levels only when the rule is limited', () => {
    expect(levelsBadge(undefined)).toBeUndefined();
    expect(levelsBadge([1, 3])).toBe('L1,3');
    expect(levelsBadge([])).toBe('no level');
  });

  it('shows the location only when it is not the default', () => {
    expect(locationBadge(undefined)).toBeUndefined();
    expect(locationBadge(['onGround'])).toBeUndefined();
    expect(locationBadge(['onGround', 'atVendor'])).toBe('ground, vendor');
  });
});
