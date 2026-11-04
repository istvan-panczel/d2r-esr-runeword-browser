import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { UniqueOrSetRow } from './itemNames.ts';
import type { TintRef } from './itemTint.ts';
import {
  artKey,
  artKeyCandidates,
  assetSlug,
  buildIconsBundle,
  buildSpriteIndex,
  compareWithoutVanilla,
  cropRgba,
  fitInside,
  listFilesRecursive,
  opaqueBounds,
  parseBuildConfigRoot,
  parseItemAssets,
  parseNamedArt,
  MISC_ICON_TYPES,
  planItemIcons,
  QUEST_ICON_TYPES,
  resolveArt,
  resolveSprite,
  selectMiscIconRows,
  readItemNames,
  selectQuestIconCodes,
} from './itemIcons.ts';
import type { IconsBundle, LootFilterItem } from '../engine/schema.ts';
import { parseTsv } from './tsv.ts';
import { serializeBundle } from './writeBundle.ts';

describe('parseItemAssets', () => {
  it('maps codes to assets, keeps the first of a repeated code and skips malformed entries', () => {
    const { assets, duplicates } = parseItemAssets([
      { hax: { asset: 'axe/hand_axe' } },
      { r33: { asset: 'rune/Moon_rune' } },
      { hax: { asset: 'axe/other' } },
      { bad: { nope: 1 } },
      { empty: { asset: '' } },
      'junk',
    ]);
    expect([...assets]).toEqual([
      ['hax', 'axe/hand_axe'],
      ['r33', 'rune/Moon_rune'],
    ]);
    expect(duplicates).toEqual(['hax']);
  });

  it('rejects a non-array', () => {
    expect(() => parseItemAssets({})).toThrow(/array/);
  });
});

describe('sprite resolution', () => {
  const index = buildSpriteIndex([
    'weapon/axe/hand_axe.sprite',
    'misc/rune/moon_rune.sprite',
    'armor/helmet/Cap.sprite',
    'armor/helmet/cap.lowend.sprite.txt',
    'armor/helmet/cap.lowend.sprite',
    'misc/readme.txt',
  ]);

  it('indexes only .sprite files (not the .lowend halves) by lowercased path', () => {
    expect([...index.keys()].sort()).toEqual(['armor/helmet/cap', 'misc/rune/moon_rune', 'weapon/axe/hand_axe']);
  });

  it('resolves an asset in whichever folder holds it, ignoring letter case', () => {
    expect(resolveSprite('axe/hand_axe', index)).toBe('weapon/axe/hand_axe.sprite');
    expect(resolveSprite('rune/Moon_rune', index)).toBe('misc/rune/moon_rune.sprite');
    expect(resolveSprite('helmet/cap', index)).toBe('armor/helmet/Cap.sprite');
    expect(resolveSprite('sword/short_sword', index)).toBeNull();
  });

  it('plans one sprite per distinct asset and reports missing entries and vanilla art', () => {
    const assets = new Map([
      ['hax', 'axe/hand_axe'],
      ['9ha', 'axe/hand_axe'],
      ['ssd', 'sword/short_sword'],
      ['r33', 'rune/Moon_rune'],
    ]);
    const plan = planItemIcons({
      codes: ['hax', '9ha', 'ssd', 'zzz', 'r33', 'hax'],
      uniques: [],
      sets: [],
      assets,
      uniqueArt: new Map(),
      setArt: new Map(),
      index,
    });
    expect([...plan.bases]).toEqual([
      ['hax', 'axe_hand_axe'],
      ['9ha', 'axe_hand_axe'],
      ['r33', 'rune_moon_rune'],
    ]);
    expect([...plan.sprites]).toEqual([
      ['axe_hand_axe', { source: 'esr', path: 'weapon/axe/hand_axe.sprite' }],
      ['rune_moon_rune', { source: 'esr', path: 'misc/rune/moon_rune.sprite' }],
    ]);
    expect(plan.basesFromVanilla).toBe(0);
    expect(plan.missingEntry).toEqual(['zzz']);
    expect(plan.missingArt).toEqual(['ssd']);
  });

  it('slugs asset paths into flat lowercase file names', () => {
    expect(assetSlug('axe/Hand_Axe')).toBe('axe_hand_axe');
    expect(assetSlug('ring/ring 1')).toBe('ring_ring-1');
  });

  it('lists a real directory tree with / separators (case kept)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'item-icons-'));
    try {
      mkdirSync(join(dir, 'misc', 'rune'), { recursive: true });
      writeFileSync(join(dir, 'misc', 'rune', 'Moon_Rune.sprite'), '');
      writeFileSync(join(dir, 'top.sprite'), '');
      const files = listFilesRecursive(dir);
      expect(files).toEqual(['misc/rune/Moon_Rune.sprite', 'top.sprite']);
      expect(resolveSprite('rune/moon_rune', buildSpriteIndex(files))).toBe('misc/rune/Moon_Rune.sprite');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('unique and set item art', () => {
  const index = buildSpriteIndex([
    'weapon/axe/hand_axe.sprite',
    'weapon/axe/the_gnasher.sprite',
    'weapon/bow/mythical_buriza.sprite',
    'armor/helmet/cap.sprite',
  ]);
  const assets = new Map([
    ['hax', 'axe/hand_axe'],
    ['cap', 'helmet/cap'],
    ['lbt', 'boot/boots'],
  ]);
  const row = (index: string, name: string, code: string, disabled = false): UniqueOrSetRow => ({
    id: 0,
    index,
    name,
    code,
    disabled,
    invTransform: '',
  });

  it('slugs a txt index or an art key the same way', () => {
    expect(artKey("Civerb's Ward")).toBe('civerbs_ward');
    expect(artKey('Buriza-Do Kyanon')).toBe('buriza_do_kyanon');
    expect(artKey('BlackKnights_Holy_Signet')).toBe(artKey("BlackKnight's Holy Signet"));
    expect(artKey('scourge of_the_twin_seas')).toBe('scourge_of_the_twin_seas');
    expect(artKeyCandidates('Stormshield_lod')).toEqual(['stormshield_lod', 'stormshield']);
    expect(artKeyCandidates('Cutthroat1')).toEqual(['cutthroat1', 'cutthroat_1']);
  });

  it('parses the art maps: normal first, then uber / ultra, first key wins, `_new` aliases', () => {
    const { art, duplicates } = parseNamedArt(
      [
        { The_Gnasher: { normal: 'axe/the_gnasher', uber: 'axe/x', ultra: 'axe/y' } },
        { only_uber: { uber: 'axe/uber_only', ultra: 'axe/ultra_only' } },
        { the_gnasher: { normal: 'axe/other' } },
        { hellfire_torch_new: { normal: 'charm/torch' } },
        { broken: 'nope' },
      ],
      'uniques.json'
    );
    expect([...art]).toEqual([
      ['the_gnasher', 'axe/the_gnasher'],
      ['only_uber', 'axe/uber_only'],
      ['hellfire_torch_new', 'charm/torch'],
      ['hellfire_torch', 'charm/torch'],
    ]);
    expect(duplicates).toEqual(['the_gnasher']);
    expect(() => parseNamedArt({}, 'sets.json')).toThrow(/sets\.json/);
  });

  it('uses own art, else the base art, one icon per display name', () => {
    const uniqueArt = new Map([
      ['the_gnasher', 'axe/the_gnasher'],
      ['plain_axe', 'axe/hand_axe'],
      ['vanilla_own', 'axe/not_in_clone'],
      ['mythical_buriza', 'bow/mythical_buriza'],
      ['never_used', 'axe/the_gnasher'],
    ]);
    const plan = planItemIcons({
      codes: [],
      uniques: [
        row('The Gnasher', 'The Gnasher', 'hax'),
        row('Plain Axe', 'Plain Axe', 'hax'),
        row('Vanilla Own', 'Vanilla Own', 'cap'),
        row('Nothing', 'Nothing', 'lbt'),
        row('Old Buriza', 'Buriza', 'hax'),
        row('Mythical Buriza', 'Buriza', 'hax', true),
        row('Twin', 'Twin', 'cap'),
        row('The Gnasher', 'Twin', 'hax'),
      ],
      sets: [row("Civerb's Ward", "Civerb's Ward", 'cap')],
      assets,
      uniqueArt,
      setArt: new Map(),
      index,
    });
    expect([...plan.uniques]).toEqual([
      ['The Gnasher', 'axe_the_gnasher'],
      ['Plain Axe', 'axe_hand_axe'],
      ['Vanilla Own', 'helmet_cap'],
      // A disabled row never replaces an enabled one; an enabled row with own art replaces base art
      ['Buriza', 'axe_hand_axe'],
      ['Twin', 'axe_the_gnasher'],
    ]);
    expect(plan.uniqueStats).toEqual({
      requested: 6,
      own: 2,
      base: 3,
      none: 1,
      vanilla: 0,
      ownArtMissing: 1,
      noneNames: ['Nothing'],
      vanillaKeyUsed: [],
      vanillaKeyRejected: [],
      unusedKeys: ['never_used'],
    });
    expect([...plan.sets]).toEqual([["Civerb's Ward", 'helmet_cap']]);
    expect(plan.sprites.get('axe_the_gnasher')).toEqual({ source: 'esr', path: 'weapon/axe/the_gnasher.sprite' });
  });

  it('records the row behind each icon (own art or not, base code, colour code) for the colour transforms', () => {
    const plan = planItemIcons({
      codes: [],
      uniques: [
        { ...row('The Gnasher', 'The Gnasher', 'hax'), invTransform: 'cred' },
        { ...row('Plain Axe', 'Plain Axe', 'hax'), invTransform: 'blac' },
        row('Nothing', 'Nothing', 'lbt'),
      ],
      sets: [],
      assets,
      uniqueArt: new Map([['the_gnasher', 'axe/the_gnasher']]),
      setArt: new Map(),
      index,
    });
    expect([...plan.uniqueChoices]).toEqual([
      ['The Gnasher', { slug: 'axe_the_gnasher', own: true, code: 'hax', invTransform: 'cred' }],
      ['Plain Axe', { slug: 'axe_hand_axe', own: false, code: 'hax', invTransform: 'blac' }],
    ]);
  });
});

describe('two art sources (ESR clone first, vanilla folder as the fallback)', () => {
  const esr = buildSpriteIndex(['weapon/axe/hand_axe.sprite', 'weapon/axe/the_gnasher.sprite', 'weapon/bow/mythical_buriza.sprite']);
  const vanilla = buildSpriteIndex([
    'weapon/axe/Hand_Axe.sprite',
    'weapon/axe/the_gnasher.sprite',
    'armor/boot/boots.sprite',
    'armor/boot/boots.lowend.sprite',
    'armor/helmet/cap.sprite',
    'weapon/bow/hellcast.sprite',
    'armor/armor/plate_mail.sprite',
    'weapon/sword/dreadfang.sprite',
  ]);
  const row = (index: string, name: string, code: string, disabled = false): UniqueOrSetRow => ({
    id: 0,
    index,
    name,
    code,
    disabled,
    invTransform: '',
  });

  it('resolves an asset in the clone first, then in the vanilla folder', () => {
    expect(resolveArt('axe/hand_axe', esr, vanilla)).toEqual({ source: 'esr', path: 'weapon/axe/hand_axe.sprite' });
    expect(resolveArt('boot/boots', esr, vanilla)).toEqual({ source: 'vanilla', path: 'armor/boot/boots.sprite' });
    expect(resolveArt('boot/boots', esr, undefined)).toBeNull();
    expect(resolveArt('ring/ring', esr, vanilla)).toBeNull();
  });

  it('fills bases from the vanilla art and the vanilla items.json; the mod entries win', () => {
    const plan = planItemIcons({
      codes: ['hax', 'lbt', 'cap', 'zzz'],
      uniques: [],
      sets: [],
      // The mod maps cap to an asset neither source has; the vanilla map is not consulted for a code the mod lists
      assets: new Map([
        ['hax', 'axe/hand_axe'],
        ['lbt', 'boot/boots'],
        ['cap', 'helmet/esr_cap'],
      ]),
      uniqueArt: new Map(),
      setArt: new Map(),
      index: esr,
      vanilla: {
        index: vanilla,
        assets: new Map([
          ['hax', 'axe/other'],
          ['cap', 'helmet/cap'],
          ['zzz', 'helmet/cap'],
        ]),
        uniqueArt: new Map(),
        setArt: new Map(),
      },
    });
    expect([...plan.bases]).toEqual([
      ['hax', 'axe_hand_axe'],
      ['lbt', 'boot_boots'],
      ['zzz', 'helmet_cap'],
    ]);
    expect(plan.basesFromVanilla).toBe(2);
    expect(plan.missingArt).toEqual(['cap']);
    expect(plan.sprites.get('axe_hand_axe')).toEqual({ source: 'esr', path: 'weapon/axe/hand_axe.sprite' });
    expect(plan.sprites.get('boot_boots')).toEqual({ source: 'vanilla', path: 'armor/boot/boots.sprite' });
  });

  it('uses vanilla own art and vanilla art-map keys, prefers ESR art within a rank and checks the asset folder', () => {
    const plan = planItemIcons({
      codes: [],
      uniques: [
        // Own art entry in the mod's map, sprite only in the vanilla folder
        row('Buriza-Do Kyanon', 'Buriza', 'hax'),
        // Same name, own ESR art: replaces the vanilla own art (same rank, ESR wins)
        row('Mythical Buriza', 'Buriza', 'hax'),
        // Key only in the vanilla map, same asset folder as the base: used
        row('Dreadfang', 'Dreadfang', 'ssd'),
        // Key only in the vanilla map, other folder than the base (ESR's shield, vanilla's armor): ignored
        row('Guardian Angel', 'Guardian Angel', 'cap'),
        row('Plain', 'Plain', 'lbt'),
      ],
      sets: [],
      assets: new Map([
        ['hax', 'axe/hand_axe'],
        ['ssd', 'sword/short_sword'],
        ['cap', 'helmet/cap'],
        ['lbt', 'boot/boots'],
      ]),
      uniqueArt: new Map([
        ['buriza_do_kyanon', 'bow/hellcast'],
        ['mythical_buriza', 'bow/mythical_buriza'],
      ]),
      setArt: new Map(),
      index: esr,
      vanilla: {
        index: vanilla,
        assets: new Map(),
        uniqueArt: new Map([
          ['dreadfang', 'sword/dreadfang'],
          ['guardian_angel', 'armor/plate_mail'],
          ['mythical_buriza', 'bow/hellcast'],
        ]),
        setArt: new Map(),
      },
    });
    expect([...plan.uniques]).toEqual([
      ['Buriza', 'bow_mythical_buriza'],
      ['Dreadfang', 'sword_dreadfang'],
      ['Guardian Angel', 'helmet_cap'],
      ['Plain', 'boot_boots'],
    ]);
    expect(plan.uniqueStats).toMatchObject({
      requested: 4,
      own: 2,
      base: 2,
      none: 0,
      vanilla: 3,
      vanillaKeyUsed: ['Dreadfang'],
      vanillaKeyRejected: ['Guardian Angel'],
      unusedKeys: [],
    });
    // A replaced pick leaves no sprite behind
    expect(plan.sprites.has('bow_hellcast')).toBe(false);
  });

  it('reads the root hash of a Steam build config', () => {
    expect(parseBuildConfigRoot('# Static Build Configuration\n\nroot = 06a0ca43e82f06e0\nvfs-root = 563 5b4\n')).toBe('06a0ca43e82f06e0');
    expect(parseBuildConfigRoot('vfs-root = 563\n')).toBeNull();
  });
});

describe('misc item art (socket fillers)', () => {
  const item = (code: string, name: string, type: string, extra: Partial<LootFilterItem> = {}): LootFilterItem => ({
    code,
    name,
    kind: 'misc',
    type,
    spawnable: true,
    drops: true,
    ...extra,
  });
  const ancestors = new Map([
    ['rune', ['rune', 'sock', 'misc']],
    ['gema', ['gema', 'gem', 'sock', 'misc']],
    ['gem0', ['gem0', 'gem', 'sock', 'misc']],
    ['jewl', ['jewl', 'sock', 'misc']],
    ['elix', ['elix', 'misc']],
  ]);

  it('selects the misc rows whose type or type2 descends from a scope type', () => {
    expect(MISC_ICON_TYPES).toEqual(['gem', 'rune']);
    const rows = selectMiscIconRows(
      [
        item('r01', 'El Rune', 'rune'),
        item('gcv', 'Chipped Amethyst', 'gema', { type2: 'gem0' }),
        item('xx1', 'Odd Gem', 'elix', { type2: 'gem0', spawnable: false }),
        item('jew', 'Jewel', 'jewl'),
        item('elx', 'Elixir', 'elix'),
        item('zzz', 'Unknown Type', 'none'),
        item('r02', 'Weapon Rune', 'rune', { kind: 'weapon' }),
      ],
      ancestors
    );
    expect(rows).toEqual([
      { code: 'r01', name: 'El Rune', enabled: true },
      { code: 'gcv', name: 'Chipped Amethyst', enabled: true },
      { code: 'xx1', name: 'Odd Gem', enabled: false },
    ]);
    // The scope list can grow: jewels in
    expect(selectMiscIconRows([item('jew', 'Jewel', 'jewl')], ancestors, ['jewl']).map((row) => row.code)).toEqual(['jew']);
  });

  it("keys the code's art by name, prefers spawnable rows and keys a name per code when its rows differ in art", () => {
    const plan = planItemIcons({
      codes: [],
      uniques: [],
      sets: [],
      misc: [
        { code: 'r68', name: 'Ko Rune', enabled: true },
        { code: 'r19', name: 'Ko Rune', enabled: true },
        // Same name, one row without art: the row with art
        { code: 'r32', name: 'Fu Rune', enabled: true },
        { code: 'r48', name: 'Fu Rune', enabled: true },
        // A non-spawnable row loses to a spawnable one
        { code: 'old', name: 'El Rune', enabled: false },
        { code: 'r51', name: 'El Rune', enabled: true },
        // Two rows with the same art: one plain key
        { code: 'gcv', name: 'Amethyst', enabled: true },
        { code: 'gc2', name: 'Amethyst', enabled: true },
        { code: 'nop', name: 'No Art', enabled: true },
        { code: 'van', name: 'Vanilla Gem', enabled: false },
      ],
      assets: new Map([
        ['r68', 'rune/ko_lod_rune'],
        ['r19', 'rune/Ko_rune'],
        ['r32', 'rune/Fu_rune'],
        ['old', 'rune/old_el'],
        ['r51', 'rune/el_rune'],
        ['gcv', 'gem/amethyst'],
        ['gc2', 'gem/amethyst'],
        ['nop', 'gem/missing'],
      ]),
      uniqueArt: new Map(),
      setArt: new Map(),
      index: buildSpriteIndex([
        'misc/rune/ko_lod_rune.sprite',
        'misc/rune/ko_rune.sprite',
        'misc/rune/fu_rune.sprite',
        'misc/rune/old_el.sprite',
        'misc/rune/el_rune.sprite',
        'misc/gem/amethyst.sprite',
      ]),
      vanilla: {
        index: buildSpriteIndex(['misc/gem/vanilla_gem.sprite']),
        assets: new Map([['van', 'gem/vanilla_gem']]),
        uniqueArt: new Map(),
        setArt: new Map(),
      },
    });
    expect([...plan.misc]).toEqual([
      ['Ko Rune#r68', 'rune_ko_lod_rune'],
      ['Ko Rune#r19', 'rune_ko_rune'],
      ['Fu Rune', 'rune_fu_rune'],
      ['El Rune', 'rune_el_rune'],
      ['Amethyst', 'gem_amethyst'],
      ['Vanilla Gem', 'gem_vanilla_gem'],
    ]);
    expect(plan.sprites.has('rune_old_el')).toBe(false);
    expect(plan.sprites.get('gem_vanilla_gem')).toEqual({ source: 'vanilla', path: 'misc/gem/vanilla_gem.sprite' });
    expect(plan.miscStats).toEqual({ requested: 6, withArt: 5, vanilla: 1, noneNames: ['No Art'], splitNames: ['Ko Rune'] });
  });
});

describe('quest item art', () => {
  const table = (rows: string[][]) => parseTsv(rows.map((cells) => cells.join('\t')).join('\n'), 'items.txt');

  it('selects the rows with a quest number or a quest icon type, by code, without repeats', () => {
    expect(QUEST_ICON_TYPES).toEqual(['ques', 'mmap']);
    const misc = table([
      ['name', 'code', 'type', 'type2', 'quest'],
      ['viper amulet', 'vip', 'vamu', '', '10'],
      ['Key of Terror', 'pk1', 'ques', '', ''],
      ['Tier 1 Map', 'z01', 'mmap', '', ''],
      ['Ring', 'rin', 'ring', '', '0'],
      ['Odd', 'odd', 'misc', 'ques', ''],
      ['Repeat', 'vip', 'ques', '', ''],
      ['Blank', '', 'ques', '', ''],
    ]);
    // weapons.txt-like table without type2
    const weapons = table([
      ['name', 'code', 'type', 'quest'],
      ['Horadric Staff', 'hst', 'staf', '10'],
      ['Hand Axe', 'hax', 'axe', ''],
    ]);
    expect(selectQuestIconCodes([misc, weapons])).toEqual(['vip', 'pk1', 'z01', 'odd', 'hst']);
  });

  it('names item codes by their first row, as stashnames.json does (namestr, else name; belt abbreviations in full)', () => {
    const misc = table([
      ['name', 'code', 'namestr'],
      ['viper amulet', 'vip', 'vip'],
      ['Thawing Potion', 'wms', 'wms'],
      ['No String', 'nos', 'missing'],
      ['Repeat', 'vip', 'other'],
    ]);
    const strings = new Map([
      ['vip', 'Top of the Horadric Staff'],
      ['wms', '*Thaw'],
      ['other', 'Other'],
    ]);
    expect([...readItemNames([misc], strings)]).toEqual([
      ['vip', 'Top of the Horadric Staff'],
      ['wms', 'Thawing Potion'],
      ['nos', 'No String'],
    ]);
  });

  it("keys the code's art by code and lists the codes without art", () => {
    const plan = planItemIcons({
      codes: ['hax'],
      uniques: [],
      sets: [],
      quest: ['vip', 'hst', 'nop', 'gone', 'vip'],
      assets: new Map([
        ['hax', 'axe/hand_axe'],
        ['vip', 'amulet/viper_amulet'],
        ['nop', 'quest/missing'],
      ]),
      uniqueArt: new Map(),
      setArt: new Map(),
      index: buildSpriteIndex(['weapon/axe/hand_axe.sprite', 'misc/amulet/viper_amulet.sprite']),
      vanilla: {
        index: buildSpriteIndex(['weapon/staff/horadric_staff.sprite']),
        assets: new Map([['hst', 'staff/horadric_staff']]),
        uniqueArt: new Map(),
        setArt: new Map(),
      },
    });
    expect([...plan.quest]).toEqual([
      ['vip', 'amulet_viper_amulet'],
      ['hst', 'staff_horadric_staff'],
    ]);
    expect([...plan.bases]).toEqual([['hax', 'axe_hand_axe']]);
    expect(plan.questStats).toEqual({ requested: 4, vanilla: 1, missing: ['gone', 'nop'] });
  });
});

describe('compareWithoutVanilla', () => {
  const axe = { file: 'axe_hand_axe.webp', w: 58, h: 128 };
  const boots = { file: 'boot_boots.webp', w: 100, h: 90 };
  const committed: IconsBundle = {
    esrVersion: '3.2.24',
    esrTag: '3.2.24',
    vanilla: { rootHash: 'abc', extractedAt: '2026-10-25', files: ['boot_boots.webp'] },
    bases: { hax: axe, lbt: boots },
    uniques: { Plain: boots, Gnasher: axe },
    sets: {},
    misc: { 'El Rune': axe },
    quest: { vip: { ...axe, name: 'Top of the Horadric Staff' } },
  };
  const esrOnly: IconsBundle = {
    esrVersion: '3.2.24',
    esrTag: '3.2.24',
    bases: { hax: axe },
    uniques: { Plain: axe, Gnasher: axe },
    sets: {},
    misc: { 'El Rune': axe },
    quest: { vip: { ...axe, name: 'Top of the Horadric Staff' } },
  };

  it('accepts the committed vanilla-derived entries and matching clone-derived ones', () => {
    expect(compareWithoutVanilla(committed, esrOnly)).toEqual([]);
  });

  it('reports clone-derived differences, new entries, a version change and vanilla files the clone now ships', () => {
    const fresh: IconsBundle = {
      esrVersion: '3.2.25',
      esrTag: null,
      bases: { hax: { ...axe, w: 60 }, lbt: boots, new: axe },
      uniques: { Plain: axe },
      sets: {},
      misc: { 'El Rune': boots },
      quest: {},
    };
    expect(compareWithoutVanilla(committed, fresh)).toEqual([
      'esrVersion 3.2.24 ≠ 3.2.25',
      'esrTag 3.2.24 ≠ null',
      'bases/hax: axe_hand_axe.webp 58×128 ≠ axe_hand_axe.webp 60×128',
      'bases/lbt: boot_boots.webp is now in the clone',
      'bases/new: missing',
      "uniques/Gnasher: not produced by the clone's art",
      'misc/El Rune: axe_hand_axe.webp 58×128 ≠ boot_boots.webp 100×90',
      "quest/vip: not produced by the clone's art",
    ]);
  });

  it('compares recoloured entries through their untinted file', () => {
    const tint = { map: 'invgreybrown', color: 'cred' };
    const withTints: IconsBundle = {
      ...committed,
      uniques: {
        Plain: { ...boots, file: 'boot_boots__invgreybrown-cred.webp', tint },
        Gnasher: { ...axe, file: 'axe_hand_axe__invgreybrown-cred.webp', tint },
      },
    };
    expect(compareWithoutVanilla(withTints, esrOnly)).toEqual([]);
    const otherSize = {
      ...withTints,
      uniques: { ...withTints.uniques, Gnasher: { ...axe, w: 50, file: 'axe_hand_axe__invgreybrown-cred.webp', tint } },
    };
    expect(compareWithoutVanilla(otherSize, esrOnly)).toEqual(['uniques/Gnasher: axe_hand_axe.webp 50×128 ≠ axe_hand_axe.webp 58×128']);
  });
});

describe('cropping and sizing', () => {
  // 4×3 image with two opaque pixels at (1,0) and (2,2)
  const rgba = new Uint8Array(4 * 3 * 4);
  rgba.set([10, 20, 30, 255], (0 * 4 + 1) * 4);
  rgba.set([40, 50, 60, 1], (2 * 4 + 2) * 4);

  it('finds the box of the pixels with any alpha', () => {
    expect(opaqueBounds(4, 3, rgba)).toEqual({ x: 1, y: 0, width: 2, height: 3 });
    expect(opaqueBounds(2, 2, new Uint8Array(16))).toBeNull();
  });

  it('copies the box row by row', () => {
    const cropped = cropRgba(4, rgba, { x: 1, y: 0, width: 2, height: 3 });
    expect(cropped).toHaveLength(2 * 3 * 4);
    expect(Array.from(cropped.subarray(0, 4))).toEqual([10, 20, 30, 255]);
    expect(Array.from(cropped.subarray((2 * 2 + 1) * 4, (2 * 2 + 2) * 4))).toEqual([40, 50, 60, 1]);
  });

  it('fits inside the square keeping the aspect ratio and never enlarges', () => {
    expect(fitInside(196, 294)).toEqual({ width: 85, height: 128 });
    expect(fitInside(98, 294)).toEqual({ width: 43, height: 128 });
    expect(fitInside(300, 100)).toEqual({ width: 128, height: 43 });
    expect(fitInside(60, 90)).toEqual({ width: 60, height: 90 });
    expect(fitInside(1000, 1)).toEqual({ width: 128, height: 1 });
  });
});

describe('buildIconsBundle', () => {
  it('lists the entries with an encoded image, sharing the file of a shared asset', () => {
    const bundle = buildIconsBundle({
      esrVersion: '3.2.24',
      esrTag: '3.2.24',
      plan: {
        bases: new Map([
          ['hax', 'axe_hand_axe'],
          ['9ha', 'axe_hand_axe'],
          ['r33', 'rune_moon_rune'],
        ]),
        uniques: new Map([
          ['The Gnasher', 'axe_the_gnasher'],
          ['Axe Unique', 'axe_hand_axe'],
        ]),
        sets: new Map([["Civerb's Ward", 'rune_moon_rune']]),
        misc: new Map([
          ['El Rune', 'axe_hand_axe'],
          ['Ko Rune#r19', 'axe_the_gnasher'],
          ['Moon Rune', 'rune_moon_rune'],
        ]),
        quest: new Map([
          ['vip', 'axe_the_gnasher'],
          ['hst', 'rune_moon_rune'],
        ]),
        sprites: new Map(),
      },
      itemNames: new Map([['vip', 'Top of the Horadric Staff']]),
      images: new Map([
        ['axe_hand_axe', { width: 58, height: 128 }],
        ['axe_the_gnasher', { width: 60, height: 120 }],
      ]),
      extension: 'webp',
    });
    expect(bundle).toEqual({
      esrVersion: '3.2.24',
      esrTag: '3.2.24',
      bases: {
        hax: { file: 'axe_hand_axe.webp', w: 58, h: 128 },
        '9ha': { file: 'axe_hand_axe.webp', w: 58, h: 128 },
      },
      uniques: {
        'The Gnasher': { file: 'axe_the_gnasher.webp', w: 60, h: 120 },
        'Axe Unique': { file: 'axe_hand_axe.webp', w: 58, h: 128 },
      },
      sets: {},
      misc: {
        'El Rune': { file: 'axe_hand_axe.webp', w: 58, h: 128 },
        'Ko Rune#r19': { file: 'axe_the_gnasher.webp', w: 60, h: 120 },
      },
      quest: { vip: { file: 'axe_the_gnasher.webp', w: 60, h: 120, name: 'Top of the Horadric Staff' } },
    });
    expect(Object.keys(JSON.parse(serializeBundle(bundle)) as object)).toEqual([
      'esrVersion',
      'esrTag',
      'bases',
      'uniques',
      'sets',
      'misc',
      'quest',
    ]);
  });

  it('points recoloured unique / set entries at their variant file and records the tint', () => {
    const tint: TintRef = { slug: 'axe_hand_axe__invgreybrown-cred', source: 'axe_hand_axe', map: 'invgreybrown', color: 'cred' };
    const bundle = buildIconsBundle({
      esrVersion: '3.2.24',
      esrTag: null,
      plan: {
        bases: new Map([['hax', 'axe_hand_axe']]),
        uniques: new Map([
          ['Red Axe', 'axe_hand_axe'],
          ['Lost Tint', 'axe_hand_axe'],
        ]),
        sets: new Map([['Red Set Axe', 'axe_hand_axe']]),
        sprites: new Map(),
      },
      tints: {
        uniques: new Map([
          ['Red Axe', tint],
          // No image for the variant (encoding skipped): the untinted file
          ['Lost Tint', { ...tint, slug: 'axe_hand_axe__invgreybrown-blac', color: 'blac' }],
        ]),
        sets: new Map([['Red Set Axe', tint]]),
      },
      images: new Map([
        ['axe_hand_axe', { width: 58, height: 128 }],
        ['axe_hand_axe__invgreybrown-cred', { width: 58, height: 128 }],
      ]),
      extension: 'webp',
    });
    const red = { file: 'axe_hand_axe__invgreybrown-cred.webp', w: 58, h: 128, tint: { map: 'invgreybrown', color: 'cred' } };
    expect(bundle.bases).toEqual({ hax: { file: 'axe_hand_axe.webp', w: 58, h: 128 } });
    expect(bundle.uniques).toEqual({ 'Red Axe': red, 'Lost Tint': { file: 'axe_hand_axe.webp', w: 58, h: 128 } });
    expect(bundle.sets).toEqual({ 'Red Set Axe': red });
  });

  it('records the vanilla provenance and the files made from vanilla sprites, only when any were', () => {
    const plan = {
      bases: new Map([
        ['hax', 'axe_hand_axe'],
        ['lbt', 'boot_boots'],
        ['cap', 'helmet_cap'],
      ]),
      uniques: new Map(),
      sets: new Map(),
      sprites: new Map([
        ['axe_hand_axe', { source: 'esr' as const, path: 'weapon/axe/hand_axe.sprite' }],
        ['helmet_cap', { source: 'vanilla' as const, path: 'armor/helmet/cap.sprite' }],
        ['boot_boots', { source: 'vanilla' as const, path: 'armor/boot/boots.sprite' }],
      ]),
    };
    const images = new Map([
      ['axe_hand_axe', { width: 58, height: 128 }],
      ['boot_boots', { width: 100, height: 90 }],
    ]);
    const vanilla = { rootHash: 'abc', extractedAt: '2026-10-25' };
    const bundle = buildIconsBundle({ esrVersion: '3.2.24', esrTag: null, vanilla, plan, images, extension: 'webp' });
    // helmet_cap failed to decode: neither an entry nor a listed file
    expect(bundle.vanilla).toEqual({ ...vanilla, files: ['boot_boots.webp'] });
    expect(Object.keys(bundle)).toEqual(['esrVersion', 'esrTag', 'vanilla', 'bases', 'uniques', 'sets', 'misc', 'quest']);
    // No misc rows or quest codes planned: empty sections
    expect(bundle.misc).toEqual({});
    expect(bundle.quest).toEqual({});
    const esrOnly = buildIconsBundle({
      esrVersion: '3.2.24',
      esrTag: null,
      vanilla,
      plan,
      images: new Map([['axe_hand_axe', { width: 58, height: 128 }]]),
      extension: 'webp',
    });
    expect(esrOnly.vanilla).toBeUndefined();
  });
});
