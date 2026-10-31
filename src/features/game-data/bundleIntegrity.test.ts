import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { EXTRA_FAMILIES } from './build/cube/cubeCatalog.ts';
import { CUBE_FAMILIES } from './build/cube/cubeFamilies.ts';
import { readEsrSources } from './build/esrSources.ts';
import { generateBundles } from './build/generateBundles.ts';
import { COLORMAP_FILES, TINT_COLORS, untintedFile } from './build/itemTint.ts';
import { serializeBundle } from './build/writeBundle.ts';
import { decodeSkillLevelLayer, decodeTabLayer, MAX_STAT_PARAM, statLayerKind } from './engine/statLayers.ts';
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
  type LootFilterDataBundle,
  type MaterialsBundle,
  type SetsBundle,
  type SkillDetailsBundle,
  type SkillsBundle,
  type SourcesBundle,
  type TiersBundle,
  type TxtRunewordsBundle,
  type TypesBundle,
} from './engine/schema.ts';

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
const craftingText = readText('crafting');
const tiersText = readText('tiers');
const areasText = readText('areas');
const { types, classes: typeClasses } = JSON.parse(typesText) as TypesBundle;
const classCodes = typeClasses.map((cls) => cls.code);
const { bases, automods: baseAutomods = [] } = JSON.parse(basesText) as BasesBundle;
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
const crafting = JSON.parse(craftingText) as CraftingBundle;
const { codes: tierCodes } = JSON.parse(tiersText) as TiersBundle;
const { areas } = JSON.parse(areasText) as AreasBundle;

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
      ['crafting', craftingText],
      ['tiers', tiersText],
      ['areas', areasText],
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
    expect(Object.keys(icons)).toEqual(['esrVersion', 'esrTag', 'vanilla', 'bases', 'uniques', 'sets', 'misc']);
    expect(manifest.counts.itemIcons).toBe(Object.keys(icons.bases).length);
    expect(manifest.counts.uniqueIcons).toBe(Object.keys(icons.uniques).length);
    expect(manifest.counts.setIcons).toBe(Object.keys(icons.sets).length);
    expect(manifest.counts.miscIcons).toBe(Object.keys(icons.misc).length);
    // With the vanilla art as the second source almost every item has an icon (ESR 3.2.24: all of them)
    expect(Object.keys(icons.bases).length).toBeGreaterThan(640);
    expect(Object.keys(icons.uniques).length).toBeGreaterThan(1100);
    expect(Object.keys(icons.sets).length).toBeGreaterThan(260);
    // Socket fillers (gems, runes, crystals; ESR 3.2.24: 177 names, Ko Rune keyed per code)
    expect(Object.keys(icons.misc).length).toBeGreaterThan(170);

    // Vanilla provenance: the Steam build's root hash, the extraction date and the files made from vanilla sprites
    const vanilla = icons.vanilla;
    expect(vanilla?.rootHash).toMatch(/^[0-9a-f]{32}$/);
    expect(vanilla?.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const vanillaFiles = vanilla?.files ?? [];
    expect(vanillaFiles.length).toBeGreaterThan(100);
    expect(vanillaFiles).toEqual([...new Set(vanillaFiles)].sort());
    for (const file of vanillaFiles) expect(existsSync(resolve(OUTPUT_DIR, 'icons', file)), file).toBe(true);
    expect(manifest.counts.vanillaIconFiles).toBe(vanillaFiles.length);
    const entries = [icons.bases, icons.uniques, icons.sets, icons.misc].flatMap((section) => Object.values(section));
    // A vanilla file is used directly or through a recoloured variant made from it
    const usedFiles = new Set(entries.map((icon) => untintedFile(icon.file)));
    for (const file of vanillaFiles) expect(usedFiles.has(file), file).toBe(true);
    expect(manifest.counts.vanillaIcons).toBe(entries.filter((icon) => vanillaFiles.includes(untintedFile(icon.file))).length);

    // Inventory colour transforms: only unique / set entries, file named after the untinted file, map and colour
    expect([icons.bases, icons.misc].flatMap((section) => Object.values(section)).some((icon) => icon.tint !== undefined)).toBe(false);
    const tinted = [icons.uniques, icons.sets].flatMap((section) => Object.values(section)).filter((icon) => icon.tint !== undefined);
    for (const icon of tinted) {
      const tint = icon.tint ?? { map: '', color: '' };
      expect(icon.file).toBe(`${untintedFile(icon.file).replace(/\.webp$/, '')}__${tint.map}-${tint.color}.webp`);
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

  it('list the materials with known families, enhance roles and groups, without equipment bases', () => {
    const families = new Set(cube.families.map((family) => family.id));
    const listed = new Set(materials.families.map((family) => family.id));
    const groups = new Map(materials.groups.map((group) => [group.code, new Set(group.blocks.map((block) => block.code))]));
    const baseCodes = new Set(bases.map((base) => base.code));
    const reagents = new Set([
      enhance.corruption.reagent.code,
      enhance.anointment.reagent.code,
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
    expect(dragonStone?.bySlot.weapon).toEqual({ lines: ['+5% Increased Attack Speed'], steps: [5, 4, 3, 2, 1], levelReq: 2 });
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
      }
    }
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
      ? first.innerHTML.split('<br>').map((part) => part.replace(/<[^>]*>/g, '').trim())
      : [first.textContent.trim(), cells[1]?.textContent.trim() ?? ''];
    if (name !== '' && CODE.test(code) && !names.has(code)) names.set(code, name.replace(/&amp;/g, '&'));
  }
  return names;
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
    expect(serializeBundle(generated.crafting)).toBe(craftingText);
    expect(serializeBundle(generated.tiers)).toBe(tiersText);
    expect(serializeBundle(generated.areas)).toBe(areasText);
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

  it('keeps the towns (waypoint, no level) and no map entrance', () => {
    const towns = ['Rogue Encampment', 'Lut Gholein', 'Kurast Docks', 'The Pandemonium Fortress', 'Harrogath'];
    for (const name of towns) expect(areas.find((area) => area.name === name)).toMatchObject({ waypoint: true, level: null });
    expect(byId.has(0)).toBe(false);
    expect(byId.get(2)?.name).toBe('Blood Moor');
  });
});
