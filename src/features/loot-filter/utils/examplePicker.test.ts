import { describe, expect, it } from 'vitest';
import { EXAMPLE_GROUPS, EXAMPLE_RULES, findExample, isHideExample, STYLE_ICON } from './exampleRules';
import {
  buildStarterRules,
  headingTitles,
  withGroupHeadings,
  effectiveChoices,
  groupBulkKind,
  groupExamples,
  groupSelection,
  INITIAL_PICKER_STATE,
  mergeStyles,
  orderedSelection,
  selectAllLabelRules,
  setExampleChoice,
  setExamplesSelected,
  setGroupSelected,
  setPickerSwitch,
  starterRulesFor,
} from './examplePicker';
import { stylePreset, styleWithoutIcon } from './stylePresets';

const pick = (...ids: string[]) => setExamplesSelected(INITIAL_PICKER_STATE, ids, true);

describe('example picker state', () => {
  it('ticks with the default choices, keeps choices on a second tick and drops them on untick; unknown ids are ignored', () => {
    let state = pick('high-runes', 'nope');
    expect(Object.keys(state.selected)).toEqual(['high-runes']);
    expect(state.selected['high-runes']).toEqual({
      style: 'high-rune',
      sound: 'tink.mp3',
      icon: STYLE_ICON,
      chatMessage: 'ÿc1High rune: ÿc0{name}',
    });
    state = setExampleChoice(state, 'high-runes', 'sound', null);
    state = setExamplesSelected(state, ['high-runes'], true);
    expect(state.selected['high-runes']?.sound).toBeNull();
    state = setExamplesSelected(state, ['high-runes'], false);
    expect(state.selected).toEqual({});
    expect(setExampleChoice(state, 'high-runes', 'sound', 'mid.mp3')).toBe(state);
  });

  it('reports a group as none, some or all ticked', () => {
    const runes = groupExamples('runes').map((example) => example.id);
    expect(groupSelection(INITIAL_PICKER_STATE, 'runes')).toBe('none');
    expect(groupSelection(pick(runes[0] ?? ''), 'runes')).toBe('some');
    expect(groupSelection(pick(...runes), 'runes')).toBe('all');
  });

  it('ticks every label rule on Select all and no hide rule', () => {
    const state = selectAllLabelRules(INITIAL_PICKER_STATE);
    const ticked = new Set(Object.keys(state.selected));
    for (const example of EXAMPLE_RULES) expect(ticked.has(example.id), example.id).toBe(!isHideExample(example));
    // A hide rule ticked by hand stays ticked, with the label rules added around it.
    const withHide = selectAllLabelRules(pick('hide-inferior'));
    expect(Object.keys(withHide.selected)).toHaveLength(ticked.size + 1);
    expect(groupSelection(state, 'junk')).toBe('none');
  });

  it('lets a group checkbox tick label rules only, except in a group of hide rules only', () => {
    expect(groupBulkKind('runes')).toBe('all');
    expect(groupBulkKind('gems')).toBe('labels');
    expect(groupBulkKind('gold')).toBe('labels');
    expect(groupBulkKind('junk')).toBe('hides');

    const gems = setGroupSelected(INITIAL_PICKER_STATE, 'gems', true);
    expect(Object.keys(gems.selected).sort()).toEqual(['blemished-gems', 'perfect-gems']);
    // The untouched hide rule does not make the group partial, so the next click unticks it.
    expect(groupSelection(gems, 'gems')).toBe('all');
    expect(groupSelection(pick('hide-low-gems'), 'gems')).toBe('some');
    const gemsAndHide = setExamplesSelected(gems, ['hide-low-gems'], true);
    expect(groupSelection(gemsAndHide, 'gems')).toBe('all');
    expect(setGroupSelected(gemsAndHide, 'gems', false).selected).toEqual({});

    const junk = setGroupSelected(INITIAL_PICKER_STATE, 'junk', true);
    expect(Object.keys(junk.selected)).toEqual(groupExamples('junk').map((example) => example.id));
    expect(groupSelection(junk, 'junk')).toBe('all');
    expect(setGroupSelected(junk, 'junk', false).selected).toEqual({});
  });

  it('applies the bulk switches on top of the choices', () => {
    const state = setPickerSwitch(setPickerSwitch(pick('high-runes'), 'noSounds', true), 'noIcons', true);
    const choices = state.selected['high-runes'];
    if (choices === undefined) throw new Error('not ticked');
    expect(effectiveChoices(state, choices)).toEqual({ ...choices, sound: null, icon: null });
    expect(effectiveChoices(setPickerSwitch(state, 'noChat', true), choices).chatMessage).toBeNull();
  });
});

describe('buildStarterRules', () => {
  it('puts label rules first in group order and the hide rules last, whatever the tick order', () => {
    const state = pick('hide-inferior', 'tier-1-maps', 'hide-low-gems', 'high-runes', 'perfect-gems');
    expect(orderedSelection(state).map((example) => example.id)).toEqual([
      'high-runes',
      'perfect-gems',
      'tier-1-maps',
      'hide-low-gems',
      'hide-inferior',
    ]);
    const { rules } = buildStarterRules(state);
    expect(rules.map((rule) => rule.comment)).toEqual(orderedSelection(state).map((example) => example.title));
    expect(rules.slice(-2).every((rule) => rule.hide === true)).toBe(true);
  });

  it('collects each used style once and leaves out the switched-off parts', () => {
    const state = setPickerSwitch(setPickerSwitch(pick('high-runes', 'elemental-runes', 'tier-1-maps'), 'noSounds', true), 'noChat', true);
    const { rules, styles } = buildStarterRules(state);
    expect(Object.keys(styles)).toEqual(['HighRune', 'MapItem']);
    expect(styles.HighRune).toEqual(stylePreset('high-rune').style);
    expect(rules.every((rule) => rule.sound === undefined && rule.chatMessage === undefined)).toBe(true);
    // The icons come with the styles; no rule needs its own.
    expect(rules.map((rule) => rule.icon)).toEqual([undefined, undefined, undefined]);
    expect([styles.HighRune?.icon?.iconName, styles.MapItem?.icon?.iconName]).toEqual(['diamond_red', 'map_white']);
  });

  it('builds every example together without duplicate comments', () => {
    const { rules } = starterRulesFor(EXAMPLE_RULES.map((example) => example.id));
    expect(rules).toHaveLength(EXAMPLE_RULES.length);
    expect(new Set(rules.map((rule) => rule.comment)).size).toBe(rules.length);
    const firstHide = rules.findIndex((rule) => rule.hide === true);
    expect(rules.slice(firstHide).every((rule) => rule.hide === true)).toBe(true);
    expect(EXAMPLE_GROUPS.length).toBeGreaterThan(10);
  });

  it('needs one NoIcon copy with the default choices of every example: Hel to Um, which keep no icon', () => {
    const { rules, styles } = starterRulesFor(EXAMPLE_RULES.map((example) => example.id));
    expect(Object.keys(styles).filter((name) => name.endsWith('NoIcon'))).toEqual(['MidTierRuneNoIcon']);
    // The copy sits right after its base style, not where it was first used.
    const names = Object.keys(styles);
    expect(names.indexOf('MidTierRuneNoIcon')).toBe(names.indexOf('MidTierRune') + 1);
    expect(styles.MidTierRuneNoIcon).toEqual(styleWithoutIcon(stylePreset('mid-rune').style));
    expect(rules.filter((rule) => rule.useStyle === 'MidTierRuneNoIcon').map((rule) => rule.comment)).toEqual(['Mid runes: Hel to Um']);
    // Every other style is a preset with its icon (Low rune and Muted have none).
    const quiet = new Set(['MidTierRuneNoIcon', 'LowRune', 'MutedJunk']);
    for (const [name, style] of Object.entries(styles)) if (!quiet.has(name)) expect(style.icon, name).toBeDefined();
  });

  describe('per-rule icon choices', () => {
    const uniques = pick('unique-items', 'unique-by-id', 'unique-jewellery');
    const unique = stylePreset('unique');
    const icons = (state: typeof uniques, existing?: Parameters<typeof buildStarterRules>[1]) =>
      buildStarterRules(state, existing).rules.map((rule) => [rule.useStyle, rule.icon?.iconName ?? null]);

    // Rule order: unique-items, unique-jewellery, unique-by-id (the group's list order).
    it('default: the style’s star on two, the jewellery rule’s own crown', () => {
      expect(icons(uniques)).toEqual([
        ['UniqueItem', null],
        ['UniqueItem', 'crown_gold'],
        ['UniqueItem', null],
      ]);
      expect(buildStarterRules(uniques).styles).toEqual({ UniqueItem: unique.style });
    });

    it('all None: the preset without its icon, no copy', () => {
      let state = uniques;
      for (const id of ['unique-items', 'unique-by-id', 'unique-jewellery']) state = setExampleChoice(state, id, 'icon', null);
      const { styles } = buildStarterRules(state);
      expect(styles).toEqual({ UniqueItem: styleWithoutIcon(unique.style) });
      expect(icons(state)).toEqual([
        ['UniqueItem', null],
        ['UniqueItem', null],
        ['UniqueItem', null],
      ]);
    });

    it('None next to own icons only (nobody wants the star): the preset without its icon, the others keep their own', () => {
      const state = setExampleChoice(setExampleChoice(uniques, 'unique-items', 'icon', null), 'unique-by-id', 'icon', 'crown_gold');
      expect(buildStarterRules(state).styles).toEqual({ UniqueItem: styleWithoutIcon(unique.style) });
      expect(icons(state)).toEqual([
        ['UniqueItem', null],
        ['UniqueItem', 'crown_gold'],
        ['UniqueItem', 'crown_gold'],
      ]);
    });

    it('mixed: None, the style’s star and a crown, the None rule on the NoIcon copy', () => {
      const state = setExampleChoice(uniques, 'unique-items', 'icon', null);
      const { styles } = buildStarterRules(state);
      expect(styles).toEqual({ UniqueItemNoIcon: styleWithoutIcon(unique.style), UniqueItem: unique.style });
      expect(icons(state)).toEqual([
        ['UniqueItemNoIcon', null],
        ['UniqueItem', 'crown_gold'],
        ['UniqueItem', null],
      ]);
    });

    it('the bulk switch: no icon anywhere, the presets without theirs, and the choices back once it is off', () => {
      const off = setPickerSwitch(uniques, 'noIcons', true);
      expect(buildStarterRules(off).styles).toEqual({ UniqueItem: styleWithoutIcon(unique.style) });
      expect(icons(off).every(([, icon]) => icon === null)).toBe(true);
      expect(icons(setPickerSwitch(off, 'noIcons', false))).toEqual(icons(uniques));
    });

    it('a filter style of the same name is never overwritten, and the rules still show what they chose', () => {
      const mine = { replaceName: 'ÿc3{name}' };
      const state = setExampleChoice(uniques, 'unique-items', 'icon', null);
      const { styles } = buildStarterRules(state, { UniqueItem: mine });
      expect(mergeStyles({ UniqueItem: mine }, styles)).toEqual({ add: {}, reused: ['UniqueItem'] });
      expect(icons(state, { UniqueItem: mine })).toEqual([
        ['UniqueItem', null],
        ['UniqueItem', 'crown_gold'],
        ['UniqueItem', 'star_gold'],
      ]);
    });
  });
});

describe('mergeStyles', () => {
  it('adds missing styles, skips identical ones and reports names the filter uses for a different style', () => {
    const high = stylePreset('high-rune');
    const map = stylePreset('map');
    const unique = stylePreset('unique');
    const merge = mergeStyles(
      { [high.name]: high.style, [map.name]: { labelBorder: { color: [1, 1, 1], width: 1 } } },
      { [high.name]: high.style, [map.name]: map.style, [unique.name]: unique.style }
    );
    expect(merge).toEqual({ add: { [unique.name]: unique.style }, reused: [map.name] });
    expect(mergeStyles(undefined, { [high.name]: high.style }).add).toEqual({ [high.name]: high.style });
    expect(findExample('high-runes')).toBeDefined();
  });
});

describe('withGroupHeadings', () => {
  const ids = ['high-runes', 'mid-runes', 'perfect-gems', 'hide-inferior', 'hide-minor-potions'];
  const examples = ids.map((id) => {
    const example = findExample(id);
    if (example === undefined) throw new Error(id);
    return example;
  });
  const rules = examples.map((example) => ({ comment: example.title }));

  it('writes a section heading above the first rule of each group, hide rules under one', () => {
    expect(withGroupHeadings(examples, rules, new Set()).map((rule) => rule.commentsBefore)).toEqual([
      ['// ---- Runes'],
      undefined,
      ['// ---- Gems'],
      ['// ---- Hide rules'],
      undefined,
    ]);
  });

  it('skips a title the filter already has as a heading, in any case', () => {
    const existing = headingTitles(['// ==== RUNES', '// a note', '// ---- Hide rules ----']);
    expect(existing).toEqual(new Set(['runes', 'hide rules']));
    expect(withGroupHeadings(examples, rules, existing).map((rule) => rule.commentsBefore)).toEqual([
      undefined,
      undefined,
      ['// ---- Gems'],
      undefined,
      undefined,
    ]);
  });
});
