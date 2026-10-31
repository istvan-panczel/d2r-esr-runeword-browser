import { describe, it, expect } from 'vitest';
import {
  chargedValue,
  decodeChargedValue,
  decodeSkillLevelLayer,
  decodeTabLayer,
  MAX_STAT_PARAM,
  skillLevelLayer,
  skillTabLayer,
  statLayerKind,
  tabLayer,
} from './statLayers.ts';

describe('statLayerKind', () => {
  it('knows the layered stats by name', () => {
    expect(statLayerKind('item_addskill_tab')).toBe('tab');
    expect(statLayerKind('item_addclassskills')).toBe('class');
    expect(statLayerKind('item_singleskill')).toBe('skill');
    expect(statLayerKind('item_aura')).toBe('skill');
    expect(statLayerKind('item_skillonhit')).toBe('event');
    expect(statLayerKind('item_skillontakedmg_hidden')).toBe('event');
    expect(statLayerKind('item_charged_skill')).toBe('charged');
  });

  it('is undefined for other stats and object keys', () => {
    expect(statLayerKind('strength')).toBeUndefined();
    expect(statLayerKind('item_elemskill')).toBeUndefined();
    expect(statLayerKind('toString')).toBeUndefined();
  });
});

describe('skill tab layers', () => {
  it('encodes class << 3 | tab', () => {
    expect(tabLayer(0, 0)).toBe(0);
    expect(tabLayer(6, 2)).toBe(50);
    expect(tabLayer(7, 0)).toBe(56);
    expect(tabLayer(8, 0)).toBeUndefined();
    expect(tabLayer(0, 3)).toBeUndefined();
    expect(tabLayer(-1, 0)).toBeUndefined();
  });

  it('maps the properties.txt tab number (class * 3 + tab) to the layer', () => {
    expect(skillTabLayer(0)).toBe(0);
    expect(skillTabLayer(4)).toBe(9);
    expect(skillTabLayer(20)).toBe(50);
    expect([21, 22, 23].map(skillTabLayer)).toEqual([56, 57, 58]);
    expect(skillTabLayer(24)).toBeUndefined();
    expect(skillTabLayer(1.5)).toBeUndefined();
  });

  it('decodes a layer to class + tab, undefined for gaps and out of range', () => {
    expect(decodeTabLayer(50)).toEqual({ cls: 6, tab: 2 });
    expect(decodeTabLayer(58)).toEqual({ cls: 7, tab: 2 });
    expect(decodeTabLayer(3)).toBeUndefined();
    // properties.txt tab number 21 (Warlock Demon) read as a layer: class 2, tab 5
    expect(decodeTabLayer(21)).toBeUndefined();
    expect(decodeTabLayer(64)).toBeUndefined();
    expect(decodeTabLayer(-1)).toBeUndefined();
    for (let p = 0; p < 24; p++) expect(decodeTabLayer(skillTabLayer(p) ?? -1)).toEqual({ cls: Math.floor(p / 3), tab: p % 3 });
  });
});

describe('skill level layers', () => {
  it('encodes skill << 6 | level', () => {
    expect(skillLevelLayer(472, 25)).toBe(472 * 64 + 25);
    expect(skillLevelLayer(0, 1)).toBe(1);
    expect(skillLevelLayer(1023, 63)).toBe(MAX_STAT_PARAM);
  });

  it('is undefined when it does not fit', () => {
    expect(skillLevelLayer(1024, 1)).toBeUndefined();
    expect(skillLevelLayer(1555, 1)).toBeUndefined();
    expect(skillLevelLayer(10, 0)).toBeUndefined();
    expect(skillLevelLayer(10, 64)).toBeUndefined();
    expect(skillLevelLayer(-1, 5)).toBeUndefined();
  });

  it('decodes, undefined for level 0 and out of range', () => {
    expect(decodeSkillLevelLayer(472 * 64 + 25)).toEqual({ skill: 472, level: 25 });
    expect(decodeSkillLevelLayer(MAX_STAT_PARAM)).toEqual({ skill: 1023, level: 63 });
    expect(decodeSkillLevelLayer(64)).toBeUndefined();
    expect(decodeSkillLevelLayer(65536)).toBeUndefined();
    expect(decodeSkillLevelLayer(2.5)).toBeUndefined();
  });
});

describe('charged values', () => {
  it('encodes max charges << 8 | charges left', () => {
    expect(chargedValue(5, 5)).toBe(1285);
    expect(chargedValue(255, 0)).toBe(65280);
    expect(chargedValue(256, 0)).toBeUndefined();
    expect(chargedValue(5, -1)).toBeUndefined();
  });

  it('decodes', () => {
    expect(decodeChargedValue(1285)).toEqual({ max: 5, charges: 5 });
    expect(decodeChargedValue(20 * 256 + 3)).toEqual({ max: 20, charges: 3 });
    expect(decodeChargedValue(-1)).toBeUndefined();
    expect(decodeChargedValue(65536)).toBeUndefined();
  });
});
