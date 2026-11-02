import { describe, expect, it } from 'vitest';
import type { LootFilterEntry } from '../store/types';
import { basedOnColumns, basedOnFromRow, entryBasedOn, inferTemplateBasedOn, sharedBasedOn, templateBasedOn } from './basedOn';
import { TEMPLATE_ID, TEMPLATE_NAME, TEMPLATE_VERSION } from './template';

const ENTRY: LootFilterEntry = { id: 'a', name: 'A', source: 'template', createdAt: 1, updatedAt: 1, text: '{"version": "0.5.0"}' };

describe('template basedOn', () => {
  it('defaults to the bundled version', () => {
    expect(templateBasedOn()).toEqual({
      template: TEMPLATE_ID,
      version: TEMPLATE_VERSION,
      label: `${TEMPLATE_NAME} v${TEMPLATE_VERSION}`,
    });
  });

  it("infers an old template draft's version from its file", () => {
    expect(inferTemplateBasedOn('// c\n{"formatVersion": 1, "version": "0.6.2", "rules": []}')).toEqual(templateBasedOn('0.6.2'));
    expect(inferTemplateBasedOn('{"formatVersion": 1, "rules": []}')).toEqual({ template: TEMPLATE_ID, label: TEMPLATE_NAME });
    expect(inferTemplateBasedOn('{ not json')).toEqual({ template: TEMPLATE_ID, label: TEMPLATE_NAME });
  });

  it('entryBasedOn prefers the recorded value and infers only for template drafts', () => {
    expect(entryBasedOn(ENTRY)).toEqual(templateBasedOn('0.5.0'));
    const recorded = { id: 'src', revision: 2, label: 'X by Y#1' };
    expect(entryBasedOn({ ...ENTRY, basedOn: recorded })).toBe(recorded);
    expect(entryBasedOn({ ...ENTRY, source: 'upload' })).toBeNull();
  });
});

describe('row mapping', () => {
  const NONE = { based_on_id: null, based_on_revision: null, based_on_template: null, based_on_version: null, based_on_label: null };

  it('reads the based_on columns', () => {
    expect(basedOnFromRow(NONE)).toBeNull();
    expect(basedOnFromRow({ ...NONE, based_on_id: 'src', based_on_revision: 3, based_on_label: 'X by Y#1' })).toEqual({
      id: 'src',
      revision: 3,
      label: 'X by Y#1',
    });
    // The source was deleted: the label stays.
    expect(basedOnFromRow({ ...NONE, based_on_revision: 3, based_on_label: 'X by Y#1' })).toEqual({ revision: 3, label: 'X by Y#1' });
  });

  it('writes them back', () => {
    expect(basedOnColumns(null)).toEqual(NONE);
    const template = templateBasedOn();
    expect(basedOnFromRow(basedOnColumns(template))).toEqual(template);
  });

  it('labels a shared copy "name by author"', () => {
    expect(sharedBasedOn({ id: 'src', revision: 4, name: 'Mine' }, 'Bob#1234')).toEqual({
      id: 'src',
      revision: 4,
      label: 'Mine by Bob#1234',
    });
  });
});
