// The standard 7 Diablo 2 Resurrected classes (see FEATURE-BUILD-SHARING.md).
export const CHARACTER_CLASSES = ['Amazon', 'Necromancer', 'Barbarian', 'Sorceress', 'Paladin', 'Druid', 'Assassin'] as const;
export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

/** Builds fetched per page (cursor-based infinite scroll). */
export const BUILDS_PAGE_SIZE = 50;

// Validation limits (mirror the DB CHECK constraints in migration 001).
export const BUILD_NAME_MAX_LENGTH = 100;
export const BUILD_DESCRIPTION_MAX_LENGTH = 2000;
export const CHARM_MAX_LENGTH = 100;
export const SKILLS_MAX_LENGTH = 2000;
/** Max length of a per-item crafting/corruption note (stored inside build_data JSONB). */
export const ITEM_NOTE_MAX_LENGTH = 500;
