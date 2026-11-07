/**
 * Pure checks over the manifest and the bundles (HEAD vs working tree) and the clone's versions: everything that needs
 * no network and no guide. The CLI reads the files and passes parsed JSON.
 */
import { compareLauncherVersions, type LauncherVersions } from '../launcherInfo.ts';
import { capLines, finding, info, ok, type Check } from './report.ts';

type Doc = Readonly<Record<string, unknown>>;

export interface ManifestLike {
  esrVersion?: string;
  esrTag?: string | null;
  esrCommit?: string;
  counts?: Readonly<Record<string, number>>;
  warnings?: readonly string[];
}

const rows = (doc: Doc | null, name: string): Doc[] => {
  const value = doc?.[name];
  return Array.isArray(value) ? (value as unknown[]).filter((entry): entry is Doc => typeof entry === 'object' && entry !== null) : [];
};
const text = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : value === undefined || value === null
        ? ''
        : JSON.stringify(value);
const short = (commit: string | null | undefined) => (commit ? commit.slice(0, 8) : '—');

// ---------------------------------------------------------------------------------------------------------------------
// 1. Versions

export interface VersionInputs {
  head: ManifestLike;
  working: ManifestLike;
  /** The clone's HEAD commit and exact tag (`git describe --tags --exact-match`, null when untagged) */
  cloneCommit: string | null;
  cloneTag: string | null;
  /** Launcher versions at the old revision and at the clone's HEAD */
  launcherOld: LauncherVersions;
  launcherNew: LauncherVersions;
}

export function versionChecks(input: VersionInputs): Check[] {
  const { head, working, cloneCommit, cloneTag, launcherOld, launcherNew } = input;
  const checks: Check[] = [];

  const describe = (m: ManifestLike) => `ESR ${m.esrVersion ?? '—'} (tag ${m.esrTag ?? 'none'}, ${short(m.esrCommit)})`;
  const manifestLines = (['esrVersion', 'esrTag', 'esrCommit'] as const).map(
    (key) => `${key}: ${text(head[key]) || '—'}${head[key] === working[key] ? '' : ` → ${text(working[key]) || '—'}`}`
  );
  const problems: string[] = [];
  if (working.esrTag && working.esrVersion !== working.esrTag) {
    problems.push(`the working-tree manifest says ESR ${working.esrVersion ?? '—'} but was built from tag ${working.esrTag}`);
  }
  if (cloneCommit !== null && working.esrCommit !== undefined && working.esrCommit !== cloneCommit) {
    problems.push(`the working-tree bundles were built from ${short(working.esrCommit)}, the clone is at ${short(cloneCommit)}`);
  }
  if (problems.length > 0) {
    checks.push(
      finding(
        'versions.manifest',
        'Manifest version',
        problems.join('; '),
        'the app labels its data and saved builds and filters with esrVersion, so a wrong label (or stale bundles) misleads players',
        manifestLines
      )
    );
  } else if (head.esrVersion === working.esrVersion && head.esrCommit === working.esrCommit && head.esrTag === working.esrTag) {
    checks.push(ok('versions.manifest', 'Manifest version', `HEAD and working tree: ${describe(working)}.`, manifestLines));
  } else {
    checks.push(info('versions.manifest', 'Manifest version', `${describe(head)} → ${describe(working)}.`, manifestLines));
  }

  if (cloneTag === null) {
    checks.push(
      finding(
        'versions.clone-tag',
        'Clone tag',
        `The clone's HEAD ${short(cloneCommit)} has no release tag`,
        'the data is built from an untagged commit (esrTag null) that the author may still change before the release'
      )
    );
  } else {
    checks.push(ok('versions.clone-tag', 'Clone tag', `The clone's HEAD ${short(cloneCommit)} is tag ${cloneTag}.`));
  }

  const mod = launcherNew.modVersion;
  if (cloneTag !== null && mod !== cloneTag) {
    checks.push(
      finding(
        'versions.mod-version',
        'metadata.modVersion',
        `d2rloader/metadata.json says modVersion ${mod ?? '—'}, the tag is ${cloneTag}`,
        'the app labels the generated data and the docs data with modVersion, so both would carry the wrong version'
      )
    );
  } else {
    checks.push(ok('versions.mod-version', 'metadata.modVersion', `modVersion ${mod ?? '—'}${cloneTag === null ? '' : ' = tag'}.`));
  }

  const launcher = compareLauncherVersions(launcherOld, launcherNew).filter(
    ({ field }) => field === 'loaderVersion' || field === 'gameVersion' || field === 'gameBuild' || field === 'saveFormatMode'
  );
  const launcherLines = launcher.map(
    ({ label, before, after, changed }) => `${label}: ${changed ? `${before ?? '—'} → ${after ?? '—'}` : (after ?? '—')}`
  );
  if (launcher.some(({ changed }) => changed)) {
    checks.push(
      finding(
        'versions.launcher',
        'D2RLoader and game build',
        `Changed: ${launcher
          .filter(({ changed }) => changed)
          .map(({ label }) => label)
          .join(', ')}`,
        "the stash parser hard-codes D2RLoader's extended save format: uploads may fail or misread until a stash saved by the new version is tested (test-fixtures/stash/)",
        launcherLines
      )
    );
  } else {
    checks.push(ok('versions.launcher', 'D2RLoader and game build', 'Unchanged since the old revision.', launcherLines));
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Manifest counts and warnings

export function manifestChecks(head: ManifestLike, working: ManifestLike): Check[] {
  const before: Readonly<Partial<Record<string, number>>> = head.counts ?? {};
  const after: Readonly<Partial<Record<string, number>>> = working.counts ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = keys
    .filter((key) => before[key] !== after[key])
    .map(
      (key) =>
        `${key}: ${before[key] === undefined ? '(new)' : String(before[key])} → ${after[key] === undefined ? '(gone)' : String(after[key])}`
    );
  const counts =
    changed.length === 0
      ? ok('manifest.counts', 'Manifest counts', `All ${String(keys.length)} counts unchanged.`)
      : info('manifest.counts', 'Manifest counts', `${String(changed.length)} of ${String(keys.length)} counts changed.`, changed);

  const oldWarnings = new Set(head.warnings ?? []);
  const newWarnings = new Set(working.warnings ?? []);
  const added = [...newWarnings].filter((warning) => !oldWarnings.has(warning));
  const removed = [...oldWarnings].filter((warning) => !newWarnings.has(warning));
  const lines = [...added.map((warning) => `+ ${warning}`), ...removed.map((warning) => `- ${warning}`)];
  let warnings: Check;
  if (added.length > 0) {
    warnings = finding(
      'manifest.warnings',
      'Generator warnings',
      `${String(added.length)} new generator warnings (${String(removed.length)} gone, ${String(newWarnings.size)} in all)`,
      'each is ESR data the generators could not read cleanly; the page that shows it may lose or misname entries',
      lines
    );
  } else if (removed.length > 0) {
    warnings = info(
      'manifest.warnings',
      'Generator warnings',
      `${String(removed.length)} warnings gone, none new (${String(newWarnings.size)} in all).`,
      lines
    );
  } else {
    warnings = ok('manifest.warnings', 'Generator warnings', `Same ${String(newWarnings.size)} warnings as HEAD.`);
  }
  return [counts, warnings];
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Skill ids

interface SkillEntry {
  name: string;
  /** `cls:page:row:col` in the class trees of skills.json, else null */
  slot: string | null;
}

function skillIndex(details: Doc | null, skills: Doc | null): Map<string, SkillEntry> {
  const slots = new Map<string, string>();
  for (const cls of rows(skills, 'classes')) {
    for (const tab of rows(cls, 'tabs')) {
      for (const skill of rows(tab, 'skills')) {
        slots.set(`${text(cls.code)}/${text(skill.id)}`, `${text(cls.code)}:${text(tab.page)}:${text(skill.row)}:${text(skill.col)}`);
      }
    }
  }
  const index = new Map<string, SkillEntry>();
  for (const skill of rows(details, 'skills')) {
    const key = `${text(skill.cls) || 'item'}/${text(skill.id)}`;
    index.set(key, { name: text(skill.name), slot: slots.get(key) ?? null });
  }
  // Tree skills missing from skilldetails still count: builds store their ids
  for (const [key, slot] of slots) if (!index.has(key)) index.set(key, { name: key.split('/').slice(1).join('/'), slot });
  return index;
}

/** Removed (or renamed) skill ids in skilldetails.json / skills.json, HEAD → working. */
export function skillIdCheck(
  head: { details: Doc | null; skills: Doc | null },
  working: { details: Doc | null; skills: Doc | null }
): Check {
  const before = skillIndex(head.details, head.skills);
  const after = skillIndex(working.details, working.skills);
  const bySlot = new Map(
    [...after].filter(([key, entry]) => entry.slot !== null && !before.has(key)).map(([key, entry]) => [entry.slot, key])
  );
  const removed: string[] = [];
  for (const [key, entry] of before) {
    if (after.has(key)) continue;
    const successor = entry.slot === null ? undefined : bySlot.get(entry.slot);
    removed.push(successor === undefined ? `- ${key}` : `- ${key} (renamed to ${successor}? same tree slot ${entry.slot ?? ''})`);
  }
  const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => `+ ${key}`);
  const renamedNames = [...after]
    .filter(([key, entry]) => before.has(key) && before.get(key)?.name !== entry.name)
    .map(([key, entry]) => `~ ${key}: name ${JSON.stringify(before.get(key)?.name)} → ${JSON.stringify(entry.name)}`);
  const lines = capLines([...removed, ...added, ...renamedNames]);
  const sizes = `${String(before.size)} → ${String(after.size)} ids`;
  if (removed.length > 0) {
    return finding(
      'skills.ids',
      'Skill ids',
      `${String(removed.length)} skill ids removed or renamed (${sizes})`,
      'builds store skill points by id and the Skills page links ?skill=<id>, so those points and links are lost',
      lines
    );
  }
  if (added.length + renamedNames.length > 0)
    return info('skills.ids', 'Skill ids', `No id removed; ${String(added.length)} added (${sizes}).`, lines);
  return ok('skills.ids', 'Skill ids', `No skill id changed (${String(after.size)} ids).`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Unknown sources

function unknownSources(doc: Doc | null): Set<string> {
  const names = new Set<string>();
  for (const item of rows(doc, 'items')) {
    if (rows(item, 'labels').some((label) => label.kind === 'unknown'))
      names.add(`${text(item.name)} (${text(item.item)} ${text(item.code)})`);
  }
  return names;
}

export function unknownSourcesCheck(head: Doc | null, working: Doc | null): Check {
  const before = unknownSources(head);
  const after = unknownSources(working);
  const added = [...after].filter((name) => !before.has(name));
  const removed = [...before].filter((name) => !after.has(name));
  const lines = [...added.map((name) => `+ ${name}`), ...removed.map((name) => `- ${name}`)];
  if (added.length > 0) {
    return finding(
      'sources.unknown',
      'Unknown sources',
      `${String(added.length)} items newly have an unknown source (${String(after.size)} in all)`,
      'their "Where it comes from" shows Unknown on the item pages and in the guide; usually a new cube, vendor or drop path the source builder does not read',
      lines
    );
  }
  if (removed.length > 0) return info('sources.unknown', 'Unknown sources', `${String(removed.length)} items got a known source.`, lines);
  return ok('sources.unknown', 'Unknown sources', `Same ${String(after.size)} items with an unknown source as HEAD.`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 7. Build crafts

const linesOf = (entry: Doc) => (Array.isArray(entry.lines) ? (entry.lines as unknown[]).map(text).join(' / ') : '');

/** The keys builds store (src/features/builds/utils/crafts.ts craftLookups) → what the craft does. */
export function craftOutcomes(enhance: Doc | null, crafting: Doc | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const outcome of rows(enhance, 'corruptionOutcomes'))
    map.set(`corruption ${text(outcome.slot)}:${text(outcome.roll)}`, linesOf(outcome));
  for (const outcome of rows(enhance, 'anointmentOutcomes')) {
    map.set(`anointment ${text(outcome.pool)}:${text(outcome.roll)}`, `${text(outcome.label)}: ${linesOf(outcome)}`);
  }
  for (const option of rows(crafting, 'forgings'))
    map.set(`forging ${text(option.kind)}:${text(option.key)}`, JSON.stringify(option.bySlot));
  for (const option of rows(crafting, 'stacking')) {
    const material = typeof option.material === 'object' && option.material !== null ? text((option.material as Doc).code) : '';
    const switchItem = typeof option.switchItem === 'object' && option.switchItem !== null ? text((option.switchItem as Doc).code) : '';
    map.set(`stacking ${text(option.kind)}:${material}:${switchItem}`, JSON.stringify(option.bySlot));
  }
  return map;
}

export function craftsCheck(
  head: { enhance: Doc | null; crafting: Doc | null },
  working: { enhance: Doc | null; crafting: Doc | null }
): Check {
  const before = craftOutcomes(head.enhance, head.crafting);
  const after = craftOutcomes(working.enhance, working.crafting);
  const clip = (value: string) => (value.length > 140 ? `${value.slice(0, 139)}…` : value);
  const changed: string[] = [];
  const removed: string[] = [];
  for (const [key, value] of before) {
    const now = after.get(key);
    if (now === undefined) removed.push(`- ${key}: ${clip(value)}`);
    else if (now !== value) changed.push(`~ ${key}: ${clip(value)} → ${clip(now)}`);
  }
  const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => `+ ${key}`);
  const lines = capLines([...changed, ...removed, ...added]);
  if (changed.length + removed.length > 0) {
    return finding(
      'builds.crafts',
      'Build crafts (corruption, anointment, forging, stacking)',
      `${String(changed.length)} outcomes changed and ${String(removed.length)} removed at the keys builds store`,
      'builds store crafts as slot:roll and kind:key, so saved builds now show a different outcome or a stale craft',
      lines
    );
  }
  if (added.length > 0)
    return info(
      'builds.crafts',
      'Build crafts (corruption, anointment, forging, stacking)',
      `${String(added.length)} outcomes added, none changed.`,
      lines
    );
  return ok(
    'builds.crafts',
    'Build crafts (corruption, anointment, forging, stacking)',
    `All ${String(after.size)} stored craft keys unchanged.`
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 8. Cube

export function cubeFallbackCheck(
  head: { manifest: ManifestLike; cube: Doc | null },
  working: { manifest: ManifestLike; cube: Doc | null }
): Check {
  const fallbacks = (cube: Doc | null) =>
    new Map(
      rows(cube, 'families')
        .filter((family) => text(family.id).startsWith('other:'))
        .map((family) => [text(family.id), Number(family.rowCount)])
    );
  const before = fallbacks(head.cube);
  const after = fallbacks(working.cube);
  const count = (m: ManifestLike, key: string) => m.counts?.[key] ?? 0;
  const families = [count(head.manifest, 'cubeFallbackFamilies'), count(working.manifest, 'cubeFallbackFamilies')];
  const rowsCount = [count(head.manifest, 'cubeFallbackRows'), count(working.manifest, 'cubeFallbackRows')];
  const lines = [
    `cubeFallbackFamilies ${String(families[0])} → ${String(families[1])}, cubeFallbackRows ${String(rowsCount[0])} → ${String(rowsCount[1])}`,
    ...[...after]
      .filter(([id, n]) => before.get(id) !== n)
      .map(([id, n]) => `${before.has(id) ? '~' : '+'} ${id}: ${String(before.get(id) ?? 0)} → ${String(n)} rows`),
    ...[...before.keys()].filter((id) => !after.has(id)).map((id) => `- ${id}`),
  ];
  if (families[1] > families[0] || rowsCount[1] > rowsCount[0]) {
    return finding(
      'cube.fallback',
      'Cube fallback families',
      'More cubemain rows fall into fallback (other:) families',
      "no family regex matched them: a cubemain description changed shape, so the guide's recipe blocks and the Cube page group them wrongly (regexes in src/features/game-data/build/cube/cubeFamilies.ts)",
      lines
    );
  }
  return ok(
    'cube.fallback',
    'Cube fallback families',
    `${String(families[1])} fallback families, ${String(rowsCount[1])} rows (HEAD ${String(families[0])} / ${String(rowsCount[0])}).`,
    lines.length > 1 ? lines : []
  );
}

/** `op` → number of enabled cubemain rows using it (0 / blank left out). */
export function cubeOps(rowsOps: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const op of rowsOps) if (op !== 0) counts.set(op, (counts.get(op) ?? 0) + 1);
  return counts;
}

/** Ops outside `known` (STAT_OPS of bundleCube.ts): new ones are findings, the ones the old revision had too are info. */
export function cubeOpsCheck(before: ReadonlyMap<number, number>, after: ReadonlyMap<number, number>, known: readonly number[]): Check {
  const unknown = [...after].filter(([op]) => !known.includes(op)).sort(([a], [b]) => a - b);
  const lines = unknown.map(
    ([op, n]) => `op ${String(op)}: ${String(before.get(op) ?? 0)} → ${String(n)} enabled rows${before.has(op) ? '' : ' (new)'}`
  );
  const fresh = unknown.filter(([op]) => !before.has(op));
  const title = 'Cube condition ops';
  if (fresh.length > 0) {
    return finding(
      'cube.ops',
      title,
      `New cubemain op values ${fresh.map(([op]) => String(op)).join(', ')} outside the known ${known.join(', ')}`,
      'the Cube page and the guide skip conditions with an unknown op silently, so those recipes show without their requirement',
      lines
    );
  }
  if (unknown.length > 0) {
    return ok(
      'cube.ops',
      title,
      `No new op; ${unknown.map(([op]) => String(op)).join(', ')} were outside ${known.join(', ')} at the old revision too.`,
      lines
    );
  }
  return ok('cube.ops', title, `Every op is one of ${known.join(', ')}.`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 10. Icons

export interface IconInputs {
  icons: Doc | null;
  bases: Doc | null;
  lootfilter: Doc | null;
}

/** Bases (by code), enabled uniques and set items (by name) without an icons.json entry. */
export function itemsWithoutIcon(input: IconInputs): Set<string> {
  const section = (name: string): Doc => {
    const value = input.icons?.[name];
    return typeof value === 'object' && value !== null ? (value as Doc) : {};
  };
  const [bases, uniques, sets] = [section('bases'), section('uniques'), section('sets')];
  const missing = new Set<string>();
  for (const base of rows(input.bases, 'bases'))
    if (!Object.hasOwn(bases, text(base.code))) missing.add(`base ${text(base.code)} (${text(base.name)})`);
  for (const unique of rows(input.lootfilter, 'uniques')) {
    if (unique.disabled !== true && !Object.hasOwn(uniques, text(unique.name))) missing.add(`unique ${text(unique.name)}`);
  }
  for (const item of rows(input.lootfilter, 'sets')) if (!Object.hasOwn(sets, text(item.name))) missing.add(`set item ${text(item.name)}`);
  return missing;
}

export function missingIconsCheck(head: IconInputs, working: IconInputs): Check {
  const before = itemsWithoutIcon(head);
  const after = itemsWithoutIcon(working);
  const added = [...after].filter((name) => !before.has(name));
  if (added.length > 0) {
    return finding(
      'icons.missing',
      'Items without an icon',
      `${String(added.length)} bases, uniques or set items newly have no icon (${String(after.size)} in all)`,
      'they show without art on the item pages, builds and the stash; run npm run game-data:icons (needs the vanilla art folder) or accept them',
      capLines(added)
    );
  }
  return ok('icons.missing', 'Items without an icon', `No new item without an icon (${String(after.size)} without one, as at HEAD).`);
}

/** icons.json sections a cube.json `icons` token is looked up in, by its prefix (engine/cubeIcons.ts, useItemIcons) */
const CUBE_TOKEN_SECTIONS: Readonly<Record<string, readonly string[]>> = {
  i: ['bases', 'quest', 'items'],
  t: ['types'],
  u: ['uniques'],
  s: ['sets'],
};

/**
 * The cube.json `icons` tokens no icons.json entry resolves, each with the first cell text that uses it. Keyed by token,
 * so a new cell naming a broad type that has no art by design (`t:armo`) is not new.
 */
export function unresolvedCubeIcons(cube: Doc | null, icons: Doc | null): Map<string, string> {
  const map = cube?.icons;
  const result = new Map<string, string>();
  if (typeof map !== 'object' || map === null) return result;
  const has = (section: string, key: string) => {
    const value = icons?.[section];
    return typeof value === 'object' && value !== null && Object.hasOwn(value, key);
  };
  for (const [cell, token] of Object.entries(map as Doc)) {
    const value = text(token);
    const sections = CUBE_TOKEN_SECTIONS[value.slice(0, 1)] ?? [];
    const key = value.slice(2);
    if (!result.has(value) && !sections.some((section) => has(section, key))) result.set(value, cell);
  }
  return result;
}

export function cubeIconsCheck(head: { cube: Doc | null; icons: Doc | null }, working: { cube: Doc | null; icons: Doc | null }): Check {
  const title = 'Cube cells without an icon';
  const before = unresolvedCubeIcons(head.cube, head.icons);
  const after = unresolvedCubeIcons(working.cube, working.icons);
  const added = [...after].filter(([token]) => !before.has(token)).map(([token, cell]) => `+ ${token} (${cell})`);
  const removed = [...before].filter(([token]) => !after.has(token)).map(([token, cell]) => `- ${token} (${cell})`);
  if (added.length > 0) {
    return finding(
      'icons.cube',
      title,
      `${String(added.length)} cube icon tokens newly resolve to no icons.json entry (${String(after.size)} in all)`,
      'the Cube Recipes page cells naming them show no picture; an item code (i:) or a unique / set name (u: / s:) the icon generator missed, or a renamed item',
      capLines([...added, ...removed])
    );
  }
  if (removed.length > 0) return info('icons.cube', title, `${String(removed.length)} tokens gained an icon.`, capLines(removed));
  return ok(
    'icons.cube',
    title,
    `No new cube icon token without an icon (${String(after.size)} without one, as at HEAD; broad types have none by design).`
  );
}

export function vanillaArtCheck(dir: string, exists: boolean, versionChanged: boolean): Check {
  if (exists) return ok('icons.vanilla-art', 'Vanilla art folder', `${dir} exists.`);
  if (versionChanged) {
    return finding(
      'icons.vanilla-art',
      'Vanilla art folder',
      `${dir} is missing and the ESR version changed`,
      'icons.json keeps the old esrVersion, so icons:check and bundleIntegrity.test.ts fail; run the update on the machine with the folder'
    );
  }
  return info('icons.vanilla-art', 'Vanilla art folder', `${dir} is missing; fine while the version is unchanged.`);
}

/** Changed icon inputs in the clone: HD sprites (items, skills) and the hd/items/*.json art indexes. */
export function iconInputsCheck(changedPaths: readonly string[]): Check {
  const groups = new Map<string, number>();
  for (const path of changedPaths) {
    const group = /\/hd\/items\/[^/]+\.json$/.test(path)
      ? path.replace(/^.*\/hd\//, 'hd/')
      : path.includes('/hd/global/ui/spells/')
        ? 'hd/global/ui/spells/ (skill icon sheets)'
        : 'hd/global/ui/items/ (item sprites)';
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  if (groups.size === 0) return ok('icons.inputs', 'Icon inputs in the clone', 'No HD sprite or hd/items/*.json changed.');
  const lines = [...groups].map(([group, n]) => `${group}: ${String(n)} files`);
  return info(
    'icons.inputs',
    'Icon inputs in the clone',
    `${String(changedPaths.length)} icon input files changed; game-data:update regenerates the icons.`,
    lines
  );
}
