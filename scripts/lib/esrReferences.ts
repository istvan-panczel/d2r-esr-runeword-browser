/**
 * ESR files outside the excel tables and the strings that the app reads or follows, and what depends on each: the
 * release diff marks them, the review lists the changed ones. Tables and strings need no entry (esr:diff marks the tables
 * the generators read; the bundle diffs show the effect).
 *
 * Kinds: `hand-kept` = the app keeps hand-written figures, rules or notes from the file that a change can make stale and
 * no bundle diff shows; `generated` = a generator reads it (the bundle diffs show the effect); `tested` = a test compares
 * the bundles with it; `runtime` = the app parses the live page (docs.lag watches those).
 */
import {
  ESR_BOSS_SET_UNIQUE_DROP_FILE,
  ESR_DESECRATED_ZONES_FILE,
  ESR_MODIFIER_CONFIGS,
  ESR_MODIFIER_PATCHES,
  ESR_SUPERIOR_AFFIXES_FILE,
  modifierConfigFile,
  modifierPatchFile,
  specializationConfigPath,
} from '../../src/features/game-data/build/esrSources.ts';
import { PERK_CONFIG_FILES, SPECIALIZATIONS_CONFIG_FILE } from '../../src/features/game-data/build/bundleSpecializations.ts';
import { MASTERY_PAGE_FILE } from '../../src/features/game-data/build/masteryPage.ts';
import { SKILL_INFO_PAGE_FILE } from '../../src/features/game-data/build/skillInfoPage.ts';
import { SPECIALIZATIONS_PAGE_FILE } from '../../src/features/game-data/build/specializationsPage.ts';

export type EsrReferenceKind = 'hand-kept' | 'generated' | 'tested' | 'runtime';

export interface EsrReference {
  /** Path in the clone (docs pages: the English copy at the docs/ root) */
  path: string;
  kind: EsrReferenceKind;
  /** What in the app follows the file */
  follows: string;
}

const MODIFIER_PROSE = 'the prose and hard-coded numbers in content/modifiers/modifiers.md and open-questions.md that quote it';

export const ESR_REFERENCES: readonly EsrReference[] = [
  // Hand-kept
  {
    path: 'docs/endgame_maps.htm',
    kind: 'hand-kept',
    follows:
      'src/features/campaign-map/data/mapBosses.ts: the `page` reward figures and the fight / damage / uber notes (mapbosses.page compares the figures with the files)',
  },
  {
    path: MASTERY_PAGE_FILE,
    kind: 'hand-kept',
    follows:
      'build/bundleMasteries.ts GROUP_RULES, LOWER_CASE_MENTIONS and HIDDEN_MOD_LABELS, the specialisation list in bundleIntegrity.test.ts, and the masteries.json parts built/compared by build/masteryPage.ts (pageDiffs, pageRules, pageNotes; a changed page shows there). The rest of masteries.json comes from cubemain and the u24desc…u41desc strings',
  },
  {
    path: 'docs/Eastern Sun Resurrected Cube Recipes.html',
    kind: 'hand-kept',
    follows:
      'build/cube/cubeCatalog.ts CUBE_SECTIONS (section anchors; `notes` rewritten from the page footnotes) and FAMILY_NOTES on the Cube page',
  },
  {
    path: 'docs/special_crafting_outcomes.htm',
    kind: 'hand-kept',
    follows:
      'the Enhance page lists (corruption, anointment, sanctification) come from cubemain: compare the page with bundle.enhance; the Enhance page and guide wording that paraphrases its rules',
  },
  {
    path: 'docs/Eastern Sun Resurrected Maps.html',
    kind: 'hand-kept',
    follows: "src/features/campaign-map/data/areas.ts and links.ts: the notes and links sourced 'official'",
  },
  {
    path: 'docs/ascendancies.htm',
    kind: 'hand-kept',
    follows: 'parsed at runtime (Ascendancies page) and src/features/ascendancies/data/orbLocations.ts (hand-kept orb spots)',
  },
  ...ESR_MODIFIER_CONFIGS.map((name): EsrReference => ({
    path: modifierConfigFile(name),
    kind: 'hand-kept',
    follows: `modifiers.json facts (generated) and ${MODIFIER_PROSE}`,
  })),
  ...ESR_MODIFIER_PATCHES.map((name): EsrReference => ({
    path: modifierPatchFile(name),
    kind: 'hand-kept',
    follows: `modifiers.json facts (generated) and ${MODIFIER_PROSE}`,
  })),
  // Generated
  {
    path: SKILL_INFO_PAGE_FILE,
    kind: 'generated',
    follows: 'skilldetails.json infoPage / mercenaries (build/skillInfoPage.ts; NAME_ALIASES for renamed skills)',
  },
  {
    path: SPECIALIZATIONS_PAGE_FILE,
    kind: 'generated',
    follows:
      'specializations.json pageDiffs (the page compared with the files) and the tree summaries (build/specializationsPage.ts); the Specializations page shows both',
  },
  ...[SPECIALIZATIONS_CONFIG_FILE, ...PERK_CONFIG_FILES].map((file): EsrReference => ({
    path: specializationConfigPath(file),
    kind: 'generated',
    follows: 'specializations.json rules / perk order / perk `plugin` settings (build/bundleSpecializations.ts); the Specializations page',
  })),
  {
    path: ESR_SUPERIOR_AFFIXES_FILE,
    kind: 'generated',
    follows: 'bases.json superior / superiorRows / superiorPools (weights by qualityitems.txt row number)',
  },
  {
    path: ESR_BOSS_SET_UNIQUE_DROP_FILE,
    kind: 'generated',
    follows: 'sources.json and areas.json mapBosses `setDrop` (the unique the last boss of a set drops)',
  },
  {
    path: ESR_DESECRATED_ZONES_FILE,
    kind: 'generated',
    follows: 'terrorzones.json (every slot of the schedule; schedule.test.ts holds dated in-game slots)',
  },
  // Tested
  {
    path: 'docs/quality_affixes.htm',
    kind: 'tested',
    follows: 'bundleIntegrity.test.ts checks every superior row (weight, item types, text) against it',
  },
  { path: 'docs/sets.htm', kind: 'tested', follows: 'bundleIntegrity.test.ts checks sets.json against it' },
  { path: 'docs/weapons.htm', kind: 'tested', follows: 'bundleIntegrity.test.ts checks the base names against it' },
  { path: 'docs/armors.htm', kind: 'tested', follows: 'bundleIntegrity.test.ts checks the base names against it' },
  // Parsed at runtime
  ...[
    'runewords.htm',
    'gemwords.htm',
    'gems.htm',
    'unique_weapons.htm',
    'unique_armors.htm',
    'unique_others.htm',
    'unique_mythicals.htm',
  ].map((page): EsrReference => ({ path: `docs/${page}`, kind: 'runtime', follows: 'parsed at runtime by the app (data-sync)' })),
];

const BY_PATH = new Map(ESR_REFERENCES.map((reference) => [reference.path, reference]));

/** The reference for a clone path; locale copies of a docs page (`docs/deDE/…`) have none. */
export function esrReferenceFor(path: string): EsrReference | undefined {
  return BY_PATH.get(path);
}

/** The file name a document citing the file would use (`celestialrayone.bleed.toml`, `endgame_maps.htm`). */
export function citedName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
