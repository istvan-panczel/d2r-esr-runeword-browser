import { describe, expect, it } from 'vitest';
import { decideUrlRead } from './urlArrival';

const params = (search: string) => new URLSearchParams(search);
const hasName = (value: URLSearchParams) => value.has('name');

describe('decideUrlRead', () => {
  it('reads on the first mount, with or without params', () => {
    expect(decideUrlRead(null, params(''), hasName)).toBe('first-mount');
    expect(decideUrlRead(null, params('name=Enigma'), hasName)).toBe('first-mount');
  });

  it('reads a later URL carrying recognised params as an arrival', () => {
    expect(decideUrlRead(params(''), params('name=Enigma'), hasName)).toBe('arrival');
  });

  it('skips a URL with nothing recognised: the cleanup, and links without params', () => {
    expect(decideUrlRead(params('name=Enigma'), params(''), hasName)).toBe('skip');
    expect(decideUrlRead(params('name=Enigma'), params('other=1'), hasName)).toBe('skip');
  });

  it('skips the same params object again (StrictMode, a repeated effect)', () => {
    const current = params('name=Enigma');
    expect(decideUrlRead(current, current, hasName)).toBe('skip');
  });

  it('reads a repeat of the same link once the cleanup has run in between', () => {
    let handled: URLSearchParams | null = null;
    const reads: string[] = [];
    for (const search of ['', 'name=Enigma', '', 'name=Enigma', '']) {
      const current = params(search);
      reads.push(decideUrlRead(handled, current, hasName));
      handled = current;
    }
    expect(reads).toEqual(['first-mount', 'arrival', 'skip', 'arrival', 'skip']);
  });
});
