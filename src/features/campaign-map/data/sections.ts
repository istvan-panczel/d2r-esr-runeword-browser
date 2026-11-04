/**
 * The page's tabs, in order, with their section notes: the official Maps page's per-act remarks and its removed levels
 * (those levels are gone from areas.json, so they only live here).
 */
import type { SectionDef } from './types';

export const SECTION_DEFS: readonly SectionDef[] = [
  {
    key: 'act1',
    title: 'Act I',
    notes: [
      {
        text: 'Removed: Jail Level 2. Jail Level 1 leads straight to the old Level 3, which the game now calls Level 2',
        source: 'official',
      },
      {
        text: 'Removed: Catacombs Level 3. Level 2 leads straight to the old Level 4 (Andariel), which the game now calls Level 3',
        source: 'official',
      },
    ],
  },
  {
    key: 'act2',
    title: 'Act II',
    notes: [
      { text: 'Removed: the old Sewers Level 1 and Palace Level 1', source: 'official' },
      { text: 'You can get the Viper Amulet without visiting Lost Farm (formerly Lost City)', source: 'official' },
      {
        text: 'Every new character starts with the Horadric Cube, and the Horadric Scroll is not needed: Radament does not drop it',
        source: 'owner',
      },
    ],
  },
  {
    key: 'act3',
    title: 'Act III',
    notes: [
      {
        text: 'The tunnel from the Flayer Jungle into Sewers Level 1 is one way; the entrances from Kurast work both ways',
        source: 'official',
        warning: true,
        verify: true,
      },
      { text: 'You can visit Bookstore Sarina (formerly Ruined Temple) for the book after you beat Baal', source: 'official' },
    ],
  },
  {
    key: 'act4',
    title: 'Act IV',
    notes: [],
  },
  {
    key: 'act5',
    title: 'Act V',
    notes: [
      {
        text: 'Frozen River is a dead end: after you rescue Anya, a red portal in Harrogath leads to the Dimensional Gate',
        source: 'tables',
      },
      {
        text: 'The red portal to the Dimensional Gate works both ways and stays open after you take its waypoint (the official page says it disappears)',
        source: 'owner',
      },
      { text: 'Removed: Worldstone Keep Level 3. Level 2 leads straight to the Throne of Destruction', source: 'official' },
      {
        text: "CAUTION: Naraku and below are extremely difficult areas for super rich experts. You don't need to kill Nihlathak to clear a difficulty",
        source: 'official',
        warning: true,
      },
    ],
  },
  {
    key: 'special',
    title: 'Special areas',
    notes: [
      {
        text: 'Special areas like the Secret Cow Level grant the best experience and drops. Go there after you beat the difficulty, or earlier with a strong character',
        source: 'official',
      },
      {
        text: 'Naraku and below are extremely difficult areas for super rich experts. Only uber players can stay alive there',
        source: 'official',
        warning: true,
      },
    ],
  },
  {
    key: 'portals',
    title: 'Ubers & portals',
    notes: [
      { text: 'Cow Portal: cube a Club and a Tome of Town Portal in the Rogue Encampment', source: 'tables' },
      {
        text: 'Pandemonium Portal: cube a Key of Terror, a Key of Hate and a Key of Destruction in Harrogath; it opens to Matron’s Den, Forgotten Sands or Furnace of Pain at random',
        source: 'tables',
      },
      { text: "Pandemonium Finale Portal: cube Diablo's Horn, Baal's Eye and Mephisto's Brain in Harrogath", source: 'tables' },
      { text: 'Endgame maps: transmute a map item by itself in Act V, Hell: a red portal opens to the map', source: 'official' },
    ],
  },
  {
    key: 'maps',
    title: 'Endgame Maps',
    notes: [
      { text: 'Transmute a map item by itself in Act V, Hell: a red portal opens to the first level of its map', source: 'official' },
    ],
  },
];
