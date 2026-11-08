import { describe, expect, it } from 'vitest';
import { assessSaveAge } from './saveAge.ts';

const base = { lastSavedAt: 1_794_000_000, bundleVersion: '3.3.02', bundleDate: '2026-11-08T08:37:34+02:00' };

describe('assessSaveAge', () => {
  it('prefers the verified sidecar version', () => {
    expect(assessSaveAge({ ...base, sidecarVersion: '3.3.02' })).toMatchObject({ status: 'same-version', source: 'sidecar' });
    expect(assessSaveAge({ ...base, sidecarVersion: '3.2.24' })).toMatchObject({ status: 'different-version', savedVersion: '3.2.24' });
  });

  it('falls back to the release date without a sidecar', () => {
    expect(assessSaveAge({ ...base, sidecarVersion: null, lastSavedAt: Date.parse('2026-11-01T00:00:00Z') / 1000 }).status).toBe(
      'saved-before-release'
    );
    expect(assessSaveAge({ ...base, sidecarVersion: null, lastSavedAt: Date.parse('2026-11-08T12:00:00Z') / 1000 }).status).toBe(
      'saved-after-release'
    );
  });

  it('is unknown without a usable date', () => {
    expect(assessSaveAge({ ...base, sidecarVersion: null, bundleDate: null }).status).toBe('unknown');
    expect(assessSaveAge({ ...base, sidecarVersion: null, bundleDate: undefined }).status).toBe('unknown');
    expect(assessSaveAge({ ...base, sidecarVersion: null, bundleDate: 'not a date' }).status).toBe('unknown');
  });
});
