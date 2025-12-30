import { describe, it, expect } from 'vitest';
import { PropertyTranslator, createPropertyTranslator } from './propertyTranslator';
import type { TxtPropertyDef, TxtProperty } from '@/core/db';

describe('PropertyTranslator', () => {
  const sampleProperties: TxtPropertyDef[] = [
    { code: 'str', tooltip: '+# to Strength', parameter: '' },
    { code: 'ac%', tooltip: '+#% Enhanced Defense', parameter: '' },
    { code: 'res-all', tooltip: 'All Resistances +#%', parameter: '' },
  ];

  describe('translate', () => {
    it('should translate a property using definition tooltip', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'str', param: '', min: 50, max: 50 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+50 to Strength');
      expect(result.rawCode).toBe('str');
    });

    it('should show range when min !== max', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'ac%', param: '', min: 100, max: 150 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(100 to 150)% Enhanced Defense');
    });

    it('should show fixed value when min === max', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'res-all', param: '', min: 30, max: 30 };

      const result = translator.translate(prop);

      expect(result.text).toBe('All Resistances +30%');
    });

    it('should use fallback tooltip for strpercent', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'strpercent', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(10 to 20)% Bonus to Strength');
    });

    it('should use fallback tooltip for vitpercent', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'vitpercent', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(10 to 20)% Bonus to Vitality');
    });

    it('should use fallback tooltip for dexpercent', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'dexpercent', param: '', min: 15, max: 15 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+15% Bonus to Dexterity');
    });

    it('should use fallback tooltip for enepercent', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'enepercent', param: '', min: 5, max: 10 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(5 to 10)% Bonus to Energy');
    });

    it('should return raw format for unknown properties', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'unknown-prop', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('unknown-prop: 10-20');
      expect(result.rawCode).toBe('unknown-prop');
    });

    it('should include param in raw format when present', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // Use a truly unknown property code (not 'skill' which is now specially handled)
      const prop: TxtProperty = { code: 'unknown-skill-type', param: 'Bash', min: 5, max: 5 };

      const result = translator.translate(prop);

      expect(result.text).toBe('unknown-skill-type Bash: 5');
    });
  });

  describe('translateAll', () => {
    it('should translate multiple properties', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const props: TxtProperty[] = [
        { code: 'str', param: '', min: 40, max: 50 },
        { code: 'vitpercent', param: '', min: 10, max: 20 },
      ];

      const results = translator.translateAll(props);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('+(40 to 50) to Strength');
      expect(results[1].text).toBe('+(10 to 20)% Bonus to Vitality');
    });
  });

  describe('hasProperty', () => {
    it('should return true for known properties', () => {
      const translator = new PropertyTranslator(sampleProperties);

      expect(translator.hasProperty('str')).toBe(true);
      expect(translator.hasProperty('ac%')).toBe(true);
    });

    it('should return false for unknown properties', () => {
      const translator = new PropertyTranslator(sampleProperties);

      expect(translator.hasProperty('unknown')).toBe(false);
      expect(translator.hasProperty('strpercent')).toBe(false); // Not in propertyMap
    });
  });

  describe('getDefinition', () => {
    it('should return definition for known properties', () => {
      const translator = new PropertyTranslator(sampleProperties);

      const def = translator.getDefinition('str');

      expect(def).toEqual({ code: 'str', tooltip: '+# to Strength', parameter: '' });
    });

    it('should return undefined for unknown properties', () => {
      const translator = new PropertyTranslator(sampleProperties);

      expect(translator.getDefinition('unknown')).toBeUndefined();
    });
  });

  describe('createPropertyTranslator', () => {
    it('should create a PropertyTranslator instance', () => {
      const translator = createPropertyTranslator(sampleProperties);

      expect(translator).toBeInstanceOf(PropertyTranslator);
      expect(translator.hasProperty('str')).toBe(true);
    });
  });

  describe('special property translations', () => {
    it('should translate skilltab with Necromancer Curses (tab 6)', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'skilltab', param: '6', min: 1, max: 6 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(1 to 6) to Curses (Necromancer Only)');
    });

    it('should translate skilltab with Necromancer Summoning (tab 8)', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'skilltab', param: '8', min: 1, max: 6 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(1 to 6) to Summoning Skills (Necromancer Only)');
    });

    it('should translate skilltab with fixed value', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'skilltab', param: '3', min: 2, max: 2 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+2 to Fire Spells (Sorceress Only)');
    });

    it('should fallback for unknown skilltab IDs', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'skilltab', param: '99', min: 1, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+1 to 99 Skills');
    });

    it('should translate red-dmg% as Physical Resist', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'red-dmg%', param: '', min: -30, max: -30 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Physical Resist: -30%');
    });

    it('should translate red-dmg% with range', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'red-dmg%', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Physical Resist: (10 to 20)%');
    });

    it('should translate extra-summ using fallback', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'extra-summ', param: '', min: 25, max: 50 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(25 to 50)% to Summon Damage');
    });

    it('should translate extra-summ-total using fallback', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'extra-summ-total', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(10 to 20)% Total Multiplier to Summon Damage Stat');
    });
  });

  describe('poison damage with duration', () => {
    it('should apply poison damage formula (rawValue * frames / 256)', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // param=256 frames, 256/25 = 10.24 seconds
      // displayValue = 500 * 256 / 256 = 500
      const prop: TxtProperty = { code: 'dmg-pois', param: '256', min: 500, max: 500 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Adds 500 Poison Damage Over 10.24 Seconds');
    });

    it('should show range for different min/max poison damage', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // param=100 frames, 100/25 = 4 seconds
      // displayMin = 50 * 100 / 256 = 20 (rounded)
      // displayMax = 100 * 100 / 256 = 39 (rounded)
      const prop: TxtProperty = { code: 'dmg-pois', param: '100', min: 50, max: 100 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Adds 20-39 Poison Damage Over 4 Seconds');
    });

    it('should calculate Serpent Lord poison damage correctly', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // param=25 frames (1 second), min=2048, max=3072
      // displayMin = 2048 * 25 / 256 = 200
      // displayMax = 3072 * 25 / 256 = 300
      const prop: TxtProperty = { code: 'dmg-pois', param: '25', min: 2048, max: 3072 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Adds 200-300 Poison Damage Over 1 Seconds');
    });

    it('should calculate Snakecord poison damage correctly', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // param=50 frames (2 seconds), min=768, max=1024
      // displayMin = 768 * 50 / 256 = 150
      // displayMax = 1024 * 50 / 256 = 200
      const prop: TxtProperty = { code: 'dmg-pois', param: '50', min: 768, max: 1024 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Adds 150-200 Poison Damage Over 2 Seconds');
    });
  });

  describe('oskill with skill ID lookup', () => {
    it('should resolve known skill ID to name', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // Skill ID 765 = Bonus Crossbow Damage
      const prop: TxtProperty = { code: 'oskill', param: '765', min: 1, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+1 to Bonus Crossbow Damage');
    });

    it('should use param as skill name for unknown IDs', () => {
      const translator = new PropertyTranslator(sampleProperties);
      // Named skill (not numeric ID)
      const prop: TxtProperty = { code: 'oskill', param: 'Teleport', min: 1, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+1 to Teleport');
    });

    it('should show range for oskill with different min/max', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'oskill', param: 'Fireball', min: 1, max: 3 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(1 to 3) to Fireball');
    });
  });

  describe('skill with class name lookup', () => {
    const druidSkills = [
      { skill: 'Contagion', charClass: 'dru' as const },
      { skill: 'Fury', charClass: 'dru' as const },
    ];
    const barbarianSkills = [{ skill: 'Bash', charClass: 'bar' as const }];

    it('should resolve skill to class name from skills data', () => {
      const translator = new PropertyTranslator(sampleProperties, druidSkills);
      const prop: TxtProperty = { code: 'skill', param: 'Contagion', min: 5, max: 10 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+(5 to 10) to Contagion (Druid Only)');
    });

    it('should handle fixed value skill bonus', () => {
      const translator = new PropertyTranslator(sampleProperties, barbarianSkills);
      const prop: TxtProperty = { code: 'skill', param: 'Bash', min: 3, max: 3 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+3 to Bash (Barbarian Only)');
    });

    it('should show skill name without class when not in skills data', () => {
      const translator = new PropertyTranslator(sampleProperties, []); // Empty skills
      const prop: TxtProperty = { code: 'skill', param: 'UnknownSkill', min: 1, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+1 to UnknownSkill');
    });

    it('should show skill name without class when no skills data provided', () => {
      const translator = new PropertyTranslator(sampleProperties); // No skills
      const prop: TxtProperty = { code: 'skill', param: 'Teleport', min: 5, max: 5 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+5 to Teleport');
    });
  });

  describe('per-level properties (Based on Character Level)', () => {
    it('should calculate per-level value using param/8 when max is 0', () => {
      // This is the common case: dmg-fire/lvl with param=16, min=0, max=0 → 16/8=2
      const propertiesWithDmgLvl: TxtPropertyDef[] = [
        { code: 'dmg-fire/lvl', tooltip: '+# to Maximum Fire Damage (Based on Character Level)', parameter: '#/8 per Level' },
      ];
      const translator = new PropertyTranslator(propertiesWithDmgLvl);
      const prop: TxtProperty = { code: 'dmg-fire/lvl', param: '16', min: 0, max: 0 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+2 to Maximum Fire Damage (Based on Character Level)');
    });

    it('should calculate per-level value for deadly/lvl with decimal', () => {
      const propertiesWithDeadly: TxtPropertyDef[] = [
        { code: 'deadly/lvl', tooltip: '#% Deadly Strike (Based on Character Level)', parameter: '#/8 per Level' },
      ];
      const translator = new PropertyTranslator(propertiesWithDeadly);
      // param=4, max=0 → 4/8 = 0.5
      const prop: TxtProperty = { code: 'deadly/lvl', param: '4', min: 0, max: 0 };

      const result = translator.translate(prop);

      expect(result.text).toBe('0.5% Deadly Strike (Based on Character Level)');
    });

    it('should calculate per-level value for thorns/lvl using max/param when max is set', () => {
      const propertiesWithThorns: TxtPropertyDef[] = [
        { code: 'thorns/lvl', tooltip: 'Attacker Takes Damage of # (Based on Character Level)', parameter: '#/8 per Level' },
      ];
      const translator = new PropertyTranslator(propertiesWithThorns);
      // When max is set and different from min, use max/param format
      const prop: TxtProperty = { code: 'thorns/lvl', param: '40', min: 0, max: 200 };

      const result = translator.translate(prop);

      expect(result.text).toBe('Attacker Takes Damage of 5 (Based on Character Level)');
    });

    it('should handle per-level with whole number result', () => {
      const propertiesWithAc: TxtPropertyDef[] = [
        { code: 'ac/lvl', tooltip: '+# Defense (Based on Character Level)', parameter: 'ac/lvl (8ths)' },
      ];
      const translator = new PropertyTranslator(propertiesWithAc);
      // param=24, max=0 → 24/8 = 3
      const prop: TxtProperty = { code: 'ac/lvl', param: '24', min: 0, max: 0 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+3 Defense (Based on Character Level)');
    });

    it('should not append param for per-level properties', () => {
      const propertiesWithDmgLvl: TxtPropertyDef[] = [
        { code: 'dmg/lvl', tooltip: '+# to Maximum Damage (Based on Character Level)', parameter: '#/8 per Level' },
      ];
      const translator = new PropertyTranslator(propertiesWithDmgLvl);
      const prop: TxtProperty = { code: 'dmg/lvl', param: '16', min: 0, max: 0 };

      const result = translator.translate(prop);

      // Should NOT append (16) at the end
      expect(result.text).toBe('+2 to Maximum Damage (Based on Character Level)');
      expect(result.text).not.toContain('(16)');
    });

    it('should default to max/8 when param is empty', () => {
      const propertiesWithDmgLvl: TxtPropertyDef[] = [
        { code: 'dmg-fire/lvl', tooltip: '+# to Maximum Fire Damage (Based on Character Level)', parameter: '#/8 per Level' },
      ];
      const translator = new PropertyTranslator(propertiesWithDmgLvl);
      // No param specified - should use max/8
      const prop: TxtProperty = { code: 'dmg-fire/lvl', param: '', min: 0, max: 16 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+2 to Maximum Fire Damage (Based on Character Level)');
    });
  });

  describe('dual # placeholder properties (chance to cast)', () => {
    it('should handle kill-skill with two # placeholders', () => {
      const propertiesWithSkill: TxtPropertyDef[] = [
        { code: 'kill-skill', tooltip: '#% Chance to Cast Level # [Skill] when you Kill an Enemy', parameter: 'Skill' },
      ];
      const translator = new PropertyTranslator(propertiesWithSkill);
      const prop: TxtProperty = { code: 'kill-skill', param: 'Lightning Surge', min: 33, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('33% Chance to Cast Level 1 Lightning Surge when you Kill an Enemy');
    });

    it('should handle gethit-skill with two # placeholders', () => {
      const propertiesWithSkill: TxtPropertyDef[] = [
        { code: 'gethit-skill', tooltip: '#% Chance to Cast Level # [Skill] when struck', parameter: 'Skill' },
      ];
      const translator = new PropertyTranslator(propertiesWithSkill);
      const prop: TxtProperty = { code: 'gethit-skill', param: 'Nova', min: 10, max: 1 };

      const result = translator.translate(prop);

      expect(result.text).toBe('10% Chance to Cast Level 1 Nova when struck');
    });

    it('should handle hit-skill with two # placeholders', () => {
      const propertiesWithSkill: TxtPropertyDef[] = [
        { code: 'hit-skill', tooltip: '#% Chance to Cast Level # [Skill] on striking', parameter: 'Skill' },
      ];
      const translator = new PropertyTranslator(propertiesWithSkill);
      const prop: TxtProperty = { code: 'hit-skill', param: 'Fireball', min: 25, max: 5 };

      const result = translator.translate(prop);

      expect(result.text).toBe('25% Chance to Cast Level 5 Fireball on striking');
    });
  });

  describe('+- formatting fix', () => {
    it('should fix +- to just - for negative values', () => {
      const propertiesWithHp: TxtPropertyDef[] = [{ code: 'hp', tooltip: '+# to Life', parameter: '' }];
      const translator = new PropertyTranslator(propertiesWithHp);
      const prop: TxtProperty = { code: 'hp', param: '', min: -150, max: -150 };

      const result = translator.translate(prop);

      expect(result.text).toBe('-150 to Life');
    });

    it('should keep + for positive values', () => {
      const propertiesWithHp: TxtPropertyDef[] = [{ code: 'hp', tooltip: '+# to Life', parameter: '' }];
      const translator = new PropertyTranslator(propertiesWithHp);
      const prop: TxtProperty = { code: 'hp', param: '', min: 100, max: 100 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+100 to Life');
    });

    it('should fix +- with range values', () => {
      const propertiesWithHp: TxtPropertyDef[] = [{ code: 'hp', tooltip: '+# to Life', parameter: '' }];
      const translator = new PropertyTranslator(propertiesWithHp);
      const prop: TxtProperty = { code: 'hp', param: '', min: -200, max: -100 };

      const result = translator.translate(prop);

      // With range format, becomes +(-200 to -100) which the fix converts to (-200 to -100)
      expect(result.text).toBe('(-200 to -100) to Life');
    });
  });
});
