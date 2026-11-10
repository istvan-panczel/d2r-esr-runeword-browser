import { describe, expect, it } from 'vitest';
import { filterId, makeSummary } from '../sharing/sharing.mock';
import {
  compareVersions,
  createdOnLine,
  draftLinks,
  filterUpdateStatus,
  levelNames,
  resolveLibraryTab,
  ruleCountLabel,
  sourceIdsOf,
  updatedOnLine,
} from './library';

const A = filterId(1);
const B = filterId(2);
const SOURCE = filterId(9);

describe('draftLinks', () => {
  it('opens a new draft on the draft route, with Save as ?save=1', () => {
    expect(draftLinks({ id: 'local-1' }, false)).toEqual({
      open: '/loot-filters/draft/local-1',
      save: '/loot-filters/draft/local-1?save=1',
    });
  });

  it('opens the edits of a saved filter through the saved filter', () => {
    expect(draftLinks({ id: 'local-1', savedId: A, savedOwnerId: 'owner' }, false)).toEqual({
      open: `/loot-filters/${A}`,
      save: `/loot-filters/${A}?save=1`,
    });
  });

  it('keeps such a draft on the draft route while it needs a sign-in', () => {
    expect(draftLinks({ id: 'local-1', savedId: A, savedOwnerId: 'owner' }, true).open).toBe('/loot-filters/draft/local-1');
  });

  it('opens a draft that does not record its owner on its own route (the saved route would not find it)', () => {
    expect(draftLinks({ id: 'local-1', savedId: A }, false)).toEqual({
      open: '/loot-filters/draft/local-1',
      save: '/loot-filters/draft/local-1?save=1',
    });
  });
});

describe('resolveLibraryTab', () => {
  const context = { authKnown: true, signedIn: false, libraryHydrated: true, hasLocalDrafts: false };

  it('follows ?tab= when it names a tab', () => {
    expect(resolveLibraryTab('shared', { ...context, signedIn: true })).toBe('shared');
    expect(resolveLibraryTab('mine', { ...context, authKnown: false })).toBe('mine');
  });

  it('defaults to My filters signed in and Shared signed out without drafts', () => {
    expect(resolveLibraryTab(null, { ...context, signedIn: true })).toBe('mine');
    expect(resolveLibraryTab('bogus', context)).toBe('shared');
  });

  it('signed out with drafts in this browser: My filters, even before the sign-in state is known', () => {
    expect(resolveLibraryTab(null, { ...context, hasLocalDrafts: true })).toBe('mine');
    expect(resolveLibraryTab(null, { ...context, hasLocalDrafts: true, authKnown: false })).toBe('mine');
  });

  it('waits for the library and the sign-in state before choosing Shared', () => {
    expect(resolveLibraryTab(null, { ...context, authKnown: false })).toBeNull();
    expect(resolveLibraryTab(null, { ...context, libraryHydrated: false })).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compares dotted numbers numerically', () => {
    expect(compareVersions('0.6.9', '0.6.11')).toBeLessThan(0);
    expect(compareVersions('0.6.11', '0.6.11')).toBe(0);
    expect(compareVersions('1.0', '0.9.9')).toBeGreaterThan(0);
  });

  it('treats a missing part as 0 and ignores a leading v', () => {
    expect(compareVersions('v0.6', '0.6.0')).toBe(0);
    expect(compareVersions('0.6', '0.6.1')).toBeLessThan(0);
  });

  it('falls back to text order for non-numeric parts', () => {
    expect(compareVersions('1.0-beta', '1.0-rc')).toBeLessThan(0);
  });
});

describe('card text', () => {
  it('lists the versions a filter was created on', () => {
    expect(createdOnLine(makeSummary(A, { esr_version: '3.2.24', plugin_version: '1.5.3', file_version: 'v0.6.11' }))).toBe(
      'Created on ESR 3.2.24 · plugin 1.5.3 · filter v0.6.11'
    );
    expect(createdOnLine(makeSummary(A, { esr_version: null, plugin_version: null, file_version: '2' }))).toBe('Created on filter v2');
    expect(createdOnLine(makeSummary(A, { esr_version: null, plugin_version: null, file_version: null }))).toBeNull();
  });

  it('adds the versions of the last content save', () => {
    expect(updatedOnLine(makeSummary(A))).toBeNull();
    expect(updatedOnLine(makeSummary(A, { esr_version_updated: '3.2.25', plugin_version_updated: '1.5.4' }))).toBe(
      'Updated on ESR 3.2.25 · plugin 1.5.4'
    );
    expect(updatedOnLine(makeSummary(A, { esr_version_updated: '3.2.25' }))).toBe('Updated on ESR 3.2.25');
  });

  it('counts rules and names levels', () => {
    expect(ruleCountLabel(1)).toBe('1 rule');
    expect(ruleCountLabel(0)).toBe('0 rules');
    expect(
      levelNames([
        { id: 1, name: 'Strict' },
        { id: 2, name: '  ' },
        { id: 3, name: ' Very strict ' },
      ])
    ).toEqual(['Strict', 'Very strict']);
    expect(levelNames(null)).toEqual([]);
  });
});

describe('filterUpdateStatus', () => {
  const copy = makeSummary(A, { based_on_id: SOURCE, based_on_revision: 2, based_on_label: 'Source by Hero#4242' });

  it('is nothing for a filter that is not a copy', () => {
    expect(filterUpdateStatus(makeSummary(A), {}, {})).toBeNull();
  });

  it('waits for the source lookup', () => {
    expect(filterUpdateStatus(copy, {}, {})).toBeNull();
  });

  it('offers an update when the source has a newer revision, with its change note', () => {
    const sources = { [SOURCE]: { id: SOURCE, revision: 3, change_note: 'Hide more junk', name: 'Source' } };
    expect(filterUpdateStatus(copy, sources, {})).toEqual({ kind: 'update', note: 'Hide more junk' });
  });

  it('is up to date at the same revision', () => {
    const sources = { [SOURCE]: { id: SOURCE, revision: 2, change_note: null, name: 'Source' } };
    expect(filterUpdateStatus(copy, sources, {})).toBeNull();
  });

  it('says no longer shared when the source is private or deleted', () => {
    expect(filterUpdateStatus(copy, { [SOURCE]: null }, {})).toEqual({ kind: 'gone' });
    // Deleted: `on delete set null` cleared the id, the label stays.
    expect(filterUpdateStatus({ ...copy, based_on_id: null }, {}, {})).toEqual({ kind: 'gone' });
  });

  it('compares a template-based filter with the version of the template text in use', () => {
    const versions = { 'sullys-qol': '0.6.11', example: '1.2.0' };
    const fromTemplate = makeSummary(A, { based_on_template: 'sullys-qol', based_on_version: '0.6.9', based_on_label: 'Sully' });
    expect(filterUpdateStatus(fromTemplate, {}, versions)).toEqual({ kind: 'update', note: null });
    expect(filterUpdateStatus({ ...fromTemplate, based_on_version: '0.6.11' }, {}, versions)).toBeNull();
    expect(filterUpdateStatus({ ...fromTemplate, based_on_version: null }, {}, versions)).toBeNull();
    expect(filterUpdateStatus({ ...fromTemplate, based_on_template: 'other' }, {}, versions)).toBeNull();
    // The template not loaded (yet), or a text without a version: no update.
    expect(filterUpdateStatus(fromTemplate, {}, {})).toBeNull();
    expect(filterUpdateStatus(fromTemplate, {}, { 'sullys-qol': null })).toBeNull();
  });

  it('compares an example-based filter with the example version, not with Sully', () => {
    const versions = { 'sullys-qol': '0.6.11', example: '1.2.0' };
    const fromExample = makeSummary(A, { based_on_template: 'example', based_on_version: '1.0.0', based_on_label: 'Example v1.0.0' });
    expect(filterUpdateStatus(fromExample, {}, versions)).toEqual({ kind: 'update', note: null });
    expect(filterUpdateStatus({ ...fromExample, based_on_version: '1.2.0' }, {}, versions)).toBeNull();
    expect(filterUpdateStatus({ ...fromExample, based_on_version: '1.10.0' }, {}, versions)).toBeNull();
    expect(filterUpdateStatus(fromExample, {}, { 'sullys-qol': '0.6.11' })).toBeNull();
  });
});

describe('sourceIdsOf', () => {
  it('lists each source once, sorted', () => {
    const filters = [
      makeSummary(A, { based_on_id: SOURCE }),
      makeSummary(B, { based_on_id: A }),
      makeSummary(filterId(3), { based_on_id: SOURCE }),
      makeSummary(filterId(4)),
    ];
    expect(sourceIdsOf(filters)).toEqual([A, SOURCE]);
  });
});
