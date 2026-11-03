/**
 * Every item of the owner's real stash resolves against the committed stash.json: no unknown code, unique id, set id or
 * runeword id. Skipped without the fixture (test-fixtures/stash/, gitignored).
 */
import { expect, it } from 'vitest';
import { describeWithFixture } from '../testing/stashFixture.mock';
import { stashCatalog } from './catalog';
import { describeStashItem, type StashItemKind } from './describeItem';
import { buildItemTypeIndex } from './itemTypes';
import { walkStashItems } from './walk';

describeWithFixture('the stash fixture against stash.json', (fixture) => {
  it('knows every code, unique, set item and runeword of the page items and their sockets', () => {
    const { stash, bundle, types } = fixture();
    const catalog = stashCatalog(bundle, buildItemTypeIndex(types.types));
    const walked = walkStashItems(stash, { socketed: true });
    const described = walked.map(({ item }) => ({ item, described: describeStashItem(item, catalog) }));
    expect(described.filter(({ described: entry }) => entry.base === null).map(({ item }) => item.code)).toEqual([]);
    expect(described.filter(({ item, described: entry }) => item.quality === 'unique' && entry.unique === null)).toEqual([]);
    expect(
      described.filter(({ item, described: entry }) => item.quality === 'set' && (entry.setItem === null || entry.set === null))
    ).toEqual([]);
    expect(described.filter(({ item, described: entry }) => item.runewordId !== null && entry.runeword === null)).toEqual([]);
    expect(described.filter(({ described: entry }) => entry.typeChain.length === 0)).toEqual([]);
    // A unique's / set item's base is the item's code
    for (const { item, described: entry } of described) {
      if (entry.unique !== null) expect(entry.unique.code, entry.unique.name).toBe(item.code);
      if (entry.setItem !== null) expect(entry.setItem.code, entry.setItem.name).toBe(item.code);
    }
    const kinds = new Map<StashItemKind, number>();
    for (const { described: entry } of described) kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1);
    console.log(
      `Stash fixture: ${String(described.length)} page items incl. socketed, by kind ${JSON.stringify(Object.fromEntries(kinds))}`
    );
    expect(walked.filter(({ parent }) => parent === null)).toHaveLength(
      stash.sections.filter((section) => section.tabType === 'normal').reduce((sum, section) => sum + section.items.length, 0)
    );
  });
});
