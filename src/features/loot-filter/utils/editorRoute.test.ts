import { describe, expect, it } from 'vitest';
import type { EditorTarget } from '../store/types';
import { templateBasedOn } from './basedOn';
import { authorLabelOf, editorPathOf, editorRouteOf, sourceUpdateOf, targetMatchesRoute } from './editorRoute';
import { TEMPLATE_VERSION } from './template';

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
const sully: EditorTarget = { kind: 'sandbox', savedId: null, revision: null, ownerId: null, name: 'Sully', baseText: '{}', basedOn: null };

describe('editorRouteOf / editorPathOf', () => {
  it('reads the route from the params', () => {
    expect(editorRouteOf({ draftId: 'd' })).toEqual({ kind: 'draft', id: 'd' });
    expect(editorRouteOf({ id: 'r' })).toEqual({ kind: 'saved', id: 'r' });
    expect(editorRouteOf({})).toEqual({ kind: 'sully' });
  });

  it('builds the path of a target', () => {
    expect(editorPathOf({ kind: 'draft', entryId: 'd' })).toBe('/loot-filters/draft/d');
    expect(editorPathOf(saved)).toBe('/loot-filters/row-1');
    expect(editorPathOf(sully)).toBe('/loot-filters/sully');
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

  it('matches Sully only with the template sandbox', () => {
    expect(targetMatchesRoute(sully, { kind: 'sully' }, null)).toBe(true);
    expect(targetMatchesRoute(sandbox, { kind: 'sully' }, null)).toBe(false);
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
    expect(sourceUpdateOf(null, {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(basedOn, {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(basedOn, { src: { id: 'src', revision: 2, change_note: null, name: 'X' } })).toEqual({ kind: 'none' });
  });

  it('reports a newer shared revision with its note, or a source that is gone', () => {
    expect(sourceUpdateOf(basedOn, { src: { id: 'src', revision: 3, change_note: 'More', name: 'X' } })).toEqual({
      kind: 'shared',
      id: 'src',
      revision: 3,
      changeNote: 'More',
      name: 'X',
    });
    expect(sourceUpdateOf(basedOn, { src: null })).toEqual({ kind: 'gone', id: 'src' });
  });

  it('compares a template-based filter with the bundled version', () => {
    expect(sourceUpdateOf(templateBasedOn(TEMPLATE_VERSION), {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn('0.5.0'), {})).toEqual({ kind: 'template', fromVersion: '0.5.0' });
    expect(sourceUpdateOf(templateBasedOn('99.0.0'), {})).toEqual({ kind: 'none' });
    expect(sourceUpdateOf(templateBasedOn(null), {})).toEqual({ kind: 'template', fromVersion: null });
  });
});
