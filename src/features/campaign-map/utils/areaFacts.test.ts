import { describe, expect, it } from 'vitest';
import { areaBosses, areaEyebrow, headsUpLines, levelText, plainNotes } from './areaFacts';
import { factSourceLabel, questGateText } from './sourceLabels';
import { edge, mockCampaignArea } from './testMap.mock';

const names: Record<number, string> = { 1: 'Flayer Jungle', 2: 'Sewers Level 1', 3: 'Kurast Bazaar' };
const nameOf = (id: number) => names[id] ?? String(id);

describe('headsUpLines', () => {
  it('lists teleport rules, no town portal, the quest gate, one-way edges and warning/spoiler notes in order', () => {
    const area = mockCampaignArea(2, 'Sewers Level 1', 'act3', {
      teleport: [{ rule: 'restricted', source: 'tables' }],
      area: { preventTownPortal: true, questGate: 18 },
      notes: [
        { text: 'Plain note', source: 'official' },
        { text: 'Careful', source: 'official', warning: true },
        { text: 'Hint: Sp***ling', source: 'official', spoiler: true },
      ],
    });
    const lines = headsUpLines(area, [edge(1, 2, { oneWay: true, source: 'official', verify: true }), edge(2, 3)], nameOf);
    expect(lines.map((line) => [line.text, line.source, line.verify, line.spoiler])).toEqual([
      ['Teleport is restricted in this area.', 'tables', undefined, undefined],
      ['You cannot open a town portal here.', 'tables', undefined, undefined],
      ["Opens after you complete Khalim's Will.", 'tables', undefined, undefined],
      ['One way: Flayer Jungle → Sewers Level 1. There is no way back the same way.', 'official', true, undefined],
      ['Careful', 'official', undefined, undefined],
      ['Hint: Sp***ling', 'official', undefined, true],
    ]);
    expect(plainNotes(area).map((note) => note.text)).toEqual(['Plain note']);
  });

  it('words an outgoing one-way edge from the area and skips act travel and cube portals both ways', () => {
    const area = mockCampaignArea(1, 'Flayer Jungle', 'act3');
    const lines = headsUpLines(
      area,
      [
        edge(1, 2, { oneWay: true, via: 'stairs' }),
        edge(9, 1, { kind: 'cube', oneWay: true }),
        edge(1, 9, { kind: 'cube', oneWay: true }),
        edge(1, 3, { kind: 'act', oneWay: true }),
        edge(3, 1, { kind: 'act', oneWay: true }),
        edge(1, 3, { kind: 'portal' }),
      ],
      nameOf
    );
    expect(lines.map((line) => line.text)).toEqual([
      'One way: Flayer Jungle → Sewers Level 1 (stairs). You cannot come back the same way.',
    ]);
  });
});

it('areaBosses merges the curated and the map boss without repeats', () => {
  const area = mockCampaignArea(1, 'X', 'maps', { bosses: ['Diablo the Invincible', 'Other'], area: { boss: 'Diablo the Invincible' } });
  expect(areaBosses(area)).toEqual(['Diablo the Invincible', 'Other']);
});

it('areaEyebrow names the section, tier, zone and terrain', () => {
  const map = mockCampaignArea(197, 'The Iron Keep Level 2', 'maps', { area: { tier: 5, group: 'Eye of the Storm' } });
  expect(areaEyebrow(map, 'Endgame Maps', 'Dungeon')).toBe('Endgame Maps · Tier 5 · Eye of the Storm · Dungeon');
  expect(areaEyebrow(mockCampaignArea(1, 'A'), 'Act I', 'Outdoor')).toBe('Act I · Outdoor');
});

it('levelText collapses equal levels', () => {
  expect(levelText(mockCampaignArea(1, 'A', 'maps', { area: { level: [108, 108, 108] } }))).toBe('108');
  expect(levelText(mockCampaignArea(1, 'A'))).toBe('1 / 2 / 3');
  expect(levelText(mockCampaignArea(1, 'A', 'act1', { area: { level: null } }))).toBeNull();
});

describe('factSourceLabel', () => {
  it('labels each source', () => {
    expect(factSourceLabel('official').text).toBe('Official Maps page');
    expect(factSourceLabel('tables').text).toBe('Game files');
    expect(factSourceLabel('vanilla')).toMatchObject({ text: 'Vanilla, unconfirmed in ESR', tone: 'caution' });
    expect(factSourceLabel('owner')).toMatchObject({ text: 'Confirmed', tone: 'confirmed' });
  });

  it('marks an unverified fact unconfirmed (vanilla already says so)', () => {
    expect(factSourceLabel('official', true)).toMatchObject({ text: 'Official Maps page, unconfirmed', tone: 'caution' });
    expect(factSourceLabel('vanilla', true).text).toBe('Vanilla, unconfirmed in ESR');
  });
});

it('questGateText labels known quests and numbers the rest', () => {
  expect(questGateText(11)).toBe('Opens after you complete The Tainted Sun.');
  expect(questGateText(99)).toBe('Opens after you complete quest #99.');
});
