import { describe, expect, it } from 'vitest';
import { formulaCallText, formulaSummary } from './formulaText';

const skillName = (id: number) =>
  new Map([
    [479, 'Teleport'],
    [900, "Hydra Baal's Vile Whisper"],
  ]).get(id);

describe('formulaCallText', () => {
  it('writes a stat by name or id, with or without a param', () => {
    expect(formulaCallText({ fn: 'stat', stat: 'fireresist', skillName })).toBe("stat('fireresist')");
    expect(formulaCallText({ fn: 'playerStat', stat: 12, skillName })).toBe('playerStat(12)');
    expect(formulaCallText({ fn: 'stat', stat: 'item_addskill_tab', param: 50, kind: 'tab', skillName })).toBe(
      "stat('item_addskill_tab', 50)"
    );
  });

  it('names a skill stat’s param by its skills.txt name, else by number', () => {
    expect(formulaCallText({ fn: 'stat', stat: 'item_nonclassskill', param: 479, kind: 'skill', skillName })).toBe(
      "stat('item_nonclassskill', 'Teleport')"
    );
    // A name with a quote cannot be written in quotes
    expect(formulaCallText({ fn: 'stat', stat: 'item_aura', param: 900, kind: 'skill', skillName })).toBe("stat('item_aura', 900)");
    expect(formulaCallText({ fn: 'stat', stat: 'item_nonclassskill', param: 3, kind: 'skill', skillName })).toBe(
      "stat('item_nonclassskill', 3)"
    );
    // Skill-event stats keep the exact skill and level
    expect(formulaCallText({ fn: 'stat', stat: 'item_skillonhit', param: (479 << 6) | 5, kind: 'event', skillName })).toBe(
      `stat('item_skillonhit', ${String((479 << 6) | 5)})`
    );
  });

  it('drops the param of statMax and statSum', () => {
    expect(formulaCallText({ fn: 'statMax', stat: 'item_addskill_tab', param: 50, kind: 'tab', skillName })).toBe(
      "statMax('item_addskill_tab')"
    );
    expect(formulaCallText({ fn: 'statSum', stat: 'item_nonclassskill', param: 479, kind: 'skill', skillName })).toBe(
      "statSum('item_nonclassskill')"
    );
  });
});

describe('formulaSummary', () => {
  it('collapses whitespace and truncates', () => {
    expect(formulaSummary("stat('a')\n  >= 1")).toBe("formula: stat('a') >= 1");
    expect(formulaSummary("((stat('item_fastercastrate')>=10)&&((stat('fireresist'))>=40))")).toBe(
      "formula: ((stat('item_fastercastrate')>=10)&&((s…"
    );
  });
});
