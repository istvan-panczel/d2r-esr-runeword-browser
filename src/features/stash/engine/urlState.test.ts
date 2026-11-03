import { describe, expect, it } from 'vitest';
import { readEnum, readFlag, readPage, readSortDir, readText, setParam, setSort } from './urlState';

describe('stash URL state helpers', () => {
  const params = new URLSearchParams('kind=rare&bad=zzz&page=12&big=1001&flag=1&dir=desc&text=&q=x');

  it('reads values and falls back on invalid ones', () => {
    expect(readEnum(params, 'kind', ['rare', 'magic'] as const, 'magic')).toBe('rare');
    expect(readEnum(params, 'bad', ['rare', 'magic'] as const, 'magic')).toBe('magic');
    expect(readPage(params, 'page')).toBe(12);
    expect(readPage(params, 'big')).toBeNull();
    expect(readFlag(params, 'flag')).toBe(true);
    expect(readFlag(params, 'none')).toBe(false);
    expect(readSortDir(params, 'dir')).toBe('desc');
    expect(readSortDir(params, 'none')).toBe('asc');
    expect(readText(params, 'text')).toBeNull();
    expect(readText(params, 'q')).toBe('x');
  });

  it('writes only what differs from the defaults', () => {
    const out = new URLSearchParams();
    setParam(out, 'a', null);
    setParam(out, 'b', false);
    setParam(out, 'c', '');
    setParam(out, 'd', true);
    setParam(out, 'e', 3);
    setSort(out, { sort: 'sort', dir: 'dir' }, { sort: 'name', dir: 'asc' }, { sort: 'name', dir: 'asc' });
    expect(out.toString()).toBe('d=1&e=3');
    setSort(out, { sort: 'sort', dir: 'dir' }, { sort: 'name', dir: 'desc' }, { sort: 'name', dir: 'asc' });
    expect(out.toString()).toBe('d=1&e=3&sort=name&dir=desc');
  });
});
