import { describe, expect, it } from 'vitest';
import type { LootFilterEntry } from '../store/types';
import {
  basedOnColumns,
  basedOnFromRow,
  entryBasedOn,
  inferTemplateBasedOn,
  sharedBasedOn,
  templateBasedOn,
  templateVersionOf,
} from './basedOn';
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

  it('takes the file version only when it looks like a template version', () => {
    const unknown = { template: TEMPLATE_ID, label: TEMPLATE_NAME };
    const withVersion = (version: string) => `{"formatVersion": 1, "version": ${JSON.stringify(version)}, "rules": []}`;
    expect(inferTemplateBasedOn(withVersion('v0.6.3'))).toEqual(templateBasedOn('0.6.3'));
    expect(inferTemplateBasedOn(withVersion(' 1.2 '))).toEqual(templateBasedOn('1.2'));
    expect(inferTemplateBasedOn(withVersion('my edit of Sully, second try'))).toEqual(unknown);
    expect(inferTemplateBasedOn(withVersion(`0.${'1'.repeat(60)}`))).toEqual(unknown);
    expect(inferTemplateBasedOn(withVersion('1.2.3.4.5'))).toEqual(unknown);
    expect(templateVersionOf('0.6.11')).toBe('0.6.11');
    expect(templateVersionOf(undefined)).toBeNull();
    expect(templateVersionOf('')).toBeNull();
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

  it('keeps the columns within their limits', () => {
    const columns = basedOnColumns({ id: 'src', revision: 2, version: 'x'.repeat(51), label: `${'é'.repeat(150)}${'😀'.repeat(100)}` });
    expect(columns.based_on_version).toBeNull();
    expect(Array.from(columns.based_on_label ?? '')).toHaveLength(200);
    expect(columns.based_on_label?.endsWith('😀')).toBe(true);
    expect(basedOnColumns({ template: TEMPLATE_ID, version: '0.6.11', label: 'Short' })).toMatchObject({
      based_on_version: '0.6.11',
      based_on_label: 'Short',
    });
  });

  it('labels a shared copy "name by author"', () => {
    expect(sharedBasedOn({ id: 'src', revision: 4, name: 'Mine' }, 'Bob#1234')).toEqual({
      id: 'src',
      revision: 4,
      label: 'Mine by Bob#1234',
    });
  });
});
