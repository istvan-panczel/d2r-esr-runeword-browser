/**
 * What the detail panel and the peek say about an area, as plain data: the "Heads up" lines, the notes, the bosses.
 * Pure (the components only render it).
 */
import type { CampaignArea, CampaignEdge, CampaignNote, FactSource } from '../engine/types';
import { questGateText, TELEPORT_RULE_TEXT } from './sourceLabels';

export interface HeadsUpLine {
  readonly key: string;
  readonly text: string;
  /** Absent for plain game-file facts that need no label (no town portal) */
  readonly source?: FactSource;
  readonly verify?: boolean;
  /** Hidden behind a click */
  readonly spoiler?: boolean;
}

/**
 * The caveats of an area, in this order: teleport rules, no town portal, the quest gate, one-way passages and portals
 * in and out (not act travel or cube portals), then the curated warning and spoiler notes.
 */
export function headsUpLines(area: CampaignArea, edges: readonly CampaignEdge[], nameOf: (id: number) => string): HeadsUpLine[] {
  const lines: HeadsUpLine[] = [];
  for (const { rule, source, verify } of area.teleport) {
    lines.push({ key: `teleport-${rule}-${source}`, text: TELEPORT_RULE_TEXT[rule], source, verify });
  }
  if (area.area.preventTownPortal === true) lines.push({ key: 'no-tp', text: 'You cannot open a town portal here.', source: 'tables' });
  if (area.area.questGate !== undefined) lines.push({ key: 'quest-gate', text: questGateText(area.area.questGate), source: 'tables' });
  for (const edge of edges) {
    // Only the one-way walks and portals matter here: act travel and cube portals are one way by nature
    if (!edge.oneWay || edge.from === edge.to || edge.kind === 'act' || edge.kind === 'cube') continue;
    const via = edge.via === undefined ? '' : ` (${edge.via})`;
    if (edge.from === area.id) {
      lines.push({
        key: `oneway-out-${String(edge.to)}`,
        text: `One way: ${area.name} → ${nameOf(edge.to)}${via}. You cannot come back the same way.`,
        source: edge.source,
        verify: edge.verify,
      });
    } else if (edge.to === area.id) {
      lines.push({
        key: `oneway-in-${String(edge.from)}`,
        text: `One way: ${nameOf(edge.from)} → ${area.name}${via}. There is no way back the same way.`,
        source: edge.source,
        verify: edge.verify,
      });
    }
  }
  area.notes.forEach((note, index) => {
    if (isHeadsUpNote(note)) {
      lines.push({ key: `note-${String(index)}`, text: note.text, source: note.source, verify: note.verify, spoiler: note.spoiler });
    }
  });
  return lines;
}

/** Warnings and spoilers go to "Heads up"; every other note to "Notes" */
export function isHeadsUpNote(note: CampaignNote): boolean {
  return note.warning === true || note.spoiler === true;
}

export function plainNotes(area: CampaignArea): CampaignNote[] {
  return area.notes.filter((note) => !isHeadsUpNote(note));
}

/** The curated bosses plus the map boss of the game files, without repeats ("Double T1 Bosses" reads "Two tier 1 bosses") */
export function areaBosses(area: CampaignArea): string[] {
  const bosses = [...area.bosses, ...(area.area.boss === undefined ? [] : [area.area.boss])];
  return [...new Set(bosses.map((boss) => boss.replace(/^Double T(\d) Bosses$/i, 'Two tier $1 bosses')))];
}

/** "Act III · Dungeon", "Endgame Maps · Tier 5 · Eye of the Storm" */
export function areaEyebrow(area: CampaignArea, sectionTitle: string, terrain: string): string {
  const parts = [sectionTitle];
  if (area.area.tier !== undefined) parts.push(`Tier ${String(area.area.tier)}`);
  else if (area.area.uniqueMap === true) parts.push('Unique map');
  if (area.area.group !== undefined && area.area.group !== area.name) parts.push(area.area.group);
  parts.push(terrain);
  return parts.join(' · ');
}

/** "88" (one difficulty) or "25 / 55 / 88"; null when the area has no monsters */
export function levelText(area: CampaignArea): string | null {
  const level = area.area.level;
  if (level === null) return null;
  return level[0] === level[1] && level[1] === level[2] ? String(level[0]) : level.map(String).join(' / ');
}
