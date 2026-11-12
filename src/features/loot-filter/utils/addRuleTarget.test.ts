import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { createBlankFilter } from './blankFilter';
import { addRuleTarget, addRuleTargetNotice, addedRuleToast, type AddRuleTargetSnapshot } from './addRuleTarget';
import { buildSectionRows } from './sections';

const filterOf = (rules: readonly LootFilterRule[], rulesEndComments?: readonly string[]): LootFilter => ({
  ...createBlankFilter('Test'),
  rules,
  ...(rulesEndComments === undefined ? {} : { rulesEndComments }),
});
const read = (path: string) => parseLootFilter(readFileSync(resolve(process.cwd(), path), 'utf8')).filter;

describe('addRuleTarget', () => {
  it('is custom with an existing Custom rules section inside Protection (titles ignoring case and spaces)', () => {
    const filter = filterOf([
      { commentsBefore: ['// ==== Hiding'] },
      { commentsBefore: ['// ====  protection '] },
      { commentsBefore: ['// ---- CUSTOM rules'] },
    ]);
    expect(addRuleTarget(filter)).toEqual({ kind: 'custom', section: 'existing', part: { at: 1, line: 0 } });
  });

  it('is custom, section created, without Custom rules in the part (one in another part does not count)', () => {
    const filter = filterOf([
      { commentsBefore: ['// ==== Protection', '// Never hidden.'] },
      { commentsBefore: ['// ==== Other', '// ---- Custom rules'] },
    ]);
    expect(addRuleTarget(filter)).toEqual({ kind: 'custom', section: 'created', part: { at: 0, line: 0 } });
  });

  it('finds a part written after the last rule', () => {
    expect(addRuleTarget(filterOf([{}], ['', '// ==== Protection']))).toEqual({
      kind: 'custom',
      section: 'created',
      part: { at: 1, line: 1 },
    });
  });

  it('is selected without a Protection part', () => {
    expect(addRuleTarget(createBlankFilter('Blank'))).toEqual({ kind: 'selected' });
    expect(addRuleTarget(filterOf([{ comment: 'a' }]))).toEqual({ kind: 'selected' });
    expect(addRuleTarget(filterOf([{ commentsBefore: ['// ---- Protection'] }]))).toEqual({ kind: 'selected' });
    expect(addRuleTarget(read('public/loot-filters/example-filter.json'))).toEqual({ kind: 'selected' });
  });

  it('points at the Protection heading row of Sully’s v0.9.2', () => {
    const filter = read('src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json');
    const target = addRuleTarget(filter);
    expect(target).toMatchObject({ kind: 'custom', section: 'created' });
    const rows = buildSectionRows(filter.rules, (rule) => rule.commentsBefore, filter.rulesEndComments ?? []);
    const protection = rows.find((row) => row.kind === 'heading' && row.title === 'Protection');
    expect(target.kind === 'custom' && protection?.kind === 'heading' ? target.part : undefined).toEqual(
      protection?.kind === 'heading' ? protection.address : 'missing'
    );
  });
});

describe('addedRuleToast', () => {
  it('says where the rule went, and that the section is new when it was created', () => {
    const part = { at: 0, line: 0 };
    expect(addedRuleToast({ kind: 'custom', section: 'existing', part })).toEqual({
      message: "Added to Protection › Custom rules with Show: hide rules can't hide it.",
      description: undefined,
    });
    expect(addedRuleToast({ kind: 'custom', section: 'created', part })?.description).toBe('New section at the end of Protection.');
  });

  it('says nothing without Protection', () => {
    expect(addedRuleToast({ kind: 'selected' })).toBeUndefined();
  });
});

describe('addRuleTargetNotice', () => {
  const at = (filterKey: string, kind: AddRuleTargetSnapshot['kind']): AddRuleTargetSnapshot => ({ filterKey, kind });

  it('tells when an edit of the same filter changes the target kind', () => {
    expect(addRuleTargetNotice(at('draft:a', 'selected'), at('draft:a', 'custom'))).toBe(
      'New rules now go to Protection › Custom rules, with Show.'
    );
    expect(addRuleTargetNotice(at('draft:a', 'custom'), at('draft:a', 'selected'))).toBe(
      'This filter has no Protection part any more: Add rule puts new rules after the selected rule, without Show.'
    );
  });

  it('says nothing on first load, for another filter, without a filter or when the kind stays', () => {
    expect(addRuleTargetNotice(null, at('draft:a', 'custom'))).toBeUndefined();
    expect(addRuleTargetNotice(at('draft:a', 'selected'), at('draft:b', 'custom'))).toBeUndefined();
    expect(addRuleTargetNotice(at('draft:a', 'custom'), null)).toBeUndefined();
    expect(addRuleTargetNotice(at('draft:a', 'custom'), at('draft:a', 'custom'))).toBeUndefined();
  });

  it('keeps custom when Add rule creates the Custom rules section', () => {
    const before = filterOf([{ commentsBefore: ['// ==== Protection'] }]);
    const after = filterOf([{ commentsBefore: ['// ==== Protection'] }, { show: true, commentsBefore: ['// ---- Custom rules'] }]);
    expect(addRuleTarget(before)).toMatchObject({ section: 'created' });
    expect(addRuleTarget(after)).toMatchObject({ section: 'existing' });
    expect(addRuleTargetNotice(at('k', addRuleTarget(before).kind), at('k', addRuleTarget(after).kind))).toBeUndefined();
  });
});
