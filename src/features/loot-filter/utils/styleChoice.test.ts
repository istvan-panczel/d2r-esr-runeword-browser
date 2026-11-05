import { describe, expect, it } from 'vitest';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { createBlankFilter } from './blankFilter';
import { applyPatch } from './patch';
import {
  actionOrigin,
  applyStyleChoice,
  collapseToStyle,
  joinWords,
  planStyleChoice,
  STYLE_KEYS,
  styleChoiceMessage,
  styleKeyLabel,
} from './styleChoice';
import { stylePreset } from './stylePresets';

const UNIQUE = stylePreset('unique');

const rule: LootFilterRule = {
  comment: 'Uniques',
  quality: [7],
  replaceName: 'ÿc1{name}',
  labelBackground: [10, 10, 10, 200],
  labelBorder: { color: [1, 2, 3, 255], width: 2 },
  sound: 'tink.mp3',
};

function filterWith(overrides: Partial<LootFilter> = {}): LootFilter {
  return { ...createBlankFilter('Test'), rules: [rule], ...overrides };
}

describe('applyStyleChoice', () => {
  it('clears the own values of the keys the style sets and keeps the others', () => {
    const { patch, cleared } = applyStyleChoice(rule, UNIQUE.style);
    expect(cleared).toEqual(['replaceName', 'labelBackground', 'labelBorder']);
    expect(applyPatch(rule, patch)).toEqual({ comment: 'Uniques', quality: [7], sound: 'tink.mp3' });
  });

  it('clears nothing without a style or when the rule sets none of its keys', () => {
    expect(applyStyleChoice(rule, undefined)).toEqual({ patch: {}, cleared: [] });
    expect(applyStyleChoice({ sound: 'tink.mp3' }, UNIQUE.style).cleared).toEqual([]);
  });

  it('never clears useStyle or comment', () => {
    expect(STYLE_KEYS).not.toContain('useStyle');
    expect(STYLE_KEYS).not.toContain('comment');
    expect(applyStyleChoice({ comment: 'x', useStyle: 'A' }, { comment: 'y', useStyle: 'B' }).cleared).toEqual([]);
  });
});

describe('planStyleChoice', () => {
  it('sets useStyle with the clearing patch and undoes exactly', () => {
    const filter = filterWith({ styles: { UniqueItem: UNIQUE.style } });
    const plan = planStyleChoice(rule, filter, { kind: 'style', name: 'UniqueItem' });
    const picked = applyPatch(rule, plan.apply.patch);
    expect(picked).toEqual({ comment: 'Uniques', quality: [7], sound: 'tink.mp3', useStyle: 'UniqueItem' });
    expect(applyPatch(picked, plan.undo.patch)).toEqual(rule);
    expect(plan.undo.ifUseStyle).toEqual({ value: 'UniqueItem' });
    expect(plan.apply.addStyle).toBeUndefined();
    expect(plan.preset).toBeUndefined();
  });

  it('restores the previous style on undo', () => {
    const styled = { ...rule, useStyle: 'Old' };
    const plan = planStyleChoice(styled, filterWith(), { kind: 'none' });
    expect(plan.cleared).toEqual([]);
    expect(applyPatch(applyPatch(styled, plan.apply.patch), plan.undo.patch)).toEqual(styled);
  });

  it('gives a wrong-shaped original back from passthrough', () => {
    const odd: LootFilterRule = { ...rule, passthrough: { useStyle: 7, extra: true } };
    const plan = planStyleChoice(odd, filterWith({ styles: { UniqueItem: UNIQUE.style } }), { kind: 'style', name: 'UniqueItem' });
    const picked = applyPatch(odd, plan.apply.patch);
    expect(picked.passthrough).toEqual({ extra: true });
    expect(applyPatch(picked, plan.undo.patch)).toEqual(odd);
  });

  it('adds a missing preset and removes it on undo', () => {
    const plan = planStyleChoice(rule, filterWith(), { kind: 'preset', preset: UNIQUE });
    expect(plan.preset).toBe('added');
    expect(plan.apply.addStyle).toEqual({ name: 'UniqueItem', style: UNIQUE.style });
    expect(plan.undo.removeStyleIfUnused).toBe('UniqueItem');
    expect(plan.cleared).toEqual(['replaceName', 'labelBackground', 'labelBorder']);
  });

  it('uses the filter style of the preset name and clears by it', () => {
    const filter = filterWith({ styles: { UniqueItem: { sound: 'unique.mp3' } } });
    const plan = planStyleChoice(rule, filter, { kind: 'preset', preset: UNIQUE });
    expect(plan.preset).toBe('kept');
    expect(plan.apply.addStyle).toBeUndefined();
    expect(plan.undo.removeStyleIfUnused).toBeUndefined();
    expect(plan.cleared).toEqual(['sound']);
    expect(planStyleChoice(rule, filterWith({ styles: { UniqueItem: UNIQUE.style } }), { kind: 'preset', preset: UNIQUE }).preset).toBe(
      'same'
    );
  });

  it('clears nothing for a missing style name', () => {
    expect(planStyleChoice(rule, filterWith(), { kind: 'style', name: 'Nope' }).cleared).toEqual([]);
  });
});

describe('styleChoiceMessage', () => {
  it('names the cleared fields', () => {
    const plan = planStyleChoice(rule, filterWith({ styles: { UniqueItem: UNIQUE.style } }), { kind: 'style', name: 'UniqueItem' });
    expect(styleChoiceMessage(plan, rule)).toEqual({
      title: "Cleared this rule's own name colour, background and border so the style shows.",
    });
  });

  it('says when a preset was added or kept, and nothing when nothing happened', () => {
    const added = planStyleChoice({ sound: 'x' }, filterWith(), { kind: 'preset', preset: UNIQUE });
    expect(styleChoiceMessage(added, {})).toEqual({ title: 'Added the style UniqueItem', description: undefined });
    const kept = planStyleChoice({}, filterWith({ styles: { UniqueItem: {} } }), { kind: 'preset', preset: UNIQUE });
    expect(styleChoiceMessage(kept, {})?.title).toBe('The filter already has a style named UniqueItem');
    expect(styleChoiceMessage(planStyleChoice({}, filterWith(), { kind: 'none' }), {})).toBeNull();
  });
});

describe('actionOrigin', () => {
  it('tells own, style, changed and none apart', () => {
    expect(actionOrigin({ sound: 'a' }, undefined, 'sound')).toBe('own');
    expect(actionOrigin({}, { sound: 'b' }, 'sound')).toBe('style');
    expect(actionOrigin({ sound: 'a' }, { sound: 'b' }, 'sound')).toBe('changed');
    expect(actionOrigin({}, {}, 'sound')).toBe('none');
  });
});

describe('collapseToStyle', () => {
  it("removes a key set to the style's value and keeps other values", () => {
    const style = { labelBorder: { width: 1, color: [255, 165, 0, 255] as const }, replaceName: 'ÿc4{name}' };
    expect(collapseToStyle({ labelBorder: { color: [255, 165, 0, 255], width: 1 }, replaceName: 'ÿc1{name}' }, style)).toEqual({
      labelBorder: undefined,
      replaceName: 'ÿc1{name}',
    });
    expect(collapseToStyle({ hide: false }, { hide: true })).toEqual({ hide: false });
    expect(collapseToStyle({ sound: 'a' }, undefined)).toEqual({ sound: 'a' });
  });
});

describe('labels', () => {
  it('words a name colour and joins lists', () => {
    expect(styleKeyLabel('replaceName', { replaceName: 'ÿc4{name}' })).toBe('name colour');
    expect(styleKeyLabel('replaceName', { replaceName: 'Shiny' })).toBe('name');
    expect(joinWords([])).toBe('');
    expect(joinWords(['a'])).toBe('a');
    expect(joinWords(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
