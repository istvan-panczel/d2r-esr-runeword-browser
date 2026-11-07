import { describe, expect, it } from 'vitest';
import {
  SHARED_FILTER_DETAIL_SELECT,
  SHARED_FILTER_LIST_SELECT,
  nameSearchPattern,
  readLevels,
  sharedFilterCursorFilter,
  sortColumns,
  type SharedFilterCursor,
} from './sharingQuery';

const cursor: SharedFilterCursor = { likesCount: 5, downloadCount: 12, createdAt: '2026-11-02T10:00:00.000Z', id: 'abc' };

describe('sharedFilterCursorFilter', () => {
  it('pages the newest sort by (created_at, id)', () => {
    expect(sharedFilterCursorFilter('newest', cursor)).toBe(
      'created_at.lt.2026-11-02T10:00:00.000Z,and(created_at.eq.2026-11-02T10:00:00.000Z,id.lt.abc)'
    );
  });

  it('pages the most-liked sort by (likes_count, created_at, id)', () => {
    expect(sharedFilterCursorFilter('most_liked', cursor)).toBe(
      'likes_count.lt.5,' +
        'and(likes_count.eq.5,created_at.lt.2026-11-02T10:00:00.000Z),' +
        'and(likes_count.eq.5,created_at.eq.2026-11-02T10:00:00.000Z,id.lt.abc)'
    );
  });

  it('pages the most-downloaded sort by (download_count, created_at, id)', () => {
    expect(sharedFilterCursorFilter('most_downloaded', cursor)).toBe(
      'download_count.lt.12,' +
        'and(download_count.eq.12,created_at.lt.2026-11-02T10:00:00.000Z),' +
        'and(download_count.eq.12,created_at.eq.2026-11-02T10:00:00.000Z,id.lt.abc)'
    );
  });
});

describe('sortColumns', () => {
  it('orders by the same columns the cursor compares', () => {
    expect(sortColumns('newest')).toEqual(['created_at', 'id']);
    expect(sortColumns('most_liked')).toEqual(['likes_count', 'created_at', 'id']);
    expect(sortColumns('most_downloaded')).toEqual(['download_count', 'created_at', 'id']);
  });
});

describe('selects', () => {
  it('never fetches content for lists, always for the detail, and embeds the author by its FK', () => {
    expect(SHARED_FILTER_LIST_SELECT).not.toContain('content');
    expect(SHARED_FILTER_LIST_SELECT).not.toContain('*');
    expect(SHARED_FILTER_DETAIL_SELECT).toContain('content');
    expect(SHARED_FILTER_LIST_SELECT).toContain('profiles!loot_filters_user_id_fkey(display_name, discriminator, avatar_url)');
    expect(SHARED_FILTER_DETAIL_SELECT).toContain('profiles!loot_filters_user_id_fkey(');
  });
});

describe('nameSearchPattern', () => {
  it('wraps the trimmed text for a substring ilike, or gives null when empty', () => {
    expect(nameSearchPattern('  hc mf ')).toBe('%hc mf%');
    expect(nameSearchPattern('   ')).toBeNull();
  });
});

describe('readLevels', () => {
  it('keeps well-formed levels', () => {
    expect(readLevels([{ id: 1, name: 'Leveling' }])).toEqual([{ id: 1, name: 'Leveling' }]);
  });

  it('drops malformed entries and turns a list left empty or a non-list into null', () => {
    expect(readLevels([{ id: '1', name: 'x' }, 'x', null, { id: 2, name: 'Maps' }])).toEqual([{ id: 2, name: 'Maps' }]);
    expect(readLevels([{ id: 'x' }])).toBeNull();
    expect(readLevels({ id: 1 })).toBeNull();
    expect(readLevels(null)).toBeNull();
  });

  it('keeps per-language names, dropping entries that are not strings of a known language', () => {
    expect(readLevels([{ id: 1, name: { enUS: 'Strict', deDE: 'Streng', xxXX: 'x', frFR: 3 } }])).toEqual([
      { id: 1, name: { enUS: 'Strict', deDE: 'Streng' } },
    ]);
    expect(
      readLevels([
        { id: 1, name: { xxXX: 'x' } },
        { id: 2, name: [] },
      ])
    ).toBeNull();
  });
});
