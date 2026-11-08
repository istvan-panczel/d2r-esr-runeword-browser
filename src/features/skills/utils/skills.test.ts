import { describe, expect, it } from 'vitest';
import type { SkillDetail, SkillDetailsBundle, SkillsBundle } from '@/features/game-data/engine/schema';
import {
  buildSkillsView,
  dependents,
  descriptionParagraphs,
  firstSentence,
  mercenaryGroups,
  disambiguation,
  duplicateNames,
  encodeSkillsState,
  formatMana,
  grantText,
  ITEM_SKILLS,
  itemPageUrl,
  keyed,
  prerequisiteChain,
  readSkillsState,
  searchSkills,
  selectionMarks,
  skillContext,
  skillPageUrl,
} from './skills';

const detail = (id: string, cls: SkillDetail['cls'], page: number | null, extra: Partial<SkillDetail> = {}): SkillDetail => ({
  id,
  name: id,
  cls,
  page,
  reqLevel: 1,
  maxLevel: 20,
  description: [],
  ...extra,
});

const trees: SkillsBundle = {
  maxLevel: 110,
  classes: [
    {
      code: 'sor',
      name: 'Sorceress',
      tabs: [
        {
          page: 1,
          name: 'Fire',
          skills: [
            { id: 'Fire Bolt', name: 'Fire Bolt', row: 1, col: 3, reqLevel: 1, maxLevel: 20, reqSkills: [] },
            { id: 'Fire Ball', name: 'Fire Ball', row: 2, col: 3, reqLevel: 12, maxLevel: 20, reqSkills: ['Fire Bolt'] },
            { id: 'Meteor', name: 'Meteor', row: 4, col: 3, reqLevel: 24, maxLevel: 20, reqSkills: ['Fire Ball'] },
          ],
        },
        {
          page: 2,
          name: 'Lightning',
          skills: [{ id: 'Teleport', name: 'Teleport', row: 5, col: 2, reqLevel: 24, maxLevel: 20, reqSkills: [] }],
        },
        { page: 3, name: 'Cold', skills: [] },
      ],
    },
    { code: 'war', name: 'Warlock', tabs: [] },
  ],
};

const details: SkillDetailsBundle = {
  items: [
    { kind: 'unique', name: 'Hellmouth' },
    { kind: 'unique', name: "Tal Rasha's Final Whisper" },
    { kind: 'set', name: "Arcanna's Head" },
    { kind: 'runeword', name: 'Enigma' },
    { kind: 'gemword', name: 'Glow' },
  ],
  skills: [
    detail('Fire Bolt', 'sor', 1),
    detail('Fire Ball', 'sor', 1, { reqSkills: ['Fire Bolt'] }),
    detail('Meteor', 'sor', 1, { reqSkills: ['Fire Ball'] }),
    detail('Teleport', 'sor', 2),
    detail('Rift Shot', null, null),
    detail('Fire Surge', null, null),
  ],
};

const view = buildSkillsView(trees, details);

describe('buildSkillsView', () => {
  it('places the detailed skills on the trees and lists item skills by name', () => {
    expect(view.classes[0]?.tabs[0]?.cells.map((cell) => [cell.detail.id, cell.row, cell.col])).toEqual([
      ['Fire Bolt', 1, 3],
      ['Fire Ball', 2, 3],
      ['Meteor', 4, 3],
    ]);
    expect(view.itemSkills.map((skill) => skill.id)).toEqual(['Fire Surge', 'Rift Shot']);
  });
});

describe('URL state', () => {
  const defaults = { level: 20, charLevel: 110, synergy: [] };

  it('defaults to the first class and follows a skill link to its class and tab', () => {
    expect(readSkillsState(new URLSearchParams(), view)).toEqual({ view: 'sor', tab: 1, skill: null, search: '', ...defaults });
    expect(readSkillsState(new URLSearchParams('skill=Teleport'), view)).toEqual({
      view: 'sor',
      tab: 2,
      skill: 'Teleport',
      search: '',
      ...defaults,
    });
    expect(readSkillsState(new URLSearchParams('skill=Rift+Shot'), view).view).toBe(ITEM_SKILLS);
    expect(readSkillsState(new URLSearchParams('class=nope&skill=nope&tab=9'), view)).toEqual({
      view: 'sor',
      tab: 1,
      skill: null,
      search: '',
      ...defaults,
    });
  });

  it('round-trips through the URL', () => {
    const state = { view: 'war', tab: 3, skill: 'Fire Ball', search: 'fire', ...defaults };
    expect(readSkillsState(encodeSkillsState(state), view)).toEqual(state);
    expect(encodeSkillsState({ view: 'sor', tab: 1, skill: null, search: '', ...defaults }).toString()).toBe('class=sor');
    expect(skillPageUrl({ id: 'Teleport', cls: 'sor', page: 2 })).toBe('/skills?class=sor&tab=2&skill=Teleport');
    expect(skillPageUrl({ id: 'Rift Shot', cls: null, page: null })).toBe('/skills?class=items&skill=Rift+Shot');
  });

  it('keeps the calculator level, character level and synergies, omitted at their defaults', () => {
    const state = { view: 'sor', tab: 1, skill: 'Fire Ball', search: '', level: 30, charLevel: 90, synergy: [20, 0, 5] };
    const params = encodeSkillsState(state);
    expect(params.toString()).toBe('class=sor&skill=Fire+Ball&lvl=30&clvl=90&syn=20.0.5');
    expect(readSkillsState(params, view)).toEqual(state);
    expect(encodeSkillsState({ ...state, synergy: 'max' }).get('syn')).toBe('max');
    expect(encodeSkillsState({ ...state, synergy: [0, 0] }).has('syn')).toBe(false);
    expect(readSkillsState(new URLSearchParams('lvl=0&clvl=111&syn=x.1'), view)).toMatchObject(defaults);
    expect(readSkillsState(new URLSearchParams('lvl=110&clvl=1&syn=max'), view)).toMatchObject({
      level: 110,
      charLevel: 1,
      synergy: 'max',
    });
  });
});

describe('search and tree relations', () => {
  it('finds class and item skills by every word of the name', () => {
    expect(searchSkills(view, 'fire').map((skill) => skill.id)).toEqual(['Fire Bolt', 'Fire Ball', 'Fire Surge']);
    expect(searchSkills(view, 'ball FIRE').map((skill) => skill.id)).toEqual(['Fire Ball']);
    expect(searchSkills(view, '"fire b"').map((skill) => skill.id)).toEqual(['Fire Bolt', 'Fire Ball']);
    expect(searchSkills(view, '"bolt fire"')).toEqual([]);
    expect(searchSkills(view, '  ')).toEqual([]);
  });

  it('walks the prerequisites and the skills a skill unlocks', () => {
    expect([...prerequisiteChain(view, 'Meteor')]).toEqual(['Fire Ball', 'Fire Bolt']);
    expect(dependents(view, 'Fire Bolt').map((skill) => skill.id)).toEqual(['Fire Ball']);
    expect(dependents(view, 'Rift Shot')).toEqual([]);
  });

  it('marks the selected skill, its prerequisite chain and its direct dependents', () => {
    const markOf = selectionMarks(view, 'Fire Ball');
    expect(markOf('Fire Ball')).toBe('selected');
    expect(markOf('Fire Bolt')).toBe('prerequisite');
    expect(markOf('Meteor')).toBe('dependent');
    expect(markOf('Teleport')).toBeNull();
    expect(selectionMarks(view, 'Meteor')('Fire Bolt')).toBe('prerequisite');
    expect(selectionMarks(view, null)('Fire Ball')).toBeNull();
  });

  it('names the class and tab', () => {
    expect(skillContext(view, detail('Teleport', 'sor', 2))).toBe('Sorceress · Lightning tab');
    expect(skillContext(view, detail('Rift Shot', null, null))).toBe('Item skill');
  });
});

describe('texts and links', () => {
  it('formats mana and grants', () => {
    expect(formatMana([2, 0.5])).toBe('2 (+0.5 per level)');
    expect(formatMana([10, -0.125])).toBe('10 (-0.125 per level)');
    expect(formatMana([5, 0])).toBe('5');
    expect(grantText({ item: 0, how: 'oskill', level: [10, 20] })).toBe('+10-20 levels (any class)');
    expect(grantText({ item: 0, how: 'skill', level: 2 })).toBe('+2 levels (class only)');
    expect(grantText({ item: 0, how: 'aura', level: 3, partial: true })).toBe('Level 3 aura when equipped (partial set bonus)');
    expect(grantText({ item: 0, how: 'charged', level: 1, charges: 7 })).toBe('Level 1, 7 charges');
    expect(grantText({ item: 0, how: 'hit-skill', level: 60, chance: 5 })).toBe('5% chance to cast level 60 on striking');
    expect(grantText({ item: 0, how: 'gethit-skill', level: 1, chance: 25 })).toBe('25% chance to cast level 1 when struck');
  });

  it('links items to their pages with ?name=, mythicals to the Mythicals page', () => {
    const mythicals = new Set(["tal rasha's final whisper"]);
    const [hellmouth, talRasha, arcanna, enigma, glow] = details.items;
    expect(hellmouth && itemPageUrl(hellmouth, mythicals)).toBe('/uniques?name=Hellmouth');
    expect(talRasha && itemPageUrl(talRasha, mythicals)).toBe('/mythicals?name=Tal+Rasha%27s+Final+Whisper');
    expect(arcanna && itemPageUrl(arcanna, mythicals)).toBe('/game-data/sets?name=Arcanna%27s+Head');
    expect(enigma && itemPageUrl(enigma, mythicals)).toBe('/runewords?name=Enigma');
    expect(glow && itemPageUrl(glow, mythicals)).toBe('/gemwords?name=Glow');
  });

  it('says "level" for one level', () => {
    expect(grantText({ item: 0, how: 'oskill', level: 1 })).toBe('+1 level (any class)');
  });

  it('cuts the first sentence, not inside parentheses or after e.g.', () => {
    expect(firstSentence('A buff that grants 2% attack speed per level. Also regenerates life.')).toBe(
      'A buff that grants 2% attack speed per level.'
    );
    expect(firstSentence('Heals (e.g. level 10 = 10% heal. Of max life) when cast. Level = % heal.')).toBe(
      'Heals (e.g. level 10 = 10% heal. Of max life) when cast.'
    );
    expect(firstSentence('Grants it, e.g. Fire Surge gets more. Then stops.')).toBe('Grants it, e.g. Fire Surge gets more.');
    expect(firstSentence('Lasts 20 seconds')).toBe('Lasts 20 seconds');
    expect(firstSentence('Deals 1.5x damage. More')).toBe('Deals 1.5x damage.');
  });

  it('groups mercenaries by hireling', () => {
    expect(
      mercenaryGroups([
        { hireling: 'Desert Mercenary', subtype: 'Comb - Normal' },
        { hireling: 'Barbarian', subtype: 'Offensive' },
        { hireling: 'Desert Mercenary', subtype: 'Def - Hell' },
      ])
    ).toEqual([
      {
        hireling: 'Desert Mercenary',
        href: '/mercenaries?hireling=desert-mercenary',
        subtypes: [
          { label: 'Comb – Normal', href: '/mercenaries?hireling=desert-mercenary&type=combat&difficulty=normal' },
          { label: 'Def – Hell', href: '/mercenaries?hireling=desert-mercenary&type=defensive&difficulty=hell' },
        ],
      },
      {
        hireling: 'Barbarian',
        href: '/mercenaries?hireling=barbarian',
        subtypes: [{ label: 'Offensive', href: '/mercenaries?hireling=barbarian&type=offensive' }],
      },
    ]);
  });

  it('joins hand-broken description lines into paragraphs', () => {
    expect(descriptionParagraphs(['Teleport and unleash a devastating', 'flurry of arrows', 'Gain extra arrows'])).toEqual([
      'Teleport and unleash a devastating flurry of arrows',
      'Gain extra arrows',
    ]);
  });

  it('tells same-name item skills apart by their id', () => {
    const skills = [
      { id: 'Empowered Enchant Cold', name: 'Empowered Enchant' },
      { id: 'Empowered Enchant Fire', name: 'Empowered Enchant' },
      { id: 'Stormshield Chain Lightning', name: 'Chain Lightning' },
      { id: 'Chain Lightning Djinn', name: 'Chain Lightning' },
      { id: 'Rift Shot', name: 'Rift Shot' },
    ];
    const duplicates = duplicateNames(skills);
    expect(skills.map((skill) => disambiguation(skill, duplicates))).toEqual([
      'Cold',
      'Fire',
      'Stormshield Chain Lightning',
      'Djinn',
      null,
    ]);
  });

  it('keys repeated lines', () => {
    expect(keyed(['a', 'b', 'a'], String).map((entry) => entry.key)).toEqual(['a', 'b', 'a#1']);
  });
});
