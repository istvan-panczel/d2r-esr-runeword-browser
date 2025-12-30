import { describe, it, expect } from 'vitest';
import { parseSocketablesTxt, buildCodeToNameMap } from './socketablesParser';

describe('socketablesParser', () => {
  describe('parseSocketablesTxt', () => {
    it('should parse basic socketable with name and code', () => {
      const content = `name\tcode\tletter\tweaponMod1Code\tweaponMod1Param\tweaponMod1Min\tweaponMod1Max\thelmMod1Code\thelmMod1Param\thelmMod1Min\thelmMod1Max\tshieldMod1Code\tshieldMod1Param\tshieldMod1Min\tshieldMod1Max
Chipped Amethyst\tgcv\ta\tatt\t\t40\t40\tstr\t\t3\t3\tac\t\t8\t8`;

      const result = parseSocketablesTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Chipped Amethyst');
      expect(result[0].code).toBe('gcv');
      expect(result[0].letter).toBe('a');
    });

    it('should parse weapon modifiers', () => {
      const content = `name\tcode\tletter\tweaponMod1Code\tweaponMod1Param\tweaponMod1Min\tweaponMod1Max\tweaponMod2Code\tweaponMod2Param\tweaponMod2Min\tweaponMod2Max
Test Gem\ttest\tt\tatt\t\t40\t50\tdmg%\t\t10\t20`;

      const result = parseSocketablesTxt(content);

      expect(result[0].weaponMods).toHaveLength(2);
      expect(result[0].weaponMods[0]).toEqual({
        code: 'att',
        param: '',
        min: 40,
        max: 50,
      });
      expect(result[0].weaponMods[1]).toEqual({
        code: 'dmg%',
        param: '',
        min: 10,
        max: 20,
      });
    });

    it('should parse helm modifiers', () => {
      const content = `name\tcode\tletter\thelmMod1Code\thelmMod1Param\thelmMod1Min\thelmMod1Max\thelmMod2Code\thelmMod2Param\thelmMod2Min\thelmMod2Max
Test Gem\ttest\tt\tstr\t\t5\t5\tdex\t\t3\t3`;

      const result = parseSocketablesTxt(content);

      expect(result[0].helmMods).toHaveLength(2);
      expect(result[0].helmMods[0]).toEqual({
        code: 'str',
        param: '',
        min: 5,
        max: 5,
      });
      expect(result[0].helmMods[1]).toEqual({
        code: 'dex',
        param: '',
        min: 3,
        max: 3,
      });
    });

    it('should parse shield modifiers', () => {
      const content = `name\tcode\tletter\tshieldMod1Code\tshieldMod1Param\tshieldMod1Min\tshieldMod1Max
Test Gem\ttest\tt\tac\t\t15\t15`;

      const result = parseSocketablesTxt(content);

      expect(result[0].shieldMods).toHaveLength(1);
      expect(result[0].shieldMods[0]).toEqual({
        code: 'ac',
        param: '',
        min: 15,
        max: 15,
      });
    });

    it('should handle modifiers with parameters', () => {
      const content = `name\tcode\tletter\tweaponMod1Code\tweaponMod1Param\tweaponMod1Min\tweaponMod1Max
El Rune\tr01\te\tlight\t\t1\t1`;

      const result = parseSocketablesTxt(content);

      expect(result[0].weaponMods[0].code).toBe('light');
      expect(result[0].weaponMods[0].min).toBe(1);
      expect(result[0].weaponMods[0].max).toBe(1);
    });

    it('should filter out rows without name', () => {
      const content = `name\tcode\tletter
Chipped Ruby\tgcr\tr
\tgcb\tb`;

      const result = parseSocketablesTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Chipped Ruby');
    });

    it('should filter out rows without code', () => {
      const content = `name\tcode\tletter
Chipped Ruby\tgcr\tr
Perfect Ruby\t\tp`;

      const result = parseSocketablesTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Chipped Ruby');
    });

    it('should handle empty modifiers', () => {
      const content = `name\tcode\tletter\tweaponMod1Code\tweaponMod1Min\tweaponMod1Max
Test Gem\ttest\tt\t\t\t`;

      const result = parseSocketablesTxt(content);

      expect(result[0].weaponMods).toHaveLength(0);
    });

    it('should handle multiple socketables', () => {
      const content = `name\tcode\tletter
El Rune\tr01\te
Eld Rune\tr02\tl
Tir Rune\tr03\tt`;

      const result = parseSocketablesTxt(content);

      expect(result).toHaveLength(3);
      expect(result.map((s) => s.code)).toEqual(['r01', 'r02', 'r03']);
    });

    it('should parse up to 3 modifiers per slot', () => {
      const content = `name\tcode\tletter\tweaponMod1Code\tweaponMod1Min\tweaponMod1Max\tweaponMod2Code\tweaponMod2Min\tweaponMod2Max\tweaponMod3Code\tweaponMod3Min\tweaponMod3Max
Test\ttest\tt\tmod1\t1\t1\tmod2\t2\t2\tmod3\t3\t3`;

      const result = parseSocketablesTxt(content);

      expect(result[0].weaponMods).toHaveLength(3);
      expect(result[0].weaponMods[0].code).toBe('mod1');
      expect(result[0].weaponMods[1].code).toBe('mod2');
      expect(result[0].weaponMods[2].code).toBe('mod3');
    });
  });

  describe('buildCodeToNameMap', () => {
    it('should create a map from code to name', () => {
      const socketables = [
        { name: 'El Rune', code: 'r01', letter: 'e', weaponMods: [], helmMods: [], shieldMods: [] },
        { name: 'Eld Rune', code: 'r02', letter: 'l', weaponMods: [], helmMods: [], shieldMods: [] },
        { name: 'Chipped Ruby', code: 'gcr', letter: 'r', weaponMods: [], helmMods: [], shieldMods: [] },
      ];

      const map = buildCodeToNameMap(socketables);

      expect(map.size).toBe(3);
      expect(map.get('r01')).toBe('El Rune');
      expect(map.get('r02')).toBe('Eld Rune');
      expect(map.get('gcr')).toBe('Chipped Ruby');
    });

    it('should handle empty array', () => {
      const map = buildCodeToNameMap([]);
      expect(map.size).toBe(0);
    });

    it('should allow name lookup by code', () => {
      const socketables = [{ name: 'Perfect Diamond', code: 'gpw', letter: 'w', weaponMods: [], helmMods: [], shieldMods: [] }];

      const map = buildCodeToNameMap(socketables);

      expect(map.has('gpw')).toBe(true);
      expect(map.has('unknown')).toBe(false);
      expect(map.get('gpw')).toBe('Perfect Diamond');
    });
  });
});
