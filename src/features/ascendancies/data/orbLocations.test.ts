/**
 * The hand-maintained orb table against the committed game-data bundles: fails after an ESR update that moves an orb
 * to another superunique or renames / renumbers an area, so the table gets re-checked.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AREA_NAMES } from '@/features/campaign-map/data/names';
import { ORB_LOCATIONS } from './orbLocations';

interface SourceItem {
  readonly name: string;
  readonly labels: readonly { readonly kind: string; readonly text: string }[];
}
interface AreaRow {
  readonly id: number;
  readonly name: string;
  /** 0-based */
  readonly act: number;
}

const GAME_DATA = resolve(__dirname, '../../../../public/game-data');
const sources = (JSON.parse(readFileSync(resolve(GAME_DATA, 'sources.json'), 'utf-8')) as { items: SourceItem[] }).items;
const areas = (JSON.parse(readFileSync(resolve(GAME_DATA, 'areas.json'), 'utf-8')) as { areas: AreaRow[] }).areas;

/** "The Hole Level 2" is "Hole Level 2" in levels.txt, "The Worldstone Chamber" keeps its article */
const withoutArticle = (name: string | undefined) => name?.replace(/^The /, '');

describe('ORB_LOCATIONS', () => {
  it('lists the five orbs once each', () => {
    expect(ORB_LOCATIONS.map((location) => location.orb)).toEqual([
      'Orb of Storms',
      'Orb of Earth',
      'Orb of Water',
      'Orb of Wind',
      'Orb of Fire',
    ]);
  });

  it.each(ORB_LOCATIONS)('$orb drops from $superunique (sources.json)', ({ orb, superunique }) => {
    const item = sources.find((source) => source.name === orb);
    expect(item, `${orb} missing from sources.json`).toBeDefined();
    expect(item?.labels.map((label) => label.text)).toContain(`Drops from ${superunique}`);
  });

  it.each(ORB_LOCATIONS)('$area is levels.txt Id $areaId in act $act and on the campaign map', ({ area, areaId, act }) => {
    const row = areas.find((candidate) => candidate.id === areaId);
    expect(withoutArticle(row?.name)).toBe(withoutArticle(area));
    expect(row?.act).toBe(act - 1);
    expect(withoutArticle(AREA_NAMES[areaId])).toBe(withoutArticle(area));
  });
});
