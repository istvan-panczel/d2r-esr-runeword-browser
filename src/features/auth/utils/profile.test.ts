import { describe, expect, it } from 'vitest';
import {
  avatarInitials,
  DISPLAY_NAME_MAX_LENGTH,
  formatProfileTag,
  MAX_DISCRIMINATOR,
  MIN_DISCRIMINATOR,
  profileTag,
  randomDiscriminator,
  validateDisplayName,
} from './profile';

describe('formatProfileTag / profileTag', () => {
  it('formats as Name#discriminator', () => {
    expect(formatProfileTag('RuneMaster', 4316)).toBe('RuneMaster#4316');
  });

  it('reads from a profile-shaped object', () => {
    expect(profileTag({ display_name: 'Hero', discriminator: 1000 })).toBe('Hero#1000');
  });
});

describe('avatarInitials', () => {
  it('uses the first letters of the first two words', () => {
    expect(avatarInitials('Rune Master')).toBe('RM');
  });

  it('uses the first two letters of a single word', () => {
    expect(avatarInitials('Hero')).toBe('HE');
  });

  it('falls back to ? for blank names', () => {
    expect(avatarInitials('   ')).toBe('?');
  });
});

describe('validateDisplayName', () => {
  it('accepts a normal name and trims surrounding whitespace', () => {
    const result = validateDisplayName('  Hero  ');
    expect(result.valid).toBe(true);
    expect(result.trimmed).toBe('Hero');
    expect(result.error).toBeNull();
  });

  it('rejects whitespace-only names', () => {
    const result = validateDisplayName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).not.toBeNull();
  });

  it('rejects names longer than the maximum', () => {
    const result = validateDisplayName('x'.repeat(DISPLAY_NAME_MAX_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.error).not.toBeNull();
  });
});

describe('randomDiscriminator', () => {
  it('always returns a 4-digit integer within the DB-constrained range', () => {
    for (let i = 0; i < 1000; i++) {
      const value = randomDiscriminator();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(MIN_DISCRIMINATOR);
      expect(value).toBeLessThanOrEqual(MAX_DISCRIMINATOR);
    }
  });
});
