// The 8 Diablo 2 Resurrected classes playable in ESR (see FEATURE-BUILD-SHARING.md).
export const CHARACTER_CLASSES = ['Amazon', 'Necromancer', 'Barbarian', 'Sorceress', 'Paladin', 'Druid', 'Assassin', 'Warlock'] as const;
export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

/** Builds fetched per page (cursor-based infinite scroll). */
export const BUILDS_PAGE_SIZE = 50;

/** Newest builds shown in the home page's "Latest builds" strip. */
export const RECENT_BUILDS_COUNT = 3;

// Validation limits (mirror the DB CHECK constraints in migration 001).
export const BUILD_NAME_MAX_LENGTH = 100;
export const BUILD_DESCRIPTION_MAX_LENGTH = 2000;
export const CHARM_MAX_LENGTH = 100;
export const SKILLS_MAX_LENGTH = 2000;
/** Max length of a per-item crafting/corruption note (stored inside build_data JSONB). */
export const ITEM_NOTE_MAX_LENGTH = 500;

/** Highest character level (ESR's cap; skills.json also carries it as `maxLevel`, experience.txt MaxLvl). */
export const LEVEL_MAX = 110;
/** Most points stored on one skill in `build_data.skillPoints` (validator cap; the game's own cap is the skill's maxLevel). */
export const SKILL_POINTS_MAX = 99;
/** Most entries kept in `build_data.skillPoints` (a class tree has 35 skills; leaves room for another class's leftovers). */
export const SKILL_POINTS_MAX_ENTRIES = 60;
/** Longest skill id accepted as a `skillPoints` key. */
export const SKILL_ID_MAX_LENGTH = 100;

/** Most variants per build (the top level of build_data is the first; `variants` holds the rest). */
export const VARIANTS_MAX = 10;
/** Most alternative items stored per slot, besides the main item. */
export const ALTERNATIVES_MAX_PER_SLOT = 10;
export const VARIANT_NAME_MAX_LENGTH = 50;
export const VARIANT_NOTE_MAX_LENGTH = 500;
/** Label of a variant without a stored name at index 0 (later ones are "Variant N"). */
export const DEFAULT_VARIANT_NAME = 'Default';
/** App-side cap on the UTF-8 bytes of JSON.stringify(build_data); migration 006 backs it with a looser DB CHECK. */
export const BUILD_DATA_MAX_BYTES = 1_048_576;
