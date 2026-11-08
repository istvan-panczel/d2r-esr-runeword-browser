import { describe, expect, it } from 'vitest';
import type { MasteriesBundle, WeaponMastery } from '@/features/game-data/engine/schema';
import {
  diffsForMastery,
  filterFamilies,
  groupByClass,
  masteriesParams,
  masteryFamilies,
  modLine,
  noMasteryGroups,
  optionGem,
  otherBaseGroups,
  readMasteriesState,
} from './masteriesView';

const mastery = (slug: string, label: string, cls: WeaponMastery['cls'], extra: Partial<WeaponMastery> = {}): WeaponMastery => ({
  property: `weapon-mastery-${slug}`,
  slug,
  label,
  cls,
  bases: [],
  token: `token-${label}`,
  inputs: [{ code: 'qqq' }],
  remove: [],
  effects: [],
  ...extra,
});

const MASTERIES = [
  mastery('stag-bow', 'Stag Bow', 'ama', { bases: ['am1'], effects: [{ heading: 'Strafe', skills: ['Strafe'], text: [] }] }),
  mastery('orb-1', 'Orb', 'sor', {
    bases: ['ob1'],
    token: 'u38',
    inputs: [{ code: 'ggg' }, { code: 'gcr' }],
    effects: [{ heading: 'Spells', skills: ['Meteor Shower'], text: [] }],
  }),
  mastery('orb-2', 'Orb', 'sor', { bases: ['ob1'], token: 'u38', inputs: [{ code: 'ggg' }, { code: 'skc' }], effects: [] }),
];

const BUNDLE: Pick<MasteriesBundle, 'masteries' | 'baseNames' | 'skillNames' | 'names' | 'pageDiffs' | 'noMasteryBases'> = {
  masteries: MASTERIES,
  baseNames: { am1: 'Stag Bow', ob1: 'Eagle Orb', kkl: 'Brass Knuckle', q80: 'Matriarchal Bow', m53: 'Mythical Matriarchal Bow' },
  skillNames: { 'Meteor Shower': 'Meteor Shower', Strafe: 'Strafe' },
  names: { gcr: 'Chipped Ruby', skc: 'Chipped Skull' },
  pageDiffs: [
    { subject: 'Orb › skills line 1', files: 'Spells', page: 'Sorceress Spells', mastery: 'orb-1' },
    { subject: 'General', files: 'a', page: 'b' },
  ],
  noMasteryBases: [{ code: 'kkl', cls: 'ass' }],
};

const read = (query: string) => {
  const state = readMasteriesState(new URLSearchParams(query), BUNDLE);
  return { cls: state.cls, mastery: state.mastery?.slug ?? null, unknown: state.unknown };
};

describe('URL state', () => {
  it('reads the class chip and the focused mastery', () => {
    expect(read('')).toEqual({ cls: null, mastery: null, unknown: null });
    expect(read('cls=ama')).toEqual({ cls: 'ama', mastery: null, unknown: null });
    expect(read('cls=sor&mastery=orb-2')).toEqual({ cls: 'sor', mastery: 'orb-2', unknown: null });
    expect(read('mastery=stag-bow')).toEqual({ cls: null, mastery: 'stag-bow', unknown: null });
  });

  it('drops a class chip that would hide the focused mastery', () => {
    expect(read('cls=ama&mastery=orb-1')).toEqual({ cls: null, mastery: 'orb-1', unknown: null });
  });

  it('reports values that name nothing and ignores prototype keys', () => {
    expect(read('cls=foo')).toEqual({ cls: null, mastery: null, unknown: 'foo' });
    expect(read('cls=toString')).toEqual({ cls: null, mastery: null, unknown: 'toString' });
    expect(read('cls=sor&mastery=nope')).toEqual({ cls: 'sor', mastery: null, unknown: 'nope' });
  });

  it('writes the same URL format back', () => {
    expect(masteriesParams('sor', 'orb-1').toString()).toBe('cls=sor&mastery=orb-1');
    expect(masteriesParams('sor').toString()).toBe('cls=sor');
    expect(masteriesParams(null).toString()).toBe('');
  });
});

describe('families and classes', () => {
  const families = masteryFamilies(MASTERIES);

  it('groups specialisations by their awakened token', () => {
    expect(families.map((family) => [family.label, family.options.map((option) => option.slug)])).toEqual([
      ['Stag Bow', ['stag-bow']],
      ['Orb', ['orb-1', 'orb-2']],
    ]);
  });

  it('groups families by class in game order', () => {
    const swapped = masteryFamilies([...MASTERIES].reverse());
    expect(groupByClass(swapped).map((group) => group.cls)).toEqual(['ama', 'sor']);
  });

  it('labels an option by the ingredient the others lack', () => {
    const orb = families[1];
    expect(orb.options.map((option) => optionGem(option, orb, BUNDLE.names))).toEqual(['Chipped Ruby', 'Chipped Skull']);
    expect(optionGem(families[0].options[0], families[0], BUNDLE.names)).toBeNull();
  });
});

describe('filterFamilies', () => {
  const families = masteryFamilies(MASTERIES);
  const labels = (cls: Parameters<typeof filterFamilies>[2], search: string) =>
    filterFamilies(families, BUNDLE, cls, search).map((family) => family.label);

  it('filters by class', () => {
    expect(labels('sor', '')).toEqual(['Orb']);
  });

  it('searches the weapon, its bases, the skills lines and the skill names', () => {
    expect(labels(null, 'eagle')).toEqual(['Orb']);
    expect(labels(null, 'meteor')).toEqual(['Orb']);
    expect(labels(null, 'strafe')).toEqual(['Stag Bow']);
    expect(labels(null, 'orb spells')).toEqual(['Orb']);
    expect(labels(null, 'nothing')).toEqual([]);
    expect(labels('ama', 'meteor')).toEqual([]);
  });
});

describe('other helpers', () => {
  it('finds the official page differences of one option', () => {
    expect(diffsForMastery(BUNDLE, 'orb-1').map((diff) => diff.subject)).toEqual(['Orb › skills line 1']);
    expect(diffsForMastery(BUNDLE, 'stag-bow')).toEqual([]);
  });

  it('splits a mods line written out for a mod without item text', () => {
    expect(modLine('+20% Total Spell Damage')).toEqual({ text: '+20% Total Spell Damage', note: null });
    expect(modLine('-100% Magic Resist (no item line; why your magic resist is always 0)')).toEqual({
      text: '-100% Magic Resist',
      note: 'why your magic resist is always 0',
    });
  });

  it('groups the bases the bundle does not list as bases, and the class weapons without rows', () => {
    const others = otherBaseGroups({
      baseNames: BUNDLE.baseNames,
      masteries: [
        mastery('stag-bow', 'Stag Bow', 'ama', {
          otherBases: [
            { code: 'q80', kind: 'lod' },
            { code: 'm53', kind: 'mythical' },
          ],
        }),
      ],
    });
    expect(others).toEqual([
      { label: 'LoD copies', bases: [{ code: 'q80', name: 'Matriarchal Bow', family: 'Stag Bow' }] },
      { label: 'Mythicals (may not be obtainable)', bases: [{ code: 'm53', name: 'Mythical Matriarchal Bow', family: 'Stag Bow' }] },
    ]);
    expect(noMasteryGroups(BUNDLE)).toEqual([{ cls: 'ass', names: ['Brass Knuckle'] }]);
  });
});
