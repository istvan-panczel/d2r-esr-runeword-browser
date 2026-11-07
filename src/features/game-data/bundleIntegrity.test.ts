import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { EXTRA_FAMILIES } from './build/cube/cubeCatalog.ts';
import { CUBE_FAMILIES } from './build/cube/cubeFamilies.ts';
import { readEsrSources } from './build/esrSources.ts';
import { REMOVED_LEVELS } from './build/bundleAreas.ts';
import { generateBundles } from './build/generateBundles.ts';
import { COLORMAP_FILES, TINT_COLORS, untintedFile } from './build/itemTint.ts';
import { serializeBundle } from './build/writeBundle.ts';
import { defaultContext, evaluateSkill, indexSkillCalc, maxSynergyPoints, skillTable, synergyInputs } from './engine/skillCalc/index.ts';
import { decodeSkillLevelLayer, decodeTabLayer, MAX_STAT_PARAM, statLayerKind } from './engine/statLayers.ts';
import { readSuperiorAffixes, superiorRollsFor, superiorRollsForBase } from './engine/superiorAffixes.ts';
import {
  CLASS_CODES,
  GAME_DATA_SCHEMA,
  type AffixesBundle,
  type AreasBundle,
  type BaseItem,
  type BasesBundle,
  type CraftingBundle,
  type CraftingSlot,
  type CubeBundle,
  type EnhanceBundle,
  type GameDataManifest,
  type IconsBundle,
  type ItemTextBundle,
  type LootFilterDataBundle,
  type MaterialsBundle,
  type ModifiersBundle,
  type SetsBundle,
  type SkillCalcBundle,
  type SkillDetailsBundle,
  type SkillsBundle,
  type SourcesBundle,
  type StashBundle,
  type StashNamesBundle,
  type TerrorZonesBundle,
  type TiersBundle,
  type TxtRunewordsBundle,
  type TypesBundle,
} from './engine/schema.ts';
import { stripHtmlTags } from '@/lib/html';

const OUTPUT_DIR = resolve(__dirname, '../../../public/game-data');
const ESR_DIR = resolve(__dirname, '../../../', process.env.ESR_SOURCE_DIR ?? '../Eastern_Sun_Resurrected');

function readText(name: string): string {
  return readFileSync(resolve(OUTPUT_DIR, `${name}.json`), 'utf-8');
}

const manifest = JSON.parse(readText('manifest')) as GameDataManifest;
const typesText = readText('types');
const basesText = readText('bases');
const runewordsText = readText('runewords');
const affixesText = readText('affixes');
const sourcesText = readText('sources');
const lootfilterText = readText('lootfilter');
const enhanceText = readText('enhance');
const cubeText = readText('cube');
const materialsText = readText('materials');
const setsText = readText('sets');
const skillsText = readText('skills');
const skillDetailsText = readText('skilldetails');
const skillCalcText = readText('skillcalc');
const craftingText = readText('crafting');
const tiersText = readText('tiers');
const areasText = readText('areas');
const stashText = readText('stash');
const stashNamesText = readText('stashnames');
const itemTextText = readText('itemtext');
const terrorZonesText = readText('terrorzones');
const modifiersText = readText('modifiers');
const { types, classes: typeClasses } = JSON.parse(typesText) as TypesBundle;
const classCodes = typeClasses.map((cls) => cls.code);
const basesBundle = JSON.parse(basesText) as BasesBundle;
const { bases, automods: baseAutomods = [] } = basesBundle;
const { runewords } = JSON.parse(runewordsText) as TxtRunewordsBundle;
const { affixes } = JSON.parse(affixesText) as AffixesBundle;
const { items: sourceItems } = JSON.parse(sourcesText) as SourcesBundle;
const lootfilter = JSON.parse(lootfilterText) as LootFilterDataBundle;
const enhance = JSON.parse(enhanceText) as EnhanceBundle;
const cube = JSON.parse(cubeText) as CubeBundle;
const materials = JSON.parse(materialsText) as MaterialsBundle;
const { sets } = JSON.parse(setsText) as SetsBundle;
const skills = JSON.parse(skillsText) as SkillsBundle;
const skillDetails = JSON.parse(skillDetailsText) as SkillDetailsBundle;
const skillCalc = JSON.parse(skillCalcText) as SkillCalcBundle;
const crafting = JSON.parse(craftingText) as CraftingBundle;
const { codes: tierCodes } = JSON.parse(tiersText) as TiersBundle;
const { areas } = JSON.parse(areasText) as AreasBundle;
const stash = JSON.parse(stashText) as StashBundle;
const stashNames = JSON.parse(stashNamesText) as StashNamesBundle;
const itemText = JSON.parse(itemTextText) as ItemTextBundle;
const terrorZones = JSON.parse(terrorZonesText) as TerrorZonesBundle;
const modifiers = JSON.parse(modifiersText) as ModifiersBundle;

describe('committed game-data bundles', () => {
  it('match the app schema', () => {
    expect(manifest.schema).toBe(GAME_DATA_SCHEMA);
  });

  it('match the manifest hashes and sizes', () => {
    for (const [name, text] of [
      ['types', typesText],
      ['bases', basesText],
      ['runewords', runewordsText],
      ['affixes', affixesText],
      ['sources', sourcesText],
      ['lootfilter', lootfilterText],
      ['enhance', enhanceText],
      ['cube', cubeText],
      ['materials', materialsText],
      ['sets', setsText],
      ['skills', skillsText],
      ['skilldetails', skillDetailsText],
      ['skillcalc', skillCalcText],
      ['crafting', craftingText],
      ['tiers', tiersText],
      ['areas', areasText],
      ['stash', stashText],
      ['stashnames', stashNamesText],
      ['itemtext', itemTextText],
      ['terrorzones', terrorZonesText],
      ['modifiers', modifiersText],
    ] as const) {
      expect(manifest.files[name]?.hash).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
      expect(manifest.files[name]?.bytes).toBe(Buffer.byteLength(text, 'utf8'));
    }
  });

  it('list icons.json in the manifest, keyed by known base codes, unique names and set item names, with every image file present', () => {
    const iconsText = readText('icons');
    expect(manifest.files.icons?.hash).toBe(createHash('sha256').update(iconsText, 'utf8').digest('hex'));
    const icons = JSON.parse(iconsText) as IconsBundle;
    expect(icons.esrVersion).toBe(manifest.esrVersion);
    expect(Object.keys(icons)).toEqual(['esrVersion', 'esrTag', 'vanilla', 'bases', 'uniques', 'sets', 'misc', 'quest', 'items', 'types']);
    expect(manifest.counts.itemIcons).toBe(Object.keys(icons.bases).length);
    expect(manifest.counts.uniqueIcons).toBe(Object.keys(icons.uniques).length);
    expect(manifest.counts.setIcons).toBe(Object.keys(icons.sets).length);
    expect(manifest.counts.miscIcons).toBe(Object.keys(icons.misc).length);
    expect(manifest.counts.questIcons).toBe(Object.keys(icons.quest).length);
    expect(manifest.counts.itemCodeIcons).toBe(Object.keys(icons.items).length);
    expect(manifest.counts.typeIcons).toBe(Object.keys(icons.types).length);
    // With the vanilla art as the second source almost every item has an icon (ESR 3.2.24: all of them)
    expect(Object.keys(icons.bases).length).toBeGreaterThan(640);
    expect(Object.keys(icons.uniques).length).toBeGreaterThan(1100);
    expect(Object.keys(icons.sets).length).toBeGreaterThan(260);
    // Socket fillers (gems, runes, crystals; ESR 3.2.24: 177 names, Ko Rune keyed per code)
    expect(Object.keys(icons.misc).length).toBeGreaterThan(170);
    // Quest items, portal keys, organs and map items by code (ESR 3.2.24: 77), every areas.json map item among them
    expect(Object.keys(icons.quest).length).toBeGreaterThan(70);
    for (const code of [
      'vip',
      'msf',
      'hst',
      'qf1',
      'qf2',
      'qey',
      'qhr',
      'qbr',
      'g33',
      'hfh',
      'hdm',
      'box',
      'bbb',
      'bks',
      'mss',
      'ice',
      'leg',
      'pk1',
    ])
      expect(icons.quest[code], code).toBeDefined();
    for (const area of areas) if (area.mapItem !== undefined) expect(icons.quest[area.mapItem], area.mapItem).toBeDefined();

    // Every other item by code (ESR 3.2.24: 1,472 of 1,579 codes), not repeating a base or quest code; the "(6 Pack)"
    // rows share the single item's file, and a gem / rune's code shares its name entry's file
    expect(Object.keys(icons.items).length).toBeGreaterThan(1400);
    for (const code of Object.keys(icons.items))
      expect(Object.hasOwn(icons.bases, code) || Object.hasOwn(icons.quest, code), code).toBe(false);
    expect(icons.items['6hrt']?.file).toBe(icons.items.hrt?.file);
    expect(icons.items['6ppp']?.file).toBe(icons.items.ppp?.file);
    expect(icons.items.gsw?.file).toBe(icons.misc.Diamond?.file);
    // Item types: shared art or a representative (Ring, Perfect Gem); none for the broad equipment types
    expect(icons.types.ring?.file).toBe(icons.bases.rin?.file);
    expect(icons.types.gem5?.file).toBe(icons.misc['Perfect Diamond']?.file);
    expect(icons.types.weap).toBeUndefined();
    expect(icons.types.armo).toBeUndefined();

    // Vanilla provenance: the Steam build's root hash, the extraction date and the files made from vanilla sprites
    const vanilla = icons.vanilla;
    expect(vanilla?.rootHash).toMatch(/^[0-9a-f]{32}$/);
    expect(vanilla?.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const vanillaFiles = vanilla?.files ?? [];
    expect(vanillaFiles.length).toBeGreaterThan(100);
    expect(vanillaFiles).toEqual([...new Set(vanillaFiles)].sort());
    for (const file of vanillaFiles) expect(existsSync(resolve(OUTPUT_DIR, 'icons', file)), file).toBe(true);
    expect(manifest.counts.vanillaIconFiles).toBe(vanillaFiles.length);
    const entries = [icons.bases, icons.uniques, icons.sets, icons.misc, icons.quest, icons.items, icons.types].flatMap((section) =>
      Object.values(section)
    );
    // A vanilla file is used directly or through a recoloured variant made from it
    const usedFiles = new Set(entries.map((icon) => untintedFile(icon.file)));
    for (const file of vanillaFiles) expect(usedFiles.has(file), file).toBe(true);
    expect(manifest.counts.vanillaIcons).toBe(entries.filter((icon) => vanillaFiles.includes(untintedFile(icon.file))).length);

    // Inventory colour transforms: only unique / set entries, file named after the untinted file, map and colour
    expect(
      [icons.bases, icons.misc, icons.quest, icons.items, icons.types]
        .flatMap((section) => Object.values(section))
        .some((icon) => icon.tint !== undefined)
    ).toBe(false);
    const tinted = [icons.uniques, icons.sets].flatMap((section) => Object.values(section)).filter((icon) => icon.tint !== undefined);
    for (const icon of tinted) {
      const tint = icon.tint ?? { map: '', color: '' };
      // A variant byte-identical to another colour's shares that file (lgrn / dgrn on the Large Charm art)
      expect(icon.file).toMatch(new RegExp(`^${untintedFile(icon.file).replace(/\.webp$/, '')}__${tint.map}-[a-z]{4}\\.webp$`));
      expect(COLORMAP_FILES as readonly string[]).toContain(tint.map);
      expect(TINT_COLORS as readonly string[]).toContain(tint.color);
      expect(existsSync(resolve(OUTPUT_DIR, 'icons', untintedFile(icon.file))), icon.file).toBe(true);
    }
    // ESR 3.2.24: 869 recoloured entries (668 uniques, 201 set items), 692 files
    expect(tinted.length).toBeGreaterThan(800);
    expect(manifest.counts.tintedIcons).toBe(tinted.length);
    expect(manifest.counts.tintedIconFiles).toBe(new Set(tinted.map((icon) => icon.file)).size);
    expect(icons.sets["Alaziel's Grip"]?.tint).toEqual({ map: 'invgreybrown', color: 'cred' });
    expect(icons.sets["Alaziel's Protector"]?.tint).toBeUndefined();

    // No duplicate art: byte-identical images share one file (duplicateImageAliases)
    const iconFiles = readdirSync(resolve(OUTPUT_DIR, 'icons')).filter((name) => name.endsWith('.webp'));
    const byHash = new Map<string, string>();
    for (const name of iconFiles) {
      const hash = createHash('sha256')
        .update(readFileSync(resolve(OUTPUT_DIR, 'icons', name)))
        .digest('hex');
      expect(byHash.get(hash), `${name} has the same bytes as ${byHash.get(hash) ?? ''}`).toBeUndefined();
      byHash.set(hash, name);
    }

    const itemCodes = new Set(lootfilter.items.map((item) => item.code));
    for (const [section, known] of [
      ['items', itemCodes],
      ['types', new Set(types.map((type) => type.code))],
    ] as const) {
      for (const [key, icon] of Object.entries(icons[section])) {
        expect(known.has(key), `${section}: ${key}`).toBe(true);
        expect(existsSync(resolve(OUTPUT_DIR, 'icons', icon.file)), icon.file).toBe(true);
      }
    }

    const codes = new Set(bases.map((base) => base.code));
    const uniqueNames = new Set(lootfilter.uniques.map((unique) => unique.name));
    const setItemNames = new Set(lootfilter.sets.map((item) => item.name));
    // Misc keys: a misc item name, or `name#code` with a code of that name
    const miscNames = new Set(lootfilter.items.filter((item) => item.kind === 'misc').map((item) => item.name));
    const miscKeys = new Set([
      ...miscNames,
      ...lootfilter.items.filter((item) => item.kind === 'misc').map((item) => `${item.name}#${item.code}`),
    ]);
    for (const name of ['El Rune', 'Chipped Amethyst', 'Perfect Skull', 'Chipped Shadow Quartz', 'Moon Rune', 'Fu Rune']) {
      expect(Object.hasOwn(icons.misc, name), name).toBe(true);
    }
    expect(Object.hasOwn(icons.misc, 'Ko Rune')).toBe(false);
    expect(icons.misc['Ko Rune#r19']?.file).not.toBe(icons.misc['Ko Rune#r68']?.file);
    for (const [section, known] of [
      ['bases', codes],
      ['uniques', uniqueNames],
      ['sets', setItemNames],
      ['misc', miscKeys],
    ] as const) {
      for (const [key, icon] of Object.entries(icons[section])) {
        expect(known.has(key), `${section}: ${key}`).toBe(true);
        expect(icon.file).toMatch(/^[a-z0-9_-]+\.webp$/);
        expect(Math.max(icon.w, icon.h)).toBeLessThanOrEqual(128);
        expect(Math.min(icon.w, icon.h)).toBeGreaterThan(0);
        expect(existsSync(resolve(OUTPUT_DIR, 'icons', icon.file)), icon.file).toBe(true);
      }
    }
    // Every set item the Sets page shows is a setitems.txt row, so it can be looked up by its name
    for (const item of sets.flatMap((set) => set.items)) expect(setItemNames.has(item.name), item.name).toBe(true);
  });

  it('contain the player-facing weapons and armors', () => {
    expect(bases.filter((base) => base.kind === 'weapon')).toHaveLength(369);
    expect(bases.filter((base) => base.kind === 'armor')).toHaveLength(255);
    expect(bases.filter((base) => base.kind === 'misc')).toHaveLength(29);
    expect(manifest.counts.bases).toBe(bases.length);
  });

  it('drop exact duplicate bases (cx1-3 copies of cm1-3)', () => {
    expect(manifest.counts.duplicateBases).toBe(3);
    expect(bases.some((base) => ['cx1', 'cx2', 'cx3'].includes(base.code))).toBe(false);
    expect(bases.some((base) => base.code === 'c11')).toBe(true);
  });

  it('name mythical accessories after the name column and keep string conflicts out of the manifest', () => {
    for (const code of ['mam', 'mrn', 'mjw']) expect(bases.find((base) => base.code === code)?.name).toMatch(/^Mythical /);
    expect(manifest.warnings.some((warning) => warning.startsWith('string '))).toBe(false);
    expect(manifest.counts.stringConflicts).toBeGreaterThan(0);
  });

  it('have unique base and type codes', () => {
    expect(new Set(bases.map((base) => base.code)).size).toBe(bases.length);
    expect(new Set(types.map((type) => type.code)).size).toBe(types.length);
  });

  it('only reference existing item types', () => {
    const codes = new Set(types.map((type) => type.code));
    for (const type of types) {
      for (const code of [...type.parents, ...type.ancestors]) expect(codes, `${type.code} → ${code}`).toContain(code);
    }
    for (const base of bases) {
      for (const code of [base.type, base.type2, ...base.ancestors]) {
        if (code !== null) expect(codes, `${base.code} → ${code}`).toContain(code);
      }
    }
  });

  it('carry automod lines that match affixes.json and staffmods on class items', () => {
    const automagicText = new Map(affixes.filter((affix) => affix.kind === 'a').map((affix) => [affix.id, affix.text]));
    const automodIds = new Set(baseAutomods.map((automod) => automod.id));
    for (const automod of baseAutomods) expect(automod.text, `automod ${String(automod.id)}`).toEqual(automagicText.get(automod.id));
    for (const base of bases) {
      for (const id of base.automods ?? []) expect(automodIds, `${base.code} → automod ${String(id)}`).toContain(id);
      if (base.automods !== undefined) expect(base.autoGroup, base.code).not.toBeNull();
    }
    expect(manifest.counts.baseAutomods).toBe(baseAutomods.length);
    const eagleOrb = bases.find((base) => base.code === 'ob1');
    expect(eagleOrb?.staffMods).toBe('sor');
    expect(eagleOrb?.automods?.length).toBeGreaterThan(1);
    expect(bases.find((base) => base.code === 'hax')?.range).toBeGreaterThan(0);
  });

  it('carry the superior affix rows, weights and pools (ESR 3.2.24)', () => {
    const superior = readSuperiorAffixes(basesBundle);
    expect(superior).not.toBeNull();
    if (superior === null) return;
    expect(superior.enabled).toBe(true);
    expect(superior.defaultWeight).toBe(100);
    expect(superior.firstFourRowBases).toBeUndefined();
    expect(superior.rows.map((row) => row.row)).toEqual(superior.rows.map((_, index) => index));
    expect(superior.rows).toHaveLength(83);
    expect(manifest.counts.superiorRows).toBe(83);
    // Every ESR row uses itype / etype; the stock item-class columns are blank
    expect(superior.rows.every((row) => row.itypes.length > 0 && row.columns.length === 0)).toBe(true);
    expect(superior.pools.map((pool) => [pool.label, pool.rows.length, pool.total])).toEqual([
      ['Weapon (other types)', 31, 969],
      ['Wand', 15, 217],
      ['Staff', 16, 220],
      ['Claw', 32, 994],
      ['Orb', 10, 173],
      ['Druid Club', 10, 200],
      ['Necromancer Dagger', 11, 203],
      ['Helm', 19, 549],
      ['Any Armor (other types)', 21, 439],
      ['Gloves', 20, 523],
      ['Boots', 18, 473],
      ['Belt', 18, 473],
    ]);
    for (const pool of superior.pools) {
      expect(pool.total, pool.label).toBe(pool.rows.reduce((sum, row) => sum + (superior.rows[row]?.weight ?? 0), 0));
    }
    // Every weapon and armor base is in exactly one pool, and its own rows are the pool's (Arrows / Bolts roll nothing)
    const gear = bases.filter((base) => base.kind !== 'misc');
    expect(superior.pools.reduce((sum, pool) => sum + pool.bases, 0)).toBe(gear.length - 2);
    const poolRows = new Map(superior.pools.flatMap((pool) => pool.types.map((code) => [code, pool.rows.join(',')])));
    for (const base of gear) {
      const rows = superiorRollsForBase(superior, base).rolls.map((roll) => roll.row.row);
      expect(rows.join(','), base.code).toBe(poolRows.get(base.type) ?? '');
    }
    // The rare rows players chase: +1 to All Skills (row 23), max resists (22), -enemy resists (32)
    const chance = (code: string, row: number) => {
      const base = bases.find((entry) => entry.code === code);
      return base === undefined ? undefined : superiorRollsForBase(superior, base).rolls.find((roll) => roll.row.row === row)?.chance;
    };
    expect(superior.rows[23]?.text).toEqual(['+1 to All Skills']);
    expect(chance('9ss', 23)).toBeCloseTo(1 / 969);
    expect(chance('xui', 23)).toBeCloseTo(1 / 439);
    expect(chance('xui', 22)).toBeCloseTo(1 / 439);
    expect(chance('9ss', 32)).toBeCloseTo(5 / 969);
    expect(chance('am1', 23)).toBeCloseTo(1 / 969);
    expect(chance('ob1', 23)).toBeCloseTo(1 / 173);
    expect(chance('ci0', 22)).toBeUndefined();
  });

  it('only reference family codes that exist among the bases or are reported as warnings', () => {
    const codes = new Set(bases.map((base) => base.code));
    const missing = bases.flatMap((base) => base.family.filter((code) => code !== '' && !codes.has(code)));
    for (const code of missing)
      expect(
        manifest.warnings.some((warning) => warning.includes(`"${code}"`)),
        code
      ).toBe(true);
  });

  it('contain every runes.txt Runeword* key with its rows (391 keys / 449 rows in ESR 3.2.12)', () => {
    expect(runewords).toHaveLength(391);
    expect(runewords.flatMap((runeword) => runeword.rows)).toHaveLength(449);
    expect(manifest.counts.runewords).toBe(runewords.length);
    expect(manifest.counts.runewordRows).toBe(449);
    const codes = new Set(types.map((type) => type.code));
    for (const runeword of runewords) {
      for (const row of runeword.rows) {
        for (const code of [...row.itypes, ...row.etypes]) expect(codes, `${runeword.key} → ${code}`).toContain(code);
        expect(row.sockets).toBe(row.ingredients.length + row.jewels);
      }
    }
  });

  it('contain the spawnable affixes with rendered text and known item types', () => {
    expect(manifest.counts.affixes).toBe(affixes.length);
    expect(affixes.length).toBeGreaterThan(2000);
    expect(new Set(affixes.map((affix) => `${affix.kind}${String(affix.id)}`)).size).toBe(affixes.length);
    // ESR 3.2.22 added magicprefix rows p910/p911/p918 (+Warlock Skills on grimoires and knives) that also list the item type
    // "voib", which itemtypes.txt does not define (the Voidblade type is "wswd"). The generator warns about it; the bundle
    // keeps the row as written so the typo shows up here once upstream fixes it.
    const codes = new Set([...types.map((type) => type.code), 'voib']);
    for (const affix of affixes) {
      for (const code of [...affix.itypes, ...affix.etypes]) expect(codes, `${affix.kind}${String(affix.id)} → ${code}`).toContain(code);
    }
    expect(affixes.filter((affix) => affix.text.length > 0).length / affixes.length).toBeGreaterThan(0.95);
    expect(affixes.flatMap((affix) => affix.text).some((line) => /%[+di0-9s]|undefined|NaN/.test(line))).toBe(false);
    expect(runewords.flatMap((rw) => rw.rows).filter((row) => row.text.length > 0).length).toBeGreaterThan(400);
  });

  it('contain a source label for every unique, set and misc entry', () => {
    expect(manifest.counts.sourcesUnique).toBe(sourceItems.filter((item) => item.item === 'unique').length);
    expect(manifest.counts.sourcesSet).toBe(sourceItems.filter((item) => item.item === 'set').length);
    expect(manifest.counts.sourcesMisc).toBe(sourceItems.filter((item) => item.item === 'misc').length);
    expect(sourceItems.filter((item) => item.item === 'unique').length).toBeGreaterThan(1000);
    expect(new Set(sourceItems.map((item) => `${item.item}:${item.name}`)).size).toBe(sourceItems.length);
    expect(sourceItems.every((item) => item.labels.length > 0 && item.name !== '')).toBe(true);
    // "Unknown" stays rare (Voidforge, a few internal ore/charm rows, …)
    expect(manifest.counts.sourcesUnknown).toBeLessThan(50);
  });

  it('contain the loot-filter reference data with known item types and base codes', () => {
    expect(manifest.counts.lootFilterItems).toBe(lootfilter.items.length);
    expect(manifest.counts.lootFilterStats).toBe(lootfilter.stats.length);
    expect(manifest.counts.lootFilterAreas).toBe(lootfilter.areas.length);
    expect(manifest.counts.lootFilterSounds).toBe(lootfilter.sounds.length);
    expect(manifest.counts.lootFilterUniques).toBe(lootfilter.uniques.length);
    expect(manifest.counts.lootFilterSets).toBe(lootfilter.sets.length);
    // Coupon uniques: hundreds of cube-only rows (ESR 3.2.24: 382), never a disabled row
    const coupons = lootfilter.uniques.filter((unique) => unique.coupon === true);
    expect(manifest.counts.lootFilterCouponUniques).toBe(coupons.length);
    expect(coupons.length).toBeGreaterThan(300);
    expect(coupons.some((unique) => unique.disabled === true)).toBe(false);
    expect(lootfilter.stats.length).toBeGreaterThan(0);
    expect(lootfilter.areas.length).toBeGreaterThan(0);
    expect(lootfilter.sounds.length).toBeGreaterThan(0);
    expect(lootfilter.uniques.length).toBeGreaterThan(1000);
    expect(lootfilter.sets.length).toBeGreaterThan(0);

    const itemCodes = new Set(lootfilter.items.map((item) => item.code));
    expect(itemCodes.size).toBe(lootfilter.items.length);
    // Every player-facing base is a loot-filter item; non-spawnable shadow bases are too
    for (const base of bases) expect(itemCodes, base.code).toContain(base.code);
    expect(lootfilter.items.some((item) => !item.spawnable)).toBe(true);
    // Non-spawnable items a treasure class names drop (Ancient Scrolls, Ore through "Uni Ore N"); Vessel of Souls bases do not
    const dropsOf = (code: string) => lootfilter.items.find((item) => item.code === code)?.drops;
    expect([dropsOf('01b'), dropsOf('ore'), dropsOf('m44'), dropsOf('r48'), dropsOf('r32')]).toEqual([true, true, false, false, true]);
    // A spawnable item drops, except the unused rune row r48 (no gems.txt row)
    expect(lootfilter.items.filter((item) => item.spawnable && !item.drops).map((item) => item.code)).toEqual(['r48']);

    const typeCodes = new Set(types.map((type) => type.code));
    for (const item of lootfilter.items) expect(typeCodes, `${item.code} → ${item.type}`).toContain(item.type);
    for (const entry of [...lootfilter.uniques, ...lootfilter.sets])
      expect(itemCodes, `${entry.name} → ${entry.code}`).toContain(entry.code);

    // Ids are row numbers: increasing and unique per table
    for (const list of [lootfilter.stats, lootfilter.uniques, lootfilter.sets]) {
      expect(list.every((entry, i) => i === 0 || entry.id > (list[i - 1]?.id ?? -1))).toBe(true);
    }
    expect(lootfilter.stats.every((stat, i) => stat.id === i)).toBe(true);
    expect(new Set(lootfilter.areas.map((area) => area.id)).size).toBe(lootfilter.areas.length);

    // The unique and set browser's fields: a required level on every row, a set name on every set item, and the
    // disabled rows (ESR 3.2.24: The Perfect Cello and the six Rupture charms; no disabled set item)
    for (const entry of [...lootfilter.uniques, ...lootfilter.sets]) expect(entry.reqLvl, entry.name).toBeGreaterThan(0);
    for (const entry of lootfilter.sets) expect(entry.set, entry.name).toBeTruthy();
    expect(lootfilter.uniques.some((entry) => entry.set !== undefined)).toBe(false);
    expect(lootfilter.uniques.filter((entry) => entry.disabled === true).map((entry) => entry.id)).toEqual([
      0, 690, 691, 692, 693, 694, 695,
    ]);
    expect(lootfilter.sets.some((entry) => entry.disabled === true)).toBe(false);
  });

  it('contain the loot-filter skills and known layers, which decode to listed skills (ESR 3.2.24)', () => {
    const { skills: filterSkills = [], knownLayers = [] } = lootfilter;
    expect(manifest.counts.lootFilterSkills).toBe(filterSkills.length);
    expect(manifest.counts.lootFilterKnownLayers).toBe(knownLayers.reduce((sum, entry) => sum + entry.layers.length, 0));
    const skillById = new Map(filterSkills.map((skill) => [skill.id, skill]));
    expect(skillById.size).toBe(filterSkills.length);
    expect(filterSkills.every((skill, i) => i === 0 || skill.id > (filterSkills[i - 1]?.id ?? -1))).toBe(true);
    // Every class tree skill of skills.json is listed, with its class
    const treeSkills = skills.classes.flatMap((cls) => cls.tabs.flatMap((tab) => tab.skills.map((skill) => [cls.code, skill.name])));
    expect(
      filterSkills
        .filter((skill) => skill.cls !== undefined)
        .map((skill) => [skill.cls, skill.name])
        .sort()
    ).toEqual(treeSkills.sort());
    expect(skillById.get(472)).toEqual({ id: 472, name: 'Orb of Winter', cls: 'sor' });

    // Tab layer 50 = Assassin Martial Arts (properties.txt tab 20); class layers are the types.json class order
    const tab = decodeTabLayer(50);
    expect(tab).toEqual({ cls: 6, tab: 2 });
    expect([typeClasses[tab?.cls ?? -1]?.code, typeClasses[tab?.cls ?? -1]?.tabs[tab?.tab ?? -1]]).toEqual(['ass', 'Martial Arts']);
    expect(classCodes).toEqual([...CLASS_CODES]);

    const statName = (id: number) => lootfilter.stats[id]?.name ?? '';
    for (const { stat, layers } of knownLayers) {
      const kind = statLayerKind(statName(stat));
      expect(['skill', 'event', 'charged'], statName(stat)).toContain(kind);
      expect(layers.every((layer, i) => i === 0 || layer > (layers[i - 1] ?? -1))).toBe(true);
      for (const layer of layers) {
        expect(layer, statName(stat)).toBeLessThanOrEqual(MAX_STAT_PARAM);
        const skill = kind === 'skill' ? layer : decodeSkillLevelLayer(layer)?.skill;
        expect(skillById.has(skill ?? -1), `${statName(stat)} ${String(layer)}`).toBe(true);
      }
    }
    // Level 60 Orb of Winter on hit (skill 472 << 6 | 60) is on items; so are charges and auras
    const known = (name: string) => knownLayers.find((entry) => statName(entry.stat) === name)?.layers ?? [];
    expect(decodeSkillLevelLayer(30268)).toEqual({ skill: 472, level: 60 });
    expect(known('item_skillonhit')).toContain(30268);
    expect(known('item_charged_skill').length).toBeGreaterThan(0);
    // sets.txt set bonuses count too: Waves of Ascension's Bone Wave level 30 on hit (496 << 6 | 30)
    expect(known('item_skillonhit')).toContain(31774);
    expect(known('item_aura').length).toBeGreaterThan(0);

    // affixes.json layers: only of the affix's stats, sorted, decodable
    const knownSet = new Map(knownLayers.map((entry) => [entry.stat, new Set(entry.layers)]));
    const affixLayers = affixes.flatMap((affix) => (affix.layers ?? []).map((layer) => ({ affix, ...layer })));
    expect(affixLayers.length).toBeGreaterThan(0);
    for (const { affix, stat, param } of affixLayers) {
      const label = `${affix.kind}${String(affix.id)} ${statName(stat)} ${String(param)}`;
      expect(affix.stats, label).toContain(stat);
      const kind = statLayerKind(statName(stat));
      if (kind === 'tab') expect(decodeTabLayer(param), label).toBeDefined();
      else if (kind === 'class') expect(param, label).toBeLessThan(CLASS_CODES.length);
      else expect(knownSet.get(stat)?.has(param), label).toBe(true);
    }
    // ESR's Warlock tab prefixes reuse the Necromancer names: "Apprentice's" p892 = +1-2 to Demon Skills (layer 56)
    expect(affixes.find((affix) => affix.kind === 'p' && affix.id === 892)?.layers).toContainEqual({ stat: 188, param: 56 });
  });

  it('contain the corruption outcomes per slot with the computed rates (ESR 3.2.24)', () => {
    const { corruptionSlots, corruptionOutcomes } = enhance;
    expect(corruptionSlots.map((slot) => slot.slot)).toEqual([
      'weapon',
      'shield',
      'body',
      'helm',
      'gloves',
      'belt',
      'boots',
      'ring',
      'amulet',
      'quiver',
      'charm',
    ]);
    expect(corruptionOutcomes).toHaveLength(272);
    expect(manifest.counts.enhanceCorruptionOutcomes).toBe(272);
    for (const slot of corruptionSlots) {
      expect(
        corruptionOutcomes.filter((outcome) => outcome.slot === slot.slot),
        slot.slot
      ).toHaveLength(slot.outcomes);
      expect(slot.outcomes + slot.brick.rolls, slot.slot).toBe(slot.rollRange);
      expect(slot.successRate, slot.slot).toBeCloseTo(slot.slot === 'charm' ? 2 / 3 : 0.75);
      expect(slot.qualities, slot.slot).not.toContain('mag');
    }
    expect(corruptionSlots.find((slot) => slot.slot === 'weapon')).toMatchObject({ outcomes: 30, rollRange: 40 });
    expect(corruptionSlots.find((slot) => slot.slot === 'quiver')).toMatchObject({ outcomes: 30, qualities: ['uni', 'rar', 'crf'] });
    expect(corruptionSlots.find((slot) => slot.slot === 'charm')).toMatchObject({ outcomes: 20, qualities: ['uni'] });
    for (const outcome of corruptionOutcomes) {
      expect(outcome.lines.length, `${outcome.slot} ${String(outcome.roll)}`).toBeGreaterThan(0);
      for (const mod of outcome.mods) expect(['corrupted', 'corrupted_dummy']).not.toContain(mod.code);
    }
    expect(enhance.corruption.notes).toHaveLength(3);
  });

  it('contain the anointment pools and rules', () => {
    const pool = (name: string) => enhance.anointmentOutcomes.filter((outcome) => outcome.pool === name);
    expect(pool('charm')).toHaveLength(30);
    expect(pool('vessel')).toHaveLength(178);
    expect(Object.fromEntries(enhance.anointmentSlots.map((slot) => [slot.slot, pool(slot.slot).length]))).toEqual({
      weapon: 179,
      shield: 58,
      body: 85,
      helm: 96,
      gloves: 59,
      belt: 48,
      boots: 48,
      ring: 101,
      amulet: 116,
    });
    for (const slot of enhance.anointmentSlots) {
      if (slot.socketedRollRange !== null) expect(slot.socketedRollRange, slot.slot).toBe(slot.rollRange - 1);
    }
    expect(pool('weapon').at(-1)).toMatchObject({ roll: 179, label: 'Sockets' });
    expect(enhance.anointment).toMatchObject({ blockedQualities: ['uni'], noRunewords: true });
    expect(enhance.vesselRecipes.find((recipe) => recipe.anointmentRolls !== undefined)).toMatchObject({
      tier: 4,
      soulCost: 5,
      anointmentRolls: 178,
    });
  });

  it('contain the jewel sanctification outcomes, one per roll of the Relic (ESR 3.2.24: 217)', () => {
    const { sanctification, sanctificationOutcomes, sanctificationBonuses } = enhance;
    expect(sanctification).toEqual({
      reagent: { code: 'u18', name: "Lucion's Relic of Sanctification" },
      item: { code: 'jewl', name: 'Jewel' },
      rollRange: 217,
      once: true,
    });
    expect(sanctificationOutcomes).toHaveLength(217);
    expect(manifest.counts.enhanceSanctificationOutcomes).toBe(217);
    expect(sanctificationOutcomes.map((outcome) => outcome.roll)).toEqual(Array.from({ length: 217 }, (_, i) => i + 1));
    for (const outcome of sanctificationOutcomes) {
      expect(outcome.mods, String(outcome.roll)).toHaveLength(3);
      expect(outcome.lines.length, String(outcome.roll)).toBeGreaterThanOrEqual(3);
      for (const mod of outcome.mods) expect(['sanctified', 'sanctified-dummy']).not.toContain(mod.code);
    }
    // Every outcome has one bonus of each of the three columns
    expect(sanctificationBonuses.reduce((sum, bonus) => sum + bonus.outcomes, 0)).toBe(3 * 217);
    expect(sanctificationBonuses.find((bonus) => bonus.line === '+1 to All Skills')?.outcomes).toBe(7);
    expect(sanctificationBonuses.find((bonus) => bonus.line === '+1% to Maximum Fire Resist')?.outcomes).toBe(36);
    // The cube page folds the pool into one row that links here
    expect(cube.rows.filter((row) => row.enhanceTab === 'sanctification').map((row) => row.variants)).toEqual([217]);
  });

  it('contain the Vessel of Souls tiers, recipes and transforms', () => {
    const tier = (n: number) => enhance.vesselRecipes.filter((recipe) => recipe.tier === n);
    const costs = (n: number) =>
      Object.fromEntries(
        [...new Set(tier(n).map((recipe) => recipe.soulCost))].map((cost) => [
          cost,
          tier(n).filter((recipe) => recipe.soulCost === cost).length,
        ])
      );
    expect(enhance.vessel).toEqual({ item: 'Vessel of Souls', startSouls: 2000 });
    expect(enhance.vesselTiers.map((entry) => [entry.tier, entry.startSouls, entry.endSouls])).toEqual([
      [1, 2000, 250],
      [2, 250, 40],
      [3, 40, 5],
      [4, 5, 0],
    ]);
    expect(costs(1)).toEqual({ 350: 200, 700: 17 });
    expect(costs(2)).toEqual({ 42: 36 });
    expect(costs(3)).toEqual({ 7: 23 });
    expect(costs(4)).toEqual({ 1: 6, 2: 74, 3: 4, 5: 20 });
    // The disabled "oskill axe swarm" pair is skipped; the "oskill shuriken trap" recipe is real
    expect(tier(4).some((recipe) => recipe.mods.some((mod) => mod.code === 'oskill' && mod.param === '561'))).toBe(false);
    expect(tier(4).some((recipe) => recipe.mods.some((mod) => mod.code === 'oskill' && mod.param === '643'))).toBe(true);
    expect(enhance.vesselRecipes.filter((recipe) => recipe.maxTimes !== undefined)).toHaveLength(63);
    expect(enhance.vesselTransforms).toHaveLength(29);
    expect(enhance.vesselTransforms.every((transform) => transform.keepsMods && transform.output.name.startsWith('Mythical '))).toBe(true);
  });

  it('list every cube family with rows, few fallback rows and the enhance rows hidden', () => {
    const counts = new Map(cube.families.map((family) => [family.id, family.rowCount]));
    // Every guide and cube-only family keeps at least one row after the hidden rows and the earlier families
    for (const family of [...CUBE_FAMILIES, ...EXTRA_FAMILIES]) expect(counts.get(family.id) ?? 0, family.id).toBeGreaterThan(0);
    // ESR 3.2.24: 41 rows in 9 fallback families; a release that adds new recipe shapes shows up here
    const fallback = cube.families.filter((family) => family.id.startsWith('other:'));
    expect(fallback.reduce((sum, family) => sum + family.rowCount, 0)).toBeLessThanOrEqual(60);
    expect(fallback.length).toBeLessThanOrEqual(12);
    // Each anointment outcome, Vessel recipe and corruption outcome is at least one hidden enhance row
    const enhanceRows = enhance.anointmentOutcomes.length + enhance.vesselRecipes.length + enhance.corruptionOutcomes.length;
    expect(cube.hidden.enhance).toBeGreaterThanOrEqual(enhanceRows);
    expect(cube.hidden.enhance).toBeLessThan(enhanceRows * 3);
    expect(manifest.counts.cubeHiddenEnhance).toBe(cube.hidden.enhance);
    // Every merged row and raw recipe points at its family and group; raw recipes only for small families
    const groups = new Map(cube.groups.map((group) => [group.id, group]));
    const raw = new Set(cube.families.filter((family) => family.raw).map((family) => family.id));
    expect(cube.rows.every((row) => groups.get(row.group)?.family === row.family)).toBe(true);
    expect(cube.recipes.every((recipe) => groups.get(recipe.group)?.family === recipe.family && raw.has(recipe.family))).toBe(true);
    for (const family of cube.families) {
      const merged = cube.rows.filter((row) => row.family === family.id).reduce((sum, row) => sum + row.variants, 0);
      expect(merged, family.id).toBe(family.rowCount);
      if (family.raw)
        expect(
          cube.recipes.filter((recipe) => recipe.family === family.id),
          family.id
        ).toHaveLength(family.rowCount);
    }
    expect(cube.sections.map((section) => section.id)).toEqual([...new Set(cube.families.map((family) => family.section))]);
  });

  it('pin the cube page fixes of the official-page audit (ESR 3.2.24)', () => {
    const groups = new Map(cube.groups.map((group) => [group.id, group]));
    const rowsOf = (family: string) => cube.rows.filter((row) => row.family === family);
    const find = (family: string, pick: (text: string) => boolean) =>
      rowsOf(family).find((row) => pick(`${row.inputs.join(' + ')} => ${row.output}`));
    // The Trap Assassin starter weapon (cubemain L8918) is listed, with its 1-2 sockets
    const trap = find('magic-rare-reroll', (text) => text.includes('Throwing Knife') && text.includes('Assassin Skill Levels'));
    expect(trap?.output).toContain('1-2 sockets');
    expect(rowsOf('magic-rare-reroll').some((row) => /\(2 sockets, \+\(1 to 2\) to Bow/.test(row.output))).toBe(false);
    // Removals read as removals: Astrogha's Petrified Heart, Secret Recipe 38 and 8
    expect(find('legendary-consumables', (text) => text.includes("Astrogha's"))?.output).toBe(
      'The same item (Removes the corruption status, so the item can be corrupted again)'
    );
    const secret = rowsOf('secret').map((row) => row.output);
    expect(secret).toContain('The same item (Removes Slain Monsters Rest in Peace)');
    expect(secret).toContain('The same item (Removes Knockback)');
    expect(secret).toContain('The same item (Removes +25% to Experience Gained) + Ancient Scroll 8');
    // Durability repair as the game writes it (Secret Recipe 37: rep-dur 5), app-wide
    expect(secret).toContain('The same item (Repairs 1 durability in 20 seconds)');
    for (const [name, text] of [
      ['cube', cubeText],
      ['affixes', affixesText],
      ['enhance', enhanceText],
      ['crafting', craftingText],
      ['sets', setsText],
    ] as const) {
      expect(text, name).not.toMatch(/Repairs \d+ durability per second/);
    }
    expect(setsText).toContain('Repairs 1 durability in 1 seconds');
    // Class crafts: one group per class, each slot with its stats (L9914: the Amazon helm)
    expect(rowsOf('class-craft')).toHaveLength(80);
    expect(new Set(rowsOf('class-craft').map((row) => groups.get(row.group)?.label)).size).toBe(8);
    expect(find('class-craft', (text) => text.startsWith('Any Magic Helm') && text.includes('Amazon'))?.output).toBe(
      'Crafted item of the same type (+(1 to 2) to Amazon Skill Levels, +(80 to 100)% Enhanced Defense, +(30 to 45) to Energy, All Resists +(15 to 25))'
    );
    // Per-row conditions: the Rerolling Orb point requirements and Tyrael's boon
    expect(rowsOf('ring-amulet').filter((row) => row.conditions?.includes('Stored Magic Ring Points ≥ 7') === true).length).toBeGreaterThan(
      0
    );
    // 11 of its 12 rows check it (L2316 does not: an ESR data issue)
    const notUpgraded = rowsOf('tyrael-boon').filter((row) => row.conditions?.includes('Not upgraded yet') === true);
    expect(notUpgraded.reduce((sum, row) => sum + row.variants, 0)).toBe(11);
    // Returned ingredients: Mythical Map + Key gives the Key back
    expect(find('map-portals', (text) => text.startsWith('Mythical Map + Key'))?.returned).toBe('Key');
    // Readable stocker and roll conditions, no raw labels
    const conditionTexts = [...cube.groups.flatMap((group) => group.conditions), ...cube.rows.flatMap((row) => row.conditions ?? [])];
    expect(conditionTexts.filter((text) => /Stocker count|Randomize counter|junk_|item_\d/.test(text))).toEqual([]);
    expect(rowsOf('secret').some((row) => row.conditions?.includes("Stored Devil's Food Points ≥ 25") === true)).toBe(true);
    // Item types read as types
    expect(find('quest-items', (text) => text.includes('Cow Portal'))?.inputs).toEqual(['Any Club', 'Tome of Town Portal']);
    expect(find('dstoning', (text) => text.startsWith('Gloves, Belt or Boots'))).toBeDefined();
    // The player-facing stocker rows: Rune Stocker upgrades, Multi Stocker, Rerolling Orb, Gem Can
    expect(find('stocker-upgrades', (text) => text.startsWith('Rune Stocker'))?.output).toBe(
      'The same Rune Stocker (2 points of that rune → 1 point of the next rune)'
    );
    for (const family of ['multi-stocker', 'rerolling-orb', 'gem-can-rerolls', 'crystal-can'])
      expect(rowsOf(family).length, family).toBeGreaterThan(0);
    expect(cube.hidden.stockers).toBeLessThan(3700);
    // D-stoning notes: fail-safe limits and the 500% ceiling; Secret Recipe 25's odds
    const notes = (id: string) => cube.families.find((family) => family.id === id)?.notes ?? [];
    expect(notes('dstoning')).toContain(
      "Fail-safe: does nothing once the item's added level requirement is at least 58 (elite), 79 (exceptional) or 99 (normal tier, rings, amulets)."
    );
    expect(notes('dstoning').some((note) => note.includes('500%'))).toBe(true);
    expect(notes('gem-meld').some((note) => note.includes('55 (elite), 78 (exceptional) or 99 (normal tier)'))).toBe(true);
    expect(find('secret', (text) => text.startsWith('Ore + Ancient Scroll 25'))?.odds?.map((line) => line.split(':')[0])).toEqual([
      '50%',
      '30%',
      '20%',
    ]);
    // Section notes and guide links; Secret Recipes 26, 27, 28 and 40 in the secret family
    expect(cube.sections.find((section) => section.id === 'legendary')?.notes?.some((note) => note.includes('engine bug'))).toBe(true);
    const secretGroups = cube.groups.filter((group) => group.family === 'secret').map((group) => group.label);
    for (const n of [26, 27, 28, 40]) expect(secretGroups, String(n)).toContain(`Secret Recipe ${String(n)}`);
    // Group labels from the ingredients where the description names another (Caster craft takes a Perfect Sapphire)
    expect(cube.groups.filter((group) => group.family === 'legacy-craft').map((group) => group.label)).toEqual([
      'Hit Power craft',
      'Blood craft',
      'Caster craft',
      'Safety craft',
    ]);
    expect(cube.groups.some((group) => group.label === 'Belt Upgrade: Sash + Thawing Potion')).toBe(false);
  });

  it('link the cube sections to guide notes that exist', () => {
    const slugs = new Set(readdirSync(resolve(__dirname, '../../../content/guide/notes')).map((file) => file.replace(/\.md$/, '')));
    for (const section of cube.sections)
      for (const slug of section.guide ?? []) expect(slugs.has(slug), `${section.id} → ${slug}`).toBe(true);
  });

  it('list the materials with known families, enhance roles and groups, without equipment bases', () => {
    const families = new Set(cube.families.map((family) => family.id));
    const listed = new Set(materials.families.map((family) => family.id));
    const groups = new Map(materials.groups.map((group) => [group.code, new Set(group.blocks.map((block) => block.code))]));
    const baseCodes = new Set(bases.map((base) => base.code));
    const reagents = new Set([
      enhance.corruption.reagent.code,
      enhance.anointment.reagent.code,
      enhance.sanctification.reagent.code,
      ...enhance.anointment.charmReagents.map((reagent) => reagent.code),
      ...enhance.vesselRecipes.flatMap((recipe) => recipe.materials.map((material) => material.code)),
      ...enhance.vesselTransforms.flatMap((transform) => transform.materials.map((material) => material.code)),
    ]);
    // ESR 3.2.24: 395 rows (1,049 misc rows before collapsing) in 16 groups
    expect(materials.items.length).toBeGreaterThan(300);
    expect(materials.items.length).toBeLessThan(600);
    expect(materials.groups.length).toBeGreaterThanOrEqual(10);
    expect(manifest.counts.materialsItems).toBe(materials.items.length);
    expect(new Set(materials.items.map((item) => item.code)).size).toBe(materials.items.length);
    for (const item of materials.items) {
      expect(baseCodes.has(item.code), item.code).toBe(false);
      expect(groups.get(item.group)?.has(item.block), `${item.code} ${item.group}/${item.block}`).toBe(true);
      expect(item.sources.length, item.code).toBeGreaterThan(0);
      for (const use of [...item.usedIn, ...item.madeBy]) {
        expect(families.has(use.family), `${item.code} → ${use.family}`).toBe(true);
        expect(listed.has(use.family), `${item.code} → ${use.family}`).toBe(true);
        expect(use.recipes, `${item.code} → ${use.family}`).toBeGreaterThan(0);
        expect(use.recipes).toBeLessThanOrEqual(cube.families.find((family) => family.id === use.family)?.rowCount ?? 0);
      }
      for (const role of item.enhance ?? []) expect(reagents.has(item.code), `${item.code} ${role.label}`).toBe(true);
    }
    // Every enhance reagent that is a misc item shows up with its role
    const roles = new Set(materials.items.filter((item) => item.enhance !== undefined).map((item) => item.code));
    expect(roles.has(enhance.corruption.reagent.code)).toBe(true);
    expect(roles.has(enhance.anointment.reagent.code)).toBe(true);
    expect(roles.has(enhance.sanctification.reagent.code)).toBe(true);
    // Spot checks: a rune, a gem, an organ, a Dragon Stone, the coupon tiers
    const byCode = new Map(materials.items.map((item) => [item.code, item]));
    expect(byCode.get('r01')?.usedIn.map((use) => use.family)).toContain('rune-forging');
    expect(byCode.get('gvb')?.madeBy.map((use) => use.family)).toContain('gem-upgrade');
    expect(byCode.get('hrt')?.enhance?.map((role) => role.tab)).toContain('vessel');
    expect(byCode.get('ppp')?.madeBy.map((use) => use.family)).toContain('dstone-cycle');
    const coupons = materials.items.filter((item) => item.group === 'coup');
    expect(coupons.length).toBeLessThanOrEqual(6);
    expect(coupons.reduce((sum, item) => sum + (item.variants ?? 1), 0)).toBeGreaterThan(300);
  });

  it('list every set with its items, bonuses and class (ESR 3.2.24: 76 sets, 266 items; _old sets hidden)', () => {
    expect(sets).toHaveLength(76);
    expect(manifest.counts.sets).toBe(sets.length);
    expect(manifest.counts.setItems).toBe(sets.reduce((sum, set) => sum + set.items.length, 0));
    expect(new Set(sets.map((set) => set.id)).size).toBe(sets.length);
    const classes = new Set(types.flatMap((type) => (type.cls === null ? [] : [type.cls])));
    const setSources = new Set(sourceItems.filter((source) => source.item === 'set').map((source) => source.name));
    for (const set of sets) {
      expect(set.id.endsWith('_old'), set.id).toBe(false);
      expect(set.items.length, set.id).toBeGreaterThanOrEqual(2);
      expect(set.full.length, set.id).toBeGreaterThan(0);
      if (set.classCode !== null) expect(classes.has(set.classCode), set.id).toBe(true);
      expect(set.reqLevel.min).toBe(Math.min(...set.items.map((item) => item.reqLevel)));
      expect(set.reqLevel.max).toBe(Math.max(...set.items.map((item) => item.reqLevel)));
      for (const group of set.partial) expect(group.pieces).toBeLessThanOrEqual(set.items.length);
      for (const item of set.items) {
        expect(setSources.has(item.name), item.name).toBe(true);
        expect(item.lines.length, item.name).toBeGreaterThan(0);
        expect(item.category, item.name).not.toBe('');
        for (const group of item.partial) expect(group.pieces, item.name).toBeLessThanOrEqual(set.items.length);
      }
    }
    // Checked against docs/sets.htm
    const arcanna = sets.find((set) => set.id === "Arcanna's Tricks-Sor");
    expect(arcanna?.className).toBe('Sorceress');
    expect(arcanna?.items[0]?.partial).toEqual([
      { pieces: 2, lines: ['+1 to All Skills', '+50% Better Chance of Getting Magic Items'] },
      { pieces: 3, lines: ['+2.5 to Mana (Based on Character Level)'] },
    ]);
    expect(arcanna?.partial).toEqual([{ pieces: 2, lines: ['Increase Maximum Life +10%', 'Increase Maximum Mana +10%'] }]);
    // A mythical description past the monstats Expansion marker row reads its own text
    expect(sets.find((set) => set.id === 'Harbinger of Ruin')?.full[0]).toMatch(/^Flame Wave deals 100% more total damage/);
  });

  it('list the class skill trees (ESR 3.2.24: 8 classes, 35 skills each, level cap 110)', () => {
    expect(skills.maxLevel).toBe(110);
    expect(skills.classes.map((cls) => cls.code)).toEqual(classCodes);
    const all = skills.classes.flatMap((cls) => cls.tabs.flatMap((tab) => tab.skills));
    expect(all).toHaveLength(280);
    expect(manifest.counts.skills).toBe(all.length);
    expect(manifest.counts.skillClasses).toBe(8);
    for (const cls of skills.classes) {
      expect(
        cls.tabs.map((tab) => tab.page),
        cls.code
      ).toEqual([1, 2, 3]);
      const ids = new Set(cls.tabs.flatMap((tab) => tab.skills.map((skill) => skill.id)));
      expect(ids.size, cls.code).toBe(35);
      for (const tab of cls.tabs) {
        expect(tab.name, cls.code).not.toBe('');
        expect(new Set(tab.skills.map((skill) => `${String(skill.row)}/${String(skill.col)}`)).size, tab.name).toBe(tab.skills.length);
        for (const skill of tab.skills) {
          expect(skill.row).toBeGreaterThanOrEqual(1);
          expect(skill.col).toBeGreaterThanOrEqual(1);
          expect(skill.maxLevel).toBe(20);
          for (const req of skill.reqSkills) expect(ids.has(req), `${skill.id} → ${req}`).toBe(true);
        }
      }
    }
    const warlock = skills.classes.find((cls) => cls.code === 'war');
    expect(warlock?.name).toBe('Warlock');
    expect(warlock?.tabs.map((tab) => tab.name)).toEqual(['Demon', 'Eldritch', 'Chaos']);
    const tainted = warlock?.tabs.flatMap((tab) => tab.skills).find((skill) => skill.id === 'Summon Tainted');
    expect(tainted).toMatchObject({ name: 'Summon Tainted', reqLevel: 12, reqSkills: ['Summon Goatman'] });
  });

  it('detail every class skill and the item skills items grant, with an icon file per key (ESR 3.2.24)', () => {
    const { items, skills: details } = skillDetails;
    const treeIds = skills.classes.flatMap((cls) => cls.tabs.flatMap((tab) => tab.skills.map((skill) => `${cls.code}/${skill.id}`)));
    const classDetails = details.filter((skill) => skill.cls !== null);
    // Same skills, same order (class, tab, row, column) as the trees of skills.json
    expect(classDetails.map((skill) => `${skill.cls ?? ''}/${skill.id}`)).toEqual(treeIds);
    const itemSkills = details.filter((skill) => skill.cls === null);
    expect(itemSkills.length).toBeGreaterThan(150);
    expect(manifest.counts.skillDetails).toBe(details.length);
    expect(manifest.counts.skillDetailsItemSkills).toBe(itemSkills.length);
    expect(manifest.counts.skillGrantItems).toBe(items.length);
    const grants = details.flatMap((skill) => skill.grantedBy ?? []);
    expect(manifest.counts.skillGrants).toBe(grants.length);
    expect(grants.length).toBeGreaterThan(2500);
    for (const grant of grants) expect(items[grant.item]).toBeDefined();
    for (const skill of itemSkills) expect(skill.grantedBy?.length, skill.id).toBeGreaterThan(0);

    const fireBolt = details.find((skill) => skill.id === 'Fire Bolt');
    expect(fireBolt).toMatchObject({ cls: 'sor', page: 1, element: 'Fire', mana: [2, 0.5], icon: 'so-0' });
    expect(fireBolt?.description[0]).toBe('Create a magical flaming missile to scorch your target');
    expect(fireBolt?.synergies?.map((synergy) => synergy.name)).toEqual(['Fire Ball', 'Rain of Fire', 'Molten Focus']);
    expect(fireBolt?.synergies?.[2]?.text).toBe('+12% Fire Damage per Level');
    const grantOf = (skill: string, item: string) =>
      details.find((entry) => entry.id === skill)?.grantedBy?.filter((grant) => items[grant.item]?.name === item);
    expect(grantOf('Teleport', 'Cactus Petal')).toEqual([expect.objectContaining({ how: 'charged', charges: 7, level: 1 })]);
    expect(grantOf('Rift Shot', 'Enigma')).toEqual([expect.objectContaining({ how: 'oskill', level: [10, 20] })]);
    // The unique Enigma (a mythical) grants Rift Shot; the Enigma runeword is a separate item
    expect(items[grantOf('Rift Shot', 'Enigma')?.[0]?.item ?? -1]?.kind).toBe('unique');
    expect(items.filter((item) => item.name === 'Enigma').map((item) => item.kind)).toEqual(['unique', 'runeword']);

    const iconKeys = new Set(details.flatMap((skill) => (skill.icon === undefined ? [] : [skill.icon])));
    expect(manifest.counts.skillIcons).toBe(iconKeys.size);
    for (const key of iconKeys) expect(existsSync(resolve(OUTPUT_DIR, 'icons/skills', `${key}.webp`)), key).toBe(true);
  });

  it('carry the ESR skill information page: oskill texts and mercenary skills (ESR 3.2.24)', () => {
    const details = skillDetails.skills;
    const byId = (id: string) => details.find((skill) => skill.id === id);
    const withInfo = details.filter((skill) => skill.infoPage !== undefined);
    const withMercs = details.filter((skill) => skill.mercenaries !== undefined);
    expect(manifest.counts.skillInfoEntries).toBe(38);
    expect(manifest.counts.skillInfoSkills).toBe(withInfo.length);
    expect(manifest.counts.skillInfoMercenarySkills).toBe(withMercs.length);
    expect(manifest.counts.skillInfoUnmatched).toBe(0);
    expect(manifest.warnings.filter((warning) => warning.includes('skill_information.htm'))).toEqual([]);

    expect(byId('Warm Up')?.description).toEqual([]);
    expect(byId('Warm Up')?.infoPage?.text.join(' ')).toContain('2% attack speed');
    expect(byId('Fire Surge')?.infoPage?.heading).toBe('Fire/Cold/Lightning/Poison/Magic/Wind Surge');
    expect(byId('Fire Surge')?.infoPage?.text[0]).toMatch(/^A small area of effect instant spell damage skill\./);
    // Grouped headings with a multi-word member, an alias and same-name lookups by skills.txt id
    expect(byId('Fists of Fire Discharge')?.infoPage).toBeDefined();
    expect(byId('Axe Proc')?.infoPage?.heading).toBe('Axe Throw, Fire/Cold/Lightning/Magic Enhanced Axe');
    expect(byId('Super Nova')?.infoPage).toBeDefined();

    expect(byId('Fanaticism')?.mercenaries).toContainEqual({ hireling: 'Desert Mercenary', subtype: 'Comb - Nightmare' });
    expect(byId('Shout of the Ancients')?.mercenaries).toEqual([{ hireling: 'Barbarian', subtype: 'Offensive' }]);
    // A hireling's Conduit is shown as the Sorceress skill (standing in for hireling.txt's "Conduit Hireling", which
    // is not in the bundle), never the item skill of the same name
    expect(byId('Conduit')?.mercenaries).toEqual([{ hireling: 'Eastern Sorcerer', subtype: 'Lightning' }]);
    expect(byId('Conduit Proc')?.mercenaries).toBeUndefined();
  });

  it('list the forging, D-stoning and gem meld options per slot family (ESR 3.2.24)', () => {
    const { forgings, stacking } = crafting;
    const ofKind = (kind: string) => forgings.filter((option) => option.kind === kind);
    expect(manifest.counts.craftingForgings).toBe(forgings.length);
    expect(manifest.counts.craftingStacking).toBe(stacking.length);
    const everySlot: CraftingSlot[] = ['weapon', 'shield', 'helmet', 'armor', 'gloves', 'boots', 'belt', 'amulet', 'ring'];

    expect(ofKind('skill').map((option) => option.key)).toEqual(classCodes);
    for (const option of ofKind('skill')) {
      expect(Object.keys(option.bySlot), option.key).toEqual(everySlot);
      expect(option.bySlot.ring?.[0], option.key).toMatch(new RegExp(`^\\+1 to ${option.label} Skill`));
    }
    expect(ofKind('all')).toHaveLength(1);
    expect(Object.keys(ofKind('all')[0]?.bySlot ?? {})).toEqual(everySlot);

    expect(ofKind('stat')).toHaveLength(7);
    const amethyst = ofKind('stat').find((option) => option.label === 'Chipped Amethyst');
    expect(amethyst?.bySlot.weapon).toEqual(['+48% Enhanced Damage']);
    expect(amethyst?.bySlot.armor).toEqual(['+48% Enhanced Defense']);
    expect(amethyst?.bySlot.gloves).toEqual(['+48% Enhanced Defense']);
    expect(amethyst?.bySlot.amulet).toEqual(['+12% Chance of Crushing Blow']);
    expect(amethyst?.bySlot.ring).toEqual(['+12% Chance of Crushing Blow']);

    // ES runes (I … Wo, r01–r46) and Kanji runes (Moon … God, r84–r97); ESR has no rune forging rows for the LoD runes
    const runes = ofKind('rune');
    expect(runes).toHaveLength(60);
    expect(runes.filter((option) => option.key <= 'r46')).toHaveLength(46);
    expect(runes.filter((option) => option.key >= 'r84')).toHaveLength(14);
    expect(runes.find((option) => option.key === 'r84')?.label).toBe('Moon Rune');
    // The glove row (the weapon bonus) overrides the armo row on gloves
    const runeI = runes.find((option) => option.key === 'r01');
    expect(runeI?.bySlot.gloves).toEqual(['+15% Enhanced Damage']);
    expect(runeI?.bySlot.boots).toEqual(['+30 Defense']);

    expect(ofKind('aura')).toHaveLength(8);
    for (const option of ofKind('aura')) expect(Object.keys(option.bySlot), option.key).toEqual(['amulet']);
    expect(ofKind('aura')[0]?.bySlot.amulet).toEqual(['Level 10 Blessed Aim Aura When Equipped']);

    for (const option of forgings) {
      for (const lines of Object.values(option.bySlot)) expect(lines.length, `${option.kind} ${option.key}`).toBeGreaterThan(0);
    }

    const dragonStone = stacking.find(
      (option) => option.kind === 'dstone' && option.material.code === 'ppp' && option.switchItem === undefined
    );
    expect(dragonStone?.material.label).toBe('Dragon Stone');
    expect(dragonStone?.bySlot.weapon).toEqual({
      lines: ['+5% Increased Attack Speed'],
      steps: [5, 4, 3, 2, 1],
      levelReq: 2,
      cap: 121,
      capLines: ['+121% Increased Attack Speed'],
    });
    const melds = stacking.filter((option) => option.kind === 'meld');
    expect(melds).toHaveLength(8);
    for (const option of melds) {
      expect(option.material.label, option.material.code).toMatch(/^Perfect /);
      expect(Object.keys(option.bySlot), option.material.code).toEqual(['weapon', 'shield', 'helmet', 'armor', 'gloves', 'boots', 'belt']);
      for (const step of Object.values(option.bySlot)) expect(step.steps).toBeUndefined();
    }
    for (const option of stacking.filter((entry) => entry.kind === 'dstone')) {
      for (const step of Object.values(option.bySlot)) {
        expect(step.lines.length, option.material.code).toBeGreaterThan(0);
        expect(step.levelReq).toBeGreaterThan(0);
        expect(step.steps?.length).toBeGreaterThan(0);
        expect(step.capLines?.length, option.material.code).toBe(step.cap === undefined ? undefined : step.lines.length);
      }
    }
  });

  it('cap every D-stoning but Forging Hammer on a weapon, counting only what D-stoning adds (ESR 3.2.24)', () => {
    const dstone = (material: string, switchItem?: string) =>
      crafting.stacking.find(
        (entry) => entry.kind === 'dstone' && entry.material.code === material && entry.switchItem?.code === switchItem
      );
    // ≤ 116 +5 … ≤ 120 +1: 115 → 120 → 121
    expect(dstone('ppp')?.bySlot.weapon).toMatchObject({ cap: 121, capLines: ['+121% Increased Attack Speed'] });
    expect(dstone('ppp')?.bySlot.armor).toMatchObject({ cap: 120 });
    // +12% while at most 500: 492 → 504
    expect(dstone('sss')?.bySlot.weapon).toMatchObject({ cap: 504, capLines: ['+504% Bonus to Attack Rating'] });
    expect(dstone('hly')?.bySlot.armor).toMatchObject({ cap: 100, capLines: ['All Resists +100'] });
    expect(dstone('ttt', 'key')?.bySlot.helmet).toMatchObject({ cap: 256, capLines: ['+256 to Life'] });
    // The str-dex-enr-cap-group property group raises the shared cap stat
    expect(dstone('eee', 'key')?.bySlot.armor?.cap).toBe(200);
    // Light radius reduction: op 15, at least -4
    expect(dstone('eee', 'vps')?.bySlot.armor?.cap).toBe(-6);
    // The weapon Forging Hammer row has no cap condition
    expect(dstone('hh2')?.bySlot.weapon?.cap).toBeUndefined();
    const uncapped = crafting.stacking
      .filter((entry) => entry.kind === 'dstone')
      .flatMap((entry) =>
        Object.entries(entry.bySlot).flatMap(([slot, step]) => (step.cap === undefined ? [`${entry.material.code} ${slot}`] : []))
      );
    expect(uncapped).toEqual(['hh2 weapon']);
    // The cube page's D-stoning rows carry the same caps
    const weaponDragonStone = cube.rows.find((row) => row.family === 'dstoning' && row.inputs.join(' + ') === 'Weapon + Dragon Stone');
    expect(weaponDragonStone?.dstoneCaps).toEqual(['+121% Increased Attack Speed']);
  });

  it('list the tier of every weapon and armor row, non-spawnable unique bases and mythicals included (ESR 3.2.24)', () => {
    const values = Object.values(tierCodes);
    expect(manifest.counts.tierCodes).toBe(values.length);
    for (const tier of ['normal', 'exceptional', 'elite', 'mythical'] as const) {
      const key = `tierCodes${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
      expect(manifest.counts[key], key).toBe(values.filter((value) => value === tier).length);
    }
    expect(values.length).toBe(1067);
    // Non-spawnable unique bases (not in bases.json), a mythical, and rows without a tier
    expect(tierCodes).toMatchObject({ hax: 'normal', p01: 'normal', q00: 'exceptional', '7ha': 'elite', '2ap': 'normal', m01: 'mythical' });
    for (const code of ['rin', 'amu', 'jew', 'cm1', 'aq2', 'hst', 'q86']) expect(tierCodes[code], code).toBeUndefined();

    // Agrees with the Bases page (where those have a real family or are mythical) and the loot filter item tiers
    const tierOf = new Map(Object.entries(tierCodes));
    for (const base of bases) {
      if (base.kind === 'misc' || !tierOf.has(base.code)) continue;
      expect(tierOf.get(base.code), base.code).toBe(base.tier);
    }
    expect(bases.filter((base) => base.kind !== 'misc' && !tierOf.has(base.code)).map((base) => base.code)).toEqual([
      'gps',
      'ops',
      'gpm',
      'opm',
      'gpl',
      'opl',
      'aq2',
      'cq2',
      'q86',
      'qdf',
    ]);
    for (const item of lootfilter.items) if (item.tier !== undefined) expect(tierOf.get(item.code), item.code).toBe(item.tier);

    // Every set item and unique base has one except misc bases (rings, amulets, charms, jewels, stones) and quivers
    const setCodes = sets.flatMap((set) => set.items.map((item) => item.code));
    expect(setCodes.filter((code) => tierOf.has(code))).toHaveLength(246);
    const uniqueCodes = new Set(lootfilter.uniques.map((unique) => unique.code));
    expect([...uniqueCodes].filter((code) => tierOf.has(code))).toHaveLength(963);
  });

  it('name every stash item code, unique, set item and runeword by the ids a save stores (ESR 3.2.24)', () => {
    expect(stashNames.bases.map((base) => base.code)).toEqual(stash.items.map(([code]) => code));
    expect(manifest.counts.stashItemCodes).toBe(stashNames.bases.length);
    const typeCodes = new Set(types.map((type) => type.code));
    expect(stashNames.bases.filter((base) => !typeCodes.has(base.type)).map((base) => base.code)).toEqual([]);
    // Same rows and names as the loot filter data, except the coupon-named Azurewrath_old
    const lootUniques = new Map(lootfilter.uniques.map((unique) => [unique.id, unique]));
    expect(stashNames.uniques).toHaveLength(manifest.counts.stashUniques ?? -1);
    expect(stashNames.uniques.filter((unique) => lootUniques.get(unique.id)?.name !== unique.name && unique.unnamed !== true)).toEqual([]);
    expect(stashNames.uniques.filter((unique) => unique.coupon !== undefined)).toHaveLength(manifest.counts.stashCouponRecipes ?? -1);
    const lootSets = new Map(lootfilter.sets.map((item) => [item.id, item]));
    expect(stashNames.setItems.filter((item) => lootSets.get(item.id)?.name !== item.name)).toEqual([]);
    const setIds = new Set(stashNames.sets.map((set) => set.id));
    // Only items of retired sets name a set sets.txt lacks
    expect(stashNames.setItems.filter((item) => !setIds.has(item.set) && !item.set.endsWith('_old'))).toEqual([]);
    // Every runewords.json runeword has its name under the string id; the ids are distinct
    const runewordNames = new Map(stashNames.runewords.map((entry) => [entry.key, entry.name]));
    expect(runewords.filter((runeword) => runewordNames.get(runeword.key) !== runeword.name).map((runeword) => runeword.key)).toEqual([]);
    expect(new Set(stashNames.runewords.map((entry) => entry.id)).size).toBe(stashNames.runewords.length);
    expect(stashNames.runewords.find((entry) => entry.id === 63086)).toMatchObject({ key: 'Runeword584', name: 'Cow' });
    expect(stashNames.runewords.filter((entry) => entry.gemword === true)).toHaveLength(9);
    expect(stash.gemwords).toEqual(stashNames.runewords.filter((entry) => entry.gemword === true).map((entry) => entry.id));
    // the coupons and home pages load stash.json only: no names in it
    expect(Object.keys(stash)).toEqual(['grid', 'stats', 'items', 'coupons', 'couponTiers', 'gemwords']);
  });

  it('give the stash item text every saved stat, its strings and the name tables by the ids a save stores (ESR 3.2.24)', () => {
    // every stat a save can hold (stash.json: Save Bits > 0) has its display columns, and only those
    expect(itemText.stats.map((def) => def !== null)).toEqual(stash.stats.map((entry) => entry !== null));
    // the strings closure: every description key is there, except the ESR keys no string table has
    const missing = new Set(['MaxMagDmgPerLvl', 'ModStr3kSum', 'ModStr3u2', 'ModStrMagMastery']);
    const keys = itemText.stats.flatMap((def) =>
      def === null ? [] : [def.descstrpos, def.descstrneg, def.descstr2, def.dgrpstrpos, def.dgrpstrneg, def.dgrpstr2]
    );
    expect(keys.filter((key) => key !== undefined && key !== '' && !(key in itemText.strings) && !missing.has(key))).toEqual([]);
    for (const key of missing) expect(itemText.strings[key]).toBeUndefined();
    // magic names: 1-based (affixes.json ids are 0-based rows), the same text as affixes.json where it has one
    const tables = { p: itemText.magicPrefixes, s: itemText.magicSuffixes, a: itemText.autoAffixes };
    expect(affixes.filter((affix) => affix.name !== '' && tables[affix.kind][affix.id + 1] !== affix.name)).toEqual([]);
    expect(tables.p[0]).toBeNull();
    // the vanilla rare name table: suffixes 1-155, prefixes 156-201, all resolved
    expect(itemText.rareNames).toHaveLength(202);
    expect(itemText.rareNames.slice(1).filter((name) => name === null)).toEqual([]);
    expect([itemText.rareNames[1], itemText.rareNames[155], itemText.rareNames[156], itemText.rareNames[201]]).toEqual([
      'Bite',
      'Flange',
      'Beast',
      'Corruption',
    ]);
    expect(itemText.lowQuality).toEqual(['Crude', 'Cracked', 'Damaged', 'Low Quality']);
    expect(itemText.superior).toBe('Superior');
    // skills: every loot-filter skill (class trees and every skill a property names) with the class index, plus the
    // skill ids above 1023 the loot filter leaves out (Long Shot 1555, Delirium Proc 1557)
    const textSkills = new Map(itemText.skills.map((skill) => [skill.id, skill]));
    expect((lootfilter.skills ?? []).filter((skill) => textSkills.get(skill.id)?.name !== skill.name)).toEqual([]);
    expect(itemText.skills.map((skill) => skill.id)).toEqual([...textSkills.keys()].sort((a, b) => a - b));
    expect([textSkills.get(1555)?.name, textSkills.get(1557)?.name]).toEqual(['Long Shot', 'Delirium Proc']);
    expect(itemText.classes.map((cls) => cls.name.slice(0, 3).toLowerCase())).toEqual([...CLASS_CODES]);
    expect(itemText.monsters.filter((name) => name !== null)).toHaveLength(manifest.counts.itemTextMonsters ?? -1);
    // lazy and small: fetched only by /stash/items
    // base data, socket fillers and required levels (ESR 3.2.24): gloves take the weapon column of the N Rune
    expect(itemText.bases.tgl).toMatchObject({ str: 45 });
    expect(itemText.bases.tgl?.gem).toBeUndefined();
    expect(itemText.bases.gsd).toMatchObject({ d1: [12, 20], d2: [25, 42], str: 100, dex: 60 });
    // throw damage only on throwable types (ESR fills maxmisdam on wands, orbs, claws …)
    expect(
      ['7gi', '7ma', '7cr', '6l7', '6sw', 'ob1', 'ob2', '0yw', 'm23'].filter((code) => itemText.bases[code]?.dt !== undefined)
    ).toEqual([]);
    expect(itemText.bases.jav?.dt).toBeDefined();
    expect(Object.keys(itemText.socketables).length).toBeGreaterThan(170);
    expect(Object.values(itemText.socketables).filter((columns) => columns.every((column) => column.length === 0))).toEqual([]);
    expect(itemText.levels.uniques.length).toBeGreaterThan(1000);
    expect(manifest.files.itemtext?.bytes).toBeLessThan(520_000);
  });

  it('resolve the merc/helm name collision and class-only bases', () => {
    expect(types.find((type) => type.code === 'merc')?.name).toBe('Helm (merc)');
    expect(types.find((type) => type.code === 'helm')?.name).toBe('Helm');
    expect(bases.filter((base) => base.cls !== null).length).toBeGreaterThan(0);
    expect(manifest.counts.classes).toBe(8);
  });
});

const CODE = /^[a-z0-9]{2,4}$/;

/**
 * Base names keyed by code from the ESR docs pages. weapons.htm rows start with "Name<br>code",
 * armors.htm rows with a name cell followed by a code cell.
 */
function readHtmBaseNames(file: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf-8'), 'text/html');
  const names = new Map<string, string>();
  for (const row of doc.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td');
    const first = cells[0];
    if (first === undefined) continue;
    const [name = '', code = ''] = first.innerHTML.includes('<br>')
      ? first.innerHTML.split('<br>').map((part) => stripHtmlTags(part).trim())
      : [first.textContent.trim(), cells[1]?.textContent.trim() ?? ''];
    if (name !== '' && CODE.test(code) && !names.has(code)) names.set(code, name.replace(/&amp;/g, '&'));
  }
  return names;
}

interface QualityAffixRow {
  weight: number;
  lines: string[];
  /** Grouped view only: the "Item Type" cell (itypes) and its "Excluded:" list (etypes) */
  itypes?: string[];
  etypes?: string[];
}

/** One stat cell of docs/quality_affixes.htm as lines (`<br>`-separated, tags stripped, blank lines dropped) */
function htmLines(cell: Element): string[] {
  return cell.innerHTML
    .split(/<br\s*\/?>/)
    .map((part) => stripHtmlTags(part).replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

/**
 * docs/quality_affixes.htm: the "Grouped" view (every qualityitems.txt row in file order with its rarity, item types and
 * exclusions) and the "Expanded" view (one table per item type with the rarity of every row it can roll).
 */
function readQualityAffixesPage(file: string): {
  grouped: QualityAffixRow[];
  sections: Map<string, QualityAffixRow[]>;
  /** Section name → item type code, from the expanded view's "[Name]" jump links (`#code`) */
  sectionTypes: Map<string, string>;
} {
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf-8'), 'text/html');
  const dataRows = (view: Element | null) =>
    [...(view?.querySelectorAll('tr') ?? [])].filter(
      (row) => row.cells.length >= 2 && /^\d+$/.test(row.cells[0]?.textContent.trim() ?? '')
    );
  const grouped = dataRows(doc.getElementById('affix-view-grouped')).map((row) => {
    const [types = '', excluded = ''] = (row.cells[2]?.textContent ?? '').split('Excluded:');
    const codes = (text: string) =>
      text
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code !== '');
    return {
      weight: Number(row.cells[0]?.textContent.trim()),
      lines: htmLines(row.cells[1]),
      itypes: codes(types),
      etypes: codes(excluded),
    };
  });
  const expanded = doc.getElementById('affix-view-expanded');
  const sectionTypes = new Map(
    [...(expanded?.querySelectorAll('a[href^="#"]') ?? [])].map((link) => [
      link.textContent.trim().replace(/^\[|\]$/g, ''),
      link.getAttribute('href')?.slice(1) ?? '',
    ])
  );
  const sections = new Map<string, QualityAffixRow[]>();
  for (const table of expanded?.querySelectorAll('table') ?? []) {
    const name = table.querySelector('td[colspan="2"]')?.textContent.trim();
    if (name === undefined) continue;
    sections.set(
      name,
      dataRows(table).map((row) => ({ weight: Number(row.cells[0]?.textContent.trim()), lines: htmLines(row.cells[1]) }))
    );
  }
  return { grouped, sections, sectionTypes };
}

/** The official D-Stoning section's sections and the builds slot families they cover */
const DSTONE_DOC_SLOTS: Readonly<Record<string, readonly CraftingSlot[]>> = {
  Weapon: ['weapon'],
  'Torso/Helm/Shield': ['armor', 'helmet', 'shield'],
  'Gloves/Belt/Boots': ['gloves', 'belt', 'boots'],
  'Ring/Amulet': ['ring', 'amulet'],
};

interface DstoneDocCap {
  section: string;
  material: string;
  switchItem: string | undefined;
  cap: number;
}

/** The "(Capped at N)" of every D-stoning row of the Cube Recipes page, with its section and ingredients */
function readDstoneDocCaps(file: string): DstoneDocCap[] {
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf-8'), 'text/html');
  const caps: DstoneDocCap[] = [];
  // The section header row and the table it heads (the Tinkering table follows the Ring/Amulet one)
  let section: { name: string; table: Element | null } | null = null;
  for (const row of doc.querySelectorAll('tr')) {
    const text = row.textContent.replace(/\s+/g, ' ').trim();
    const header = /^D-Stoning (.+)$/.exec(text)?.[1];
    if (header !== undefined && row.cells.length === 1) {
      section = header in DSTONE_DOC_SLOTS ? { name: header, table: row.closest('table') } : null;
      continue;
    }
    const [inputCell, outputCell] = [...row.cells];
    if (section === null || row.closest('table') !== section.table) continue;
    if (row.cells.length !== 2 || inputCell === undefined || outputCell === undefined) continue;
    // A row of an outer layout table holds whole nested tables
    if (row.querySelector('table') !== null) continue;
    const cap = /Capped at (-?\d+)/.exec(outputCell.textContent)?.[1];
    if (cap === undefined) continue;
    const [, material = '', switchItem] = inputCell.innerHTML
      .split(/<br\s*\/?>/)
      .map((part) => stripHtmlTags(part).replace(/\s+/g, ' ').trim());
    caps.push({ section: section.name, material, switchItem: switchItem === '' ? undefined : switchItem, cap: Number(cap) });
  }
  return caps;
}

describe.skipIf(!existsSync(ESR_DIR))('game data generated from the ESR clone', () => {
  const generated = generateBundles(readEsrSources(ESR_DIR));
  const htm = new Map([
    ...readHtmBaseNames(resolve(ESR_DIR, 'docs/weapons.htm')),
    ...readHtmBaseNames(resolve(ESR_DIR, 'docs/armors.htm')),
  ]);
  const gear: BaseItem[] = generated.bases.bases.filter((base) => base.kind !== 'misc');

  it('produces the committed bundles (run npm run game-data:generate if this fails)', () => {
    expect(serializeBundle(generated.types)).toBe(typesText);
    expect(serializeBundle(generated.bases)).toBe(basesText);
    expect(serializeBundle(generated.runewords)).toBe(runewordsText);
    expect(serializeBundle(generated.affixes)).toBe(affixesText);
    expect(serializeBundle(generated.sources)).toBe(sourcesText);
    expect(serializeBundle(generated.lootfilter)).toBe(lootfilterText);
    expect(serializeBundle(generated.enhance)).toBe(enhanceText);
    expect(serializeBundle(generated.cube)).toBe(cubeText);
    expect(serializeBundle(generated.materials)).toBe(materialsText);
    expect(serializeBundle(generated.sets)).toBe(setsText);
    expect(serializeBundle(generated.skills)).toBe(skillsText);
    expect(serializeBundle(generated.skilldetails)).toBe(skillDetailsText);
    expect(serializeBundle(generated.skillcalc)).toBe(skillCalcText);
    expect(serializeBundle(generated.crafting)).toBe(craftingText);
    expect(serializeBundle(generated.tiers)).toBe(tiersText);
    expect(serializeBundle(generated.areas)).toBe(areasText);
    expect(serializeBundle(generated.stash)).toBe(stashText);
    expect(serializeBundle(generated.stashnames)).toBe(stashNamesText);
    expect(serializeBundle(generated.itemtext)).toBe(itemTextText);
    expect(serializeBundle(generated.terrorzones)).toBe(terrorZonesText);
    expect(serializeBundle(generated.modifiers)).toBe(modifiersText);
  });

  it('rolls the superior rows of docs/quality_affixes.htm with its rarities, per row and per item type (ESR 3.2.24)', () => {
    const superior = readSuperiorAffixes(generated.bases);
    expect(superior).not.toBeNull();
    if (superior === null) return;
    const page = readQualityAffixesPage(resolve(ESR_DIR, 'docs/quality_affixes.htm'));
    // The page shows Enhanced Defense rows with their max only ("+40%" for ac% 20-40)
    const lines = (row: QualityAffixRow | { text: string[] }) =>
      ('text' in row ? row.text : row.lines)
        .map((line) => line.replace(/^\+\(\d+ to (\d+)\)% Enhanced Defense$/, '+$1% Enhanced Defense'))
        .sort();

    expect(page.grouped).toHaveLength(superior.rows.length);
    superior.rows.forEach((row, index) => {
      const doc = page.grouped[index];
      expect(doc?.weight, `row ${String(index)} weight`).toBe(row.weight);
      expect(doc?.itypes, `row ${String(index)} itypes`).toEqual(row.itypes);
      expect(doc?.etypes, `row ${String(index)} etypes`).toEqual(row.etypes);
      expect(doc === undefined ? [] : lines(doc), `row ${String(index)} text`).toEqual(lines(row));
    });

    // Every item type section: the rows a base of exactly that type rolls, in row order
    const typeByCode = new Map(generated.types.types.map((type) => [type.code, type]));
    expect(page.sections.size).toBe(52);
    for (const [name, docRows] of page.sections) {
      const type = typeByCode.get(page.sectionTypes.get(name) ?? '');
      expect(type, name).toBeDefined();
      if (type === undefined) continue;
      const kind = type.ancestors.includes('weap') ? 'weapon' : 'armor';
      const { rolls } = superiorRollsFor(superior.rows, { kind, type: type.code, ancestors: type.ancestors });
      expect(
        rolls.map((roll) => [roll.row.weight, lines(roll.row)]),
        name
      ).toEqual(docRows.map((row) => [row.weight, lines(row)]));
    }
  });

  it('caps the D-stonings like the official D-Stoning Caps, within one step (ESR 3.2.24)', () => {
    const docCaps = readDstoneDocCaps(resolve(ESR_DIR, 'docs/Eastern Sun Resurrected Cube Recipes.html'));
    // 22 weapon, 16 torso / helm / shield, 16 gloves / belt / boots and 21 ring / amulet rows
    expect(docCaps).toHaveLength(75);
    const mismatches: string[] = [];
    for (const entry of docCaps) {
      const option = crafting.stacking.find(
        (candidate) =>
          candidate.kind === 'dstone' && candidate.material.label === entry.material && candidate.switchItem?.label === entry.switchItem
      );
      const name = `${entry.section}: ${[entry.material, entry.switchItem].filter((part) => part !== undefined).join(' + ')}`;
      for (const slot of DSTONE_DOC_SLOTS[entry.section] ?? []) {
        const step = option?.bySlot[slot];
        if (step === undefined) {
          mismatches.push(`${name} on ${slot}: no option`);
          continue;
        }
        // The page rounds: the D-stoning stops once its total passes the condition value, up to one step past it
        const largest = Math.max(...(step.steps ?? []).map(Math.abs));
        if (step.cap === undefined || Math.abs(step.cap - entry.cap) > largest)
          mismatches.push(`${name} on ${slot}: ${step.cap === undefined ? 'no cap' : String(step.cap)}, page ${String(entry.cap)}`);
      }
    }
    // Where the rows disagree with the page (ESR 3.2.24); the bundle follows the rows
    expect(mismatches).toEqual([
      'Weapon: Forging Hammer on weapon: no cap, page 500',
      'Weapon: Blackmoor + Key on weapon: 60, page 150',
      // The "VS + Any Weapon + vps" rows name the Forging Hammer (hh2), shadowed by the earlier Forging Hammer + vps rows
      'Weapon: Void Shard + Stamina Potion on weapon: no option',
      'Torso/Helm/Shield: Holy Symbol on armor: 100, page 150',
      'Torso/Helm/Shield: Holy Symbol on helmet: 100, page 150',
      'Torso/Helm/Shield: Holy Symbol on shield: 100, page 150',
      'Gloves/Belt/Boots: Holy Symbol on gloves: 100, page 150',
      'Gloves/Belt/Boots: Holy Symbol on belt: 100, page 150',
      'Gloves/Belt/Boots: Holy Symbol on boots: 100, page 150',
      'Ring/Amulet: Forging Hammer + Stamina Potion on ring: 300, page 400',
      'Ring/Amulet: Forging Hammer + Stamina Potion on amulet: 300, page 400',
    ]);
  });

  it('numbers uniques, sets, stats and sounds like the *ID / *Index comment columns where those are consistent', () => {
    const commentIds = (file: string, column: string) => {
      const [header = '', ...lines] = readFileSync(resolve(ESR_DIR, 'Eastern_Sun_Resurrected.mpq/data/global/excel', file), 'utf-8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      const i = header.split('\t').indexOf(column);
      return lines.map((line) => line.split('\t')[i]?.trim() ?? '');
    };
    const byId = (entries: { id: number }[], ids: string[]) => entries.every((entry) => ids[entry.id] === String(entry.id));
    expect(byId(generated.lootfilter.uniques, commentIds('uniqueitems.txt', '*ID'))).toBe(true);
    expect(byId(generated.lootfilter.sets, commentIds('setitems.txt', '*ID'))).toBe(true);
    expect(byId(generated.lootfilter.stats, commentIds('itemstatcost.txt', '*ID'))).toBe(true);
    // sounds.txt *Index is hand-maintained and repeats 11949 for the Leoric taunt rows (ESR 3.2.12); the game uses the row
    expect(commentIds('sounds.txt', '*Index')).toHaveLength(generated.lootfilter.sounds.length);
  });

  it('labels the verified source examples', () => {
    const kinds = (name: string) => generated.sources.items.find((item) => item.name === name)?.labels.map((label) => label.kind);
    const labelTexts = (name: string) => generated.sources.items.find((item) => item.name === name)?.labels.map((label) => label.text);
    expect(labelTexts('Pelta Lunata')).toEqual(['Cube: Ancient Coupon']);
    expect(kinds("Krok's Basher")).toEqual(['drop', 'gamble']);
    expect(kinds("Mephisto's Will")).toEqual(['maps']);
    expect(labelTexts('Frostmourne')).toEqual(['Drops from The Lich King']);
    expect(labelTexts('Annihilus')).toEqual(['Drops from Diablo Clone']);
    expect(kinds('Hellfire Torch')).toEqual(['plugin']);
    expect(kinds('Kill Ledger')).toEqual(['cube']);
    expect(kinds('Orb of Anointment')).toEqual(['maps']);
    expect(labelTexts('Forging Hammer')).toEqual(['Cube', "Drops from Bloodwitch the Wild, Uldyssian's Hound"]);
  });

  it('names spawnable bases like the ESR docs pages (≥ 95 % overlap)', () => {
    const htmNames = new Set(htm.values());
    const missing = gear.filter((base) => !htmNames.has(base.name));
    const differing = gear.filter((base) => htm.has(base.code) && htm.get(base.code) !== base.name);
    console.log(
      `Docs oracle: ${String(gear.length - missing.length)}/${String(gear.length)} base names found, ${String(differing.length)} differ by code`
    );
    if (missing.length > 0) console.log(`Base names not in the docs: ${missing.map((b) => `${b.code}=${b.name}`).join(', ')}`);
    if (differing.length > 0) {
      console.log(`Names differing by code: ${differing.map((b) => `${b.code}: "${b.name}" vs "${htm.get(b.code) ?? ''}"`).join(', ')}`);
    }
    expect((gear.length - missing.length) / gear.length).toBeGreaterThanOrEqual(0.95);
  });
});

// --- areas.json ---------------------------------------------------------------------------------------------------

describe('committed areas bundle', () => {
  const byId = new Map(areas.map((area) => [area.id, area]));

  it('lists unique ids whose connections resolve, with the manifest counts', () => {
    expect(byId.size).toBe(areas.length);
    expect(manifest.counts.areas).toBe(areas.length);
    for (const area of areas) {
      expect(area.name).not.toBe('');
      for (const id of area.connections) expect(byId.has(id), `${area.name} → ${String(id)}`).toBe(true);
    }
  });

  it('has the five map tiers of four zones each on the fixed level ladder, plus the unique map', () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      const maps = areas.filter((area) => area.tier === tier);
      expect(new Set(maps.map((area) => area.group)).size).toBe(4);
      for (const area of maps) if (area.level !== null) expect(area.level).toEqual(Array(3).fill(100 + 2 * (tier - 1)));
    }
    expect(areas.filter((area) => area.uniqueMap === true).map((area) => area.name)).toEqual(['The Hidden Vault']);
  });

  it('keeps the towns (waypoint, no level) and no map entrance or removed level', () => {
    const towns = ['Rogue Encampment', 'Lut Gholein', 'Kurast Docks', 'The Pandemonium Fortress', 'Harrogath'];
    for (const name of towns)
      expect(areas.find((area) => area.name === name)).toMatchObject({ waypoint: true, level: null, terrain: 'town' });
    expect(areas.filter((area) => area.terrain === 'town')).toHaveLength(towns.length);
    expect(byId.has(0)).toBe(false);
    expect(byId.get(2)?.name).toBe('Blood Moor');
    for (const id of REMOVED_LEVELS) expect(byId.has(id), String(id)).toBe(false);
    expect(manifest.counts.areasHiddenRemoved).toBe(REMOVED_LEVELS.length);
    // The rows that took over the removed levels' names are the only ones left with them
    for (const name of ['Jail Level 2', 'Catacombs Level 3'])
      expect(
        areas.filter((area) => area.name === name),
        name
      ).toHaveLength(1);
  });

  it('links two areas only both ways, and enters every map zone through one map item, without a waypoint', () => {
    for (const area of areas)
      for (const id of area.connections) expect(byId.get(id)?.connections, `${area.name} → ${String(id)}`).toContain(area.id);
    const maps = areas.filter((area) => area.tier !== undefined || area.uniqueMap === true);
    expect(maps.some((area) => area.waypoint)).toBe(false);
    const zones = new Set(maps.map((area) => area.group));
    const entries = maps.filter((area) => area.mapItem !== undefined);
    expect(new Set(entries.map((area) => area.group))).toEqual(zones);
    expect(entries).toHaveLength(zones.size);
    expect(new Set(entries.map((area) => area.mapItem)).size).toBe(entries.length);
    expect(manifest.counts.areasWithMapItem).toBe(entries.length);
  });
});

// --- skillcalc.json -----------------------------------------------------------------------------------------------

describe('committed skillcalc bundle', () => {
  const index = indexSkillCalc(skillCalc);
  /** The value spans of a line at levels 1 / 20 / 30 / 50 (synergies: every listed one at 20, or none) */
  const spans = (id: string, key: string, synergies = false, levels = [1, 20, 30, 50]) => {
    const skill = index.record(id);
    if (skill === undefined) throw new Error(`no skillcalc record for ${id}`);
    const synergyPoints = synergies ? maxSynergyPoints(skill, index) : {};
    const row = skillTable(skill, index, levels, { synergyPoints }).find((entry) => entry.key === key);
    return row?.cells.map((cell) => (cell.unavailable === true ? null : cell.span));
  };
  const lineKey = (id: string, label: string) => {
    const skill = index.record(id);
    const row = skill === undefined ? undefined : skillTable(skill, index, [20]).find((entry) => entry.label === label);
    if (row === undefined) throw new Error(`no "${label}" line on ${id}`);
    return row.key;
  };

  it('covers every skilldetails skill in the same order, with rows for every referenced skill (ESR 3.2.24)', () => {
    expect(skillCalc.skills.map((skill) => skill.id)).toEqual(skillDetails.skills.map((skill) => skill.id));
    expect(manifest.counts.skillCalcSkills).toBe(skillCalc.skills.length);
    expect(manifest.counts.skillCalcLines).toBe(skillCalc.skills.reduce((sum, skill) => sum + skill.lines.length, 0));
    expect(manifest.counts.skillCalcRows).toBe(skillCalc.rows.length);
    expect(manifest.counts.skillCalcMissiles).toBe(skillCalc.missiles.length);
    for (const skill of skillCalc.skills) {
      expect(index.skill(skill.id), skill.id).toBeDefined();
      for (const id of skill.synergies ?? []) expect(index.skill(id)?.maxlvl, `${skill.id} → ${id}`).toBeGreaterThan(0);
      for (const line of skill.lines)
        for (const text of [line.a, line.b]) if (text !== undefined) expect(skillCalc.texts[text], `${skill.id} ${line.key}`).toBeDefined();
    }
    // Every class skill has per-level lines; most item skills too
    const classIds = new Set(skillDetails.skills.filter((skill) => skill.cls !== null).map((skill) => skill.id));
    const withLevelLines = skillCalc.skills.filter((skill) => skill.lines.some((line) => line.key.startsWith('desc')));
    expect(withLevelLines.filter((skill) => classIds.has(skill.id))).toHaveLength(classIds.size);
    expect(manifest.counts.skillCalcSkillsWithLevelLines).toBe(withLevelLines.length);
    expect(manifest.counts.skillCalcLines).toBeGreaterThan(2500);
    expect(manifest.files.skillcalc?.bytes).toBeLessThan(450_000);
  });

  it('reproduces the reference values of Fire Ball, with and without synergies', () => {
    const damage = lineKey('Fire Ball', 'Fire Damage: …');
    expect(spans('Fire Ball', damage)).toEqual(['10-20', '80-128', '160-228', '360-468']);
    expect(spans('Fire Ball', damage, false, [110])).toEqual(['960-1188']);
    expect(index.record('Fire Ball')?.synergies).toEqual(['Fire Bolt', 'Rain of Fire', 'Molten Focus']);
    expect(spans('Fire Ball', damage, true)).toEqual(['58-116', '464-742', '928-1322', '2088-2714']);
    expect(spans('Fire Ball', lineKey('Fire Ball', 'Mana Cost: …'))).toEqual(['5', '14.5', '19.5', '29.5']);
    expect(spans('Fire Ball', lineKey('Fire Ball', 'Radius: … yards'))).toEqual(['4', '5.3', '6', '7.3']);
    expect(spans('Fire Ball', lineKey('Fire Ball', 'Enemy Fire Resist: …%'))).toEqual(['-10', '-20', '-25', '-35']);
  });

  it('reproduces the reference values of other class and item skills', () => {
    expect(spans('Blizzard', lineKey('Blizzard', 'Cold Damage: …'))).toEqual(['6-12', '76-120', '156-220', '356-460']);
    expect(spans('Fanaticism', lineKey('Fanaticism', 'Physical Damage: …%'))).toEqual(['+50', '+240', '+340', '+540']);
    expect(spans('Fanaticism', lineKey('Fanaticism', '…% Base Attack Speed'))).toEqual(['+15', '+28', '+35', '+48']);
    expect(spans('Might', lineKey('Might', 'Physical Damage: …%'))).toEqual(['+50', '+392', '+572', '+932']);
    expect(spans('Raise Skeleton', lineKey('Raise Skeleton', 'Defense: …'))).toEqual(['22', '828', '1716', '4452']);
    expect(spans('Whirlwind', lineKey('Whirlwind', 'Attack Rating: …%'))).toEqual(['+15', '+300', '+450', '+750']);
    expect(spans('Hellfire Lance', lineKey('Hellfire Lance', 'Fire Damage: …'))).toEqual(['8-10', '256-296', '516-576', '1156-1256']);
    expect(spans('Rift Shot', lineKey('Rift Shot', 'Mana Cost: …'))).toEqual(['20', '58', '78', '118']);
  });

  it('compiles formulas like the game (ternary and minus rules) and keeps lines unlisted synergies switch on', () => {
    // Cloak of Shadows aurastatcalc3 -(cond)?0:(10+lvl/2) negates the whole ternary
    expect(spans('Cloak of Shadows', lineKey('Cloak of Shadows', 'Enemy Physical Resist: …%'), false, [1, 20])).toEqual(['-10', '-20']);
    // Sharpened Focus ((lvl>0)?5:0+lvl/5)…: (cond ? 5 : 0) + lvl/5
    expect(spans('Sharpened Focus', lineKey('Sharpened Focus', 'Enemy Physical Resist: …%'), false, [1, 20])).toEqual(['-5', '-14']);
    expect(spans('Sharpened Focus', lineKey('Sharpened Focus', 'Enemy Elemental and Poison Resists: …%'), false, [20])).toEqual(['-24']);
    // Weaken reads every curse's hard points through Attack's calc1 without listing them
    expect(index.record('Weaken')?.unlistedSynergies).toContain('Amplify Damage');
    expect(spans('Weaken', lineKey('Weaken', 'Enemy Elemental Resist: …%'), true, [20])).toEqual(['-115']);
    // lines that are 0 without points in another class skill are shown
    expect(spans('Werewolf', lineKey('Werewolf', 'Max Life: …%'), true, [20])).toEqual(['+96']);
    for (const [id, keys] of [
      ['Fire Claws', ['desc4']],
      ['Fury', ['desc4']],
      ['Poison Weapon', ['desc4', 'desc5']],
      ['Reap Souls', ['dsc2-1']],
      ['Bone Armor', ['desc4', 'desc5']],
      ['Werebear', ['desc5']],
    ] as const)
      for (const key of keys)
        expect(
          index.record(id)?.lines.some((line) => line.key === key),
          `${id} ${key}`
        ).toBe(true);
    for (const skill of skillCalc.skills)
      for (const id of skill.unlistedSynergies ?? []) expect(index.skill(id)?.maxlvl, id).toBeGreaterThan(0);
  });

  it('lists only unlisted synergies whose points can change a value, one input per skill', () => {
    // Fire Ball reads Zap, Conduit, Storm Nexus and Static Focus only behind an ascendancy gate that is always 0 here
    expect(index.record('Fire Ball')?.unlistedSynergies).toBeUndefined();
    expect(index.record('Werewolf')?.unlistedSynergies).toEqual(['Lycanthropy']);
    const counts = skillCalc.skills.reduce(
      (sum, skill) => ({
        skills: sum.skills + (skill.unlistedSynergies === undefined ? 0 : 1),
        inputs: sum.inputs + (skill.unlistedSynergies?.length ?? 0),
      }),
      { skills: 0, inputs: 0 }
    );
    expect(counts).toEqual({ skills: 73, inputs: 235 });
    // Blizzard's tooltip lists Orb of Winter twice: one input
    const blizzard = index.record('Blizzard');
    expect(blizzard === undefined ? [] : synergyInputs(blizzard, index).map((input) => input.id)).toEqual([
      'Raging Gale',
      'Orb of Winter',
      'Glacial Focus',
    ]);
  });

  it('keeps the skilldetails.json fixed lines in the order the calculator shows them', () => {
    let compared = 0;
    for (const detail of skillDetails.skills) {
      const record = index.record(detail.id);
      if (detail.lines === undefined || record === undefined) continue;
      const texts = evaluateSkill(record, index, defaultContext(record, { level: 20 })).map((result) => result.text);
      const positions = detail.lines.map((line) => texts.indexOf(line)).filter((position) => position >= 0);
      if (positions.length < 2) continue;
      compared++;
      expect(positions, detail.id).toEqual([...positions].sort((a, b) => a - b));
    }
    expect(compared).toBeGreaterThan(10);
  });

  it('hides engine-computed, character-stat and always-zero lines', () => {
    // Raise Skeleton's Life is type 13 (monstats); Hellfire Lance's cooldown is 0 without its item effect
    expect(index.record('Raise Skeleton')?.lines.some((line) => line.type === 13)).toBe(false);
    expect(index.record('Hellfire Lance')?.lines.some((line) => line.key === 'dsc2-1')).toBe(false);
    // Righteous Fire's damage scales with maximum life
    expect(index.record('Righteous Fire')?.hiddenStatLines).toBeGreaterThan(0);
    expect(manifest.counts.skillCalcHiddenStat).toBe(skillCalc.skills.reduce((sum, skill) => sum + (skill.hiddenStatLines ?? 0), 0));
  });
});

// --- terrorzones.json ----------------------------------------------------------------------------------------------

describe('committed terrorzones bundle', () => {
  const areaIds = new Map(areas.map((area) => [area.id, area.name]));

  it('carries the manifest version, an exact 64-bit seed and a usable config', () => {
    expect(Object.keys(terrorZones)).toEqual(['esrVersion', 'config', 'boosts', 'zones']);
    expect(terrorZones.esrVersion).toBe(manifest.esrVersion);
    expect(terrorZones.config.seed).toMatch(/^\d+$/);
    expect(BigInt(terrorZones.config.seed) < 2n ** 64n).toBe(true);
    expect(terrorZones.config.zoneMinutes).toBeGreaterThan(0);
    expect(terrorZones.config.breakMinutes).toBeGreaterThanOrEqual(0);
    expect(manifest.files.terrorzones?.bytes).toBeLessThan(20_000);
  });

  it('has a boost per game version and difficulty, inside the monster level bounds', () => {
    expect(terrorZones.boosts.map((boost) => `${boost.version}:${String(boost.difficulty)}`)).toEqual([
      'expansion:0',
      'expansion:1',
      'expansion:2',
      'rotw:0',
      'rotw:1',
      'rotw:2',
    ]);
    for (const boost of terrorZones.boosts) expect(boost.minLevel).toBeLessThan(boost.maxLevel);
    expect(manifest.counts.terrorZoneBoosts).toBe(terrorZones.boosts.length);
  });

  it('names every zone group, with unique ids and areas as areas.json names them', () => {
    expect(new Set(terrorZones.zones.map((zone) => zone.id)).size).toBe(terrorZones.zones.length);
    expect(manifest.counts.terrorZoneGroups).toBe(terrorZones.zones.length);
    // ESR 3.2.24: 22 groups ESR-Zone01 … ESR-Zone22 in file order
    expect(terrorZones.zones.length).toBeGreaterThanOrEqual(2);
    for (const zone of terrorZones.zones) {
      expect(zone.labels.length, zone.id).toBeGreaterThan(0);
      expect(zone.areas.length, zone.id).toBeGreaterThan(0);
      for (const area of zone.areas) expect(areaIds.get(area.id), `${zone.id} ${String(area.id)}`).toBe(area.name);
    }
    expect(manifest.counts.terrorZoneAreas).toBe(terrorZones.zones.reduce((sum, zone) => sum + zone.areas.length, 0));
  });
});

// --- modifiers.json -----------------------------------------------------------------------------------------------

describe('committed modifiers bundle (ESR 3.2.24)', () => {
  const stat = (name: string) => modifiers.stats.find((entry) => entry.stat === name);
  const kind = (key: string) => modifiers.kinds.find((entry) => entry.key === key);
  const fact = (key: string) => modifiers.facts.find((entry) => entry.key === key);

  it('lists about 480 used stats, each in one kind, with unique kind keys', () => {
    const used = modifiers.stats.filter((entry) => entry.items > 0);
    expect(used.length).toBeGreaterThan(450);
    expect(used.length).toBeLessThan(560);
    expect(manifest.counts.modifierStatsUsed).toBe(used.length);
    expect(manifest.counts.modifierStats).toBe(modifiers.stats.length);
    expect(manifest.counts.modifierKinds).toBe(modifiers.kinds.length);
    expect(new Set(modifiers.kinds.map((entry) => entry.key)).size).toBe(modifiers.kinds.length);
    const kindKeys = new Set(modifiers.kinds.map((entry) => entry.key));
    const ids = new Set(modifiers.stats.map((entry) => entry.id));
    for (const entry of modifiers.stats) {
      expect(kindKeys.has(entry.kind), entry.stat).toBe(true);
      expect(entry.examples.length, entry.stat).toBeLessThanOrEqual(12);
      // every item is in one list, so the per-list counts add up to the item count
      expect(entry.items, entry.stat).toBe(Object.values(entry.usage).reduce((sum, count) => sum + count, 0));
    }
    const inKinds = modifiers.kinds.flatMap((entry) => entry.stats);
    expect(new Set(inKinds).size).toBe(inKinds.length);
    for (const id of inKinds) expect(ids.has(id)).toBe(true);
    expect(manifest.files.modifiers?.bytes).toBeLessThan(400_000);
  });

  it('pins the key modifier stats', () => {
    expect(kind('deadly-strike')?.items).toBeGreaterThan(0);
    expect(stat('item_deadlystrike')).toMatchObject({ id: 141, kind: 'deadly-strike' });
    expect(stat('item_deadlystrike')?.items).toBeGreaterThan(100);
    expect(stat('criticaldamage')).toMatchObject({ id: 434, kind: 'critical-damage', vanilla: 'esr' });
    expect(stat('item_crushingblow')?.events?.map((event) => event.func)).toEqual([16, 16]);
    // Open Wounds: only non-spawnable "of Wounding" suffixes have it, and ESR removed its item events (bleed replaces it)
    expect(stat('item_openwounds')).toMatchObject({ id: 135, items: 0, vanilla: 'changed' });
    expect(stat('item_openwounds')?.events).toBeUndefined();
    expect(kind('open-wounds')?.items).toBe(0);
    expect(stat('bleedmindam')?.items).toBeGreaterThan(0);
    // ESR fires thorns on missile hits too, and on-kill casts through the on-death function
    expect(stat('item_attackertakesdamage')?.changed).toEqual(expect.arrayContaining(['itemevent2']));
    expect(stat('item_skillonkill')?.events?.[0]?.func).toBe(30);
    expect(stat('item_hp_perlevel')?.op?.formula).toBe('maxhp += value × character level / 8');
    expect(stat('lifedrainmindam')?.text).toBe('%+d%% Physical Damage Leeched as Life');
  });

  it('pins the difficulty and plugin facts', () => {
    expect(fact('difficulty.LifeStealDivisor')).toMatchObject({ value: [1, 25, 150], vanilla: [1, 2, 3] });
    expect(fact('difficulty.ManaStealDivisor')?.value).toEqual([1, 15, 75]);
    expect(fact('difficulty.ResistPenalty')?.value).toEqual([1, -80, -150]);
    expect(fact('difficulty.PlayerDamagePercentVSPrimeEvil')?.value).toEqual([100, 50, 25]);
    expect(fact('crushingBlow.share')?.value).toEqual({
      monster: 12.5,
      champion: 12.5,
      unique: 6.25,
      super_unique: 2,
      act_boss: 2,
      minion: 12.5,
      mercenary: 5,
      player: 5,
    });
    // The config comment of `unique = 25` says 12.5 %; the value is kept, the note and a warning say so
    expect(fact('crushingBlow.share')?.note).toContain('unique = 25 gives 6.25 %');
    expect(manifest.warnings.filter((warning) => warning.startsWith('modifiers:'))).toEqual([
      'modifiers: crushing-blow.toml unique = 25 gives 6.25 % of current life, but its config comment says "50 -> 12.5 %"',
    ]);
    expect(fact('crushingBlow.ranged')?.value).toBe(100);
    expect(fact('criticalDamage.stat')?.value).toBe(434);
    expect(fact('criticalDamage.basePercent')?.value).toBe(200);
    expect(fact('dodge.cap')?.value).toEqual({ dodge: 75, avoid: 75, evade: 75 });
    expect(fact('castRate.cap')?.value).toBe(500);
    expect(fact('castRate.maxRate')?.value).toBe(196);
    expect(fact('magicFind.tail')?.value).toEqual({ unique: 10, set: 10, rare: 10 });
    expect(fact('attackRating.curve')?.value).toMatchObject({
      pivotRatio: 5,
      steepness: 5,
      tail: 3,
      lateTail: 1,
      minChance: 0,
      maxChance: 100,
    });
    expect(fact('bleed.stats')?.value).toEqual({ min: 435, max: 436, length: 437, state: 62 });
    expect(fact('resist.floor')?.value).toBe(-1000);
    expect(fact('charstats.BlockFactor')?.value).toMatchObject({ Amazon: 5, Paladin: 6, Sorceress: 4 });
    for (const entry of modifiers.facts) expect(entry.source.file, entry.key).not.toBe('');
  });
});
