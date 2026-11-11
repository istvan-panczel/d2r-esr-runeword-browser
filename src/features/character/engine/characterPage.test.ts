/** The pure helpers of the My Character page: tabs, the stored-character list, progress stats and the build handoff. */
import { describe, expect, it } from 'vitest';
import type { SpecializationsBundle } from '@/features/game-data/engine/schema';
import type { CharacterFileMeta } from '../db/characterDb';
import type { CharacterStat } from '../parser/types';
import { readSaveHandoff, saveHandoffState } from './buildHandoff';
import type { ItemSection } from './characterItems';
import { filterStorageSections } from './characterStorage';
import { selectedCharacterEntry, sortCharacterEntries, upsertCharacterEntries } from './characterList';
import { PROGRESS_STATS, progressCounters, specializationProgress, statValue } from './characterProgress';
import { CHARACTER_TABS, characterTabUrl, readCharacterTab, withCharacterTab } from './characterTabs';

describe('character tabs', () => {
  it('reads ?tab= with the Overview as the default, ignoring case and unknown values', () => {
    expect(CHARACTER_TABS.map((tab) => tab.label)).toEqual(['Overview', 'Gear', 'Skills', 'Combat', 'Storage', 'Progress']);
    expect(readCharacterTab('gear')).toBe('gear');
    expect(readCharacterTab('Storage ')).toBe('storage');
    expect(readCharacterTab(null)).toBe('overview');
    expect(readCharacterTab('constructor')).toBe('overview');
  });

  it('writes the tab into the params, the default as no param, keeping the others', () => {
    expect(withCharacterTab(new URLSearchParams('tab=gear&x=1'), 'overview').toString()).toBe('x=1');
    expect(withCharacterTab(new URLSearchParams('x=1'), 'skills').toString()).toBe('x=1&tab=skills');
    expect(characterTabUrl('overview')).toBe('/character');
    expect(characterTabUrl('progress')).toBe('/character?tab=progress');
  });
});

describe('stored character list', () => {
  const meta = (uploadedAt: number): CharacterFileMeta => ({
    name: 'x.d2s',
    size: 1,
    lastModified: null,
    uploadedAt,
    sidecar: { status: 'none' },
  });
  const entry = (key: string, uploadedAt = 0, tag = '') => ({ key, file: meta(uploadedAt), tag });

  it('sorts by name, case-insensitive', () => {
    expect(sortCharacterEntries([entry('zed'), entry('Amy'), entry('bob')]).map((e) => e.key)).toEqual(['Amy', 'bob', 'zed']);
  });

  it('replaces an entry of the same name and keeps the last of several uploads of one name', () => {
    const list = [entry('Amy', 1, 'old'), entry('Zed', 1)];
    const next = upsertCharacterEntries(list, [entry('Amy', 2, 'first'), entry('Bob', 2), entry('Amy', 3, 'second')]);
    expect(next.map((e) => [e.key, e.tag])).toEqual([
      ['Amy', 'second'],
      ['Bob', ''],
      ['Zed', ''],
    ]);
  });

  it('shows the remembered character while it is stored, else the most recent upload', () => {
    const list = [entry('Amy', 5), entry('Bob', 9), entry('Cid', 9)];
    expect(selectedCharacterEntry(list, 'Amy')?.key).toBe('Amy');
    expect(selectedCharacterEntry(list, 'Gone')?.key).toBe('Bob');
    expect(selectedCharacterEntry(list, null)?.key).toBe('Bob');
    expect(selectedCharacterEntry([], 'Amy')).toBeNull();
  });
});

describe('progress stats', () => {
  const stat = (id: number, value: number): CharacterStat => ({ id, raw: value, value });
  const bundle = {
    trees: [
      {
        slug: 'alchemist',
        name: 'Alchemist',
        perks: [
          { slug: 'a1', title: 'A1', stat: 927 },
          { slug: 'a2', title: 'A2', stat: 928 },
        ],
      },
      { slug: 'archaeologist', name: 'Archaeologist', perks: [{ slug: 'r1', title: 'R1', stat: 976 }] },
    ],
  } as unknown as Pick<SpecializationsBundle, 'trees'>;

  it('reads a stat, 0 when the save does not hold it', () => {
    expect(statValue({ attributes: [stat(163, 171039)] }, PROGRESS_STATS.kills)).toBe(171039);
    expect(statValue({ attributes: [] }, PROGRESS_STATS.kills)).toBe(0);
    expect(progressCounters({ attributes: [stat(163, 10), stat(237, 5)] })).toEqual({ kills: 10, relics: 0, respecPoints: 5 });
  });

  it('lists the learned perks of every tree by their stat, and whether the system is unlocked', () => {
    const progress = specializationProgress({ attributes: [stat(928, 1), stat(976, 1), stat(926, 2)] }, bundle);
    expect(progress.trees.map((entry) => [entry.tree.name, entry.learned.map((learned) => learned.perk.slug)])).toEqual([
      ['Alchemist', ['a2']],
      ['Archaeologist', ['r1']],
    ]);
    expect(progress).toMatchObject({ learnedCount: 2, unspentPoints: 2, unlocked: true });
    expect(specializationProgress({ attributes: [] }, bundle)).toMatchObject({ learnedCount: 0, unlocked: false });
    expect(specializationProgress({ attributes: [stat(942, 1)] }, bundle).unlocked).toBe(true);
  });
});

describe('build handoff', () => {
  it('round-trips through the router state', () => {
    const handoff = { bytes: new Uint8Array([1, 2]), fileName: 'Hero.d2s', sidecarVersion: '3.3.02' };
    expect(readSaveHandoff(structuredClone(saveHandoffState(handoff)))).toEqual(handoff);
  });

  it('ignores any other state', () => {
    expect(readSaveHandoff(null)).toBeNull();
    expect(readSaveHandoff({ usr: 1 })).toBeNull();
    expect(readSaveHandoff({ characterSave: { bytes: [1], fileName: 'x', sidecarVersion: null } })).toBeNull();
    expect(readSaveHandoff({ characterSave: { bytes: new Uint8Array(1), fileName: 'x', sidecarVersion: 3 } })).toBeNull();
  });
});

describe('storage filter', () => {
  const row = (key: string, search: string) =>
    ({ key, where: '', row: { search, typeWordText: search, info: { typeChain: [] } } }) as unknown as ItemSection['rows'][number];
  const sections: ItemSection[] = [
    { key: 'inventory', title: 'Inventory', rows: [row('a', 'shako\nhelm'), row('b', 'tome of identify')] },
    { key: 'cube', title: 'Horadric Cube', rows: [row('c', 'ral rune')] },
  ];

  it('keeps every section without a search and only the matching rows and sections with one', () => {
    expect(filterStorageSections(sections, '  ', null).map((entry) => entry.rows.length)).toEqual([2, 1]);
    const shown = filterStorageSections(sections, 'shako', null);
    expect(shown.map((entry) => [entry.section.key, entry.rows.map((r) => r.key)])).toEqual([['inventory', ['a']]]);
  });
});
