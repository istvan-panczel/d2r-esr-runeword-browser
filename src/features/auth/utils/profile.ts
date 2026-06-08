import type { Profile } from '@/core/supabase';

export const DISPLAY_NAME_MAX_LENGTH = 50;

// Discriminator range and retry budget mirror the DB constraint
// (profiles_discriminator_range: 1000-9999) and the feature spec's "retry on
// collision, max 10 attempts" rule for display-name changes.
export const MIN_DISCRIMINATOR = 1000;
export const MAX_DISCRIMINATOR = 9999;
export const MAX_DISCRIMINATOR_ATTEMPTS = 10;

/** A random 4-digit discriminator in [1000, 9999], matching the DB default. */
export function randomDiscriminator(): number {
  const span = MAX_DISCRIMINATOR - MIN_DISCRIMINATOR + 1;
  return MIN_DISCRIMINATOR + Math.floor(Math.random() * span);
}

/** Public "Name#1234" tag shown everywhere. Emails are never exposed publicly. */
export function formatProfileTag(displayName: string, discriminator: number): string {
  return `${displayName}#${String(discriminator)}`;
}

export function profileTag(profile: Pick<Profile, 'display_name' | 'discriminator'>): string {
  return formatProfileTag(profile.display_name, profile.discriminator);
}

/** 1-2 character fallback shown in the avatar when no image is available. */
export function avatarInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return '?';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export interface DisplayNameValidation {
  readonly valid: boolean;
  readonly trimmed: string;
  readonly error: string | null;
}

/** Validates a display name per the feature spec: trimmed, 1-50 chars, not blank. */
export function validateDisplayName(name: string): DisplayNameValidation {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, trimmed, error: 'Display name cannot be empty.' };
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return { valid: false, trimmed, error: `Display name must be ${String(DISPLAY_NAME_MAX_LENGTH)} characters or fewer.` };
  }
  return { valid: true, trimmed, error: null };
}
