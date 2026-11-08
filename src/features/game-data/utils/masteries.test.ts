import { describe, expect, it } from 'vitest';
import type { MasteriesBundle, WeaponMastery } from '../engine/schema';
import {
  anyWeaponPerkText,
  buildMasteryIndex,
  masteryBasesUrl,
  masteryHref,
  masteryRecipe,
  masterySummary,
  namesOneSkill,
} from './masteries';

const mastery = (
  property: string,
  label: string,
  effects: WeaponMastery['effects'],
  extra: Partial<WeaponMastery> = {}
): WeaponMastery => ({
  property,
  slug: property.replace('weapon-mastery-', ''),
  label,
  cls: 'sor',
  bases: ['ob1', 'ob6'],
  token: 'u38',
  inputs: [{ code: 'ggg' }, { code: 'qqq' }],
  remove: [{ code: 'ggg' }, { code: 'wms', qty: 3 }],
  effects,
  ...extra,
});

const orb1 = mastery('weapon-mastery-orb-1', 'Orb', [{ heading: 'Spells', skills: ['Meteor Shower', 'Teleport'], text: ['Triples …'] }], {
  type: 'orb',
});
const orb2 = mastery('weapon-mastery-orb-2', 'Orb', [{ heading: 'Sorceress Exclusives', skills: ['Omnipotence'], text: ['Increases …'] }], {
  type: 'orb',
});
const bundle: MasteriesBundle = {
  token: 'u23',
  names: { ggg: 'Crushed Gem', qqq: 'Anvil Stone', u38: 'Awakened Weapon Mastery Token', wms: 'Thawing Potion' },
  skillNames: { 'Meteor Shower': 'Meteor Shower', Teleport: 'Teleport', Omnipotence: 'Omnipotence' },
  masteries: [orb1, orb2],
  baseNames: {},
  noRunewords: true,
  noMasteryBases: [],
  pageRules: {},
  pageDiffs: [],
};

describe('weapon mastery helpers', () => {
  it('indexes the masteries by base and by skill', () => {
    const index = buildMasteryIndex(bundle);
    expect(index.byBase.get('ob6')).toEqual([orb1, orb2]);
    expect(index.bySkill.get('Teleport')).toEqual([{ mastery: orb1, effects: orb1.effects }]);
    expect(index.bySkill.has('Fire Ball')).toBe(false);
  });

  it('words the panel summary, the recipe and the Bases page link', () => {
    expect(masterySummary([orb1, orb2])).toBe('one of 2 (Spells or Sorceress Exclusives)');
    expect(masterySummary([orb1])).toBe('Spells');
    expect(masteryRecipe(orb1, bundle.names).map((entry) => entry.text)).toEqual(['Awakened token', 'Crushed Gem', 'Anvil Stone']);
    expect(masteryBasesUrl(orb1)).toBe('/game-data/bases?type=orb');
    expect(masteryHref('orb-1')).toBe('/weapon-masteries?mastery=orb-1');
    expect(masteryBasesUrl(mastery('weapon-mastery-reflex-bow', 'Reflex Bow', [], { bases: ['am2', 'am7', 'amc', 'm54'] }))).toBe(
      '/game-data/bases?codes=am2%2Cam7%2Camc%2Cm54'
    );
  });

  it('links a skills line itself only when it names one skill', () => {
    expect(namesOneSkill({ heading: 'Omnipotence', skills: ['Omnipotence'], text: [] }, bundle.skillNames)).toBe(true);
    expect(namesOneSkill(orb1.effects[0], bundle.skillNames)).toBe(false);
  });

  it('words the perk with which any weapon takes any specialisation', () => {
    expect(anyWeaponPerkText(bundle)).toBe('');
    expect(anyWeaponPerkText({ ...bundle, anyWeaponPerk: { title: 'True Master', tree: 'Blacksmith' } })).toBe(
      'With the Blacksmith perk True Master, any weapon takes any specialisation.'
    );
  });
});
