import { describe, it, expect } from 'vitest';
import { compareVersions, isVersionDifferent } from './versionUtils';

describe('compareVersions', () => {
  it('should treat identical versions as equal', () => {
    expect(compareVersions('3.11.09', '3.11.09')).toBe(0);
    expect(compareVersions('3.12', '3.12')).toBe(0);
  });

  it('should compare three-part versions numerically', () => {
    expect(compareVersions('3.11.08', '3.11.09')).toBe(-1);
    expect(compareVersions('3.11.09', '3.11.08')).toBe(1);
  });

  it('should compare minor versions numerically, not lexically', () => {
    // "3.9" < "3.12" numerically even though it sorts later as a string
    expect(compareVersions('3.9.09', '3.12')).toBe(-1);
    expect(compareVersions('3.12', '3.9.09')).toBe(1);
  });

  it('should treat a missing patch component as 0', () => {
    expect(compareVersions('3.12', '3.12.0')).toBe(0);
    expect(compareVersions('3.12', '3.12.01')).toBe(-1);
    expect(compareVersions('3.12.01', '3.12')).toBe(1);
  });

  it('should order the ESR release sequence correctly', () => {
    const releases = ['3.11', '3.11.01', '3.11.08', '3.11.09', '3.12'];
    for (let i = 1; i < releases.length; i++) {
      expect(compareVersions(releases[i - 1], releases[i]), `${releases[i - 1]} < ${releases[i]}`).toBe(-1);
    }
  });
});

describe('isVersionDifferent', () => {
  it('should be true when nothing is stored yet', () => {
    expect(isVersionDifferent(null, '3.12')).toBe(true);
  });

  it('should be false for the same version', () => {
    expect(isVersionDifferent('3.12', '3.12')).toBe(false);
  });

  it('should be true when the remote version changed', () => {
    expect(isVersionDifferent('3.11.09', '3.12')).toBe(true);
  });

  it('should be false when only the patch notation differs but the value is equal', () => {
    expect(isVersionDifferent('3.12.0', '3.12')).toBe(false);
  });
});
