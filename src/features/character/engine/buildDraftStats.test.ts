import { describe, expect, it } from 'vitest';
import { asBuildStats } from '@/features/builds/buildStats';
import type { StashBundle, StashNamesBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { stashCatalog, withNames } from '@/features/stash/engine/catalog';
import { createItemTextContext } from '@/features/stash/engine/items/itemText';
import { buildItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSave } from '../parser/testCharacter';
import { createBuildDraft, type BuildDraftData } from './buildDraft';
import { draftFromSaveBytes } from './buildDraftRead';
import { buildStatsFromSnapshot, computeBuildStats, statsFromSaveBytes } from './buildDraftStats';
import { computeCharacterSheet, toStatsSnapshot } from './sheet';
import { charSheetBundle, equipped, item, itemTextBundle, sheetData, testCharacter } from './sheet/testSheet.mock';

const BARBARIAN = 4;
const L = 256;
const json = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', `${name}.json`), 'utf-8')) as T;
const STASH = json<StashBundle>('stash');
const TYPES = json<TypesBundle>('types');
const CATALOG = stashCatalog(withNames(STASH, json<StashNamesBundle>('stashnames')), buildItemTypeIndex(TYPES.types));

/** The committed bundles without the HTM item tables: every item becomes a custom item, which is all these tests need */
const EMPTY_DATA = {
  catalog: CATALOG,
  text: createItemTextContext(itemTextBundle, CATALOG),
  sets: { sets: [] },
  txtRunewords: { runewords: [] },
  typeNames: new Map(),
  uniques: [],
  mythicals: [],
  runewords: [],
  gemwords: [],
  ascendancies: [],
  skillIds: [],
  skillNames: new Map(),
} as unknown as BuildDraftData;

const hellBarbarian = () =>
  testCharacter({
    classId: BARBARIAN,
    level: 80,
    difficulty: 2,
    attributes: { strength: 150, dexterity: 60, vitality: 200, energy: 25, maxhp: 900 * L, maxmana: 100 * L },
    items: [
      item('cap', equipped('head'), [
        ['fireresist', 40],
        ['item_fasterattackrate', 20],
        ['item_magicbonus', 35],
      ]),
    ],
  });

describe('character stats from a save', () => {
  it('computes the sheet for the save difficulty, unbuffed, as the stored block', () => {
    const file = hellBarbarian();
    const stats = computeBuildStats(file, sheetData, '3.3.03');
    const sheet = computeCharacterSheet(file, sheetData);
    expect(stats).not.toBeNull();
    expect(stats).toMatchObject({ source: 'save', difficulty: 2, character: file.name, esrVersion: '3.3.03' });
    // The UTC day of the save only
    expect(stats?.savedAt).toBe(file.lastSavedAt - (file.lastSavedAt % 86_400));
    expect(stats?.buffed).toBeUndefined();
    expect(stats?.edited).toBeUndefined();
    expect(stats?.values).toMatchObject({
      str: sheet.attributes.strength.value,
      vit: sheet.attributes.vitality.value,
      life: sheet.life.value,
      mana: sheet.mana.value,
      // 40 − 150 (Hell penalty)
      fr: -110,
      ias: 20,
      mf: 35,
    });
    // Level stays on the variant; no shield, so no block chance; bonuses at 0 are left out, a 0 resistance is kept
    expect(stats?.values).not.toHaveProperty('lvl');
    expect(stats?.values).not.toHaveProperty('blk');
    expect(sheet.offense.deadlyStrike.value).toBe(0);
    expect(stats?.values).not.toHaveProperty('ds');
    expect(stats?.values).not.toHaveProperty('dod');
    expect(sheet.resists.magic.value).toBe(0);
    expect(stats?.values.mr).toBe(0);
    // What it stores reads back unchanged
    expect(asBuildStats(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
  });

  it('leaves the ESR version out when the sidecar is unknown', () => {
    expect(computeBuildStats(hellBarbarian(), sheetData, null)).not.toHaveProperty('esrVersion');
  });

  it('gives no stats for a parse that stopped inside the player items', () => {
    const file = { ...hellBarbarian(), incomplete: { section: 'player-items' } } as unknown as Parameters<typeof computeBuildStats>[0];
    expect(computeBuildStats(file, sheetData, null)).toBeNull();
    const later = { ...hellBarbarian(), incomplete: { section: 'merc-items' } } as unknown as Parameters<typeof computeBuildStats>[0];
    expect(computeBuildStats(later, sheetData, null)).not.toBeNull();
  });

  it('never throws: a sheet failure gives null', () => {
    const broken = { ...hellBarbarian(), attributes: null } as unknown as Parameters<typeof computeBuildStats>[0];
    expect(computeBuildStats(broken, sheetData, null)).toBeNull();
  });

  it('stores the attack rating of the left button skill, named; the base value only without a hand skill', () => {
    const snapshot = toStatsSnapshot(computeCharacterSheet(hellBarbarian(), sheetData), { savedAt: 1_794_387_009 });
    const withSkill = buildStatsFromSnapshot({ ...snapshot, ar: 61_474, ars: 'Frenzy' }, 'Tester');
    expect(withSkill?.values.ar).toBe(61_474);
    expect(withSkill?.arSkill).toBe('Frenzy');
    const base = buildStatsFromSnapshot({ ...snapshot, ars: undefined }, 'Tester');
    expect(base).not.toHaveProperty('arSkill');
  });

  it('stores a max resist only above 75 (the magic cap too) and rounds the save time to its UTC day', () => {
    const snapshot = toStatsSnapshot(computeCharacterSheet(hellBarbarian(), sheetData), { savedAt: 1_794_387_009 });
    const stats = buildStatsFromSnapshot({ ...snapshot, frm: 75, crm: 79, mrm: 80 }, 'Tester');
    expect(stats?.values).not.toHaveProperty('frm');
    expect(stats?.values.crm).toBe(79);
    expect(stats?.values.mrm).toBe(80);
    expect(stats?.savedAt).toBe(1_794_355_200);
  });

  it('keeps a snapshot buffed flag and drops numbers outside the stored ranges', () => {
    const snapshot = toStatsSnapshot(computeCharacterSheet(hellBarbarian(), sheetData), { savedAt: 1_794_387_009 });
    const stats = buildStatsFromSnapshot({ ...snapshot, buf: 1, dod: 500 }, 'Tester');
    expect(stats?.buffed).toBe(true);
    expect(stats?.values).not.toHaveProperty('dod');
  });
});

describe('createBuildDraft with stats', () => {
  it('puts the stats on the variant, last, and reports them', () => {
    const file = hellBarbarian();
    const draft = createBuildDraft(file, EMPTY_DATA, 'x.d2s', '3.3.03', sheetData);
    const [variant] = draft.values.variants;
    expect(variant.stats).toEqual(computeBuildStats(file, sheetData, '3.3.03'));
    expect(Object.keys(variant).at(-1)).toBe('stats');
    expect(draft.report.stats).toBe('computed');
  });

  it('comes without stats when the sheet data is missing, and says so', () => {
    const draft = createBuildDraft(hellBarbarian(), EMPTY_DATA, 'x.d2s');
    expect(draft.values.variants[0]).not.toHaveProperty('stats');
    expect(draft.report.stats).toBe('unavailable');
  });

  it('a sheet failure never blocks the import', () => {
    const broken = { ...hellBarbarian(), attributes: null } as unknown as Parameters<typeof createBuildDraft>[0];
    const draft = createBuildDraft(broken, EMPTY_DATA, 'x.d2s', null, sheetData);
    expect(draft.report.stats).toBe('unavailable');
    expect(draft.values.variants[0]).not.toHaveProperty('stats');
  });

  it('draftFromSaveBytes turns a parse failure into an error whether or not the sheet bundles are there', () => {
    const bundles = { charsheet: charSheetBundle, itemtext: itemTextBundle };
    const result = draftFromSaveBytes(new Uint8Array(32), 'bad.d2s', STASH, EMPTY_DATA, null, bundles);
    expect(result.ok).toBe(false);
  });
});

// The success path reads real saves (the synthetic save needs the parser's own test data, not stash.json): see
// buildDraft.fixture.integration.test.ts
describe('statsFromSaveBytes (Fill from a save file)', () => {
  const bundles = { stash: STASH, charsheet: charSheetBundle, itemtext: itemTextBundle };

  it('turns a broken file into an error to show, never a throw', () => {
    const bad = statsFromSaveBytes(new Uint8Array([1, 2, 3]), 'bad.d2s', bundles);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.title).toBe('Could not read this save');
    const empty = statsFromSaveBytes(buildSave({ level: 40 }), 's.d2s', bundles);
    expect(empty.ok).toBe(false);
  });
});
