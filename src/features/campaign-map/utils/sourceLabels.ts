/**
 * Labels of the campaign map's curated facts: where each one comes from (`FactSource`) and whether it is confirmed.
 * See docs/features/CAMPAIGN-MAP.md "Trust labels".
 */
import type { AreaTerrain } from '@/features/game-data/engine/schema';
import type { CampaignSectionKey, EdgeKind, FactSource, TeleportRule } from '../engine/types';

/** neutral: game files; official: the Maps page; caution: not confirmed in ESR; confirmed: checked in game */
export type FactTone = 'neutral' | 'official' | 'caution' | 'confirmed';

export interface FactLabel {
  readonly text: string;
  /** Longer explanation (tooltip) */
  readonly title: string;
  readonly tone: FactTone;
}

const SOURCE_LABELS: Record<FactSource, FactLabel> = {
  official: { text: 'Official Maps page', title: 'From the official ESR Maps page', tone: 'official' },
  tables: { text: 'Game files', title: 'Read from the ESR game files (txt tables)', tone: 'neutral' },
  vanilla: {
    text: 'Vanilla, unconfirmed in ESR',
    title: 'Unchanged Diablo II behaviour; ESR may have changed it and nobody has checked yet',
    tone: 'caution',
  },
  owner: { text: 'Confirmed', title: 'Checked in game in the current ESR version', tone: 'confirmed' },
};

/** The label of a fact's source; `verify` (not confirmed in game) adds "unconfirmed" and the caution tone. */
export function factSourceLabel(source: FactSource, verify = false): FactLabel {
  const label = SOURCE_LABELS[source];
  if (!verify || source === 'vanilla') return label;
  return {
    text: `${label.text}, unconfirmed`,
    title: `${label.title}; not confirmed in game yet`,
    tone: 'caution',
  };
}

const TERRAIN_LABELS: Record<AreaTerrain, string> = {
  town: 'Town',
  outdoor: 'Outdoor',
  tower: 'Tower',
  cave: 'Cave',
  tomb: 'Tomb',
  dungeon: 'Dungeon',
  temple: 'Temple',
  special: 'Special',
};

export function terrainLabel(terrain: AreaTerrain): string {
  return TERRAIN_LABELS[terrain];
}

/** Tab titles; the engine's section titles win when present (they come with the map) */
export const SECTION_TAB_LABELS: Record<CampaignSectionKey, string> = {
  act1: 'Act I',
  act2: 'Act II',
  act3: 'Act III',
  act4: 'Act IV',
  act5: 'Act V',
  special: 'Special areas',
  portals: 'Ubers & portals',
  maps: 'Endgame Maps',
};

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  border: 'Walk across',
  passage: 'Entrance / stairs',
  portal: 'Portal',
  cube: 'Cube portal',
  act: 'Travel to the next act',
};

/** One "Heads up" line per teleport rule */
export const TELEPORT_RULE_TEXT: Record<TeleportRule, string> = {
  off: 'No teleport at all in this area.',
  restricted: 'Teleport is restricted in this area.',
};

/**
 * `questGate` (levels.txt QuestFlagEx, else QuestFlag): the quest that must be done before the area opens. Only the
 * values ESR uses are labelled (vanilla quest ids: Act II 9–14, Act III 17–22, Act IV 25–27, Act V 35–40); another value
 * reads "quest #N".
 */
const QUEST_GATE_LABELS: Readonly<Record<number, string>> = {
  11: 'The Tainted Sun',
  13: 'The Summoner',
  18: "Khalim's Will",
  26: "Terror's End (Diablo)",
  39: 'Rite of Passage',
  40: 'Eve of Destruction (Baal)',
};

export function questGateText(questGate: number): string {
  return `Opens after you complete ${QUEST_GATE_LABELS[questGate] ?? `quest #${String(questGate)}`}.`;
}
