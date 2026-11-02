import { describe, expect, it } from 'vitest';
import { descendingKeysetFilter, isUuid } from './query';

describe('descendingKeysetFilter', () => {
  it('compares a single column with lt', () => {
    expect(descendingKeysetFilter([{ column: 'id', value: 'abc' }])).toBe('id.lt.abc');
  });

  it('adds one and() branch per further column, pinning the earlier ones with eq', () => {
    expect(
      descendingKeysetFilter([
        { column: 'download_count', value: 7 },
        { column: 'created_at', value: '2026-11-02T10:00:00.000Z' },
        { column: 'id', value: 'abc' },
      ])
    ).toBe(
      'download_count.lt.7,' +
        'and(download_count.eq.7,created_at.lt.2026-11-02T10:00:00.000Z),' +
        'and(download_count.eq.7,created_at.eq.2026-11-02T10:00:00.000Z,id.lt.abc)'
    );
  });

  it('returns an empty filter for no columns', () => {
    expect(descendingKeysetFilter([])).toBe('');
  });
});

describe('isUuid', () => {
  it('accepts a uuid in either case', () => {
    expect(isUuid('dccfffc5-feca-40d2-b2c7-96c6a97decc3')).toBe(true);
    expect(isUuid('DCCFFFC5-FECA-40D2-B2C7-96C6A97DECC3')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isUuid('sully')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
