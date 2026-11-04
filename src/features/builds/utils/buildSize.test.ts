import { describe, expect, it } from 'vitest';
import { BUILD_DATA_MAX_BYTES } from '../constants';
import { buildDataBytes, buildDataTooLargeMessage } from './buildSize';

describe('buildDataBytes', () => {
  it('counts the UTF-8 bytes of the JSON', () => {
    expect(buildDataBytes({})).toBe(2);
    expect(buildDataBytes({ skills: 'abc' })).toBe(JSON.stringify({ skills: 'abc' }).length);
    // "é" is 2 bytes, "⚔" 3 bytes in UTF-8.
    expect(buildDataBytes({ skills: 'é⚔' })).toBe(JSON.stringify({ skills: '' }).length + 5);
  });

  it('ignores undefined keys like JSON.stringify', () => {
    expect(buildDataBytes({ skills: undefined, variants: undefined })).toBe(2);
  });
});

describe('buildDataTooLargeMessage', () => {
  // {"skills":""} is 13 bytes.
  const ofBytes = (bytes: number) => ({ skills: 'x'.repeat(bytes - 13) });

  it('accepts a build up to the cap', () => {
    expect(buildDataTooLargeMessage({})).toBeNull();
    expect(buildDataBytes(ofBytes(BUILD_DATA_MAX_BYTES))).toBe(BUILD_DATA_MAX_BYTES);
    expect(buildDataTooLargeMessage(ofBytes(BUILD_DATA_MAX_BYTES))).toBeNull();
  });

  it('rejects a build over the cap with its size in KB', () => {
    expect(buildDataTooLargeMessage(ofBytes(BUILD_DATA_MAX_BYTES + 1))).toBe(
      'This build is too large to save (1025 KB, limit 1024 KB). Remove some alternatives or variants.'
    );
  });
});
