import { describe, expect, it } from 'vitest';
import type { EditorTarget } from '../store/types';
import { templateBasedOn } from './basedOn';
import {
  authorLabelOf,
  editorPathOf,
  editorRouteOf,
  isShowProblemsState,
  keepsOwnerSandbox,
  saveDialogDetailsOf,
  SHOW_PROBLEMS_STATE,
  sourceUpdateOf,
  targetMatchesRoute,
} from './editorRoute';

const saved: EditorTarget = {
  kind: 'saved',
  savedId: 'row-1',
  revision: 2,
  ownerId: 'me',
  name: 'Mine',
  baseText: '{}',
  baseCanonical: '{}',
  draftId: 'draft-1',
  basedOn: null,
};
const sandbox: EditorTarget = {
  kind: 'sandbox',
  savedId: 'row-1',
  revision: 2,
  ownerId: 'me',
  name: 'Mine',
  baseText: '{}',
  basedOn: null,
};
const templateSandbox = { kind: 'sandbox', savedId: null, revision: null, ownerId: null, baseText: '{}' } as const;
const sully: EditorTarget = { ...templateSandbox, name: 'Sully', basedOn: templateBasedOn('sullys-qol', '0.9.2') };
const example: EditorTarget = { ...templateSandbox, name: 'Example', basedOn: templateBasedOn('example', '2.2.0') };
/** A template sandbox that records no template: Sully's, as before there were two. */
const unnamed: EditorTarget = { ...templateSandbox, name: 'Sully', basedOn: null };

describe('editorRouteOf / editorPathOf', () => {
  it('reads the route from the params, a template sandbox from its path', () => {
    expect(editorRouteOf({ draftId: 'd' }, '/loot-filters/draft/d')).toEqual({ kind: 'draft', id: 'd' });
    expect(editorRouteOf({ id: 'r' }, '/loot-filters/r')).toEqual({ kind: 'saved', id: 'r' });
    expect(editorRouteOf({}, '/loot-filters/sully')).toEqual({ kind: 'template', template: 'sullys-qol' });
    expect(editorRouteOf({}, '/loot-filters/example/')).toEqual({ kind: 'template', template: 'example' });
    expect(editorRouteOf({})).toEqual({ kind: 'template', template: 'sullys-qol' });
  });

  it('builds the path of a target', () => {
    expect(editorPathOf({ kind: 'draft', entryId: 'd' })).toBe('/loot-filters/draft/d');
    expect(editorPathOf(saved)).toBe('/loot-filters/row-1');
    expect(editorPathOf(sandbox)).toBe('/loot-filters/row-1');
    expect(editorPathOf(sully)).toBe('/loot-filters/sully');
    expect(editorPathOf(example)).toBe('/loot-filters/example');
    expect(editorPathOf(unnamed)).toBe('/loot-filters/sully');
  });
});

describe('targetMatchesRoute', () => {
  it('matches a draft by entry id', () => {
    expect(targetMatchesRoute({ kind: 'draft', entryId: 'd' }, { kind: 'draft', id: 'd' }, null)).toBe(true);
    expect(targetMatchesRoute({ kind: 'draft', entryId: 'd' }, { kind: 'draft', id: 'e' }, null)).toBe(false);
    expect(targetMatchesRoute(null, { kind: 'draft', id: 'd' }, null)).toBe(false);
  });

  it('matches a saved filter only with the kind that suits the viewer', () => {
    const route = { kind: 'saved', id: 'row-1' } as const;
    expect(targetMatchesRoute(saved, route, 'me')).toBe(true);
    expect(targetMatchesRoute(saved, route, null)).toBe(false);
    expect(targetMatchesRoute(sandbox, route, null)).toBe(true);
    expect(targetMatchesRoute(sandbox, route, 'someone')).toBe(true);
    // Signed in as the owner while the sandbox is open: reopen as the owner's filter.
    expect(targetMatchesRoute(sandbox, route, 'me')).toBe(false);
    expect(targetMatchesRoute(saved, { kind: 'saved', id: 'row-2' }, 'me')).toBe(false);
  });

  it("matches a template route only with that template's sandbox", () => {
    const sullyRoute = { kind: 'template', template: 'sullys-qol' } as const;
    const exampleRoute = { kind: 'template', template: 'example' } as const;
    expect(targetMatchesRoute(sully, sullyRoute, null)).toBe(true);
    expect(targetMatchesRoute(unnamed, sullyRoute, null)).toBe(true);
    expect(targetMatchesRoute(example, exampleRoute, null)).toBe(true);
    expect(targetMatchesRoute(sully, exampleRoute, null)).toBe(false);
    expect(targetMatchesRoute(example, sullyRoute, null)).toBe(false);
    expect(targetMatchesRoute(sandbox, sullyRoute, null)).toBe(false);
    expect(targetMatchesRoute({ kind: 'draft', entryId: 'd' }, exampleRoute, null)).toBe(false);
  });
});

describe('keepsOwnerSandbox', () => {
  const route = { kind: 'saved', id: 'row-1' } as const;

  it("keeps the owner's sandbox while it has edits", () => {
    expect(keepsOwnerSandbox(sandbox, true, route, 'me')).toBe(true);
  });

  it('switches without edits, for someone else, signed out, on another route or another target', () => {
    expect(keepsOwnerSandbox(sandbox, false, route, 'me')).toBe(false);
    expect(keepsOwnerSandbox(sandbox, true, route, 'someone')).toBe(false);
    expect(keepsOwnerSandbox(sandbox, true, route, null)).toBe(false);
    expect(keepsOwnerSandbox(sandbox, true, { kind: 'saved', id: 'row-2' }, 'me')).toBe(false);
    expect(keepsOwnerSandbox(saved, true, route, 'me')).toBe(false);
    expect(keepsOwnerSandbox(sully, true, { kind: 'template', template: 'sullys-qol' }, 'me')).toBe(false);
  });
});

describe('saveDialogDetailsOf', () => {
  it('starts a new draft public, a saved filter from its row, and leaves an unknown privacy unknown', () => {
    expect(saveDialogDetailsOf('Mine', true, null)).toEqual({ name: 'Mine', description: '', isPrivate: false });
    expect(saveDialogDetailsOf('Mine', false, { description: 'About', is_private: true })).toEqual({
      name: 'Mine',
      description: 'About',
      isPrivate: true,
    });
    expect(saveDialogDetailsOf('Mine', false, { description: null, is_private: false }).isPrivate).toBe(false);
    expect(saveDialogDetailsOf('Mine', false, null)).toEqual({ name: 'Mine', description: '', isPrivate: null });
  });
});

describe('authorLabelOf', () => {
  it('formats the tag', () => {
    expect(authorLabelOf({ display_name: 'Hero', discriminator: 4242, avatar_url: null })).toBe('Hero#4242');
    expect(authorLabelOf(null)).toBe('Unknown author');
  });
});

describe('sourceUpdateOf', () => {
  const basedOn = { id: 'src', revision: 2, label: 'X by Y#1' };

  it('is nothing without a source, before the lookup or when up to date', () => {
    expect(sourceUpdateOf(null, {}, {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(basedOn, {}, {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(basedOn, { src: { id: 'src', revision: 2, change_note: null, name: 'X' } }, {})).toEqual({ kind: 'none' });
  });

  it('reports a newer shared revision with its note, or a source that is gone', () => {
    expect(sourceUpdateOf(basedOn, { src: { id: 'src', revision: 3, change_note: 'More', name: 'X' } }, {})).toEqual({
      kind: 'shared',
      id: 'src',
      revision: 3,
      changeNote: 'More',
      name: 'X',
    });
    expect(sourceUpdateOf(basedOn, { src: null }, {})).toEqual({ kind: 'gone', id: 'src' });
  });

  it('reads a saved copy that lost its based_on_id (source deleted) as gone, like the library', () => {
    expect(sourceUpdateOf({ revision: 2, label: 'X by Y#1' }, {}, {})).toEqual({ kind: 'gone', id: null });
  });

  it('compares a template-based filter with the version of the template text in use', () => {
    const versions = { 'sullys-qol': '0.9.2', example: '2.2.0' };
    const sullyUpdate = { kind: 'template', template: 'sullys-qol', toVersion: '0.9.2' } as const;
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '0.9.2'), {}, versions)).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '0.5.0'), {}, versions)).toEqual({ ...sullyUpdate, fromVersion: '0.5.0' });
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '99.0.0'), {}, versions)).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', null), {}, versions)).toEqual({ ...sullyUpdate, fromVersion: null });
    // A live file with a lower version than the draft's (Sully went back): no update.
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '0.9.2'), {}, { 'sullys-qol': '0.9.1' })).toEqual({ kind: 'none' });
  });

  it('shows no template update while the template is not loaded or its version is unknown', () => {
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '0.5.0'), {}, {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', null), {}, { example: '2.2.0' })).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn('sullys-qol', '0.5.0'), {}, { 'sullys-qol': null })).toEqual({ kind: 'none' });
  });

  it('compares an example-based filter with the example, not with Sully', () => {
    const versions = { 'sullys-qol': '0.9.2', example: '2.2.0' };
    const exampleUpdate = { kind: 'template', template: 'example', toVersion: '2.2.0' } as const;
    expect(sourceUpdateOf(templateBasedOn('example', '2.2.0'), {}, versions)).toEqual({ kind: 'none' });
    // Older than the example (2.2.0), though newer than Sully's version; a draft from the old 1.0.0 file too.
    expect(sourceUpdateOf(templateBasedOn('example', '0.9.0'), {}, versions)).toEqual({ ...exampleUpdate, fromVersion: '0.9.0' });
    expect(sourceUpdateOf(templateBasedOn('example', '1.0.0'), {}, versions)).toEqual({ ...exampleUpdate, fromVersion: '1.0.0' });
    expect(sourceUpdateOf(templateBasedOn('example', '2.0.0'), {}, versions)).toEqual({ ...exampleUpdate, fromVersion: '2.0.0' });
    expect(sourceUpdateOf(templateBasedOn('example', '0.6.12'), {}, versions)).toEqual({ ...exampleUpdate, fromVersion: '0.6.12' });
    expect(sourceUpdateOf(templateBasedOn('example', null), {}, versions)).toEqual({ ...exampleUpdate, fromVersion: null });
    expect(sourceUpdateOf({ template: 'retired', version: '0.1', label: 'Old' }, {}, versions)).toEqual({ kind: 'none' });
  });
});

describe('isShowProblemsState', () => {
  it('accepts only the show-problems router state', () => {
    expect(isShowProblemsState(SHOW_PROBLEMS_STATE)).toBe(true);
    expect(isShowProblemsState(null)).toBe(false);
    expect(isShowProblemsState({ showProblems: 'yes' })).toBe(false);
    expect(isShowProblemsState(undefined)).toBe(false);
  });
});
