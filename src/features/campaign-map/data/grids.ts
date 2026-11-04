/**
 * The hand-placed act maps (format: `ActGrid` in ./types.ts). Placement follows ESR's connections, arranged loosely
 * like the game world; it is not the vanilla world map (ESR rewired Acts II, III and V).
 *
 * Reading aids: `npx vitest run src/features/campaign-map` fails with the exact problem (unknown id, a station placed
 * twice, an edge running over a station, an area of the act missing from its grid).
 */
import type { ActGrid } from './types';

export const ACT_GRIDS: readonly ActGrid[] = [
  {
    // Main line: Rogue Encampment → Black Marsh along row 2 (Stony Field → Dark Wood runs through the Underground
    // Passage), down to Tamoe Highland, then back right to left through the Monastery.
    key: 'act1',
    act: 0,
    grid: `
      .     18       .     19    .       .     .
      39    .        17    .     38      .     .
      1     2        3     4     5       6     11+15
      .     8        9+13  .     10+14   .     20
      .     .        .     .     .       .     21..25
      .     .        .     .     .       .     .
      32    29+31    28    27    26      7     12+16
      33    34+35+37 .     .     .       .     .
      .     .        @40   .     .       .     .
    `,
    regions: [{ label: 'Monastery', from: [-0.45, 5.5], to: [4.45, 7.85] }],
    routes: { '4-10': 'diagonal-first', '4-38': 'diagonal-first', '6-20': 'diagonal-first', '37-40': 'diagonal-first' },
  },
  {
    // Lut Gholein on the left: palace and the Summoner's line above, the desert to the right, the rewired sewers and
    // Underground Maze below. Tal Rasha's seven tombs are folded into one station.
    key: 'act2',
    act: 1,
    grid: `
      .     52..54   74    46    66      73    @75
      50    .        55+59 .     .       .     .
      .     48+49    .     .     .       .     .
      40    41       42    43    44      45    .
      .     .        56+60 62    65      58    .
      .     .        .     .     .       .     .
      .     .        .     51    47      57    61
      .     64       63    .     .       .     .
    `,
    routes: {
      '50-52': 'diagonal-first',
      '40-48': 'diagonal-first',
      '41-55': 'diagonal-first',
      '40-51': 'diagonal-first',
      '51-63': 'diagonal-first',
    },
  },
  {
    // The jungle along the top, Kurast as a column (Bazaar, Upper Kurast, Causeway, Travincal, Durance) with its
    // temples on both sides, Sewers Level 1 as the hub between Flayer Jungle, Bazaar and Upper Kurast.
    key: 'act3',
    act: 2,
    grid: `
      75    76       77    78    79      90    .
      .     85       88    .     80      86+94 .
      .     .        98    92    .       95    .
      .     .        93    .     81      96    .
      .     .        .     97    .       89+91 .
      .     .        .     99    82      87+84 .
      .     .        .     .     83      .     .
      .     .        .     @103  100..102 .    .
    `,
    regions: [{ label: 'Kurast', from: [2.55, 0.45], to: [5.6, 7.85] }],
    routes: {
      '76-88': 'diagonal-first',
      '88-78': 'straight-first',
      '92-80': 'diagonal-first',
      '92-81': 'diagonal-first',
      '92-93': 'diagonal-first',
      '80-90': 'diagonal-first',
      '80-95': 'diagonal-first',
      '81-89': 'diagonal-first',
      '81-97': 'diagonal-first',
    },
  },
  {
    key: 'act4',
    act: 3,
    grid: `
      103   104      105   106   107     108   @109
    `,
  },
  {
    // Harrogath at the bottom left, the Summit and Worldstone Keep along the top, Naraku as a shaft going down on the
    // right. The way on from Arreat Plateau is Anya's red portal to the Dimensional Gate (Frozen River is a dead end).
    key: 'act5',
    act: 4,
    grid: `
      137   .        120   128   129     131   132
      127   117      118   .     .       .     .
      .     .        .     .     .       115   119
      .     121      .     .     .       214   116
      .     .        .     .     .       130   138
      109   110      111   112   114     122   .
      .     .        125   126   .       113   .
      .     .        .     .     .       123+124 .
    `,
    regions: [
      { label: 'Worldstone Keep', from: [2.55, -0.4], to: [6.45, 0.55] },
      { label: 'Naraku depths', from: [4.55, 1.55], to: [6.45, 7.85] },
    ],
    routes: { '118-115': 'straight-first', '109-121': 'straight-first' },
  },
];
