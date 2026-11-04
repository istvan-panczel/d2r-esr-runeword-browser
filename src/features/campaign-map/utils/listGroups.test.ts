import { expect, it } from 'vitest';
import { areaListGroups, twinRepresentative, withoutLaterTwins } from './listGroups';
import { mockCampaignArea, mockMap, mockSection } from './testMap.mock';

it('keeps an act as one group in display order', () => {
  const map = mockMap([mockCampaignArea(2, 'B'), mockCampaignArea(1, 'A')]);
  expect(areaListGroups(mockSection('act1', [2, 1]), map.areas)).toEqual([{ key: 'all', title: null, ids: [2, 1] }]);
});

it('groups the maps by tier and zone, in order of first appearance', () => {
  const map = mockMap([
    mockCampaignArea(10, 'Chasm L1', 'maps', { area: { tier: 1, group: 'Chasm of Horrors' } }),
    mockCampaignArea(11, 'Chasm L2', 'maps', { area: { tier: 1, group: 'Chasm of Horrors' } }),
    mockCampaignArea(20, 'Vault', 'maps', { area: { uniqueMap: true, group: 'Goblin Realm' } }),
    mockCampaignArea(12, 'Crypt', 'maps', { area: { tier: 1, group: 'Crypt of Damnation' } }),
  ]);
  expect(areaListGroups(mockSection('maps', [10, 11, 20, 12]), map.areas).map((group) => [group.title, group.ids])).toEqual([
    ['Tier 1 · Chasm of Horrors', [10, 11]],
    ['Unique map · Goblin Realm', [20]],
    ['Tier 1 · Crypt of Damnation', [12]],
  ]);
});

it('withoutLaterTwins keeps the first row of a twin family', () => {
  const map = mockMap([
    mockCampaignArea(66, 'Tal Rasha', 'act2', { twins: [67, 68] }),
    mockCampaignArea(67, 'Tal Rasha', 'act2', { twins: [66, 68] }),
    mockCampaignArea(5, 'Other', 'act2'),
    mockCampaignArea(68, 'Tal Rasha', 'act2', { twins: [66, 67] }),
  ]);
  expect(withoutLaterTwins([66, 67, 5, 68], map.areas)).toEqual([66, 5]);
  expect([67, 68, 66, 5, 999].map((id) => twinRepresentative(map.areas, id))).toEqual([66, 66, 66, 5, 999]);
});
