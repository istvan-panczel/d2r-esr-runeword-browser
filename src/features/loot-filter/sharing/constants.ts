/** Rows per page of the Shared tab and the author filters on `/user/:userId`. */
export const SHARED_FILTERS_PAGE_SIZE = 50;

/** A user may keep this many filters (the `loot_filters_cap` trigger), so My filters is one query. */
export const MY_FILTERS_LIMIT = 50;

/** Filters in the home page "Latest loot filters" block. */
export const LATEST_FILTERS_COUNT = 3;

// The `loot_filters` check constraints (lengths in characters, as Postgres' char_length counts them).
export const FILTER_NAME_MAX_LENGTH = 100;
export const FILTER_DESCRIPTION_MAX_LENGTH = 2000;
export const CHANGE_NOTE_MAX_LENGTH = 200;
/** `octet_length(content) <= 524288`: the file's UTF-8 size. */
export const FILTER_CONTENT_MAX_BYTES = 512 * 1024;
