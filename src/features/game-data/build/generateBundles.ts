import type {
  AffixesBundle,
  AreasBundle,
  BasesBundle,
  CraftingBundle,
  CubeBundle,
  ElixirsBundle,
  EnhanceBundle,
  ItemTextBundle,
  LootFilterDataBundle,
  MasteriesBundle,
  MaterialsBundle,
  ModifiersBundle,
  SetsBundle,
  SkillCalcBundle,
  SkillDetailsBundle,
  SkillsBundle,
  SourcesBundle,
  SpecializationsBundle,
  StashBundle,
  StashNamesBundle,
  TerrorZonesBundle,
  TiersBundle,
  TxtRunewordsBundle,
  TypesBundle,
} from '../engine/schema.ts';
import { readStatIndex } from './affixStats.ts';
import { buildAffixesBundle } from './bundleAffixes.ts';
import { buildAreasBundle } from './bundleAreas.ts';
import { buildMapBosses } from './bundleMapBosses.ts';
import { readBossSetRules } from './pluginUniques.ts';
import { attachAutomods, buildBasesBundle, readStaffMods } from './bundleBases.ts';
import { assignCubeRows, buildCubeBundle, itemTypeCodes } from './bundleCube.ts';
import { buildMasteriesBundle, readMasterySkills } from './bundleMasteries.ts';
import { buildSpecializationsBundle } from './bundleSpecializations.ts';
import { perkChecks, perkOfStat } from './cube/perks.ts';
import { buildMaterialsBundle } from './bundleMaterials.ts';
import { buildModifiersBundle, type ModifierSource } from './bundleModifiers.ts';
import { buildEnhanceBundle } from './bundleEnhance.ts';
import { buildElixirsBundle } from './bundleElixirs.ts';
import { buildCubeNames, modRendererFor, readCube, readCubeItem, stockerCounterNames, type CubeRow } from './cube/cubeRows.ts';
import { buildLootFilterBundle } from './bundleLootFilter.ts';
import { buildLootFilterSkills, createPropertyLayerResolver, propertyGroupSources, setBonusSources } from './bundleLootFilterSkills.ts';
import { buildRunewordsBundle } from './bundleRunewords.ts';
import { buildSetsBundle } from './bundleSets.ts';
import { buildSuperiorAffixes } from './bundleSuperior.ts';
import { buildSkillsBundle } from './bundleSkills.ts';
import { buildStashBundle } from './bundleStash.ts';
import { buildItemTextBundle } from './bundleItemText.ts';
import { buildSkillDetailsBundle, readGrantSources } from './bundleSkillDetails.ts';
import { buildSkillCalcBundle } from './bundleSkillCalc.ts';
import { applySkillInfoPage, parseSkillInfoPage } from './skillInfoPage.ts';
import { buildCraftingBundle } from './bundleCrafting.ts';
import { buildSourcesBundle } from './bundleSources.ts';
import { buildTerrorZonesBundle } from './bundleTerrorZones.ts';
import { buildTiersBundle } from './bundleTiers.ts';
import { buildTypesBundle } from './bundleTypes.ts';
import type { EsrSources } from './esrSources.ts';
import { itemRowName, readUniqueOrSetRows, resolveName } from './itemNames.ts';
import { readAffixes, readCharStats, readItems, readItemTypes, readRuneRecipes, type ItemRow } from './model.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import type { EnhanceContext } from './bundleEnhance.ts';
import type { PropertyDef, PropertyGroupDef } from './stats/tables.ts';
import { createStatRenderer, readStatTables } from './stats/statRenderer.ts';
import { createSkillLookup } from './stats/skills.ts';
import { buildStringTable } from './strings.ts';
import { parseTsv, type TsvTable } from './tsv.ts';

export interface GeneratedBundles {
  types: TypesBundle;
  bases: BasesBundle;
  runewords: TxtRunewordsBundle;
  affixes: AffixesBundle;
  sources: SourcesBundle;
  lootfilter: LootFilterDataBundle;
  enhance: EnhanceBundle;
  cube: CubeBundle;
  materials: MaterialsBundle;
  sets: SetsBundle;
  skills: SkillsBundle;
  skilldetails: SkillDetailsBundle;
  // skillcalc.json
  skillcalc: SkillCalcBundle;
  crafting: CraftingBundle;
  tiers: TiersBundle;
  // areas.json
  areas: AreasBundle;
  // stash.json
  stash: StashBundle;
  // stashnames.json
  stashnames: StashNamesBundle;
  // itemtext.json
  itemtext: ItemTextBundle;
  // terrorzones.json
  terrorzones: TerrorZonesBundle;
  // modifiers.json
  modifiers: ModifiersBundle;
  // masteries.json
  masteries: MasteriesBundle;
  // specializations.json
  specializations: SpecializationsBundle;
  // elixirs.json
  elixirs: ElixirsBundle;
  counts: Record<string, number>;
  /** Build warnings stored in the manifest */
  warnings: string[];
  /** String-table key conflicts; printed only (mostly chinese-overlay noise), counted in counts.stringConflicts */
  stringWarnings: string[];
}

/** Builds all bundles from the raw clone sources (no I/O). */
export function generateBundles(sources: EsrSources): GeneratedBundles {
  const { strings, ids: stringIds, warnings: stringWarnings } = buildStringTable(sources.strings);
  const table = (name: keyof EsrSources['tables']) => parseTsv(sources.tables[name], `${name}.txt`);

  const typeRows = readItemTypes(table('itemtypes'));
  const charStats = readCharStats(table('charstats'));
  const misc = readItems(table('misc'), 'misc');
  const items = [...readItems(table('weapons'), 'weapon'), ...readItems(table('armor'), 'armor'), ...misc];
  // Bases only need ancestors/sockets/classes; type names are settled afterwards, when the base types are known
  const staffMods = readStaffMods(typeRows);
  const bases = buildBasesBundle(items, buildTypesBundle(typeRows, charStats, strings).bundle, strings, staffMods.bundle);
  const baseTypes = new Set(bases.bundle.bases.flatMap((base) => (base.type2 === null ? [base.type] : [base.type, base.type2])));
  const types = buildTypesBundle(typeRows, charStats, strings, baseTypes);
  const runeTypes = new Set(
    types.bundle.types.filter((type) => type.code === 'rune' || type.ancestors.includes('rune')).map((type) => type.code)
  );
  const runeCodes = new Set(misc.filter((item) => runeTypes.has(item.type)).map((item) => item.code));
  const statTables = readStatTables(sources.tables);
  const renderer = createStatRenderer(statTables, strings);
  const renderMods = (mods: Parameters<typeof renderer.renderMods>[0]) => renderer.renderMods(mods);
  const runewords = buildRunewordsBundle(readRuneRecipes(table('runes')), misc, types.bundle, strings, renderMods);
  // Row-numbered tables keep their Expansion marker rows so ids match the game's row numbers
  const rowTable = (name: keyof EsrSources['tables']) => parseTsv(sources.tables[name], `${name}.txt`, { keepExpansionRows: true });
  const affixRows = [
    ...readAffixes(table('magicprefix'), 'p'),
    ...readAffixes(table('magicsuffix'), 's'),
    ...readAffixes(table('automagic'), 'a'),
  ];
  // Skill, tab and class params of the layered stats (affixes.json `layers`, lootfilter.json `knownLayers`)
  const skillLookup = createSkillLookup(statTables, strings);
  const statIndex = readStatIndex(rowTable('itemstatcost'));
  const layers = createPropertyLayerResolver(statTables.properties, statIndex, (param) => skillLookup.skillId(param));
  const affixes = buildAffixesBundle(affixRows, types.bundle, strings, renderMods, {
    properties: statTables.properties,
    stats: statIndex,
    layers,
  });
  const withAutomods = attachAutomods(bases.bundle, affixes.bundle.affixes);
  const superior = buildSuperiorAffixes({
    // Rows are addressed by number (row 0 = the first line under the header)
    qualityitems: rowTable('qualityitems'),
    config: sources.plugins.superiorAffixes,
    bases: withAutomods.bases,
    types: types.bundle.types,
    throwableTypes: new Set(
      table('itemtypes')
        .rows.filter((row) => row.num('Throwable') === 1)
        .map((row) => row.str('Code'))
    ),
    renderMods,
  });
  const { rows: superiorRows, pools: superiorPools, ...superiorRules } = superior.superior;
  const basesBundle = { ...withAutomods, superior: superiorRules, superiorRows, superiorPools };
  const countAffixes = (kind: string) => affixes.bundle.affixes.filter((affix) => affix.kind === kind).length;

  const sourceItems = buildSourcesBundle(
    {
      uniqueitems: table('uniqueitems'),
      setitems: table('setitems'),
      weapons: table('weapons'),
      armor: table('armor'),
      misc: table('misc'),
      cubemain: table('cubemain'),
      treasureclassex: table('treasureclassex'),
      monstats: table('monstats'),
      superuniques: table('superuniques'),
      gamble: table('gamble'),
    },
    strings,
    sources.plugins.bossSetUniqueDrop
  );
  const countSources = (item: string) => sourceItems.bundle.items.filter((source) => source.item === item).length;

  // Every property list the game data puts on items (affixes, uniques, set items, runewords, cube outputs, set bonuses,
  // property groups): the params of the layered stats (lootfilter.json) and of the monster stats (itemtext.json)
  const modSources = [
    ...affixes.bundle.affixes.map((affix) => ({
      label: `affix ${affix.kind}${String(affix.id)}`,
      mods: affix.mods.map((mod) => ({ code: mod.prop, param: mod.param, min: mod.min, max: mod.max })),
    })),
    ...readGrantSources({
      uniqueitems: table('uniqueitems'),
      setitems: table('setitems'),
      runes: readRuneRecipes(table('runes')),
      strings,
      isRune: (code) => runeCodes.has(code),
    }).map((source) => ({ label: `${source.kind} ${source.name}`, mods: [...source.mods, ...(source.partialMods ?? [])] })),
    ...readCube(table('cubemain')).map((row) => ({
      label: `cubemain line ${String(row.line)}`,
      mods: row.outputs.flatMap((output) =>
        output.mods.map((mod) => ({ code: mod.mod, param: mod.param === '' ? null : mod.param, min: mod.min, max: mod.max }))
      ),
    })),
    ...setBonusSources(table('sets')),
    ...propertyGroupSources(statTables.groups),
  ];
  const lootFilterSkills = buildLootFilterSkills({
    skills: table('skills'),
    skilldesc: table('skilldesc'),
    itemstatcost: rowTable('itemstatcost'),
    lookup: skillLookup,
    layers,
    sources: modSources,
  });

  const lootfilter = buildLootFilterBundle(
    {
      weapons: table('weapons'),
      armor: table('armor'),
      misc: table('misc'),
      itemstatcost: rowTable('itemstatcost'),
      levels: table('levels'),
      sounds: rowTable('sounds'),
      uniqueitems: rowTable('uniqueitems'),
      setitems: rowTable('setitems'),
      treasureclassex: table('treasureclassex'),
      gems: table('gems'),
      cubemain: table('cubemain'),
    },
    strings,
    lootFilterSkills.bundle,
    affixes.bundle.stats
  );

  const enhance = buildEnhanceBundle(
    { cubemain: table('cubemain'), uniqueitems: table('uniqueitems') },
    enhanceContext(strings, items, types.bundle, statTables.properties, rowTable('itemstatcost'), renderMods)
  );
  const { corruptionSlots, corruptionOutcomes, anointmentOutcomes, vesselRecipes, vesselTransforms } = enhance.bundle;
  const countPool = (pool: string) => anointmentOutcomes.filter((outcome) => outcome.pool === pool).length;

  const itemtypes = table('itemtypes');
  const cubeItems = [
    ...table('misc').rows.map((row) => readCubeItem(row, 'misc', strings)),
    ...table('armor').rows.map((row) => readCubeItem(row, 'armor', strings)),
    ...table('weapons').rows.map((row) => readCubeItem(row, 'weapon', strings)),
  ];
  const levelNames = new Map(
    table('levels')
      .rows.filter((row) => row.str('Id') !== '')
      .map((row) => [row.num('Id'), resolveName(strings, row.str('LevelName'), row.str('Name'))])
  );
  const cubeRows = readCube(table('cubemain'));
  const counterNames = stockerCounterNames(statTables.stats, statTables.properties, strings, cubeRows);
  const statNameById = new Map(rowTable('itemstatcost').rows.map((row, id) => [id, row.str('Stat')]));
  const cubePerks = perkChecks(cubeRows, (id) => statNameById.get(id), strings);
  const cubeTables = {
    cube: cubeRows,
    items: cubeItems,
    ...buildCubeNames(cubeItems, itemtypes, strings),
    renderMods: modRendererFor(() => renderer),
    levelName: (id: number) => levelNames.get(id) ?? null,
    counterName: (modOrStat: string) => counterNames.get(modOrStat) ?? null,
    perkChecks: (row: CubeRow) => cubePerks.get(row) ?? [],
  };
  const cube = buildCubeBundle({
    tables: cubeTables,
    typeCodes: itemTypeCodes(itemtypes),
    statNames: statNameById,
    setNames: new Set(table('setitems').rows.map((row) => row.str('index'))),
    uniqueNames: new Set(table('uniqueitems').rows.map((row) => row.str('index'))),
    statIdsOf: propertyStatIds(statTables.properties, rowTable('itemstatcost'), statTables.groups),
  });
  const cubeFallbackRows = cube.fallback.reduce((sum, family) => sum + family.rows, 0);

  const materials = buildMaterialsBundle({
    misc: table('misc'),
    types: types.bundle.types,
    bases: basesBundle.bases,
    nameOf: cubeTables.nameOf,
    cubeRows: cubeTables.cube,
    familyRows: new Map([...assignCubeRows(cubeTables).assigned].map(([id, { rows }]) => [id, rows])),
    families: cube.bundle.families,
    sources: sourceItems.bundle,
    miscLabels: sourceItems.miscLabels,
    enhance: enhance.bundle,
  });
  const countMaterials = (pick: (item: MaterialsBundle['items'][number]) => boolean) => materials.bundle.items.filter(pick).length;

  const sets = buildSetsBundle({
    sets: table('sets'),
    setitems: table('setitems'),
    bases: basesBundle.bases,
    types: types.bundle.types,
    classes: types.bundle.classes,
    strings,
    renderMods,
  });

  const skills = buildSkillsBundle({
    skills: table('skills'),
    skilldesc: table('skilldesc'),
    experience: table('experience'),
    classes: types.bundle.classes,
    strings,
  });

  const skillDetails = buildSkillDetailsBundle({
    skills: table('skills'),
    skilldesc: table('skilldesc'),
    classes: types.bundle.classes,
    strings,
    items: readGrantSources({
      uniqueitems: table('uniqueitems'),
      setitems: table('setitems'),
      runes: readRuneRecipes(table('runes')),
      strings,
      isRune: (code) => runeCodes.has(code),
    }),
  });
  // ESR's skill information page: hand-written oskill descriptions and the mercenaries' skills
  const skillInfo =
    sources.skillInfoPage === null
      ? null
      : applySkillInfoPage(
          skillDetails.bundle.skills,
          parseSkillInfoPage(sources.skillInfoPage),
          new Set(table('skills').rows.map((row) => row.str('skill')))
        );
  const skillInfoWarnings = skillInfo?.warnings ?? ['skilldetails: docs/skill_information.htm missing in the ESR clone'];
  // --- masteries.json ---
  const masteries = buildMasteriesBundle({
    cube: cubeTables.cube,
    nameOf: cubeTables.nameOf,
    itemCodes: new Set(cubeItems.map((item) => item.code)),
    bases: basesBundle.bases,
    types: types.bundle.types,
    classes: types.bundle.classes,
    strings,
    skills: readMasterySkills(table('skills'), skillDetails.bundle.skills),
    renderMods: cubeTables.renderMods,
    perkChecks: cubeTables.perkChecks,
    statOf: (property) => statTables.properties.get(property)?.slots[0]?.stat,
    page: sources.masteryPage,
  });
  // --- end masteries.json ---

  // --- elixirs.json ---
  const elixirs = buildElixirsBundle({
    misc: table('misc'),
    treasureclassex: table('treasureclassex'),
    itemstatcost: rowTable('itemstatcost'),
    experience: table('experience'),
    shrines: table('shrines'),
    strings,
    cubeRows: cubeTables.cube,
    cubeRecipes: cube.bundle.recipes,
    alchemyConfig: sources.plugins.alchemy,
    renderStats: (entries) => renderer.renderStats(entries),
  });
  const countElixirs = (pick: (elixir: ElixirsBundle['elixirs'][number]) => boolean) => elixirs.bundle.elixirs.filter(pick).length;
  // --- end elixirs.json ---

  // --- skillcalc.json ---
  const skillCalc = buildSkillCalcBundle({
    skills: table('skills'),
    skilldesc: table('skilldesc'),
    missiles: table('missiles'),
    strings,
    details: skillDetails.bundle,
    statNames: new Set(rowTable('itemstatcost').rows.map((row) => row.str('Stat'))),
  });
  const skillCalcLines = skillCalc.bundle.skills.flatMap((skill) => skill.lines);
  const skillCalcCounts = {
    skillCalcSkills: skillCalc.bundle.skills.length,
    skillCalcSkillsWithLevelLines: skillCalc.bundle.skills.filter((skill) => skill.lines.some((line) => line.key.startsWith('desc')))
      .length,
    skillCalcLines: skillCalcLines.length,
    skillCalcLevelLines: skillCalcLines.filter((line) => line.key.startsWith('desc')).length,
    skillCalcFixedLines: skillCalcLines.filter((line) => line.key.startsWith('dsc2')).length,
    skillCalcSynergyLines: skillCalcLines.filter((line) => line.key.startsWith('dsc3')).length,
    skillCalcHiddenStat: skillCalc.hidden.stat,
    skillCalcHiddenEngine: skillCalc.hidden.engine,
    skillCalcHiddenUnsupported: skillCalc.hidden.unsupported,
    skillCalcHiddenParse: skillCalc.hidden.parse,
    skillCalcHiddenRandom: skillCalc.hidden.random,
    skillCalcHiddenGated: skillCalc.hidden.gated,
    skillCalcHiddenType: skillCalc.hidden.type,
    skillCalcHiddenString: skillCalc.hidden.string,
    skillCalcHiddenFormat: skillCalc.hidden.format,
    skillCalcCharLevelSkills: skillCalc.bundle.skills.filter((skill) => skill.scalesWithCharLevel === true).length,
    skillCalcHardPointSkills: skillCalc.bundle.skills.filter((skill) => skill.scalesWithHardPointsOnly === true).length,
    skillCalcSynergyInputs: skillCalc.bundle.skills.reduce((sum, skill) => sum + (skill.synergies?.length ?? 0), 0),
    skillCalcItemEffect: skillCalc.bundle.skills.filter((skill) => skill.itemEffect !== undefined).length,
    skillCalcRows: skillCalc.bundle.rows.length,
    skillCalcMissiles: skillCalc.bundle.missiles.length,
  };
  // --- end skillcalc.json ---

  const skillDetailCount = (pick: (skill: SkillDetailsBundle['skills'][number]) => boolean) =>
    skillDetails.bundle.skills.filter(pick).length;

  const crafting = buildCraftingBundle({
    cube: cubeTables.cube,
    nameOf: cubeTables.nameOf,
    classes: types.bundle.classes,
    bases: basesBundle.bases,
    renderMods,
    statIdsOf: propertyStatIds(statTables.properties, rowTable('itemstatcost'), statTables.groups),
  });

  const tiers = buildTiersBundle(items);
  const tierCodes = Object.values(tiers.bundle.codes);
  const countTier = (tier: string) => tierCodes.filter((value) => value === tier).length;

  // --- areas.json ---
  const areasOnly = buildAreasBundle({ levelsText: sources.tables.levels, cubemainText: sources.tables.cubemain, strings });
  const bosses = buildMapBosses({
    areas: areasOnly.bundle.areas,
    monstats: table('monstats'),
    treasureclassex: table('treasureclassex'),
    itemNames: new Map(items.map((item) => [item.code, itemRowName(strings, item.namestr, item.name)])),
    uniqueNames: new Map(readUniqueOrSetRows(table('uniqueitems'), 'code', strings).map((row) => [row.index, row.name])),
    strings,
    setRules: readBossSetRules(sources.plugins.bossSetUniqueDrop),
  });
  const areas = {
    ...areasOnly,
    bundle: { areas: bosses.areas, mapBosses: bosses.mapBosses },
    warnings: [...areasOnly.warnings, ...bosses.warnings],
  };
  const countAreas = (pick: (area: AreasBundle['areas'][number]) => boolean) => areas.bundle.areas.filter(pick).length;
  const areaCounts = {
    areas: areas.bundle.areas.length,
    areasMaps: countAreas((area) => area.tier !== undefined),
    areasMapZones: new Set(areas.bundle.areas.flatMap((area) => (area.tier === undefined ? [] : [area.group]))).size,
    areasUniqueMaps: countAreas((area) => area.uniqueMap === true),
    areasWithoutMonsters: countAreas((area) => area.level === null),
    areasWithWaypoint: countAreas((area) => area.waypoint),
    areasHiddenPrepZones: areas.hidden.prepZones,
    areasHiddenRemoved: areas.hidden.removed,
    areasHiddenOther: areas.hidden.other,
    areasOneWayVis: areas.oneWayVis,
    areasWithMapItem: countAreas((area) => area.mapItem !== undefined),
    areasUniquesMinsThenMaxes: areas.uniquesMinsThenMaxes,
    areasMapBosses: bosses.mapBosses.length,
    areasMapBossArenas: countAreas((area) => area.mapBosses !== undefined),
  };
  // --- end areas.json ---

  // --- specializations.json ---
  const specializations = buildSpecializationsBundle({
    sources: sources.specializations,
    itemstatcost: rowTable('itemstatcost'),
    misc: table('misc'),
    skills: table('skills'),
    treasureclassex: table('treasureclassex'),
    monstats: table('monstats'),
    superuniques: table('superuniques'),
    levels: table('levels'),
    areaNames: new Map(areas.bundle.areas.map((area) => [area.id, area.name])),
    cubeRows: cubeTables.cube,
    familyRows: new Map([...assignCubeRows(cubeTables).assigned].map(([id, { rows }]) => [id, rows])),
    perkChecks: cubeTables.perkChecks,
    cube: cube.bundle,
    enhance: enhance.bundle,
    masteries: masteries.bundle,
    strings,
    nameOf: cubeTables.nameOf,
  });
  // --- end specializations.json ---

  // --- stash.json ---
  const stash = buildStashBundle(
    {
      itemstatcost: rowTable('itemstatcost'),
      itemtypes,
      weapons: table('weapons'),
      armor: table('armor'),
      misc: table('misc'),
      inventory: table('inventory'),
      cubemain: table('cubemain'),
      uniqueitems: rowTable('uniqueitems'),
      setitems: rowTable('setitems'),
      sets: table('sets'),
      runes: table('runes'),
    },
    strings,
    stringIds
  );
  // --- end stash.json ---

  // --- itemtext.json ---
  const itemText = buildItemTextBundle(
    {
      itemstatcost: rowTable('itemstatcost'),
      magicprefix: rowTable('magicprefix'),
      magicsuffix: rowTable('magicsuffix'),
      automagic: rowTable('automagic'),
      setitems: rowTable('setitems'),
      statTables,
      skillIds: lootFilterSkills.bundle.skills.map((skill) => skill.id),
      mods: modSources.flatMap((source) => source.mods),
      bases: {
        itemtypes,
        weapons: table('weapons'),
        armor: table('armor'),
        misc: table('misc'),
        gems: table('gems'),
        uniqueitems: rowTable('uniqueitems'),
      },
    },
    strings
  );
  // --- end itemtext.json ---

  // --- terrorzones.json ---
  const terrorZones = buildTerrorZonesBundle({
    esrVersion: sources.esrVersion,
    desecratedZonesText: sources.desecratedZones,
    levelsText: sources.tables.levels,
    levelGroupsText: sources.tables.levelgroups,
    strings,
    areas: areas.bundle,
  });
  // --- end terrorzones.json ---

  // --- modifiers.json ---
  const itemNames = new Map(items.map((item) => [item.code, resolveName(strings, item.namestr, item.name)]));
  const typeNames = new Map(types.bundle.types.map((type) => [type.code, type.name]));
  const affixKinds = { p: 'prefix', s: 'suffix', a: 'automagic' } as const;
  const modCodes = (mods: readonly { code: string }[]) => mods.filter((mod) => mod.code !== '');
  const modifierSources: ModifierSource[] = [
    ...affixes.bundle.affixes.map((affix) => ({
      kind: affixKinds[affix.kind],
      name: affix.name,
      mods: affix.mods.map((mod) => ({ code: mod.prop })),
    })),
    ...readGrantSources({
      uniqueitems: table('uniqueitems'),
      setitems: table('setitems'),
      runes: readRuneRecipes(table('runes')),
      strings,
      isRune: (code) => runeCodes.has(code),
    }).map((source) => ({
      kind: source.kind,
      name: source.name,
      mods: modCodes([...source.mods, ...(source.partialMods ?? [])]),
    })),
    ...setBonusSources(table('sets')).map((source) => {
      const index = source.label.replace(/^set bonus /, '');
      return { kind: 'setBonus' as const, name: resolveName(strings, index, index), mods: modCodes(source.mods) };
    }),
    ...table('qualityitems').rows.map((row) => {
      const itemTypes = [1, 2, 3, 4, 5, 6, 7].map((i) => row.str(`itype${String(i)}`)).filter((code) => code !== '');
      return {
        kind: 'superior' as const,
        name: `Superior ${itemTypes.map((code) => typeNames.get(code) ?? code).join(' / ') || 'item'}`,
        mods: modCodes([row.str('mod1code'), row.str('mod2code')].map((code) => ({ code }))),
      };
    }),
    ...table('gems').rows.map((row) => ({
      kind: 'socketable' as const,
      name: itemNames.get(row.str('code')) ?? row.str('name'),
      mods: modCodes(
        ['weapon', 'helm', 'shield'].flatMap((slot) => [1, 2, 3].map((i) => ({ code: row.str(`${slot}Mod${String(i)}Code`) })))
      ),
    })),
    ...cubeTables.cube.map((row) => ({
      kind: 'cube' as const,
      name: row.description === '' ? `cubemain line ${String(row.line)}` : row.description,
      mods: modCodes(row.outputs.flatMap((output) => output.mods.map((mod) => ({ code: mod.mod })))),
    })),
  ].filter((source) => source.mods.length > 0);
  const modifiers = buildModifiersBundle({
    itemstatcost: rowTable('itemstatcost'),
    properties: statTables.properties,
    groups: statTables.groups,
    strings,
    sources: modifierSources,
    difficultylevels: table('difficultylevels'),
    charstats: table('charstats'),
    monstats: table('monstats'),
    misc: table('misc'),
    skills: table('skills'),
    configs: sources.modifierConfigs,
    patches: sources.modifierPatches,
  });
  // --- end modifiers.json ---

  const countKind = (kind: string) => bases.bundle.bases.filter((base) => base.kind === kind).length;
  return {
    types: types.bundle,
    bases: basesBundle,
    runewords: runewords.bundle,
    affixes: affixes.bundle,
    sources: sourceItems.bundle,
    lootfilter: lootfilter.bundle,
    enhance: enhance.bundle,
    cube: cube.bundle,
    materials: materials.bundle,
    sets: sets.bundle,
    skills: skills.bundle,
    skilldetails: skillDetails.bundle,
    skillcalc: skillCalc.bundle,
    crafting: crafting.bundle,
    tiers: tiers.bundle,
    areas: areas.bundle,
    stash: stash.bundle,
    stashnames: stash.names,
    itemtext: itemText.bundle,
    terrorzones: terrorZones.bundle,
    modifiers: modifiers.bundle,
    masteries: masteries.bundle,
    specializations: specializations.bundle,
    elixirs: elixirs.bundle,
    counts: {
      types: types.bundle.types.length,
      classes: types.bundle.classes.length,
      bases: bases.bundle.bases.length,
      weapons: countKind('weapon'),
      armors: countKind('armor'),
      misc: countKind('misc'),
      strings: strings.size,
      stringConflicts: stringWarnings.length,
      duplicateBases: bases.duplicates,
      baseAutomods: basesBundle.automods?.length ?? 0,
      basesWithAutomods: basesBundle.bases.filter((base) => base.automods !== undefined).length,
      basesWithStaffMods: basesBundle.bases.filter((base) => base.staffMods !== undefined).length,
      superiorRows: superior.superior.rows.length,
      superiorPools: superior.superior.pools.length,
      // Rows with a weight of their own (ESR 3.3: every frequency cell; 0 = never rolls)
      superiorWeightedRows: superior.superior.rows.filter((row) => row.weight !== superior.superior.defaultWeight).length,
      runewords: runewords.bundle.runewords.length,
      runewordRows: runewords.bundle.runewords.reduce((sum, runeword) => sum + runeword.rows.length, 0),
      affixes: affixes.bundle.affixes.length,
      affixesPrefix: countAffixes('p'),
      affixesSuffix: countAffixes('s'),
      affixesAutomagic: countAffixes('a'),
      affixesDropped: affixes.dropped,
      affixesPlaceholdersDropped: affixes.droppedPlaceholders,
      sourcesUnique: countSources('unique'),
      sourcesSet: countSources('set'),
      sourcesMisc: countSources('misc'),
      sourcesMerged: sourceItems.merged,
      sourcesUnknown: sourceItems.bundle.items.filter((source) => source.labels.some((entry) => entry.kind === 'unknown')).length,
      lootFilterItems: lootfilter.bundle.items.length,
      lootFilterStats: lootfilter.bundle.stats.length,
      lootFilterAreas: lootfilter.bundle.areas.length,
      lootFilterSounds: lootfilter.bundle.sounds.length,
      lootFilterUniques: lootfilter.bundle.uniques.length,
      lootFilterSets: lootfilter.bundle.sets.length,
      lootFilterCouponUniques: lootfilter.bundle.uniques.filter((unique) => unique.coupon === true).length,
      lootFilterSkills: lootFilterSkills.bundle.skills.length,
      lootFilterKnownLayers: lootFilterSkills.bundle.knownLayers.reduce((sum, entry) => sum + entry.layers.length, 0),
      lootFilterSkillNames: lootFilterSkills.bundle.skillNames.filter((name) => name !== '').length,
      enhanceCorruptionSlots: corruptionSlots.length,
      enhanceCorruptionOutcomes: corruptionOutcomes.length,
      enhanceAnointmentOutcomes: anointmentOutcomes.length - countPool('charm') - countPool('vessel'),
      enhanceCharmAnointments: countPool('charm'),
      enhanceVesselAnointments: countPool('vessel'),
      enhanceSanctificationOutcomes: enhance.bundle.sanctificationOutcomes.length,
      enhanceVesselRecipes: vesselRecipes.length,
      enhanceVesselTransforms: vesselTransforms.length,
      cubeRecipes: cube.bundle.families.reduce((sum, family) => sum + family.rowCount, 0),
      cubeFamilies: cube.bundle.families.length,
      cubeFallbackFamilies: cube.fallback.length,
      cubeFallbackRows,
      cubeMergedRows: cube.bundle.rows.length,
      cubeRawRecipes: cube.bundle.recipes.length,
      cubeHiddenEnhance: cube.bundle.hidden.enhance,
      cubeHiddenTraps: cube.bundle.hidden.traps,
      cubeHiddenOld: cube.bundle.hidden.old,
      cubeHiddenStockers: cube.bundle.hidden.stockers,
      cubeHiddenDummy: cube.bundle.hidden.dummy,
      materialsItems: materials.bundle.items.length,
      materialsGroups: materials.bundle.groups.length,
      materialsCollapsed: materials.collapsed,
      materialsUsedInCube: countMaterials((item) => item.usedIn.length > 0),
      materialsMadeByCube: countMaterials((item) => item.madeBy.length > 0),
      materialsUnknownSource: countMaterials((item) => item.sources.some((source) => source.kind === 'unknown')),
      materialsExcludedBases: materials.excluded.bases,
      materialsExcludedGold: materials.excluded.gold,
      materialsExcludedUnlisted: materials.excluded.unlisted,
      materialsExcludedQuest: materials.excluded.quest,
      materialsExcludedUnused: materials.excluded.unused,
      sets: sets.bundle.sets.length,
      setItems: sets.bundle.sets.reduce((sum, set) => sum + set.items.length, 0),
      setsHidden: sets.hidden.sets,
      setItemsHidden: sets.hidden.items,
      skillClasses: skills.bundle.classes.length,
      skills: skills.bundle.classes.reduce((sum, cls) => sum + cls.tabs.reduce((tabSum, tab) => tabSum + tab.skills.length, 0), 0),
      skillsSkipped: skills.skipped,
      skillDetails: skillDetails.bundle.skills.length,
      skillDetailsItemSkills: skillDetailCount((skill) => skill.cls === null),
      skillDetailsWithGrants: skillDetailCount((skill) => skill.grantedBy !== undefined),
      skillDetailsWithSynergies: skillDetailCount((skill) => skill.synergies !== undefined),
      skillComboBonuses: skillDetails.bundle.skills.reduce((sum, skill) => sum + (skill.comboBonuses?.length ?? 0), 0),
      skillDetailsWithoutDescription: skillDetailCount((skill) => skill.description.length === 0),
      ...skillInfo?.counts,
      skillGrantItems: skillDetails.bundle.items.length,
      skillGrants: skillDetails.bundle.skills.reduce((sum, skill) => sum + (skill.grantedBy?.length ?? 0), 0),
      skillGrantsUndescribed: skillDetails.undescribedGrants,
      ...skillCalcCounts,
      skillIcons: new Set(skillDetails.bundle.skills.flatMap((skill) => (skill.icon === undefined ? [] : [skill.icon]))).size,
      craftingForgings: crafting.bundle.forgings.length,
      craftingStacking: crafting.bundle.stacking.length,
      craftingRowsUsed: crafting.rowsUsed,
      craftingRowsSkipped: crafting.rowsSkipped,
      tierCodes: tierCodes.length,
      tierCodesNormal: countTier('normal'),
      tierCodesExceptional: countTier('exceptional'),
      tierCodesElite: countTier('elite'),
      tierCodesMythical: countTier('mythical'),
      ...areaCounts,
      stashItemCodes: stash.bundle.items.length,
      stashSavedStats: stash.bundle.stats.filter((stat) => stat !== null).length,
      stashCoupons: stash.bundle.coupons.filter((coupon) => coupon.wildCard !== true).length,
      stashCouponRecipes: stash.bundle.coupons.filter((coupon) => coupon.unique !== undefined).length,
      stashCouponWildCardRecipes: stash.bundle.coupons.filter((coupon) => coupon.withWildCards !== undefined).length,
      stashUniques: stash.names.uniques.length,
      stashSetItems: stash.names.setItems.length,
      stashRunewords: stash.names.runewords.filter((entry) => entry.gemword !== true).length,
      stashGemwords: stash.names.runewords.filter((entry) => entry.gemword === true).length,
      itemTextStats: itemText.bundle.stats.filter((stat) => stat !== null).length,
      itemTextStrings: Object.keys(itemText.bundle.strings).length,
      itemTextSkills: itemText.bundle.skills.length,
      itemTextMonsters: itemText.bundle.monsters.filter((name) => name !== null).length,
      itemTextMagicPrefixes: itemText.bundle.magicPrefixes.filter((name) => name !== null).length,
      itemTextMagicSuffixes: itemText.bundle.magicSuffixes.filter((name) => name !== null).length,
      itemTextAutoAffixes: itemText.bundle.autoAffixes.filter((name) => name !== null).length,
      itemTextRareNames: itemText.bundle.rareNames.filter((name) => name !== null).length,
      terrorZoneGroups: terrorZones.bundle.zones.length,
      terrorZoneAreas: terrorZones.bundle.zones.reduce((sum, zone) => sum + zone.areas.length, 0),
      terrorZoneUnlistedLevels: terrorZones.unlistedLevels,
      terrorZoneBoosts: terrorZones.bundle.boosts.length,
      modifierStats: modifiers.bundle.stats.length,
      modifierStatsUsed: modifiers.bundle.stats.filter((stat) => stat.items > 0).length,
      modifierStatsEsrOnly: modifiers.bundle.stats.filter((stat) => stat.vanilla === 'esr').length,
      modifierStatsChanged: modifiers.bundle.stats.filter((stat) => stat.vanilla === 'changed').length,
      modifierKinds: modifiers.bundle.kinds.length,
      modifierKeyKinds: modifiers.bundle.kinds.filter((kind) => kind.generated !== true).length,
      modifierFacts: modifiers.bundle.facts.length,
      modifierConfigFacts: modifiers.bundle.facts.filter((fact) => fact.origin === 'esr-config').length,
      modifierSources: modifierSources.length,
      masteries: masteries.bundle.masteries.length,
      masteryBases: new Set(masteries.bundle.masteries.flatMap((mastery) => mastery.bases)).size,
      masteryEffects: masteries.bundle.masteries.reduce((sum, mastery) => sum + mastery.effects.length, 0),
      masterySkills: Object.keys(masteries.bundle.skillNames).length,
      masteryOtherBases: masteries.bundle.masteries.reduce((sum, mastery) => sum + (mastery.otherBases?.length ?? 0), 0),
      masteryPageDiffs: masteries.bundle.pageDiffs.length,
      ...specializations.counts,
      elixirs: elixirs.bundle.elixirs.length,
      elixirsRegular: countElixirs((elixir) => elixir.variant === 'regular'),
      elixirsGreater: countElixirs((elixir) => elixir.variant === 'greater'),
      elixirsSpecial: countElixirs((elixir) => elixir.variant === 'special'),
      elixirsForEveryone: countElixirs((elixir) => elixir.dropPerks?.length === 0),
      elixirsPerkGated: countElixirs((elixir) => (elixir.dropPerks?.length ?? 0) > 0),
      elixirsNoSource: countElixirs((elixir) => elixir.dropPerks === undefined && elixir.recipes === undefined),
      elixirPerks: elixirs.bundle.perks.length,
      elixirDropSources: elixirs.bundle.drops.sources.length,
      elixirRecipes: elixirs.bundle.recipes.length,
    },
    warnings: [
      ...types.warnings,
      ...staffMods.warnings,
      ...bases.warnings,
      ...superior.warnings,
      ...runewords.warnings,
      ...affixes.warnings,
      ...sourceItems.warnings,
      ...lootfilter.warnings,
      ...lootFilterSkills.warnings,
      ...enhance.warnings,
      ...cube.warnings,
      ...materials.warnings,
      ...sets.warnings,
      ...skills.warnings,
      ...skillDetails.warnings,
      ...skillInfoWarnings,
      ...skillCalc.warnings,
      ...crafting.warnings,
      ...tiers.warnings,
      ...areas.warnings,
      ...stash.warnings,
      ...itemText.warnings,
      ...terrorZones.warnings,
      ...modifiers.warnings,
      ...masteries.warnings,
      ...specializations.warnings,
      ...elixirs.warnings,
    ],
    stringWarnings: [...stringWarnings],
  };
}

/** Names, item type ancestry and property → stat ids for the enhance bundle */
function enhanceContext(
  strings: ReadonlyMap<string, string>,
  items: readonly ItemRow[],
  types: TypesBundle,
  properties: ReadonlyMap<string, PropertyDef>,
  itemstatcost: TsvTable,
  renderMods: ModsRenderer
): EnhanceContext {
  const itemNames = new Map<string, string>();
  const itemTypes = new Map<string, string[]>();
  const typeItemNames = new Map<string, Set<string>>();
  for (const item of items) {
    if (itemNames.has(item.code)) continue;
    const name = resolveName(strings, item.namestr, item.name);
    itemNames.set(item.code, name);
    const own = [item.type, item.type2].filter((type) => type !== '');
    itemTypes.set(item.code, own);
    for (const type of own) typeItemNames.set(type, (typeItemNames.get(type) ?? new Set()).add(name));
  }
  const typeInfo = new Map(types.types.map((type) => [type.code, type]));
  // A type whose items all share one name reads as that name: ESR's "Large Charm" type holds the Grand Charm
  const typeName = (code: string) => {
    const names = [...(typeItemNames.get(code) ?? [])];
    return names.length === 1 ? names[0] : typeInfo.get(code)?.name;
  };
  const isType = (code: string, parent: string) => code === parent || (typeInfo.get(code)?.ancestors.includes(parent) ?? false);
  return {
    nameOf: (token) => itemNames.get(token) ?? typeName(token) ?? resolveName(strings, token, token),
    isA: (code, parent) => isType(code, parent) || (itemTypes.get(code) ?? []).some((type) => isType(type, parent)),
    statIdsOf: propertyStatIds(properties, itemstatcost),
    renderMods,
    perkOf: (statId) => perkOfStat(itemstatcost.rows[statId]?.str('Stat') ?? '', strings),
  };
}

/**
 * Property → the itemstatcost ids (row numbers) of the stats it sets; [] for an unknown property. With `groups`, a
 * propertygroups.txt group whose entries all apply (PickMode 0, the D-stoning `*-cap-group` mods) sets its entries' stats.
 */
function propertyStatIds(
  properties: ReadonlyMap<string, PropertyDef>,
  itemstatcost: TsvTable,
  groups?: ReadonlyMap<string, PropertyGroupDef>
): (property: string) => number[] {
  const statIds = new Map(itemstatcost.rows.map((row, id) => [row.str('Stat'), id]));
  const idsOf = (property: string, depth: number): number[] => {
    const group = groups?.get(property);
    if (group !== undefined && group.pickMode === 0 && depth < 5) return group.entries.flatMap((entry) => idsOf(entry.prop, depth + 1));
    return (properties.get(property)?.slots ?? []).flatMap((slot) => {
      const id = statIds.get(slot.stat);
      return id === undefined ? [] : [id];
    });
  };
  return (property) => idsOf(property, 0);
}
