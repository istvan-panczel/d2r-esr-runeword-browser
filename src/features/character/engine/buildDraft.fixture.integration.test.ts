/**
 * Builds a draft from every real ESR character save with the committed bundles and the fetched HTM fixtures. Skipped
 * without them: test-fixtures/character/ is gitignored (personal saves, never committed).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { RunewordItemRef, SetItemRef, UniqueItemRef } from '@/features/builds/buildData';
import { CHARM_MAX_LENGTH } from '@/features/builds/constants';
import type {
  CharSheetBundle,
  ItemTextBundle,
  LootFilterDataBundle,
  SetsBundle,
  StashBundle,
  StashNamesBundle,
  TxtRunewordsBundle,
  TypesBundle,
} from '@/features/game-data/engine/schema';
import { parseAscendancies } from '@/features/data-sync/parsers/ascendanciesParser';
import { parseGemwordsHtml } from '@/features/data-sync/parsers/gemwordsParser';
import { parseHtmUniqueItems } from '@/features/data-sync/parsers/htmUniqueItemsParser';
import { parseMythicalUniques } from '@/features/data-sync/parsers/mythicalUniquesParser';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import { stashCatalog, withNames } from '@/features/stash/engine/catalog';
import { createItemTextContext } from '@/features/stash/engine/items/itemText';
import { buildItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { createCharacterData } from '../parser/characterData';
import { parseCharacter } from '../parser/parseCharacter';
import { createBuildDraft, type BuildDraft, type BuildDraftData } from './buildDraft';
import { createSheetData } from './sheet';
import { draftFromSaveBytes } from './buildDraftRead';
import { statsFromSaveBytes } from './buildDraftStats';

const ROOT = resolve(__dirname, '../../../..');
const CHAR_DIR = resolve(ROOT, 'test-fixtures/character');
const HTM_DIR = resolve(ROOT, 'test-fixtures');
const json = <T>(name: string): T => JSON.parse(readFileSync(resolve(ROOT, 'public/game-data', `${name}.json`), 'utf-8')) as T;
const htm = (name: string) => readFileSync(resolve(HTM_DIR, name), 'utf-8');

const SAVES = [
  'SpinToWin',
  'Javazon',
  'ZealoProcadin',
  'Dudu',
  'EleBowazon',
  'PhysMagicBowazo',
  'Soso',
  'Trapsin',
  'Wawa',
  'Mefi',
  'cheat',
];
const READY = existsSync(resolve(CHAR_DIR, 'SpinToWin.d2s')) && existsSync(resolve(HTM_DIR, 'unique_weapons.htm'));

describe.skipIf(!READY)('build draft from the real saves', () => {
  const stash = json<StashBundle>('stash');
  const types = json<TypesBundle>('types');
  const itemText = json<ItemTextBundle>('itemtext');
  const catalog = stashCatalog(withNames(stash, json<StashNamesBundle>('stashnames')), buildItemTypeIndex(types.types));
  const withIds = <T>(rows: readonly T[]) => rows.map((row, id) => ({ ...row, id: id + 1 }));
  const data: BuildDraftData = {
    catalog,
    text: createItemTextContext(itemText, catalog),
    sets: json<SetsBundle>('sets'),
    txtRunewords: json<TxtRunewordsBundle>('runewords'),
    typeNames: new Map(types.types.map((type) => [type.code, type.name])),
    uniques: withIds([
      ...parseHtmUniqueItems(htm('unique_weapons.htm'), 'weapons'),
      ...parseHtmUniqueItems(htm('unique_armors.htm'), 'armors'),
      ...parseHtmUniqueItems(htm('unique_others.htm'), 'other'),
    ]),
    mythicals: withIds(parseMythicalUniques(htm('unique_mythicals.htm'))),
    runewords: parseRunewordsHtml(htm('runewords.htm')),
    gemwords: parseGemwordsHtml(htm('gemwords.htm')),
    ascendancies: parseAscendancies(htm('ascendancies.htm')).map((ascendancy) => ascendancy.name),
    skillIds: json<LootFilterDataBundle>('lootfilter').skillNames ?? [],
    skillNames: new Map(itemText.skills.map((skill) => [skill.id, skill.name])),
  };
  const characterData = createCharacterData(stash);
  const draftOf = (path: string): BuildDraft => {
    const file = parseCharacter(new Uint8Array(readFileSync(resolve(CHAR_DIR, path))), characterData);
    return createBuildDraft(file, data, path);
  };
  const drafts = new Map(SAVES.map((save) => [save, draftOf(`${save}.d2s`)]));
  const spin = drafts.get('SpinToWin') as BuildDraft;
  const spinVariant = spin.values.variants[0];

  it('matches 79 of the 99 equipped items, every named kind included', () => {
    const items = [...drafts.values()].flatMap((draft) => draft.report.items);
    const named = items.filter((item) => ['unique', 'mythical', 'set', 'runeword', 'gemword'].includes(item.kind));
    expect(items).toHaveLength(99);
    expect(items.filter((item) => item.outcome !== 'custom')).toHaveLength(79);
    expect(named).toHaveLength(79);
    expect(named.every((item) => item.outcome !== 'custom')).toBe(true);
    expect(items.filter((item) => item.outcome === 'custom')).toHaveLength(20);
    expect(items.filter((item) => item.kind === 'rare')).toHaveLength(12);
    expect(items.filter((item) => item.kind === 'magic')).toHaveLength(8);
  });

  it('reads SpinToWin as a level 102 Barbarian with its name, skills and ascendancy', () => {
    expect(spin.values.name).toBe('SpinToWin');
    expect(spin.values.characterClass).toBe('Barbarian');
    expect(spinVariant.level).toBe(102);
    expect(spinVariant.skills).toBe(
      'Left: Frenzy · Right: Whirlwind. Hotkeys: Battle Command, Battle Orders, Shout, Shade Armor, Teleport.'
    );
    expect(spinVariant.ascendancy).toBe('Blademaster');
    expect(Object.keys(spinVariant.skillPoints ?? {}).length).toBeGreaterThan(0);
    expect(spin.report.matched).toBe(11);
    expect(spin.report.total).toBe(11);
  });

  const SAVE_3304 = resolve(CHAR_DIR, 'ground-truth/spintowin-3.3.04/SpinToWin.d2s');
  it.skipIf(!existsSync(SAVE_3304))('reads the ascendancy of an ESR 3.3.04 save (no stone) from its saved stats', () => {
    const file = parseCharacter(new Uint8Array(readFileSync(SAVE_3304)), characterData);
    const sheetData = createSheetData(json<CharSheetBundle>('charsheet'), itemText);
    expect(createBuildDraft(file, data, 'SpinToWin.d2s', null, sheetData).values.variants[0].ascendancy).toBe('Blademaster');
    // Without the sheet data only a stone could tell, and the 3.3.04 save has none
    expect(createBuildDraft(file, data, 'SpinToWin.d2s').values.variants[0].ascendancy).toBeUndefined();
    // The old save's stone goes through the same data
    expect(
      createBuildDraft(
        parseCharacter(new Uint8Array(readFileSync(resolve(CHAR_DIR, 'SpinToWin.d2s'))), characterData),
        data,
        'SpinToWin.d2s',
        null,
        sheetData
      ).values.variants[0].ascendancy
    ).toBe('Blademaster');
  });

  it("puts Death's Grip in the belt slot it is really in, with the review flag and a note", () => {
    const belt = spinVariant.items?.belt as UniqueItemRef;
    expect(belt.type).toBe('unique');
    expect(belt.snapshot.name).toBe("Death's Grip");
    expect(spinVariant.itemNotes?.belt).toBe('On Merchant Belt');
    const row = spin.report.rows.find((candidate) => candidate.slot === 'belt');
    expect(row?.severity).toBe('check');
    expect(row?.message).toContain('in game on a Merchant Belt');
  });

  it('places Thunder Star in the weapon swap on both SpinToWin saves, with the same gear from both', () => {
    const swapped = draftOf('swap/SpinToWin.d2s').values.variants[0];
    for (const variant of [spinVariant, swapped]) {
      expect((variant.weaponSwap?.weapon2 as UniqueItemRef).snapshot.name).toBe('Thunder Star');
    }
    const gear = (variant: typeof spinVariant) => ({
      items: variant.items,
      weaponSwap: variant.weaponSwap,
      mercenary: variant.mercenary,
      itemNotes: variant.itemNotes,
    });
    expect(gear(swapped)).toEqual(gear(spinVariant));
  });

  it('merges charms of the charm inventory by name, without the ledger or the stone', () => {
    const charms = spinVariant.charms ?? [];
    expect(charms.length).toBeGreaterThan(0);
    expect(charms.length).toBeLessThanOrEqual(28);
    expect(charms.some((line) => /ledger|ascendancy stone/i.test(line))).toBe(false);
    // The stats come with the name, per-level ones at the character's level (102)
    expect(charms).toContain('Coral Small Charm: Lightning Resist +11%');
    expect(charms).toContain('Grand Charm of the Angel: +51 to Life (Based on Character Level)');
    // Same name, different rolls: both stay
    expect(charms.filter((line) => line.startsWith('Bitter Eye: '))).toHaveLength(2);
    expect(charms.filter((line) => line.startsWith('Grim Eye: '))).toHaveLength(2);
    // Nothing to roll: the name alone
    expect(charms).toContain('Abandon');
    const total = charms.reduce((sum, line) => sum + Number(/^(\d+)x /.exec(line)?.[1] ?? 1), 0);
    expect(total).toBe(28);
  });

  it('counts 110 charms across the geared saves', () => {
    const total = [...drafts.values()].flatMap((draft) => draft.values.variants[0].charms ?? []);
    const sum = total.reduce((acc, line) => acc + Number(/^(\d+)x /.exec(line)?.[1] ?? 1), 0);
    expect(sum).toBe(110);
  });

  it('keeps the runeword base and the jewels in free sockets', () => {
    const refs = [...drafts.values()].flatMap((draft) => Object.values(draft.values.variants[0].items ?? {}));
    const runewords = refs.filter((ref): ref is RunewordItemRef => ref?.type === 'runeword');
    expect(runewords.length).toBeGreaterThan(0);
    expect(runewords.every((ref) => ref.base !== undefined)).toBe(true);
    const sets = refs.filter((ref): ref is SetItemRef => ref?.type === 'set');
    expect(sets.length).toBeGreaterThan(0);
  });

  it.each(SAVES)('%s fits the build form limits', (save) => {
    const variant = (drafts.get(save) as BuildDraft).values.variants[0];
    expect((variant.skills ?? '').length).toBeLessThanOrEqual(2000);
    for (const charm of variant.charms ?? []) expect(charm.length).toBeLessThanOrEqual(CHARM_MAX_LENGTH);
  });
});

const GROUND_TRUTH_SAVE = resolve(CHAR_DIR, 'ground-truth/spintowin-2026-11-11/SpinToWin.d2s');

// The character stats a draft carries, against the in-game screen of 2026-11-11 (GROUND-TRUTH.md in that folder)
describe.skipIf(!READY || !existsSync(GROUND_TRUTH_SAVE))('build draft stats from the ground-truth save', () => {
  const stash = json<StashBundle>('stash');
  const types = json<TypesBundle>('types');
  const itemText = json<ItemTextBundle>('itemtext');
  const charsheet = json<CharSheetBundle>('charsheet');
  const catalog = stashCatalog(withNames(stash, json<StashNamesBundle>('stashnames')), buildItemTypeIndex(types.types));
  const data = {
    catalog,
    text: createItemTextContext(itemText, catalog),
    sets: json<SetsBundle>('sets'),
    txtRunewords: json<TxtRunewordsBundle>('runewords'),
    typeNames: new Map(types.types.map((type) => [type.code, type.name])),
    uniques: [],
    mythicals: [],
    runewords: [],
    gemwords: [],
    ascendancies: [],
    skillIds: [],
    skillNames: new Map(),
  } as unknown as BuildDraftData;
  const bytes = new Uint8Array(readFileSync(GROUND_TRUTH_SAVE));
  const SCREEN = {
    str: 986,
    dex: 746,
    vit: 493,
    ene: 118,
    life: 6080,
    mana: 791,
    fr: 79,
    cr: 79,
    lr: 79,
    pr: 79,
    mr: 38,
    phr: 50,
    frm: 79,
    crm: 79,
    lrm: 79,
    prm: 79,
    def: 73276,
    dr: 84,
    mdr: 60,
    ias: 205,
    // Frenzy on the left mouse button, main hand: the character screen's number
    ar: 61474,
    frw: 85,
    fhr: 10,
    fbr: 10,
    fcr: 100,
    arp: 505,
    ds: 100,
    cb: 82,
    ll: 158,
    ml: 20,
    mf: 417,
    gf: 302,
    sk: 10,
  };

  it('pre-fills the screen numbers for Hell, unbuffed, with the provenance', () => {
    const result = draftFromSaveBytes(bytes, 'SpinToWin.d2s', stash, data, '3.3.03', { charsheet, itemtext: itemText });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.report.stats).toBe('computed');
    const { stats } = result.draft.values.variants[0];
    expect(stats).toMatchObject({ source: 'save', difficulty: 2, character: 'SpinToWin', esrVersion: '3.3.03', values: SCREEN });
    expect(stats?.buffed).toBeUndefined();
    expect(stats?.arSkill).toBe('Frenzy');
    // Every cap is 79 (+4 max all resistances), the magic one too: stored, as it is above 75
    expect(stats?.values.mrm).toBe(79);
    expect(new TextEncoder().encode(JSON.stringify(stats)).length).toBeLessThan(1024);
  });

  it('Fill from a save file gives the same block', () => {
    const result = statsFromSaveBytes(bytes, 'SpinToWin.d2s', { stash, charsheet, itemtext: itemText });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stats).toMatchObject({ source: 'save', difficulty: 2, character: 'SpinToWin', values: SCREEN });
    if (result.ok) expect(result.stats).not.toHaveProperty('esrVersion');
  });

  it.each(SAVES)('%s gets stats from its save', (save) => {
    const result = statsFromSaveBytes(new Uint8Array(readFileSync(resolve(CHAR_DIR, `${save}.d2s`))), `${save}.d2s`, {
      stash,
      charsheet,
      itemtext: itemText,
    });
    expect(result.ok).toBe(true);
  });
});
