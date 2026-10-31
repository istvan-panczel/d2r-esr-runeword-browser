import type {
  AffixesBundle,
  AreasBundle,
  BasesBundle,
  CraftingBundle,
  CubeBundle,
  EnhanceBundle,
  LootFilterDataBundle,
  MaterialsBundle,
  SetsBundle,
  SkillDetailsBundle,
  SkillsBundle,
  SourcesBundle,
  TiersBundle,
  TxtRunewordsBundle,
  TypesBundle,
} from '../engine/schema.ts';
import { readStatIndex } from './affixStats.ts';
import { buildAffixesBundle } from './bundleAffixes.ts';
import { buildAreasBundle } from './bundleAreas.ts';
import { attachAutomods, buildBasesBundle, readStaffMods } from './bundleBases.ts';
import { assignCubeRows, buildCubeBundle, itemTypeCodes } from './bundleCube.ts';
import { buildMaterialsBundle } from './bundleMaterials.ts';
import { buildEnhanceBundle } from './bundleEnhance.ts';
import { buildCubeNames, modRendererFor, readCube, readCubeItem } from './cube/cubeRows.ts';
import { buildLootFilterBundle } from './bundleLootFilter.ts';
import { buildLootFilterSkills, createPropertyLayerResolver, propertyGroupSources } from './bundleLootFilterSkills.ts';
import { buildRunewordsBundle } from './bundleRunewords.ts';
import { buildSetsBundle } from './bundleSets.ts';
import { buildSkillsBundle } from './bundleSkills.ts';
import { buildSkillDetailsBundle, readGrantSources } from './bundleSkillDetails.ts';
import { buildCraftingBundle } from './bundleCrafting.ts';
import { buildSourcesBundle } from './bundleSources.ts';
import { buildTiersBundle } from './bundleTiers.ts';
import { buildTypesBundle } from './bundleTypes.ts';
import type { EsrSources } from './esrSources.ts';
import { resolveName } from './itemNames.ts';
import { readAffixes, readCharStats, readItems, readItemTypes, readRuneRecipes, type ItemRow } from './model.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import type { EnhanceContext } from './bundleEnhance.ts';
import type { PropertyDef } from './stats/tables.ts';
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
  crafting: CraftingBundle;
  tiers: TiersBundle;
  // areas.json
  areas: AreasBundle;
  counts: Record<string, number>;
  /** Build warnings stored in the manifest */
  warnings: string[];
  /** String-table key conflicts; printed only (mostly chinese-overlay noise), counted in counts.stringConflicts */
  stringWarnings: string[];
}

/** Builds all bundles from the raw clone sources (no I/O). */
export function generateBundles(sources: EsrSources): GeneratedBundles {
  const { strings, warnings: stringWarnings } = buildStringTable(sources.strings);
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
  const basesBundle = attachAutomods(bases.bundle, affixes.bundle.affixes);
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

  const lootFilterSkills = buildLootFilterSkills({
    skills: table('skills'),
    skilldesc: table('skilldesc'),
    itemstatcost: rowTable('itemstatcost'),
    lookup: skillLookup,
    layers,
    sources: [
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
      ...propertyGroupSources(statTables.groups),
    ],
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
    lootFilterSkills.bundle
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
  const cubeTables = {
    cube: readCube(table('cubemain')),
    items: cubeItems,
    ...buildCubeNames(cubeItems, itemtypes, strings),
    renderMods: modRendererFor(() => renderer),
    levelName: (id: number) => levelNames.get(id) ?? null,
  };
  const cube = buildCubeBundle({
    tables: cubeTables,
    typeCodes: itemTypeCodes(itemtypes),
    statNames: new Map(rowTable('itemstatcost').rows.map((row, id) => [id, row.str('Stat')])),
    setNames: new Set(table('setitems').rows.map((row) => row.str('index'))),
    uniqueNames: new Set(table('uniqueitems').rows.map((row) => row.str('index'))),
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
  const skillDetailCount = (pick: (skill: SkillDetailsBundle['skills'][number]) => boolean) =>
    skillDetails.bundle.skills.filter(pick).length;

  const crafting = buildCraftingBundle({
    cube: cubeTables.cube,
    nameOf: cubeTables.nameOf,
    classes: types.bundle.classes,
    bases: basesBundle.bases,
    renderMods,
  });

  const tiers = buildTiersBundle(items);
  const tierCodes = Object.values(tiers.bundle.codes);
  const countTier = (tier: string) => tierCodes.filter((value) => value === tier).length;

  // --- areas.json ---
  const areas = buildAreasBundle({ levelsText: sources.tables.levels, strings });
  const countAreas = (pick: (area: AreasBundle['areas'][number]) => boolean) => areas.bundle.areas.filter(pick).length;
  const areaCounts = {
    areas: areas.bundle.areas.length,
    areasMaps: countAreas((area) => area.tier !== undefined),
    areasMapZones: new Set(areas.bundle.areas.flatMap((area) => (area.tier === undefined ? [] : [area.group]))).size,
    areasUniqueMaps: countAreas((area) => area.uniqueMap === true),
    areasWithoutMonsters: countAreas((area) => area.level === null),
    areasWithWaypoint: countAreas((area) => area.waypoint),
    areasHiddenPrepZones: areas.hidden.prepZones,
    areasHiddenOther: areas.hidden.other,
    areasUniquesMinsThenMaxes: areas.uniquesMinsThenMaxes,
  };
  // --- end areas.json ---

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
    crafting: crafting.bundle,
    tiers: tiers.bundle,
    areas: areas.bundle,
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
      enhanceCorruptionSlots: corruptionSlots.length,
      enhanceCorruptionOutcomes: corruptionOutcomes.length,
      enhanceAnointmentOutcomes: anointmentOutcomes.length - countPool('charm') - countPool('vessel'),
      enhanceCharmAnointments: countPool('charm'),
      enhanceVesselAnointments: countPool('vessel'),
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
      skillDetailsWithoutDescription: skillDetailCount((skill) => skill.description.length === 0),
      skillGrantItems: skillDetails.bundle.items.length,
      skillGrants: skillDetails.bundle.skills.reduce((sum, skill) => sum + (skill.grantedBy?.length ?? 0), 0),
      skillGrantsUndescribed: skillDetails.undescribedGrants,
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
    },
    warnings: [
      ...types.warnings,
      ...staffMods.warnings,
      ...bases.warnings,
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
      ...crafting.warnings,
      ...tiers.warnings,
      ...areas.warnings,
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
  const statIds = new Map(itemstatcost.rows.map((row, id) => [row.str('Stat'), id]));
  // A type whose items all share one name reads as that name: ESR's "Large Charm" type holds the Grand Charm
  const typeName = (code: string) => {
    const names = [...(typeItemNames.get(code) ?? [])];
    return names.length === 1 ? names[0] : typeInfo.get(code)?.name;
  };
  const isType = (code: string, parent: string) => code === parent || (typeInfo.get(code)?.ancestors.includes(parent) ?? false);
  return {
    nameOf: (token) => itemNames.get(token) ?? typeName(token) ?? resolveName(strings, token, token),
    isA: (code, parent) => isType(code, parent) || (itemTypes.get(code) ?? []).some((type) => isType(type, parent)),
    statIdsOf: (property) =>
      (properties.get(property)?.slots ?? []).flatMap((slot) => {
        const id = statIds.get(slot.stat);
        return id === undefined ? [] : [id];
      }),
    renderMods,
  };
}
