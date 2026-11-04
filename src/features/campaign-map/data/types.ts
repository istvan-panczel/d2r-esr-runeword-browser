/**
 * Shapes of the hand-written campaign map data (this folder). The engine (`../engine/buildCampaignMap.ts`) merges it
 * with areas.json; the integrity test checks every id and name against the bundle.
 */
import type { CampaignNote, CampaignSectionKey, EdgeKind, FactSource, QuestFact } from '../engine/types';

/** Cell coordinates [column, row] in an act grid; fractions are fine (regions sit between cells) */
export type GridPoint = readonly [number, number];

/**
 * One act's hand-placed transit map. `grid` holds one line per row of whitespace-separated tokens, one per column
 * (alignment is cosmetic; at most 7 columns so the map fits the ~880 px canvas next to the detail panel):
 *
 * - `.`        empty cell
 * - `12`       station for area 12
 * - `21..25`   dungeon stack (one pill, a dot per level, top to bottom) for consecutive ids
 * - `9+13`     dungeon stack with an explicit id list
 * - `@40`      ghost of an area drawn in another section (clicking it switches tab)
 * - `#`        starts a comment
 *
 * A stack takes the rows its dots and label need: keep the cells below it empty. Twin rows (same name, same neighbours,
 * e.g. the seven Tal Rasha's Tombs) need only one id in the grid: the others are folded into it.
 * Passages (mutual levels.txt Vis links) between placed stations are drawn automatically.
 */
export interface ActGrid {
  readonly key: CampaignSectionKey;
  /** 0-based act of the areas this grid must place */
  readonly act: number;
  readonly grid: string;
  /** Background boxes with a caption (Monastery, Naraku depths…), in cell coordinates */
  readonly regions?: readonly { readonly label: string; readonly from: GridPoint; readonly to: GridPoint }[];
  /**
   * Edge routing hints keyed `"a-b"` (area ids): the route is computed from `a` and starts with a 45° segment
   * ('diagonal-first') instead of the default straight one. Same key without a hint = the default from `a`.
   */
  readonly routes?: Readonly<Record<string, 'diagonal-first' | 'straight-first'>>;
}

/** An edge the tables do not have (outdoor borders, portals, act travel), or a restyle of a Vis passage (one-way) */
export interface CuratedLink {
  readonly from: number;
  readonly to: number;
  readonly kind: EdgeKind;
  readonly oneWay?: boolean;
  /** Short label drawn on the edge and shown in the panel */
  readonly via?: string;
  readonly source: FactSource;
  readonly verify?: boolean;
  /** A 'passage' the tables do not list (confirmed in game); without it a 'passage' link only restyles a Vis passage */
  readonly missingFromTables?: true;
}

/** Hand-written facts about one area, keyed by levels.txt Id in CURATED_AREAS */
export interface CuratedArea {
  /** Must equal the areas.json name (rename detection) */
  readonly name: string;
  readonly officialName?: string;
  /** ESR special area that areas.json does not flag as an Endgame Zone (Naraku depths, Cow Level, uber levels…) */
  readonly special?: true;
  /** Drawn on another tab than its act's (the uber levels live on the portals tab) */
  readonly home?: CampaignSectionKey;
  readonly bosses?: readonly string[];
  readonly quests?: readonly QuestFact[];
  readonly notes?: readonly CampaignNote[];
  readonly entry?: string;
  readonly entryUnknown?: true;
}

export interface SectionDef {
  readonly key: CampaignSectionKey;
  readonly title: string;
  readonly notes: readonly CampaignNote[];
}
