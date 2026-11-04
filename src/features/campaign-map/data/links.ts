/**
 * Edges the tables cannot give (levels.txt Vis lists warps only): outdoor borders, quest and red portals, cube portals,
 * act travel, plus restyles of a Vis passage (one-way). Endgame map portals are NOT listed: they come from areas.json
 * `mapItem` (cubemain `Red Portal,lvl=`).
 *
 * Sources: 'vanilla' = unchanged Diablo II behaviour, 'official' = the official ESR Maps page, 'tables' = read from the
 * txt files. `verify` = not confirmed in game yet (shown as "unconfirmed"). `oneWay` only where there is really no way back
 * (the Horadric Orifice, act travel, Flayer Jungle → Sewers Level 1); red, quest and cube portals have a portal back.
 */
import type { CuratedLink } from './types';

export const CURATED_LINKS: readonly CuratedLink[] = [
  // --- Act I ---------------------------------------------------------------------------------------------------------
  { from: 1, to: 2, kind: 'border', source: 'owner' },
  { from: 2, to: 3, kind: 'border', source: 'owner' },
  { from: 3, to: 4, kind: 'border', source: 'owner' },
  { from: 3, to: 17, kind: 'border', source: 'owner' },
  { from: 5, to: 6, kind: 'border', source: 'owner' },
  { from: 6, to: 7, kind: 'border', source: 'owner' },
  { from: 7, to: 26, kind: 'border', source: 'owner' },
  { from: 4, to: 38, kind: 'portal', via: 'Cairn Stones', source: 'owner' },
  { from: 1, to: 39, kind: 'cube', via: 'Cow Portal', source: 'tables' },
  { from: 37, to: 40, kind: 'act', oneWay: true, via: 'Warriv, after Andariel', source: 'owner' },

  // --- Act II --------------------------------------------------------------------------------------------------------
  { from: 40, to: 41, kind: 'border', source: 'owner' },
  { from: 41, to: 42, kind: 'border', source: 'owner' },
  { from: 42, to: 43, kind: 'border', source: 'owner' },
  { from: 43, to: 44, kind: 'border', source: 'owner' },
  { from: 44, to: 45, kind: 'border', source: 'owner' },
  { from: 54, to: 74, kind: 'portal', via: 'Arcane portal', source: 'owner' },
  { from: 74, to: 46, kind: 'portal', via: "Summoner's portal", source: 'owner' },
  { from: 66, to: 73, kind: 'portal', oneWay: true, via: 'Horadric Orifice (true tomb)', source: 'owner' },
  { from: 73, to: 75, kind: 'act', oneWay: true, via: 'Meshif, after Duriel', source: 'owner' },

  // --- Act III -------------------------------------------------------------------------------------------------------
  { from: 75, to: 76, kind: 'border', source: 'owner' },
  { from: 76, to: 77, kind: 'border', source: 'owner' },
  { from: 77, to: 78, kind: 'border', source: 'owner' },
  { from: 78, to: 79, kind: 'border', source: 'owner' },
  { from: 79, to: 80, kind: 'border', source: 'owner' },
  { from: 80, to: 81, kind: 'border', source: 'official' },
  { from: 81, to: 82, kind: 'border', source: 'owner' },
  { from: 82, to: 83, kind: 'border', source: 'owner' },
  // Restyles the Vis passage: "You can't come back from The Sewer Level 1"
  { from: 78, to: 92, kind: 'passage', oneWay: true, via: 'one way', source: 'official', verify: true },
  { from: 102, to: 103, kind: 'act', oneWay: true, via: 'Red portal, after Mephisto', source: 'owner' },

  // --- Act IV --------------------------------------------------------------------------------------------------------
  { from: 103, to: 104, kind: 'border', source: 'owner' },
  { from: 104, to: 105, kind: 'border', source: 'owner' },
  { from: 105, to: 106, kind: 'border', source: 'owner' },
  { from: 108, to: 109, kind: 'act', oneWay: true, via: "Tyrael's portal, after Diablo", source: 'owner' },

  // --- Act V ---------------------------------------------------------------------------------------------------------
  { from: 109, to: 110, kind: 'border', source: 'owner' },
  { from: 110, to: 111, kind: 'border', source: 'owner' },
  { from: 111, to: 112, kind: 'border', source: 'owner' },
  // Two-way, and it stays open after you take the Dimensional Gate waypoint (owner; the official page says it disappears)
  { from: 109, to: 121, kind: 'portal', via: 'Red portal, after Anya', source: 'owner' },
  // Two-way red portals (owner)
  { from: 111, to: 125, kind: 'portal', via: 'Red portal', source: 'owner' },
  { from: 112, to: 126, kind: 'portal', via: 'Red portal', source: 'owner' },
  { from: 117, to: 127, kind: 'portal', via: 'Red portal', source: 'owner' },
  // The game files link GFraizer's Dome to Naraku Level 1 only; the owner confirmed the Naraku Level 2 entrance
  { from: 214, to: 119, kind: 'passage', source: 'owner', missingFromTables: true },

  // --- Uber levels (cubemain recipes; which portal opens where is engine behaviour) -----------------------------------
  { from: 109, to: 133, kind: 'cube', via: 'Pandemonium Portal', source: 'owner' },
  { from: 109, to: 134, kind: 'cube', via: 'Pandemonium Portal', source: 'owner' },
  { from: 109, to: 135, kind: 'cube', via: 'Pandemonium Portal', source: 'owner' },
  { from: 109, to: 136, kind: 'cube', via: 'Pandemonium Finale Portal', source: 'owner' },
];
