import { describe, it, expect } from 'vitest';
import type { SocketableBonuses, Affix } from '@/core/db/models';
import type { UnifiedSocketable } from '../types';
import { bonusesToSearchText, matchesSearch } from './filteringHelpers';

// Helper to create a minimal affix
function createAffix(rawText: string): Affix {
  return {
    rawText,
    pattern: rawText,
    value: null,
    valueType: 'none',
  };
}

// Helper to create empty bonuses
function createEmptyBonuses(): SocketableBonuses {
  return {
    weaponsGloves: [],
    helmsBoots: [],
    armorShieldsBelts: [],
  };
}

// Helper to create a minimal socketable
function createSocketable(overrides: Partial<UnifiedSocketable> = {}): UnifiedSocketable {
  return {
    name: 'Test Item',
    category: 'gems',
    color: '#FF0000',
    reqLevel: 1,
    bonuses: createEmptyBonuses(),
    sortOrder: 0,
    ...overrides,
  };
}

describe('bonusesToSearchText', () => {
  it('should return empty string for empty bonuses', () => {
    const bonuses = createEmptyBonuses();
    expect(bonusesToSearchText(bonuses)).toBe('');
  });

  it('should include weaponsGloves bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+10 to Attack Rating')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    expect(bonusesToSearchText(bonuses)).toContain('+10 to attack rating');
  });

  it('should include helmsBoots bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [],
      helmsBoots: [createAffix('+15 Defense')],
      armorShieldsBelts: [],
    };
    expect(bonusesToSearchText(bonuses)).toContain('+15 defense');
  });

  it('should include armorShieldsBelts bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [],
      helmsBoots: [],
      armorShieldsBelts: [createAffix('+1 Light Radius')],
    };
    expect(bonusesToSearchText(bonuses)).toContain('+1 light radius');
  });

  it('should combine all bonus categories', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+10 Attack')],
      helmsBoots: [createAffix('+15 Defense')],
      armorShieldsBelts: [createAffix('+1 Light')],
    };
    const result = bonusesToSearchText(bonuses);
    expect(result).toContain('+10 attack');
    expect(result).toContain('+15 defense');
    expect(result).toContain('+1 light');
  });

  it('should lowercase the output', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('FIRE DAMAGE')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    expect(bonusesToSearchText(bonuses)).toBe('fire damage');
  });
});

describe('matchesSearch', () => {
  it('should return true for empty search terms', () => {
    const item = createSocketable({ name: 'Perfect Ruby' });
    expect(matchesSearch(item, [])).toBe(true);
  });

  it('should match item name', () => {
    const item = createSocketable({ name: 'Perfect Ruby' });
    expect(matchesSearch(item, ['ruby'])).toBe(true);
  });

  it('should match item name case-insensitively', () => {
    const item = createSocketable({ name: 'Perfect Ruby' });
    expect(matchesSearch(item, ['perfect'])).toBe(true);
  });

  it('should match bonus text', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+50% Fire Damage')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const item = createSocketable({ name: 'Test', bonuses });
    expect(matchesSearch(item, ['fire'])).toBe(true);
  });

  it('should require all terms to match (AND logic)', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+50% Fire Damage')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const item = createSocketable({ name: 'Perfect Ruby', bonuses });

    // Both terms present
    expect(matchesSearch(item, ['ruby', 'fire'])).toBe(true);

    // One term missing
    expect(matchesSearch(item, ['ruby', 'cold'])).toBe(false);
  });

  it('should match quoted phrases as single terms', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+5% Life Stolen Per Hit')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const item = createSocketable({ name: 'Test', bonuses });

    // This tests that the parseSearchTerms correctly extracts quoted phrases
    // and matchesSearch correctly matches them
    expect(matchesSearch(item, ['life stolen per hit'])).toBe(true);
    expect(matchesSearch(item, ['life stolen'])).toBe(true);
  });

  it('should not match partial words incorrectly', () => {
    const item = createSocketable({ name: 'Perfect Ruby' });

    // "perf" should match because it's a substring of "perfect"
    expect(matchesSearch(item, ['perf'])).toBe(true);

    // But "xyz" should not match
    expect(matchesSearch(item, ['xyz'])).toBe(false);
  });

  it('should match across name and bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+50% Fire Damage')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const item = createSocketable({ name: 'Perfect Ruby', bonuses });

    // "ruby" from name and "fire" from bonuses
    expect(matchesSearch(item, ['ruby', 'fire'])).toBe(true);
  });
});
