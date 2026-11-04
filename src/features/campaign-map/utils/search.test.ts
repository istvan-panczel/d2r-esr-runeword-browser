import { describe, expect, it } from 'vitest';
import { searchCampaignMap } from './search';
import { mockCampaignArea } from './testMap.mock';

const areas = [
  mockCampaignArea(80, 'Spider Cavern', 'act3', { quests: [{ quest: "Khalim's Will", itemCode: 'qey', source: 'vanilla' }] }),
  mockCampaignArea(93, 'Sewers Level 2', 'act3', { quests: [{ quest: "Khalim's Will", itemCode: 'qhr', source: 'official' }] }),
  mockCampaignArea(61, 'Claw Viper Temple Level 2', 'act2', { officialName: 'Unholy Altar', bosses: ['Fangskin'] }),
  mockCampaignArea(197, 'The Iron Keep Level 2', 'maps', { area: { group: 'Eye of the Storm', boss: 'Diablo the Invincible' } }),
  mockCampaignArea(5, 'Heart of the Forest', 'act1'),
];
const ITEMS: Record<string, string> = { qey: "Khalim's Eye", qhr: "Khalim's Heart" };
const itemName = (code: string) => ITEMS[code];
const search = (query: string) => searchCampaignMap(areas, query, itemName).map((hit) => [hit.id, hit.kind, hit.text]);

describe('searchCampaignMap', () => {
  it('finds a quest item ("heart" → Sewers Level 2) after an area name with the same word', () => {
    expect(search('heart')).toEqual([
      [5, 'area', 'Heart of the Forest'],
      [93, 'item', "Khalim's Heart"],
    ]);
  });

  it('finds the official name, a boss and a map zone', () => {
    expect(search('unholy')).toEqual([[61, 'official', 'Unholy Altar']]);
    expect(search('fangskin')).toEqual([[61, 'boss', 'Fangskin']]);
    expect(search('diablo the')).toEqual([[197, 'boss', 'Diablo the Invincible']]);
    expect(search('eye of the storm')).toEqual([[197, 'zone', 'Eye of the Storm']]);
  });

  it('gives one hit per area, its best text', () => {
    expect(search("khalim's")).toEqual([
      [80, 'item', "Khalim's Eye"],
      [93, 'item', "Khalim's Heart"],
    ]);
  });

  it('ignores case, quotes and extra spaces; empty finds nothing', () => {
    expect(search('  SEWERS   level ')).toEqual([[93, 'area', 'Sewers Level 2']]);
    expect(search('khalim’s eye')).toEqual([[80, 'item', "Khalim's Eye"]]);
    expect(search('   ')).toEqual([]);
  });

  it('finds a twin family once', () => {
    const tombs = [66, 67, 68].map((id, _, ids) =>
      mockCampaignArea(id, "Tal Rasha's Tomb", 'act2', { twins: ids.filter((twin) => twin !== id) })
    );
    expect(searchCampaignMap(tombs, 'tal rasha', itemName).map((hit) => hit.id)).toEqual([66]);
  });

  it('caps the results', () => {
    expect(searchCampaignMap(areas, 'e', itemName, 2)).toHaveLength(2);
  });
});
