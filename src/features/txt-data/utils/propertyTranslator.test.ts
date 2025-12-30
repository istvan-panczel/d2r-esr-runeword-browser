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

      expect(result.text).toBe('+100-150% Enhanced Defense');
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

      expect(result.text).toBe('+10-20% Bonus to Strength');
    });

    it('should use fallback tooltip for vitpercent', () => {
      const translator = new PropertyTranslator(sampleProperties);
      const prop: TxtProperty = { code: 'vitpercent', param: '', min: 10, max: 20 };

      const result = translator.translate(prop);

      expect(result.text).toBe('+10-20% Bonus to Vitality');
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

      expect(result.text).toBe('+5-10% Bonus to Energy');
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
      const prop: TxtProperty = { code: 'skill', param: 'Bash', min: 5, max: 5 };

      const result = translator.translate(prop);

      expect(result.text).toBe('skill Bash: 5');
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
      expect(results[0].text).toBe('+40-50 to Strength');
      expect(results[1].text).toBe('+10-20% Bonus to Vitality');
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
});
