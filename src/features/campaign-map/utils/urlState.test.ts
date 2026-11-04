import { describe, expect, it } from 'vitest';
import { mockCampaignArea, mockMap, mockSection } from './testMap.mock';
import { campaignMapAreaPath, encodeCampaignMapState, readCampaignMapUrlState, resolveCampaignMapState } from './urlState';

const read = (query: string) => readCampaignMapUrlState(new URLSearchParams(query));

const drawn = mockMap([
  mockCampaignArea(1, 'Rogue Encampment', 'act1'),
  mockCampaignArea(66, "Tal Rasha's Tomb", 'act2', { twins: [67] }),
  mockCampaignArea(67, "Tal Rasha's Tomb", 'act2', { twins: [66] }),
  mockCampaignArea(93, 'Sewers Level 2', 'act3'),
  mockCampaignArea(197, 'The Iron Keep Level 2', 'maps'),
]);
/** Special areas lists 93, drawn on Act III */
const map = { ...drawn, sections: [...drawn.sections, mockSection('special', [93])] };
const homeOf = (id: number) => map.areas.get(id)?.section;

describe('readCampaignMapUrlState', () => {
  it('reads tab, area and view', () => {
    expect(read('tab=act3&area=93&view=list')).toEqual({ tab: 'act3', area: 93, view: 'list' });
  });

  it('ignores an unknown tab, a bad area and an unknown view', () => {
    expect(read('tab=act9&area=abc&view=grid')).toEqual({ tab: null, area: null, view: 'map' });
    expect(read('area=-3')).toEqual({ tab: null, area: null, view: 'map' });
    expect(read('area=12345')).toEqual({ tab: null, area: null, view: 'map' });
  });

  it('takes act=N as an alias of tab=actN, tab wins', () => {
    expect(read('act=3').tab).toBe('act3');
    expect(read('act=7').tab).toBeNull();
    expect(read('act=2&tab=maps').tab).toBe('maps');
  });
});

describe('resolveCampaignMapState', () => {
  it("derives the tab from the area's home section", () => {
    expect(resolveCampaignMapState(read('area=93'), map)).toEqual({ tab: 'act3', area: 93, view: 'map' });
  });

  it('keeps an explicit tab that lists the area (an area seen from another section)', () => {
    expect(resolveCampaignMapState(read('tab=special&area=93'), map).tab).toBe('special');
  });

  it("switches to the area's home when the tab does not list it", () => {
    expect(resolveCampaignMapState(read('tab=act1&area=93'), map)).toEqual({ tab: 'act3', area: 93, view: 'map' });
  });

  it('selects a twin under the id its family is drawn with', () => {
    expect(resolveCampaignMapState(read('area=67'), map)).toEqual({ tab: 'act2', area: 66, view: 'map' });
  });

  it('drops an unknown area and falls back to the first section', () => {
    expect(resolveCampaignMapState(read('area=500'), map)).toEqual({ tab: 'act1', area: null, view: 'map' });
  });

  it('ignores a tab the map does not have', () => {
    expect(resolveCampaignMapState(read('tab=portals&area=197'), map).tab).toBe('maps');
  });
});

describe('encodeCampaignMapState', () => {
  const encode = (state: Parameters<typeof encodeCampaignMapState>[0]) => encodeCampaignMapState(state, homeOf).toString();

  it('leaves out the derivable tab', () => {
    expect(encode({ tab: 'act3', area: 93, view: 'map' })).toBe('area=93');
    expect(encode({ tab: 'act1', area: null, view: 'map' })).toBe('');
  });

  it('keeps a tab that differs from the derived one, and the list view', () => {
    expect(encode({ tab: 'special', area: 93, view: 'list' })).toBe('tab=special&area=93&view=list');
    expect(encode({ tab: 'maps', area: null, view: 'map' })).toBe('tab=maps');
  });

  it('round-trips through read + resolve', () => {
    const state = { tab: 'special', area: 93, view: 'list' } as const;
    expect(resolveCampaignMapState(readCampaignMapUrlState(encodeCampaignMapState(state, homeOf)), map)).toEqual(state);
  });
});

it('campaignMapAreaPath links an area on its home map', () => {
  expect(campaignMapAreaPath(93)).toBe('/campaign-map?area=93');
});
