/**
 * URL param keys owned by the game-data pages. Shared keys (`search`, `sockets`, `maxlvl`) come from
 * `FILTER_URL_PARAM_KEYS` in `@/core/utils/filterUrlParams`. Keys are per page, so `cls`, `type` and `sort` mean
 * the same kind of filter on Bases and Affixes.
 */
export const GAME_DATA_URL_PARAM_KEYS = {
  KIND: 'kind',
  TIER: 'tier',
  CLS: 'cls',
  TYPE: 'type',
  SORT: 'sort',
  // Bases
  VIEW: 'view',
  CODES: 'codes',
  // Best base
  RW: 'rw',
  VARIANT: 'v',
  LVL: 'lvl',
  STR: 'str',
  DEX: 'dex',
  // Affixes
  BASE: 'base',
  ILVL: 'ilvl',
  AFF: 'aff',
  RARE: 'rare',
  MINLVL: 'minlvl',
  QUALITY: 'q',
  AUTO: 'auto',
  // Affixes, superior view (VIEW above is reused: `view=superior`)
  SUPERIOR_TYPE: 'stype',
  // Enhance (TIER above is reused for the Vessel tier)
  TAB: 'tab',
  SLOT: 'slot',
  // Cube recipes (QUALITY above is reused for the output qualities)
  FAMILY: 'family',
  IN: 'in',
  OUT: 'out',
  // Materials
  GROUP: 'group',
  // Sets (CLS above is reused for the set's class)
  PIECES: 'pieces',
} as const;
