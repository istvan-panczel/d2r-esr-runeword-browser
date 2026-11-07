import { describe, expect, it } from 'vitest';
import type { ClassInfo } from '../engine/schema.ts';
import { base, type } from '../utils/testBases.mock.ts';
import {
  buildMasteriesBundle,
  joinEffectLines,
  parseMasteryDescription,
  readInput,
  resolveEffectSkills,
  type MasterySkill,
} from './bundleMasteries.ts';
import type { CubeRow } from './cube/cubeRows.ts';

/** A description as the strings file stores it: bottom-up, colours stripped by the string table */
const reversed = (...lines: string[]) => [...lines].reverse().join('\n');

const REFLEX = reversed(
  "Transmute this with a Reflex Bow variant, a Spider's Silk",
  'and an Anvil Stone to empower it with as following',
  '',
  'Strafe',
  'Triples the number of targets, but applies a 2% physical resist',
  'penalty per arrow fired for 2 seconds. This effect has no limit',
  '',
  'Multiple Shot',
  'Causes Multiple Shot to fire a nova of arrows instead',
  'but no longer gains damage bonus per level'
);

const ORB = reversed(
  'Transmute this with an Orb, a Crushed Gem, a Chipped Ruby',
  'and an Anvil Stone to empower it with as following',
  '',
  'Sorceress Spells',
  'Triples the cooldown of your level 24 Sorceress spells',
  'and adds a 2 second cooldown to Hydra,',
  'but increases your total spell damage by 20%',
  '',
  'Transmute this with an Orb, a Crushed Gem, a Chipped Skull',
  'and an Anvil Stone to empower it with as following',
  '',
  'Sorceress Exclusives',
  'Increases the bonuses granted by your exclusives by 50% and their downsides by 75%'
);

describe('parseMasteryDescription', () => {
  it('reads the bottom-up lines in display order, a skills line after each blank line', () => {
    expect(parseMasteryDescription(REFLEX)).toEqual([
      {
        weapon: 'Reflex Bow',
        ingredients: ["Spider's Silk", 'Anvil Stone'],
        effects: [
          {
            heading: 'Strafe',
            lines: [
              'Triples the number of targets, but applies a 2% physical resist',
              'penalty per arrow fired for 2 seconds. This effect has no limit',
            ],
          },
          {
            heading: 'Multiple Shot',
            lines: ['Causes Multiple Shot to fire a nova of arrows instead', 'but no longer gains damage bonus per level'],
          },
        ],
      },
    ]);
  });

  it('splits a token with two specialisations into two blocks and strips colour codes', () => {
    const coloured = ORB.replace('Sorceress Spells', 'ÿc@Sorceress Spellsÿc0').replace('Chipped Ruby', 'ÿc1Chipped Rubyÿc0');
    const blocks = parseMasteryDescription(coloured);
    expect(blocks.map((block) => [block.weapon, block.ingredients, block.effects.map((effect) => effect.heading)])).toEqual([
      ['Orb', ['Crushed Gem', 'Chipped Ruby', 'Anvil Stone'], ['Sorceress Spells']],
      ['Orb', ['Crushed Gem', 'Chipped Skull', 'Anvil Stone'], ['Sorceress Exclusives']],
    ]);
  });
});

describe('joinEffectLines', () => {
  it('joins wrapped lines, starts a sentence at a capital and closes each with a full stop', () => {
    expect(
      joinEffectLines([
        'Halves the Wolves and Ravens you can summon and gain',
        '1 additional grizzly bear for every 5 regular summons',
        'lost. Double the amount of hits of all pet skills',
        'This effect stacks',
        'Done.',
      ])
    ).toEqual([
      'Halves the Wolves and Ravens you can summon and gain 1 additional grizzly bear for every 5 regular summons lost. Double the amount of hits of all pet skills.',
      'This effect stacks.',
      'Done.',
    ]);
  });
});

describe('readInput', () => {
  it('reads the code and quantity of a cube input', () => {
    expect(readInput('am1,nru')).toEqual({ code: 'am1' });
    expect(readInput('wms,qty=3')).toEqual({ code: 'wms', qty: 3 });
  });
});

const skill = (id: string, cls: MasterySkill['cls'], page: number, extra: Partial<MasterySkill> = {}): MasterySkill => ({
  id,
  name: id,
  cls,
  page,
  reqLevel: 1,
  etype: '',
  aurastate: '',
  passive: false,
  weaponSkill: false,
  ...extra,
});

describe('resolveEffectSkills', () => {
  const amazon = ['Magic Arrow', 'Cold Arrow', 'Exploding Arrow', 'Pyre Javelin', 'Frost Javelin', 'Strafe'].map((id) =>
    skill(id, 'ama', 1)
  );
  const tabs = ['Bow', 'Passive', 'Javelin'];

  it('resolves a list sharing its last word and keeps skill tree order', () => {
    expect(resolveEffectSkills('Exploding, Cold, Magic Arrow', [], amazon, tabs)).toEqual({
      skills: ['Magic Arrow', 'Cold Arrow', 'Exploding Arrow'],
      how: 'names',
    });
    expect(resolveEffectSkills('Pyre, Frost Javelin', [], amazon, tabs).skills).toEqual(['Pyre Javelin', 'Frost Javelin']);
  });

  it('resolves plural words to the skills named by them, not inside other words', () => {
    const druid = [
      skill('Summon Spirit Wolf', 'dru', 1),
      skill('Raven', 'dru', 1),
      skill('Contagion', 'dru', 1),
      skill('Summon Grizzly', 'dru', 1),
      skill('Werewolf', 'dru', 2),
    ];
    // Contagion: named in lower case by the effect text, listed in LOWER_CASE_MENTIONS
    expect(resolveEffectSkills('Wolves, Ravens, Grizzly', ['… and the damage dealt by contagion.'], druid, tabs).skills).toEqual([
      'Summon Spirit Wolf',
      'Raven',
      'Contagion',
      'Summon Grizzly',
    ]);
  });

  it('takes a class tab named like the skills line, and group rules from the skills.txt columns', () => {
    const necro = [
      skill('Weaken', 'nec', 1),
      skill('Bone Spear', 'nec', 2, { etype: 'mag' }),
      skill('Reap Souls', 'nec', 2, { etype: 'mag', weaponSkill: true }),
      skill('Bone Mastery', 'nec', 2, { etype: 'mag', passive: true }),
      skill('Corpse Explosion', 'nec', 2, { etype: 'mag' }),
    ];
    expect(resolveEffectSkills('Curses', [], necro, ['Curses', 'Poison and Bone', 'Summoning'])).toEqual({
      skills: ['Weaken'],
      how: 'tab',
    });
    expect(resolveEffectSkills('Magic Spells', [], necro, tabs)).toEqual({ skills: ['Bone Spear'], how: 'rule' });

    const sorc = [
      skill('Fire Ball', 'sor', 1, { reqLevel: 12 }),
      skill('Meteor Shower', 'sor', 1, { reqLevel: 24 }),
      skill('Lightning Hydra', 'sor', 2, { reqLevel: 24 }),
      skill('Omnipotence', 'sor', 1, { reqLevel: 30, aurastate: 'exclusiveskill' }),
    ];
    expect(resolveEffectSkills('Sorceress Spells', ['Triples the cooldown of your level 24 Sorceress spells.'], sorc, tabs).skills).toEqual(
      ['Meteor Shower', 'Lightning Hydra']
    );
    expect(resolveEffectSkills('Sorceress Exclusives', [], sorc, tabs).skills).toEqual(['Omnipotence']);

    const assassin = [
      skill('Tiger Strike', 'ass', 3, { aurastate: 'progressive_damage' }),
      skill('Fists of Fire', 'ass', 3, { aurastate: 'progressive_fire', etype: 'fire' }),
      skill('Dragon Fury', 'ass', 3, { aurastate: 'progressive_phys', etype: 'stun' }),
    ];
    expect(resolveEffectSkills('Elemental Charge-up Skills', [], assassin, tabs).skills).toEqual(['Fists of Fire']);
  });

  it('adds the skills the effect text names (capitalised, by name or id) and ignores ordinary words', () => {
    const warlock = [
      skill('Hellfire Lance', 'war', 3),
      { ...skill('Miasma Chains', 'war', 3), name: 'Miasma Chain' },
      skill('Nova', 'war', 1),
    ];
    expect(
      resolveEffectSkills(
        'Fire and Magic Skills',
        ['Hellfire Lance deals lightning damage instead.', 'Miasma Chains releases a nova.'],
        warlock,
        tabs
      )
    ).toEqual({ skills: ['Hellfire Lance', 'Miasma Chains'], how: 'text' });
    expect(resolveEffectSkills('Unknown Group', ['Nothing here.'], warlock, tabs)).toEqual({ skills: [], how: 'none' });
  });
});

// --- the whole bundle ---------------------------------------------------------------------------------------------

const cubeRow = (line: number, description: string, inputs: string[], mods: [string, number][], output = 'useitem'): CubeRow => ({
  line,
  description,
  cls: '',
  minDiff: 0,
  inputs,
  outputs: [{ spec: output, mods: mods.map(([mod, value]) => ({ mod, param: '', min: value, max: value })) }],
  condition: null,
});

const NAMES: Record<string, string> = {
  sss: "Spider's Silk",
  ggg: 'Crushed Gem',
  qqq: 'Anvil Stone',
  gcr: 'Chipped Ruby',
  skc: 'Chipped Skull',
  wms: 'Thawing Potion',
  u23: 'Weapon Mastery Token',
  u25: 'Awakened Weapon Mastery Token',
  u38: 'Awakened Weapon Mastery Token',
};

const CLASSES: ClassInfo[] = [
  { code: 'ama', name: 'Amazon', tabs: ['Bow and Crossbow Skills', 'Passive and Magic Skills', 'Javelin and Spear Skills'] },
  { code: 'sor', name: 'Sorceress', tabs: ['Fire Skills', 'Lightning Skills', 'Cold Skills'] },
];

describe('buildMasteriesBundle', () => {
  const orbType = { ...type('orb', 'Orb', 'sor'), ancestors: ['orb', 'weap'] };
  const bases = [
    base('am7', 'Ceremonial Bow', 'abow', 'exceptional', ['am2', 'am7', 'amc'], 30, { cls: 'ama' }),
    base('am2', 'Reflex Bow', 'abow', 'normal', ['am2', 'am7', 'amc'], 10, { cls: 'ama' }),
    base('ob1', 'Eagle Orb', 'orb', 'normal', ['ob1', 'ob6', 'obb'], 5, { cls: 'sor' }),
  ];
  const cube = [
    cubeRow(10, 'Apply Awaken Weapon Mastery Token - Reflex Bow', ['am2,nru', 'u25', 'sss', 'qqq'], [['weapon-mastery', 2]]),
    cubeRow(11, 'Apply Awaken Weapon Mastery Token - Ceremonial Bow', ['am7,nru', 'u25', 'sss', 'qqq'], [['weapon-mastery', 2]]),
    // Not spawnable (no base): skipped without a warning
    cubeRow(12, 'Apply Awaken Weapon Mastery Token - Ceremonial Bow LoD', ['q77,nru', 'u25', 'sss', 'qqq'], [['weapon-mastery', 2]]),
    cubeRow(
      13,
      'Apply Awaken Weapon Mastery Token - Orb 1',
      ['orb,nru', 'u38', 'ggg', 'qqq', 'gcr'],
      [
        ['weapon-mastery', 15],
        ['generic-total-multiplier', 20],
      ]
    ),
    cubeRow(14, 'Apply Awaken Weapon Mastery Token - Orb 2', ['orb,nru', 'u38', 'ggg', 'qqq', 'skc'], [['weapon-mastery', 17]]),
    cubeRow(20, 'Remove Awaken Weapon Mastery Token - Reflex Bow', ['am2,nru', 'sss', 'wms,qty=3'], [['weapon-mastery', -2]]),
    cubeRow(21, 'Remove Awaken Weapon Mastery Token - Orb 1', ['orb,nru', 'ggg', 'wms,qty=3'], [['weapon-mastery', -15]]),
    cubeRow(22, 'Remove Awaken Weapon Mastery Token - Orb 2', ['orb,nru', 'ggg', 'wms,qty=3'], [['weapon-mastery', -17]]),
    cubeRow(30, 'Unawaken Weapon Mastery Token', ['u25'], [], 'u23'),
  ];
  const skills = [
    skill('Strafe', 'ama', 1),
    skill('Multiple Shot', 'ama', 1),
    skill('Meteor Shower', 'sor', 1, { reqLevel: 24 }),
    skill('Omnipotence', 'sor', 1, { aurastate: 'exclusiveskill' }),
  ];
  const { bundle, warnings } = buildMasteriesBundle({
    cube,
    nameOf: (code) => NAMES[code] ?? code,
    itemCodes: new Set(['q77']),
    bases,
    types: [type('abow', 'Amazon Bow', 'ama'), orbType],
    classes: CLASSES,
    strings: new Map([
      ['u25desc', REFLEX],
      // The Chipped Skull block names a Dragon Stone the rows do not take (like ESR's u39desc)
      ['u38desc', ORB.replace('an Orb, a Crushed Gem, a Chipped Skull', 'an Orb, a Dragon Stone, a Chipped Skull')],
    ]),
    skills,
    renderMods: (mods) => mods.map((mod) => `+${String(mod.min)}% ${mod.mod}`),
  });

  it('groups the rows by stat value, bases by tier, and pairs each orb block by its ingredients', () => {
    expect(bundle.token).toBe('u23');
    expect(bundle.masteries.map((mastery) => [mastery.value, mastery.label, mastery.cls, mastery.type, mastery.bases])).toEqual([
      [2, 'Reflex Bow', 'ama', undefined, ['am2', 'am7']],
      [15, 'Orb', 'sor', 'orb', ['ob1']],
      [17, 'Orb', 'sor', 'orb', ['ob1']],
    ]);
    const [reflex, orb1, orb2] = bundle.masteries;
    expect(reflex.inputs).toEqual([{ code: 'sss' }, { code: 'qqq' }]);
    expect(reflex.remove).toEqual([{ code: 'sss' }, { code: 'wms', qty: 3 }]);
    // No remove row takes the exceptional bow
    expect(reflex.noRemove).toEqual(['am7']);
    expect(reflex.effects.map((effect) => [effect.heading, effect.skills])).toEqual([
      ['Strafe', ['Strafe']],
      ['Multiple Shot', ['Multiple Shot']],
    ]);
    expect(orb1.mods).toEqual(['+20% generic-total-multiplier']);
    expect(orb1.effects).toEqual([
      {
        heading: 'Sorceress Spells',
        skills: ['Meteor Shower'],
        text: [
          'Triples the cooldown of your level 24 Sorceress spells and adds a 2 second cooldown to Hydra, but increases your total spell damage by 20%.',
        ],
      },
    ]);
    expect(orb2.effects.map((effect) => effect.skills)).toEqual([['Omnipotence']]);
    expect(bundle.skillNames).toEqual({
      'Meteor Shower': 'Meteor Shower',
      'Multiple Shot': 'Multiple Shot',
      Omnipotence: 'Omnipotence',
      Strafe: 'Strafe',
    });
    expect(bundle.names.wms).toBe('Thawing Potion');
  });

  it('warns about rows and strings that disagree, but not about bases that do not spawn', () => {
    expect(warnings).toEqual([
      'masteries: Reflex Bow: no remove row takes am7',
      'masteries: u38desc (Orb, value 17) names Dragon Stone, Chipped Skull, Anvil Stone; the rows take Crushed Gem, Anvil Stone, Chipped Skull',
    ]);
  });
});
