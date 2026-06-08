import { describe, expect, it } from 'vitest';
import { buildCursorOrFilter, isUuid, type BuildListCursor } from './buildsQuery';

const cursor: BuildListCursor = { likesCount: 5, createdAt: '2026-06-08T10:00:00.000Z', id: 'abc' };

describe('buildCursorOrFilter', () => {
  it('builds a (created_at, id) keyset filter for the newest sort', () => {
    expect(buildCursorOrFilter('newest', cursor)).toBe(
      'created_at.lt.2026-06-08T10:00:00.000Z,and(created_at.eq.2026-06-08T10:00:00.000Z,id.lt.abc)'
    );
  });

  it('builds a (likes_count, created_at, id) keyset filter for the most-liked sort', () => {
    expect(buildCursorOrFilter('most_liked', cursor)).toBe(
      'likes_count.lt.5,' +
        'and(likes_count.eq.5,created_at.lt.2026-06-08T10:00:00.000Z),' +
        'and(likes_count.eq.5,created_at.eq.2026-06-08T10:00:00.000Z,id.lt.abc)'
    );
  });
});

describe('isUuid', () => {
  it('accepts a valid uuid', () => {
    expect(isUuid('dccfffc5-feca-40d2-b2c7-96c6a97decc3')).toBe(true);
  });

  it('rejects non-uuids', () => {
    expect(isUuid('does-not-exist')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('123')).toBe(false);
  });
});
