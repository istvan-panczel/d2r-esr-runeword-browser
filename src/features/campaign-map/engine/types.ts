/**
 * Campaign map model (`/campaign-map`): the contract between the engine (`buildCampaignMap`, grid layout, edge routing)
 * and the page (tabs, canvas, detail panel, list view). See docs/features/CAMPAIGN-MAP.md.
 *
 * Built at runtime from areas.json plus the hand-written facts in `../data/` (act grids, curated links, quest and boss
 * facts, notes). Pure data: no React, no DOM.
 */
import type { Area, AreaTerrain } from '@/features/game-data/engine/schema';

/** Tabs of the page, in order */
export type CampaignSectionKey = 'act1' | 'act2' | 'act3' | 'act4' | 'act5' | 'special' | 'portals' | 'maps';

/** Where a hand-written fact comes from; the UI labels every curated fact with it */
export type FactSource =
  /** The official ESR Maps page */
  | 'official'
  /** Read from the txt tables, with a human-written label */
  | 'tables'
  /** Unchanged Diablo II behaviour, not confirmed in ESR */
  | 'vanilla'
  /** Confirmed by the owner in game */
  | 'owner';

export interface CampaignNote {
  readonly text: string;
  readonly source: FactSource;
  /** A caveat the player should know before going there (teleport limits, one-way, the Red Portal…) */
  readonly warning?: boolean;
  /** Hidden behind a click (e.g. the Dead End hint) */
  readonly spoiler?: boolean;
  /** Not confirmed in game: shown as "unconfirmed" */
  readonly verify?: boolean;
}

export interface QuestFact {
  /** Quest name, e.g. "The Horadric Staff" */
  readonly quest: string;
  /** What to do or get here, e.g. "Get the Viper Amulet from the chest" */
  readonly how?: string;
  /** Quest item code (misc/weapons.txt) for the name and the icon, e.g. "vip" */
  readonly itemCode?: string;
  readonly source: FactSource;
  readonly verify?: boolean;
}

export type TeleportRule =
  /** levels.txt Teleport 0: no teleport at all */
  | 'off'
  /** levels.txt Teleport 2 */
  | 'restricted';

export interface CampaignArea {
  /** levels.txt Id */
  readonly id: number;
  /** Display name: the areas.json name without ESR's " (Endgame Zone)" suffix */
  readonly name: string;
  /** The areas.json row (levels, density, unique packs, tier, waypoint…) */
  readonly area: Area;
  readonly section: CampaignSectionKey;
  readonly terrain: AreaTerrain;
  /** ESR special area (Endgame Zone, the official page's special dungeons, uber levels) */
  readonly special: boolean;
  /** The official Maps page's name when it differs ("Unholy Altar" for Claw Viper Temple Level 2) */
  readonly officialName?: string;
  readonly bosses: readonly string[];
  readonly quests: readonly QuestFact[];
  readonly notes: readonly CampaignNote[];
  readonly teleport: readonly { readonly rule: TeleportRule; readonly source: FactSource; readonly verify?: boolean }[];
  /** How to get in when it is not a plain walk or stairs (cube recipe, red portal, map item…), shown in the panel */
  readonly entry?: string;
  /** No known entrance (e.g. Colossal Summit) */
  readonly entryUnknown?: true;
  /**
   * Other rows with the same name and the same neighbours (Tal Rasha's Tomb ×7): the map draws them as one station
   * whose `ids` hold all of them (`folded`). Empty for a normal area.
   */
  readonly twins: readonly number[];
  /** False when no hand-written entry exists (a new area after an ESR release): the UI marks it "not curated yet" */
  readonly curated: boolean;
}

export type EdgeKind =
  /** Walk across an outdoor border (curated: the tables have no outdoor borders) */
  | 'border'
  /** Stairs / cave mouth / doorway (levels.txt Vis, kept only when both rows list each other) */
  | 'passage'
  /** Red portal or quest portal (curated) */
  | 'portal'
  /** Portal opened with a cube recipe (Cow Level, ubers, endgame map items) */
  | 'cube'
  /** Travel to the next act (curated) */
  | 'act';

export interface CampaignEdge {
  readonly from: number;
  readonly to: number;
  readonly kind: EdgeKind;
  /** Only from → to */
  readonly oneWay: boolean;
  /** Label: "Cairn Stones", "Club + Tome of Town Portal", "Red Portal after Anya" */
  readonly via?: string;
  readonly source: FactSource;
  readonly verify?: boolean;
}

// --- geometry (computed by the engine from the act grid; SVG user units) ---------------------------------------------

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One area, or a dungeon stack (consecutive levels drawn as one pill with a dot per level) */
export interface MapStation {
  /** Area ids, top to bottom; one id for a plain station */
  readonly ids: readonly number[];
  /** Centre of each id's dot, same order as `ids` */
  readonly dots: readonly Point[];
  /** Label anchor (centre of the label's top edge) and the label text (stack: the shared name, e.g. "Tower Cellar") */
  readonly label: { readonly x: number; readonly y: number; readonly text: string; readonly lines: readonly string[] };
  /** A ghost of an area placed in another section; clicking it jumps there */
  readonly ghostOf?: CampaignSectionKey;
  /** Identical twin rows (Tal Rasha's Tomb ×7) drawn as ONE dot: every entry of `dots` is the same point */
  readonly folded?: true;
}

export interface MapEdge {
  readonly edge: CampaignEdge;
  /** SVG path data, routed orthogonally / at 45° between the two dots */
  readonly path: string;
  /** Where the `via` label goes, when there is one */
  readonly labelAt?: Point;
}

export interface MapRegion {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SectionLayout {
  readonly width: number;
  readonly height: number;
  readonly stations: readonly MapStation[];
  readonly edges: readonly MapEdge[];
  readonly regions: readonly MapRegion[];
}

export interface CampaignSection {
  readonly key: CampaignSectionKey;
  readonly title: string;
  /** Every area that belongs to this section (placed or not), in display order */
  readonly areaIds: readonly number[];
  /** The drawn map; null for sections shown as cards/lists only */
  readonly layout: SectionLayout | null;
  /** Areas of this section missing from its grid (a new ESR area): drawn in an "Unplaced" strip */
  readonly unplacedIds: readonly number[];
  /** Section notes (the official page's act notes, removed levels…) */
  readonly notes: readonly CampaignNote[];
}

export interface CampaignMap {
  readonly sections: readonly CampaignSection[];
  readonly areas: ReadonlyMap<number, CampaignArea>;
  /** Every edge, also the ones between sections (portal into a map, act travel) */
  readonly edges: readonly CampaignEdge[];
  /** Problems found while building (stale curated id, renamed area, unknown grid id); the integrity test asserts it is empty */
  readonly problems: readonly string[];
}
