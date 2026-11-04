import { describe, expect, it } from 'vitest';
import { EMPTY_LAUNCHER_VERSIONS } from '../launcherInfo.ts';
import {
  craftsCheck,
  cubeFallbackCheck,
  cubeOps,
  cubeOpsCheck,
  iconInputsCheck,
  manifestChecks,
  missingIconsCheck,
  skillIdCheck,
  unknownSourcesCheck,
  vanillaArtCheck,
  versionChecks,
} from './dataChecks.ts';
import { findShifts, idShiftChecks, idSpaces } from './idShifts.ts';

const manifest = { esrVersion: '3.2.24', esrTag: '3.2.24', esrCommit: 'b0622767aaaa' };
const launcher = { ...EMPTY_LAUNCHER_VERSIONS, modVersion: '3.2.24', loaderVersion: '1.3.1', gameVersion: '3.3.0', gameBuild: '93847' };
const byId = (checks: { id: string; status: string }[]) => Object.fromEntries(checks.map((check) => [check.id, check.status]));

describe('version checks', () => {
  it('is all ok for an unchanged, tagged clone', () => {
    const checks = versionChecks({
      head: manifest,
      working: manifest,
      cloneCommit: 'b0622767aaaa',
      cloneTag: '3.2.24',
      launcherOld: launcher,
      launcherNew: launcher,
    });
    expect(byId(checks)).toEqual({
      'versions.manifest': 'ok',
      'versions.clone-tag': 'ok',
      'versions.mod-version': 'ok',
      'versions.launcher': 'ok',
    });
  });

  it('flags an untagged clone, a stale modVersion and a loader bump', () => {
    const working = { esrVersion: '3.2.24', esrTag: '3.2.25', esrCommit: 'c0ffee' };
    const checks = versionChecks({
      head: manifest,
      working,
      cloneCommit: 'c0ffee',
      cloneTag: '3.2.25',
      launcherOld: launcher,
      launcherNew: { ...launcher, loaderVersion: '1.4.0' },
    });
    expect(byId(checks)).toMatchObject({
      'versions.manifest': 'finding',
      'versions.mod-version': 'finding',
      'versions.launcher': 'finding',
    });
    const untagged = versionChecks({
      head: manifest,
      working: manifest,
      cloneCommit: 'b0622767aaaa',
      cloneTag: null,
      launcherOld: launcher,
      launcherNew: launcher,
    });
    expect(byId(untagged)['versions.clone-tag']).toBe('finding');
    expect(checks.find((check) => check.status === 'finding')?.summary).toContain('Why it matters:');
  });

  it('notices bundles built from another commit than the clone HEAD', () => {
    const checks = versionChecks({
      head: manifest,
      working: manifest,
      cloneCommit: 'deadbeef',
      cloneTag: '3.2.24',
      launcherOld: launcher,
      launcherNew: launcher,
    });
    expect(byId(checks)['versions.manifest']).toBe('finding');
  });
});

describe('manifest checks', () => {
  it('lists changed counts and new warnings', () => {
    const [counts, warnings] = manifestChecks(
      { counts: { a: 1, b: 2 }, warnings: ['bases: old', 'bases: kept'] },
      { counts: { a: 1, b: 3, c: 4 }, warnings: ['bases: kept', 'stash: new'] }
    );
    expect(counts).toMatchObject({ status: 'info', details: ['b: 2 → 3', 'c: (new) → 4'] });
    expect(warnings).toMatchObject({ status: 'finding', details: ['+ stash: new', '- bases: old'] });
    expect(
      manifestChecks({ counts: { a: 1 }, warnings: ['x'] }, { counts: { a: 1 }, warnings: ['x'] }).map((check) => check.status)
    ).toEqual(['ok', 'ok']);
  });
});

describe('skill ids', () => {
  const skills = (id: string) => ({ classes: [{ code: 'ama', tabs: [{ page: 1, skills: [{ id, row: 1, col: 1 }] }] }] });
  const details = (id: string) => ({
    skills: [
      { id, name: id, cls: 'ama' },
      { id: 'Teleport', name: 'Teleport', cls: null },
    ],
  });

  it('reports a removed id with a rename hint from the tree slot', () => {
    const check = skillIdCheck(
      { details: details('Old Arrow'), skills: skills('Old Arrow') },
      { details: details('New Arrow'), skills: skills('New Arrow') }
    );
    expect(check.status).toBe('finding');
    expect(check.details[0]).toBe('- ama/Old Arrow (renamed to ama/New Arrow? same tree slot ama:1:1:1)');
  });

  it('is ok when nothing moved', () => {
    expect(skillIdCheck({ details: details('A'), skills: skills('A') }, { details: details('A'), skills: skills('A') }).status).toBe('ok');
  });
});

describe('unknown sources', () => {
  const doc = (...names: string[]) => ({
    items: names.map((name) => ({ name, item: 'misc', code: name.slice(0, 3), labels: [{ kind: 'unknown', text: '?' }] })),
  });
  it('reports only the new ones as findings', () => {
    expect(unknownSourcesCheck(doc('Ore'), doc('Ore')).status).toBe('ok');
    expect(unknownSourcesCheck(doc('Ore'), doc('Ore', 'Elixir')).details).toEqual(['+ Elixir (misc Eli)']);
    expect(unknownSourcesCheck(doc('Ore'), doc()).status).toBe('info');
  });
});

describe('id shifts', () => {
  it('finds renamed and vanished ids, not appended ones', () => {
    const before = new Map([
      ['0', 'a'],
      ['1', 'b'],
      ['2', 'c'],
    ]);
    const after = new Map([
      ['0', 'a'],
      ['1', 'x'],
      ['3', 'd'],
    ]);
    expect(findShifts(before, after)).toEqual([
      { id: '1', before: 'b', after: 'x' },
      { id: '2', before: 'c', after: null },
    ]);
  });

  it('checks every id space per file', () => {
    const side = (soundTwo: string) =>
      idSpaces({
        lootfilter: { uniques: [{ id: 0, name: 'Cello' }], sounds: ['', 'gong', soundTwo] },
        stashnames: { runewords: [{ id: 1742, key: 'Deadly' }] },
        itemtext: { stats: [{ stat: 'strength' }], magicPrefixes: ['Sturdy'] },
        stash: { stats: [[14, 1000, 0]] },
      });
    const checks = idShiftChecks(side('mid'), side('tink'));
    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ['ids.lootfilter', 'finding'],
      ['ids.stashnames', 'ok'],
      ['ids.itemtext', 'ok'],
      ['ids.stash', 'ok'],
    ]);
    expect(checks[0].details).toEqual(['sounds 2: "mid" → "tink"']);
  });
});

describe('build crafts', () => {
  const enhance = (line: string) => ({
    corruptionOutcomes: [{ slot: 'weapon', roll: 1, lines: [line] }],
    anointmentOutcomes: [{ pool: 'ring', roll: 2, label: 'of X', lines: ['y'] }],
  });
  const crafting = {
    forgings: [{ kind: 'skill', key: 'ama', bySlot: { weapon: ['+1'] } }],
    stacking: [{ kind: 'dstone', material: { code: 'sss' }, bySlot: {} }],
  };

  it('flags a changed outcome at a stored key', () => {
    const check = craftsCheck({ enhance: enhance('+10% ED'), crafting }, { enhance: enhance('+20% ED'), crafting });
    expect(check.status).toBe('finding');
    expect(check.details).toEqual(['~ corruption weapon:1: +10% ED → +20% ED']);
    expect(craftsCheck({ enhance: enhance('a'), crafting }, { enhance: enhance('a'), crafting }).status).toBe('ok');
  });
});

describe('cube', () => {
  const cube = (rows: number) => ({
    families: [
      { id: 'other:x', rowCount: rows },
      { id: 'socket', rowCount: 9 },
    ],
  });
  const counts = (families: number, rows: number) => ({ counts: { cubeFallbackFamilies: families, cubeFallbackRows: rows } });

  it('flags growing fallback families', () => {
    expect(cubeFallbackCheck({ manifest: counts(1, 3), cube: cube(3) }, { manifest: counts(1, 3), cube: cube(3) }).status).toBe('ok');
    const check = cubeFallbackCheck({ manifest: counts(1, 3), cube: cube(3) }, { manifest: counts(1, 5), cube: cube(5) });
    expect(check.status).toBe('finding');
    expect(check.details).toContain('~ other:x: 3 → 5 rows');
  });

  it('flags only new unknown ops', () => {
    const known = [3, 15, 16, 17, 18];
    expect(cubeOps([0, 18, 18, 6])).toEqual(
      new Map([
        [18, 2],
        [6, 1],
      ])
    );
    expect(cubeOpsCheck(cubeOps([18]), cubeOps([18]), known).status).toBe('ok');
    expect(cubeOpsCheck(cubeOps([6]), cubeOps([6, 6]), known)).toMatchObject({ status: 'ok', details: ['op 6: 1 → 2 enabled rows'] });
    expect(cubeOpsCheck(cubeOps([6]), cubeOps([6, 29]), known).status).toBe('finding');
  });
});

describe('icons', () => {
  const side = (icons: Record<string, object>) => ({
    icons: { bases: { hax: {} }, uniques: icons, sets: {} },
    bases: { bases: [{ code: 'hax', name: 'Hand Axe' }] },
    lootfilter: { uniques: [{ name: 'Cello', disabled: true }, { name: 'Ore' }], sets: [] },
  });

  it('flags items that newly have no icon', () => {
    expect(missingIconsCheck(side({ Ore: {} }), side({ Ore: {} })).status).toBe('ok');
    expect(missingIconsCheck(side({ Ore: {} }), side({}))).toMatchObject({ status: 'finding', details: ['unique Ore'] });
  });

  it('needs the vanilla art only on a version change', () => {
    expect(vanillaArtCheck('../d2r-vanilla-art', true, true).status).toBe('ok');
    expect(vanillaArtCheck('../d2r-vanilla-art', false, false).status).toBe('info');
    expect(vanillaArtCheck('../d2r-vanilla-art', false, true).status).toBe('finding');
  });

  it('groups changed icon inputs', () => {
    expect(iconInputsCheck([]).status).toBe('ok');
    const check = iconInputsCheck([
      'Eastern_Sun_Resurrected.mpq/data/hd/items/items.json',
      'Eastern_Sun_Resurrected.mpq/data/hd/global/ui/items/misc/potion/elixir.sprite',
      'Eastern_Sun_Resurrected.mpq/data/hd/global/ui/spells/hireables/hrskillicon.sprite',
    ]);
    expect(check.details).toEqual([
      'hd/items/items.json: 1 files',
      'hd/global/ui/items/ (item sprites): 1 files',
      'hd/global/ui/spells/ (skill icon sheets): 1 files',
    ]);
  });
});
