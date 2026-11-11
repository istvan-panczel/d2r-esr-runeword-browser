import { describe, expect, it } from 'vitest';
import { ascendancyMods, buildCharSheetBundle, itemSkillUses, type CharSheetInput } from './bundleCharSheet.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][], keepExpansionRows = true) =>
  parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'test', { keepExpansionRows });

const CLASSES = ['Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin', 'Warlock'];
const ARCHAEOLOGY = `[archaeology]
enabled = true
[socketed_runes]
enabled = true
perk_stat = 3
bonus_percent = 5
item_codes = ["r01", "r02"]
per_item_stats = [16]
stats = [0, 16]
`;
const CLASS_PROPERTIES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'war'];
const ASCENDANCIES = `[ascendancies]
enabled = true
ascendancy_stat = 10
progress_stat = 11
soulstone_stat = 12
orb_stat = 13
soulstone_cap = 10
soulstone_tier = 4
class_skill_properties = ["ama", "sor", "nec", "pal", "bar", "dru", "ass", "war"]
lich_king = ["lich-king-bonus=1"]
legacy_stone_item = "ast"
legacy_tier_stats = [676, 677, 678, 680]
legacy_soulstone_stat = 919
legacy_lich_king_stat = 826

[[ascendancy]]
name = "Battlemage"
legacy_unique = 1100
tier1 = ["class-skills=1", "str=60"]
tier2 = ["class-skills=1"]
tier3 = ["aura-hidden[787]=1"]
tier4 = ["dmg-norm=40..50"]
tier5 = ["class-skills=3", "dodge-group=1"]

[[ascendancy]]
name = "Blademaster"
legacy_unique = 1102
tier1 = []
tier2 = []
tier3 = ["aura-hidden[789]=1"]
tier4 = []
tier5 = []
`;
const DISPLAY_PATCH = '{"patches":[{"description":"Upper bound (min(75+maxresist, 95), …"}]}';

const SKILL_COLUMNS = [
  'skill',
  'charclass',
  'skilldesc',
  'passive',
  'passivestate',
  'passiveitype',
  'aura',
  'aurafilter',
  'aurastate',
  'summon',
  'aurastat1',
  'aurastatcalc1',
  'passivestat1',
  'passivecalc1',
  'ToHit',
  'LevToHit',
  'ToHitCalc',
  'weapsel',
  'range',
  'calc1',
  'Param1',
];
const SET_COLUMNS = [
  'index',
  ...[2, 3, 4, 5].flatMap((n) => ['a', 'b'].flatMap((ab) => ['PCode', 'PParam', 'PMin', 'PMax'].map((part) => `${part}${String(n)}${ab}`))),
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => ['FCode', 'FParam', 'FMin', 'FMax'].map((part) => `${part}${String(n)}`)),
];
const DUO: Partial<Record<string, string>> = {
  index: 'Duo',
  PCode2a: 'str',
  PMin2a: '5',
  PMax2a: '5',
  FCode1: 'dodge-group',
  FMin1: '1',
  FMax1: '1',
};
const skillRow = (cells: Partial<Record<string, string>>) => SKILL_COLUMNS.map((column) => cells[column] ?? '');

function input(overrides: Partial<CharSheetInput> = {}): CharSheetInput {
  return {
    itemstatcost: tsv([
      ['Stat', 'ValShift', 'op', 'op param', 'op base', 'op stat1', 'op stat2', 'op stat3'],
      ['strength', '', '', '', '', '', '', ''],
      ['maxhp', '8', '', '', '', '', '', ''],
      ['level', '', '', '', '', '', '', ''],
      ['archaeology_3', '', '', '', '', '', '', ''],
      ['item_maxhp_percent', '', '11', '', '', 'maxhp', 'item_hp_perlevel', ''],
      ['item_hp_perlevel', '8', '2', '3', 'level', 'maxhp', '', ''],
      ['maxfireresist', '', '', '', '', '', '', ''],
      ['damageresist', '', '', '', '', '', '', ''],
      ['passive_dodge', '', '', '', '', '', '', ''],
      ['fireresist', '', '', '', '', '', '', ''],
      ['ascendancy', '', '', '', '', '', '', ''],
      ['ascendancy_progress', '', '', '', '', '', '', ''],
      ['ascendancy_soulstones', '', '', '', '', '', '', ''],
      ['ascendancy_orb', '', '', '', '', '', '', ''],
      ['item_addclassskills', '', '', '', '', '', '', ''],
    ]),
    skills: tsv([
      SKILL_COLUMNS,
      skillRow({ skill: 'Attack', ToHit: '0' }),
      skillRow({
        skill: 'Dodge',
        charclass: 'ama',
        skilldesc: 'dodge',
        passive: '1',
        passivestate: 'ironskin',
        passivestat1: 'passive_dodge',
        passivecalc1: "skill('Helper'.clc1)",
      }),
      skillRow({ skill: 'Helper', calc1: 'par1*2', Param1: '7' }),
      skillRow({ skill: 'Enemy Aura', aura: '1', aurafilter: String(0x8000 | 3), aurastat1: 'fireresist', aurastatcalc1: '-lvl' }),
      skillRow({ skill: 'Own Aura', aura: '1', aurafilter: '73731', aurastat1: 'fireresist', aurastatcalc1: 'lvl' }),
      skillRow({ skill: 'Summon It', summon: 'golem', aurastat1: 'damageresist', aurastatcalc1: 'lvl' }),
      skillRow({ skill: 'Self Proc', aurastat1: 'damageresist', aurastatcalc1: 'lvl', range: 'none' }),
      skillRow({ skill: 'Curse Proc', aurafilter: '3', aurastat1: 'damageresist', aurastatcalc1: '-lvl' }),
      skillRow({ skill: 'Bash', charclass: 'bar', skilldesc: 'bash', ToHit: '20', LevToHit: '5', weapsel: '3', range: 'h2h' }),
      skillRow({
        skill: 'Wolf Form',
        charclass: 'dru',
        skilldesc: 'wolf',
        aurastate: 'wolf',
        aurastat1: 'damageresist',
        aurastatcalc1: 'lvl',
      }),
      skillRow({ skill: 'Battle Cry', charclass: 'bar', aurastate: 'shout', aurastat1: 'damageresist', aurastatcalc1: 'lvl' }),
      skillRow({ skill: 'Glow', charclass: 'pal', aurastate: 'holyshield', aurastat1: 'damageresist', aurastatcalc1: 'lvl' }),
    ]),
    skilldesc: tsv([
      ['skilldesc', 'SkillPage'],
      ['dodge', '2'],
      ['bash', '1'],
    ]),
    charstats: tsv(
      [
        ['class', 'LifePerVitality', 'StaminaPerVitality', 'ManaPerMagic', 'ToHitFactor', 'BlockFactor'],
        ...CLASSES.map((name) => [name, '4', '4', '4', '20', '5']),
      ],
      false
    ),
    experience: tsv(
      [
        ['Level', 'Amazon', 'Sorceress', 'ExpRatio'],
        ['MaxLvl', '3', '3', '10'],
        ['0', '0', '0', '1024'],
        ['1', '500', '500', '1024'],
        ['2', '1500', '1500', '1024'],
      ],
      false
    ),
    weapons: tsv(
      [
        ['code', 'type', 'type2', 'speed'],
        ['hax', 'axe', '', '0'],
        ['lsd', 'swor', '', '-10'],
        ['aq2', 'arrm', '', '0'],
      ],
      false
    ),
    itemtypes: tsv(
      [
        ['Code', 'Equiv1', 'Equiv2'],
        ['weap', '', ''],
        ['mele', 'weap', ''],
        ['axe', 'mele', ''],
        ['swor', 'mele', ''],
        ['misc', '', ''],
        ['misl', 'misc', ''],
        ['seco', '', ''],
        ['bowq', 'misl', 'seco'],
        ['arrm', 'bowq', 'seco'],
        ['ring', 'misc', ''],
      ],
      false
    ),
    states: tsv(
      [
        ['state', 'transform', 'gfxtype'],
        ['shout', '', ''],
        ['holyshield', '1', ''],
        ['wolf', '1', '1'],
      ],
      false
    ),
    armor: tsv(
      [
        ['code', 'speed', 'block'],
        ['cap', '0', '0'],
        ['kit', '5', '20'],
      ],
      false
    ),
    sets: tsv([SET_COLUMNS, SET_COLUMNS.map((column) => DUO[column] ?? '')], false),
    setitems: tsv([
      ['index', 'set'],
      ['A', 'Duo'],
      ['B', ''],
      ['C', 'Duo'],
    ]),
    hireling: tsv(
      [
        ['Hireling', 'Version', 'Id', 'Act', 'Difficulty', 'Exp/Lvl', 'HireDesc'],
        ['Rogue Scout', '0', '0', '1', '1', '65', 'farw'],
        ['Rogue Scout', '100', '0', '1', '1', '65', 'farw'],
        ['Rogue Scout', '100', '0', '1', '1', '65', 'farw'],
        ['Barbarian', '100', '24', '5', '2', '65', 'def'],
      ],
      false
    ),
    difficultylevels: tsv(
      [
        ['Name', 'ResistPenalty'],
        ['Normal', '0'],
        ['Nightmare', '-80'],
        ['Hell', '-150'],
      ],
      false
    ),
    itemSkills: { owned: new Set([3, 4, 5]), events: new Set([6, 7]) },
    groups: new Map([
      [
        'dodge-group',
        { code: 'dodge-group', pickMode: 0, entries: [{ prop: 'dodge', parMin: '', parMax: '', modMin: 3, modMax: 3, chance: 0 }] },
      ],
    ]),
    // str → strength (0), a class skill property → item_addclassskills (14) with the class, aura-hidden → stat 9 with the skill
    savedStats: (code, param, _min, max) => {
      const cls = CLASS_PROPERTIES.indexOf(code);
      if (cls >= 0) return [[14, cls, max]];
      if (code === 'aura-hidden') return [[9, Number(param), max]];
      if (code === 'dmg-norm') return [[8, 0, max]];
      return [[code === 'str' ? 0 : 8, 0, max]];
    },
    specializations: [],
    configs: {
      archaeology: ARCHAEOLOGY,
      charmDedup: 'enabled = true\ngroups = [\n  ["c11", "c12"],\n]\n',
      charmInventory: '[charm-inv]\nallow_inventory_charms = false\n',
      dodgeCap: '[dodge_avoid_evade_cap]\nenabled = true\ncap_percent = 75\ndodge_cap_percent = 60\navoid_cap_percent = -1\n',
      resistFloor: '{}',
      resistFloorDisplay: DISPLAY_PATCH,
      ascendancies: null,
    },
    ...overrides,
  };
}

describe('buildCharSheetBundle', () => {
  it('reads stat names, shifts and ops, class constants, experience, item speeds and hirelings', () => {
    const { bundle } = buildCharSheetBundle(input());
    expect(bundle.statNames.slice(0, 3)).toEqual(['strength', 'maxhp', 'level']);
    expect(bundle.valShift).toEqual({ 1: 8, 5: 8 });
    expect(bundle.ops).toEqual([
      { id: 4, op: 11, param: 0, base: null, targets: [1, 5] },
      { id: 5, op: 2, param: 3, base: 2, targets: [1] },
    ]);
    expect(bundle.classes[4]).toEqual({
      code: 'bar',
      lifePerVitality: 4,
      staminaPerVitality: 4,
      manaPerEnergy: 4,
      toHitFactor: 20,
      blockFactor: 5,
    });
    expect(bundle.experience).toEqual([0, 500, 1500]);
    expect(bundle.weaponSpeed).toEqual({ hax: 0, lsd: -10, aq2: 0 });
    expect(bundle.quivers).toEqual(['aq2']);
    expect(bundle.armor).toEqual({ kit: { speed: 5, block: 20 } });
    expect(bundle.hirelings).toEqual([
      { id: 0, name: 'Rogue Scout', subtype: 'Elemental', act: 1, difficulty: 0, expPerLevel: 65 },
      { id: 24, name: 'Barbarian', subtype: 'Defensive', act: 5, difficulty: 1, expPerLevel: 65 },
    ]);
  });

  it('keeps class skills, item skills whose stats reach the owner, and the columns their formulas read', () => {
    const { bundle } = buildCharSheetBundle(input());
    const byName = new Map(bundle.skills.map((skill) => [skill.row.id, skill]));
    expect(byName.get('Dodge')).toMatchObject({
      n: 1,
      cls: 0,
      tab: 2,
      row: { passive: 1, passivestate: 'ironskin', passivestat1: 'passive_dodge' },
    });
    // read by Dodge's formula: only the column it reaches (and the Param it reads)
    expect(byName.get('Helper')?.row).toEqual({ id: 'Helper', calc1: 'par1*2', Param1: 7 });
    expect(byName.get('Own Aura')?.row).toMatchObject({ aurastat1: 'fireresist', aurafilter: 73731 });
    // `range` (attack or cast) only for a skill whose stats reach its owner
    expect(byName.get('Self Proc')?.row).toMatchObject({ aurastat1: 'damageresist', range: 'none' });
    expect(byName.get('Bash')?.row.range).toBeUndefined();
    // enemy-only aura, summon and curse proc: nothing reaches the owner, nothing kept
    expect(byName.has('Enemy Aura')).toBe(false);
    expect(byName.has('Summon It')).toBe(false);
    expect(byName.has('Curse Proc')).toBe(false);
    expect(byName.get('Bash')).toMatchObject({ cls: 4, tab: 1, row: { ToHit: 20, LevToHit: 5, weapsel: 3 } });
    expect(byName.get('Attack')?.row).toEqual({ id: 'Attack' });
    // a states.txt morph state (transform + gfxtype 1) marks a shape-shift; transform alone or another state does not
    expect(byName.get('Wolf Form')).toMatchObject({ cls: 5, shapeshift: true });
    expect(byName.get('Battle Cry')?.shapeshift).toBeUndefined();
    expect(byName.get('Glow')?.shapeshift).toBeUndefined();
  });

  it('throws on a weapons.txt row that is neither a weapon nor a quiver by its item type', () => {
    const weapons = tsv(
      [
        ['code', 'type', 'type2', 'speed'],
        ['xyz', 'ring', '', '0'],
      ],
      false
    );
    expect(() => buildCharSheetBundle(input({ weapons }))).toThrow(/xyz .*neither a weapon nor a quiver/);
  });

  it('turns sets.txt bonuses into saved stats, groups expanded, and maps set items to their set', () => {
    const { bundle } = buildCharSheetBundle(input());
    expect(bundle.setItems).toEqual([0, -1, 0]);
    expect(bundle.sets).toEqual([{ key: 'Duo', items: 2, partial: [{ pieces: 2, stats: [[0, 0, 5]] }], full: [[8, 0, 3]] }]);
  });

  it('reads the loader rules and asserts what it cannot read', () => {
    const { bundle } = buildCharSheetBundle(input());
    expect(bundle.rules).toEqual({
      resistPenalty: [0, -80, -150],
      resistCap: 75,
      resistCeiling: 95,
      resistFloor: -1000,
      physicalResistCap: 50,
      anyaResist: 10,
      dodgeCap: { dodge: 60, avoid: 75, evade: 75 },
      runicInsight: { stat: 3, percent: 5, runes: ['r01', 'r02'], stats: [0, 16], perItemStats: [16] },
      charmDedup: [['c11', 'c12']],
      inventoryCharms: false,
    });
    expect(() => buildCharSheetBundle(input({ configs: { ...input().configs, resistFloorDisplay: '{"patches":[]}' } }))).toThrow(
      /min\(75\+maxresist, 95\)/
    );
    expect(() =>
      buildCharSheetBundle(input({ configs: { ...input().configs, archaeology: ARCHAEOLOGY.replace('perk_stat = 3', 'perk_stat = 0') } }))
    ).toThrow(/archaeology_3/);
    expect(() => buildCharSheetBundle(input({ configs: { ...input().configs, charmInventory: '' } }))).toThrow(/allow_inventory_charms/);
    expect(buildCharSheetBundle(input({ configs: { ...input().configs, resistFloorDisplay: null } })).bundle.rules.resistFloor).toBe(-100);
  });
});

describe('buildCharSheetBundle: ascendancies', () => {
  const withToml = (text: string | null) => input({ configs: { ...input().configs, ascendancies: text } });

  it('reads the saved stats, the class skill stats, the Lich King bonus and each tier as saved stats, in window order', () => {
    const { bundle, warnings } = buildCharSheetBundle(withToml(ASCENDANCIES));
    expect(warnings).toEqual([]);
    expect(bundle.ascendancies).toEqual({
      stats: { ascendancy: 10, progress: 11, soulstones: 12, orb: 13 },
      soulstoneCap: 10,
      soulstoneTier: 4,
      classSkills: CLASS_PROPERTIES.map((_, cls) => [14, cls]),
      lichKing: [[8, 0, 1]],
      legacy: { item: 'ast', tierStats: [676, 677, 678, 680], soulstoneStat: 919, lichKingStat: 826 },
      list: [
        {
          index: 1,
          name: 'Battlemage',
          legacyUnique: 1100,
          tiers: [
            { classSkills: 1, stats: [[0, 0, 60]] },
            { classSkills: 1, stats: [] },
            { classSkills: 0, stats: [[9, 787, 1]] },
            { classSkills: 0, stats: [[8, 0, 50]] },
            // a property group is expanded (dodge-group → dodge 3)
            { classSkills: 3, stats: [[8, 0, 3]] },
          ],
        },
        {
          index: 2,
          name: 'Blademaster',
          legacyUnique: 1102,
          tiers: [
            { classSkills: 0, stats: [] },
            { classSkills: 0, stats: [] },
            { classSkills: 0, stats: [[9, 789, 1]] },
            { classSkills: 0, stats: [] },
            { classSkills: 0, stats: [] },
          ],
        },
      ],
    });
  });

  it('is null with a warning without the file, null when switched off, and throws on a shape it does not know', () => {
    const missing = buildCharSheetBundle(withToml(null));
    expect(missing.bundle.ascendancies).toBeNull();
    expect(missing.warnings).toContain('charsheet: celestialrayone.ascendancies.toml missing, no ascendancy bonuses');
    expect(buildCharSheetBundle(withToml(ASCENDANCIES.replace('enabled = true', 'enabled = false'))).bundle.ascendancies).toBeNull();
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.replace('ascendancy_stat = 10', 'ascendancy_stat = 11')))).toThrow(
      /ascendancy_stat = 11 is not ascendancy/
    );
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.replace('"ama", "sor"', '"sor", "ama"')))).toThrow(/class order/);
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.replace('"str=60"', '"str 60"')))).toThrow(/Battlemage tier 1: "str 60"/);
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.replace('"class-skills=3"', '"class-skills=1..3"')))).toThrow(
      /class-skills takes one value/
    );
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.replace('tier4 = []', '')))).toThrow(/Blademaster tier 4: no tier4 list/);
    expect(() => buildCharSheetBundle(withToml(ASCENDANCIES.split('[[ascendancy]]')[0]))).toThrow(/no \[\[ascendancy\]\] block/);
  });

  it('lists every property the tiers and the Lich King bonus name (not class-skills), for the skills they keep', () => {
    expect(ascendancyMods(null)).toEqual([]);
    expect(ascendancyMods(ASCENDANCIES)).toEqual([
      { code: 'lich-king-bonus', param: null, min: 1, max: 1 },
      { code: 'str', param: null, min: 60, max: 60 },
      { code: 'aura-hidden', param: '787', min: 1, max: 1 },
      { code: 'dmg-norm', param: null, min: 40, max: 50 },
      { code: 'dodge-group', param: null, min: 1, max: 1 },
      { code: 'aura-hidden', param: '789', min: 1, max: 1 },
    ]);
  });
});

describe('itemSkillUses', () => {
  it('splits the skills properties name into owned (aura, oskill) and event (proc) skills', () => {
    const properties = new Map([
      ['aura', { code: 'aura', slots: [{ func: 22, stat: 'item_aura', set: 0, val: 0 }] }],
      ['hit-skill', { code: 'hit-skill', slots: [{ func: 11, stat: 'item_skillonhit', set: 0, val: 0 }] }],
      ['str', { code: 'str', slots: [{ func: 1, stat: 'strength', set: 0, val: 0 }] }],
    ]);
    const ids: Record<string, number> = { Might: 540, Fade: 647 };
    const uses = itemSkillUses(
      [
        { code: 'aura', param: 'Might' },
        { code: 'hit-skill', param: 'Fade' },
        { code: 'str', param: null },
        { code: 'aura', param: 'Unknown' },
      ],
      properties,
      (param) => ids[param] ?? null
    );
    expect([...uses.owned]).toEqual([540]);
    expect([...uses.events]).toEqual([647]);
  });
});
