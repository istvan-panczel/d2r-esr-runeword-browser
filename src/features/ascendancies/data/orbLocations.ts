/**
 * Where the five elemental orbs drop. Hand-maintained: the official ascendancies.htm only hints "Act 1, 2, 3 each have
 * a superunique, Act 5 has 2". The superuniques come from the game files (superuniques.txt TC(H) → treasureclassex.txt
 * → misc.txt u11–u15, names from monsters.json; sources.json says the same, see orbLocations.test.ts), the areas and
 * spots were checked in game by the owner (also in content/guide/notes/ascendancies.md). Re-check after an ESR release.
 */

export interface OrbLocation {
  /** Display name (the string table's, not misc.txt's: "Orb of Storms", not "Orb of Storm") */
  readonly orb: string;
  readonly act: number;
  /** The area as players know it */
  readonly area: string;
  /** levels.txt Id of the area, for the campaign map link */
  readonly areaId: number;
  /** Where in the area */
  readonly where: string;
  /** The superunique that drops the orb (Hell only) */
  readonly superunique: string;
}

export const ORB_LOCATIONS: readonly OrbLocation[] = [
  { orb: 'Orb of Storms', act: 1, area: 'The Hole Level 2', areaId: 15, where: 'Below the Black Marsh', superunique: "Rathma's Acolyte" },
  {
    orb: 'Orb of Earth',
    act: 2,
    area: 'Halls of the Dead Level 2',
    areaId: 60,
    where: 'Below the Dry Hills',
    superunique: "Horazon's Disciple",
  },
  { orb: 'Orb of Water', act: 3, area: 'Travincal', areaId: 83, where: 'South-east of the Council', superunique: "Uldyssian's Hound" },
  {
    orb: 'Orb of Wind',
    act: 5,
    area: 'Arreat Plateau',
    areaId: 112,
    where: 'West of the Crystalline Passage entrance',
    superunique: "Malthael's Imp",
  },
  {
    orb: 'Orb of Fire',
    act: 5,
    area: 'The Worldstone Chamber',
    areaId: 132,
    where: 'North-west corner',
    superunique: "Inarius' Stalker",
  },
];

/** What the five orbs cube into (cubemain "Orb of Creation: 5 Orb of Elements") */
export const ORB_OF_CREATION = 'Orb of Creation';

/** The Cube page family with the Orb of Creation, unlock and tier recipes */
export const ASCENDANCY_CUBE_FAMILY = 'ascendancy';
