/**
 * The All items rows of the owner's real stash: one row per page item (sockets inside their parent, no materials tab),
 * search basics, and the time a row build takes. Skipped without the fixture (test-fixtures/stash/, gitignored).
 */
import { expect, it } from 'vitest';
import { describeWithFixture } from '../../testing/stashFixture.mock';
import { stashCatalog } from '../catalog';
import { buildItemTypeIndex } from '../itemTypes';
import { walkStashItems } from '../walk';
import { createItemRows, DEFAULT_ITEMS_STATE, filterItemRows, itemsSummary, sortItemRows } from './allItems';

describeWithFixture('the All items rows of the stash fixture', (fixture) => {
  const setup = () => {
    const { stash, bundle, types } = fixture();
    const index = buildItemTypeIndex(types.types);
    const catalog = stashCatalog(bundle, index);
    return { stash, catalog, index };
  };

  it('has one row per page item, socketed items only inside their parent', () => {
    const { stash, catalog } = setup();
    const started = performance.now();
    const rows = createItemRows(stash, catalog, null);
    const elapsed = performance.now() - started;
    const pageItems = stash.sections
      .filter((section) => section.tabType === 'normal')
      .reduce((sum, section) => sum + section.items.length, 0);
    const socketed = walkStashItems(stash, { socketed: true }).filter(({ parent }) => parent !== null);
    console.log(
      `All items fixture: ${String(rows.length)} rows, ${String(socketed.length)} socketed inside, built in ${elapsed.toFixed(0)} ms`
    );
    expect(rows).toHaveLength(pageItems);
    expect(rows.every((row) => row.location.tabType === 'normal')).toBe(true);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    const rowItems = new Set(rows.map((row) => row.item));
    expect(socketed.filter(({ item }) => rowItems.has(item))).toEqual([]);
    expect(rows.reduce((sum, row) => sum + row.socketed.length, 0)).toBe(rows.reduce((sum, row) => sum + row.item.socketed.length, 0));
    expect(itemsSummary(stash, catalog.bundle).total).toBe(rows.length);
    expect(rows.every((row) => row.name !== '')).toBe(true);
  });

  it('finds items by name, item type word, socketed name and code', () => {
    const { stash, catalog, index } = setup();
    const rows = createItemRows(stash, catalog, null);
    const search = (text: string) => filterItemRows(rows, { ...DEFAULT_ITEMS_STATE, search: text }, index);

    const unique = rows.find((row) => row.info.unique !== null);
    expect(unique).toBeDefined();
    if (unique === undefined) return;
    expect(search(`"${unique.name}"`)).toContain(unique);

    const rings = search('ring');
    expect(rings.length).toBeGreaterThan(0);
    expect(rings.every((row) => row.info.typeChain.includes('ring'))).toBe(true);

    const withSocketed = rows.find((row) => row.socketed.length > 0);
    expect(withSocketed).toBeDefined();
    if (withSocketed === undefined) return;
    const childName = withSocketed.socketed[0]?.name ?? '';
    const found = search(`"${childName}"`);
    expect(found).toContain(withSocketed);

    const code = rows[0]?.info.code ?? '';
    expect(search(code).length).toBeGreaterThan(0);
    expect(search('zzzz-no-such-item')).toEqual([]);

    // A type word matches the type chain or a word of the name / socketed names, not the row's own base or type
    expect(search("Milabrega's Orb").map((row) => row.name)).toEqual(["Milabrega's Orb"]);
    expect(search('Ru Rune').map((row) => row.name)).toContain('Richesdotcom');
    expect(search('Heart of Jewels')[0]?.name).toBe('Heart of Jewels');
    expect(search('ring').filter((row) => !row.info.typeChain.includes('ring') && row.name === row.info.baseName)).toEqual([]);

    // Stash order is the location order of the default sort
    expect(sortItemRows(rows, 'location', 'asc').map((row) => row.page)).toEqual(rows.map((row) => row.page).sort((a, b) => a - b));
  });
});
