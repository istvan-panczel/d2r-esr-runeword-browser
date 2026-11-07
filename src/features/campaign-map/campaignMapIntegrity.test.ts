/**
 * The campaign map against the committed bundle (public/game-data/areas.json): after an ESR release, a failure here
 * means the hand-written data in ./data needs a look (a new or renamed area, a stale link, an unreachable level).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { AreasBundle, LootFilterDataBundle } from '@/features/game-data/engine/schema';
import { CURATED_AREAS } from './data/areas';
import { CURATED_LINKS } from './data/links';
import { MAP_BOSS_FACTS } from './data/mapBosses';
import { buildCampaignMap, ROGUE_ENCAMPMENT_ID } from './engine/buildCampaignMap';

const GAME_DATA = resolve(__dirname, '../../../public/game-data');
const { areas, mapBosses } = JSON.parse(readFileSync(resolve(GAME_DATA, 'areas.json'), 'utf-8')) as AreasBundle;
const lootfilter = JSON.parse(readFileSync(resolve(GAME_DATA, 'lootfilter.json'), 'utf-8')) as LootFilterDataBundle;
const map = buildCampaignMap(areas);

describe('campaign map integrity', () => {
  it('builds without problems', () => {
    expect(map.problems).toEqual([]);
  });

  it('places every area on its tab (nothing on an unplaced strip)', () => {
    for (const section of map.sections) expect(section.unplacedIds, section.key).toEqual([]);
    const drawn = new Set(
      map.sections.flatMap((section) => (section.layout?.stations ?? []).filter((s) => s.ghostOf === undefined).flatMap((s) => s.ids))
    );
    const listed = new Set(map.sections.filter((section) => section.layout === null).flatMap((section) => section.areaIds));
    const missing = areas.filter((area) => !drawn.has(area.id) && !(map.areas.get(area.id)?.section === 'portals' && listed.has(area.id)));
    expect(missing.map((area) => `${String(area.id)} ${area.name}`)).toEqual([]);
  });

  it('only names areas that exist, with their current names', () => {
    const byId = new Map(areas.map((area) => [area.id, area]));
    for (const link of CURATED_LINKS) {
      expect(byId.has(link.from), `link from ${String(link.from)}`).toBe(true);
      expect(byId.has(link.to), `link to ${String(link.to)}`).toBe(true);
    }
    for (const [id, curated] of Object.entries(CURATED_AREAS)) expect(byId.get(Number(id))?.name, `area ${id}`).toBe(curated.name);
  });

  it('uses quest item codes that exist', () => {
    const codes = new Set(lootfilter.items.map((item) => item.code));
    const used = [...map.areas.values()].flatMap((area) =>
      area.quests.flatMap((quest) => (quest.itemCode === undefined ? [] : [quest.itemCode]))
    );
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((code) => !codes.has(code))).toEqual([]);
  });

  it('reaches every area from the Rogue Encampment, except the ones with no known entrance', () => {
    const next = new Map<number, number[]>();
    const add = (from: number, to: number) => next.set(from, [...(next.get(from) ?? []), to]);
    for (const edge of map.edges) {
      add(edge.from, edge.to);
      if (!edge.oneWay) add(edge.to, edge.from);
    }
    const seen = new Set([ROGUE_ENCAMPMENT_ID]);
    const queue = [ROGUE_ENCAMPMENT_ID];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const to of next.get(id) ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        queue.push(to);
      }
    }
    const unreachable = [...map.areas.values()].filter((area) => !seen.has(area.id) && area.entryUnknown !== true);
    expect(unreachable.map((area) => `${String(area.id)} ${area.name}`)).toEqual([]);
  });

  it('has hand-written facts for every map boss, and only for map bosses', () => {
    const ids = mapBosses.map((boss) => boss.id);
    expect(ids.filter((id) => !Object.hasOwn(MAP_BOSS_FACTS, id))).toEqual([]);
    expect(Object.keys(MAP_BOSS_FACTS).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('gives every boss arena of a tiered map its bosses, each with rewards and generic loot rolls', () => {
    const arenas = areas.filter((area) => area.tier !== undefined && area.boss !== undefined);
    expect(arenas.length).toBeGreaterThan(10);
    expect(arenas.filter((area) => (area.mapBosses ?? []).length === 0).map((area) => `${String(area.id)} ${area.name}`)).toEqual([]);
    for (const boss of mapBosses) {
      expect(boss.rewards.length, boss.id).toBeGreaterThan(0);
      expect(boss.otherRolls, boss.id).toBeGreaterThan(0);
    }
  });

  it('fits every drawn tab into the ~880 px canvas', () => {
    for (const section of map.sections) if (section.layout !== null) expect(section.layout.width, section.key).toBeLessThanOrEqual(880);
  });
});
