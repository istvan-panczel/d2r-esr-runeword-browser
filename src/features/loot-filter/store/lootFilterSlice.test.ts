import { describe, expect, it } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';
import { parseLootFilter } from '../engine/parse';
import { serializeLootFilter } from '../engine/serialize';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { createBlankFilter } from '../utils/blankFilter';
import reducer, {
  EMPTY_EDITOR,
  addRule,
  close,
  createBlank,
  duplicate,
  duplicateRule,
  editorFlushed,
  hydrate,
  importText,
  initialState,
  moveRule,
  open,
  patchRule,
  remove,
  removeRule,
  setRuleDisabled,
  removeStyle,
  rename,
  renameStyle,
  replaceFilter,
  selectRule,
  renumberLevel,
  setFilterLevels,
  setHeader,
  setNotifications,
  setQualityColors,
  setStyle,
  updateRule,
} from './lootFilterSlice';
import { selectDiagnostics } from './selectors';
import type { LootFilterEntry, LootFilterState } from './types';

const NOW = 1_000;
const LATER = 2_000;

function entry(id: string, filter: LootFilter = createBlankFilter(id), name = id): LootFilterEntry {
  return { id, name, source: 'upload', createdAt: NOW, updatedAt: NOW, text: serializeLootFilter(filter) };
}

const RULES: readonly LootFilterRule[] = [{ comment: 'a' }, { comment: 'b' }, { comment: 'c' }, { comment: 'd' }];

function filterWith(overrides: Partial<LootFilter> = {}): LootFilter {
  return { ...createBlankFilter('Test'), rules: RULES, ...overrides };
}

function run(state: LootFilterState, ...actions: UnknownAction[]): LootFilterState {
  return actions.reduce(reducer, state);
}

function openState(filter: LootFilter = filterWith()): LootFilterState {
  return run(initialState, hydrate([entry('one', filter)]), { type: open.type, payload: { id: 'one', now: NOW } });
}

const comments = (state: LootFilterState) => state.editor.filter?.rules.map((rule) => rule.comment);

describe('createBlankFilter', () => {
  it('builds a one-level, rule-less filter titled with the name', () => {
    expect(createBlankFilter('Mine')).toEqual({
      formatVersion: 1,
      title: 'Mine',
      filterLevels: [{ id: 1, name: 'Default' }],
      defaultLevel: 1,
      rules: [],
      leadingComments: [],
    });
  });

  it('serializes to a file the parser reads back without errors', () => {
    const { filter, diagnostics } = parseLootFilter(serializeLootFilter(createBlankFilter('Mine')));
    expect(diagnostics).toEqual([]);
    expect(filter.title).toBe('Mine');
  });
});

describe('library reducers', () => {
  it('hydrate marks the library loaded and replaces its entries', () => {
    const state = reducer(initialState, hydrate([entry('stored')]));
    expect(state.library.hydrated).toBe(true);
    expect(state.library.entries.map((e) => e.id)).toEqual(['stored']);
  });

  it('createBlank adds a blank entry whose text is the blank filter', () => {
    const state = reducer(initialState, { type: createBlank.type, payload: { id: 'x', name: '  My filter ', now: NOW } });
    expect(state.library.entries).toEqual([
      {
        id: 'x',
        name: 'My filter',
        source: 'blank',
        createdAt: NOW,
        updatedAt: NOW,
        text: serializeLootFilter(createBlankFilter('My filter')),
      },
    ]);
  });

  it('createBlank prepare generates an id and a timestamp', () => {
    const action = createBlank('Name');
    expect(action.payload.id).not.toBe('');
    expect(action.payload.now).toBeGreaterThan(0);
    expect(createBlank('Other').payload.id).not.toBe(action.payload.id);
  });

  it('importText stores the text verbatim and falls back to a default name', () => {
    const text = '// hi\n{"formatVersion": 1, "rules": []}';
    const state = reducer(initialState, { type: importText.type, payload: { id: 'u', name: ' ', text, source: 'template', now: NOW } });
    expect(state.library.entries[0]).toMatchObject({ id: 'u', name: 'Untitled filter', source: 'template', text });
  });

  it('duplicate inserts a copy after the original', () => {
    const state = run(initialState, hydrate([entry('a'), entry('b')]), {
      type: duplicate.type,
      payload: { id: 'a', newId: 'a2', now: LATER },
    });
    expect(state.library.entries.map((e) => [e.id, e.name])).toEqual([
      ['a', 'a'],
      ['a2', 'a (copy)'],
      ['b', 'b'],
    ]);
    expect(state.library.entries[1]).toMatchObject({ text: state.library.entries[0].text, createdAt: LATER, updatedAt: LATER });
  });

  it('duplicate of the open entry copies its unsaved edits', () => {
    const state = run(openState(), setHeader({ title: 'Edited' }), {
      type: duplicate.type,
      payload: { id: 'one', newId: 'copy', now: LATER },
    });
    expect(parseLootFilter(state.library.entries[1].text).filter.title).toBe('Edited');
    expect(state.editor.dirty).toBe(false);
  });

  it('duplicate of a missing id is a no-op', () => {
    const before = run(initialState, hydrate([entry('a')]));
    expect(reducer(before, { type: duplicate.type, payload: { id: 'zzz', newId: 'n', now: LATER } })).toBe(before);
  });

  it('rename trims, bumps updatedAt and ignores unknown ids', () => {
    const before = run(initialState, hydrate([entry('a')]));
    const state = reducer(before, { type: rename.type, payload: { id: 'a', name: ' New ', now: LATER } });
    expect(state.library.entries[0]).toMatchObject({ name: 'New', updatedAt: LATER });
    expect(reducer(before, { type: rename.type, payload: { id: 'zzz', name: 'X', now: LATER } })).toBe(before);
  });

  it('remove deletes the entry and closes the editor when it was open', () => {
    const state = reducer(openState(), remove('one'));
    expect(state.library.entries).toEqual([]);
    expect(state.editor).toEqual(EMPTY_EDITOR);
  });

  it('remove keeps the editor when another entry is removed', () => {
    const base = run(openState(), { type: importText.type, payload: { id: 'two', name: 'Two', text: '{}', source: 'upload', now: NOW } });
    const state = reducer(base, remove('two'));
    expect(state.editor.id).toBe('one');
    expect(state.library.entries.map((e) => e.id)).toEqual(['one']);
  });

  it('editorFlushed writes a dirty model into the entry text', () => {
    const state = run(openState(), setHeader({ title: 'Flushed' }), { type: editorFlushed.type, payload: { now: LATER } });
    expect(state.editor.dirty).toBe(false);
    expect(state.library.entries[0].updatedAt).toBe(LATER);
    expect(parseLootFilter(state.library.entries[0].text).filter.title).toBe('Flushed');
  });

  it('editorFlushed without edits changes nothing', () => {
    const before = openState();
    expect(reducer(before, { type: editorFlushed.type, payload: { now: LATER } })).toBe(before);
  });
});

describe('open and close', () => {
  it('open parses the entry text', () => {
    const state = openState();
    expect(state.editor).toMatchObject({ id: 'one', selectedRule: null, dirty: false, parseDiagnostics: [] });
    expect(comments(state)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('open keeps parse diagnostics (unknown keys)', () => {
    const text = '{"formatVersion": 1, "rules": [{"mystery": 1}]}';
    const state = run(initialState, hydrate([{ ...entry('x'), text }]), { type: open.type, payload: { id: 'x', now: NOW } });
    expect(state.editor.filter?.rules[0].passthrough).toEqual({ mystery: 1 });
    expect(state.editor.parseDiagnostics).toHaveLength(1);
    expect(state.editor.parseDiagnostics[0].severity).toBe('warning');
  });

  it('open with a JSONC syntax error leaves no model and stores the message', () => {
    const state = run(initialState, hydrate([{ ...entry('bad'), text: '{ "formatVersion": 1,' }]), {
      type: open.type,
      payload: { id: 'bad', now: NOW },
    });
    expect(state.editor.id).toBe('bad');
    expect(state.editor.filter).toBeNull();
    expect(state.editor.parseDiagnostics).toHaveLength(1);
    expect(state.editor.parseDiagnostics[0]).toMatchObject({ severity: 'error', path: '' });
    expect(state.editor.parseDiagnostics[0].message).toMatch(/line 1/);
  });

  it('open of an unknown id records the id with no model', () => {
    const state = reducer(initialState, { type: open.type, payload: { id: 'nope', now: NOW } });
    expect(state.editor).toEqual({ ...EMPTY_EDITOR, id: 'nope' });
  });

  it('open flushes the previously open, dirty filter', () => {
    const two = { type: importText.type, payload: { id: 'two', name: 'Two', text: entry('two').text, source: 'upload', now: NOW } };
    const base = run(openState(), two, setHeader({ title: 'Kept' }));
    const state = reducer(base, { type: open.type, payload: { id: 'two', now: LATER } });
    expect(state.editor.id).toBe('two');
    const one = state.library.entries.find((candidate) => candidate.id === 'one');
    expect(one && parseLootFilter(one.text).filter.title).toBe('Kept');
  });

  it('close flushes and resets the editor', () => {
    const state = run(openState(), setHeader({ author: 'Me' }), { type: close.type, payload: { now: LATER } });
    expect(state.editor).toEqual(EMPTY_EDITOR);
    expect(parseLootFilter(state.library.entries[0].text).filter.author).toBe('Me');
  });
});

describe('settings reducers', () => {
  it('setHeader patches keys, removes undefined ones and sets dirty', () => {
    const state = run(openState(), setHeader({ author: 'Me', soundVolume: 50 }), setHeader({ title: undefined }));
    expect(state.editor.dirty).toBe(true);
    expect(state.editor.filter).toMatchObject({ author: 'Me', soundVolume: 50 });
    expect(state.editor.filter && 'title' in state.editor.filter).toBe(false);
  });

  it('setHeader drops a wrong-shaped passthrough value of the same key', () => {
    const state = openState(filterWith({ passthrough: { title: 42, extra: true } }));
    const next = reducer(state, setHeader({ title: 'Fixed' }));
    expect(next.editor.filter?.passthrough).toEqual({ extra: true });
  });

  it('setFilterLevels replaces or removes the levels', () => {
    const levels = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
    ];
    const state = reducer(openState(), setFilterLevels(levels));
    expect(state.editor.filter?.filterLevels).toEqual(levels);
    expect(reducer(state, setFilterLevels(undefined)).editor.filter?.filterLevels).toBeUndefined();
  });

  describe('renumberLevel', () => {
    const levelled = () =>
      openState(
        filterWith({
          filterLevels: [
            { id: 1, name: 'One' },
            { id: 2, name: 'Two' },
          ],
          defaultLevel: 2,
          rules: [{ activeInLevels: [1, 2], hide: true }, { activeInLevels: [1] }, { hide: true }],
        })
      );

    it('changes the id and the rules and default level that use it', () => {
      const state = reducer(levelled(), renumberLevel({ from: 2, to: 5 }));
      expect(state.editor.filter?.filterLevels).toEqual([
        { id: 1, name: 'One' },
        { id: 5, name: 'Two' },
      ]);
      expect(state.editor.filter?.defaultLevel).toBe(5);
      expect(state.editor.filter?.rules.map((rule) => rule.activeInLevels)).toEqual([[1, 5], [1], undefined]);
      expect(state.editor.dirty).toBe(true);
    });

    it('leaves the default level alone when it is another level', () => {
      const state = reducer(levelled(), renumberLevel({ from: 1, to: 3 }));
      expect(state.editor.filter?.defaultLevel).toBe(2);
      expect(state.editor.filter?.rules.map((rule) => rule.activeInLevels)).toEqual([[3, 2], [3], undefined]);
    });

    it('is a no-op for a taken, non-integer or unknown id', () => {
      const before = levelled();
      expect(reducer(before, renumberLevel({ from: 1, to: 2 }))).toBe(before);
      expect(reducer(before, renumberLevel({ from: 1, to: 1.5 }))).toBe(before);
      expect(reducer(before, renumberLevel({ from: 9, to: 10 }))).toBe(before);
      expect(reducer(before, renumberLevel({ from: 1, to: 1 }))).toBe(before);
    });
  });

  it('setNotifications patches formats and drops the object when empty', () => {
    const state = reducer(openState(), setNotifications({ dropFormat: '{name}', levelChangeFormat: 'Level {level}' }));
    expect(state.editor.filter?.notifications).toEqual({ dropFormat: '{name}', levelChangeFormat: 'Level {level}' });
    const cleared = run(state, setNotifications({ dropFormat: undefined }), setNotifications({ levelChangeFormat: undefined }));
    expect(cleared.editor.filter && 'notifications' in cleared.editor.filter).toBe(false);
  });

  it('setQualityColors patches one quality and drops the object when empty', () => {
    const state = reducer(openState(), setQualityColors({ magic: 'ÿc3' }));
    expect(state.editor.filter?.qualityColors).toEqual({ magic: 'ÿc3' });
    const cleared = reducer(state, setQualityColors({ magic: undefined }));
    expect(cleared.editor.filter && 'qualityColors' in cleared.editor.filter).toBe(false);
  });

  it('edits without an open filter are ignored', () => {
    expect(reducer(initialState, setHeader({ title: 'x' }))).toBe(initialState);
    expect(reducer(initialState, addRule())).toBe(initialState);
  });
});

describe('rule reducers', () => {
  it('addRule appends an empty rule by default and selects it', () => {
    const state = reducer(openState(), addRule());
    expect(state.editor.filter?.rules).toHaveLength(5);
    expect(state.editor.filter?.rules[4]).toEqual({});
    expect(state.editor).toMatchObject({ selectedRule: 4, dirty: true });
  });

  it('addRule inserts at a clamped position', () => {
    expect(comments(reducer(openState(), addRule({ rule: { comment: 'new' }, at: 1 })))).toEqual(['a', 'new', 'b', 'c', 'd']);
    expect(comments(reducer(openState(), addRule({ rule: { comment: 'new' }, at: -5 })))).toEqual(['new', 'a', 'b', 'c', 'd']);
    expect(comments(reducer(openState(), addRule({ rule: { comment: 'new' }, at: 99 })))).toEqual(['a', 'b', 'c', 'd', 'new']);
  });

  it('updateRule replaces the whole rule; out of range is a no-op', () => {
    const state = reducer(openState(), updateRule({ index: 1, rule: { hide: true } }));
    expect(state.editor.filter?.rules[1]).toEqual({ hide: true });
    const before = openState();
    expect(reducer(before, updateRule({ index: 4, rule: {} }))).toBe(before);
  });

  it('patchRule merges keys and removes keys set to undefined', () => {
    const base = openState(filterWith({ rules: [{ itemCodes: ['r01'], hide: true, comment: 'x', passthrough: { hide: 'yes', odd: 1 } }] }));
    const state = reducer(base, patchRule({ index: 0, patch: { hide: undefined, notify: true, comment: undefined } }));
    expect(state.editor.filter?.rules[0]).toEqual({ itemCodes: ['r01'], notify: true, passthrough: { odd: 1 } });
    expect(state.editor.dirty).toBe(true);
    expect(reducer(base, patchRule({ index: 3, patch: { notify: true } }))).toBe(base);
  });

  it('removeRule removes and keeps the selection on the same rule', () => {
    const selected = reducer(openState(), selectRule(2));
    const state = reducer(selected, removeRule(0));
    expect(comments(state)).toEqual(['b', 'c', 'd']);
    expect(state.editor.selectedRule).toBe(1);
    expect(reducer(selected, removeRule(2)).editor.selectedRule).toBeNull();
    expect(reducer(selected, removeRule(3)).editor.selectedRule).toBe(2);
    expect(reducer(selected, removeRule(4))).toBe(selected);
  });

  it('moveRule moves down and up, and the selection follows', () => {
    const selected = reducer(openState(), selectRule(0));
    const down = reducer(selected, moveRule({ from: 0, to: 2 }));
    expect(comments(down)).toEqual(['b', 'c', 'a', 'd']);
    expect(down.editor.selectedRule).toBe(2);

    const up = reducer(reducer(openState(), selectRule(1)), moveRule({ from: 3, to: 0 }));
    expect(comments(up)).toEqual(['d', 'a', 'b', 'c']);
    expect(up.editor.selectedRule).toBe(2);

    const past = reducer(reducer(openState(), selectRule(2)), moveRule({ from: 0, to: 3 }));
    expect(past.editor.selectedRule).toBe(1);
  });

  it('moveRule out of bounds or onto itself is a no-op', () => {
    const before = openState();
    expect(reducer(before, moveRule({ from: 0, to: 4 }))).toBe(before);
    expect(reducer(before, moveRule({ from: -1, to: 0 }))).toBe(before);
    expect(reducer(before, moveRule({ from: 2, to: 2 }))).toBe(before);
    expect(reducer(before, moveRule({ from: 0.5, to: 1 }))).toBe(before);
  });

  it('duplicateRule inserts a copy after the rule and selects it; out of range is a no-op', () => {
    const state = reducer(openState(), duplicateRule(3));
    expect(comments(state)).toEqual(['a', 'b', 'c', 'd', 'd']);
    expect(state.editor.selectedRule).toBe(4);
    const before = openState();
    expect(reducer(before, duplicateRule(4))).toBe(before);
  });

  it('setRuleDisabled flags a rule in place; duplicate and move keep the flag', () => {
    const selected = reducer(openState(), selectRule(1));
    const off = reducer(selected, setRuleDisabled({ index: 1, disabled: true }));
    expect(off.editor.filter?.rules[1]).toEqual({ comment: 'b', disabled: true });
    expect(off.editor).toMatchObject({ selectedRule: 1, dirty: true });
    expect(comments(off)).toEqual(['a', 'b', 'c', 'd']);
    expect(reducer(off, setRuleDisabled({ index: 1, disabled: true }))).toBe(off);
    expect(reducer(off, setRuleDisabled({ index: 9, disabled: true }))).toBe(off);

    const copied = reducer(off, duplicateRule(1));
    expect(copied.editor.filter?.rules.map((rule) => rule.disabled)).toEqual([undefined, true, true, undefined, undefined]);
    const moved = reducer(off, moveRule({ from: 1, to: 3 }));
    expect(moved.editor.filter?.rules.map((rule) => rule.disabled)).toEqual([undefined, undefined, undefined, true]);

    const on = reducer(off, setRuleDisabled({ index: 1, disabled: false }));
    expect(on.editor.filter?.rules[1]).toEqual({ comment: 'b' });
  });

  it('setRuleDisabled leaves a passthrough key named "disabled" alone', () => {
    const state = openState(filterWith({ rules: [{ comment: 'a', passthrough: { disabled: 1 } }] }));
    const off = reducer(state, setRuleDisabled({ index: 0, disabled: true }));
    expect(off.editor.filter?.rules[0]).toEqual({ comment: 'a', passthrough: { disabled: 1 }, disabled: true });
  });

  it('selectRule selects valid indices only and does not set dirty', () => {
    const state = reducer(openState(), selectRule(3));
    expect(state.editor).toMatchObject({ selectedRule: 3, dirty: false });
    expect(reducer(state, selectRule(10)).editor.selectedRule).toBeNull();
    expect(reducer(state, selectRule(null)).editor.selectedRule).toBeNull();
  });
});

describe('style reducers', () => {
  const styled = () =>
    openState(
      filterWith({
        styles: { Gold: { notify: true }, Red: { hide: true } },
        rules: [{ useStyle: 'Gold' }, { useStyle: 'Red' }],
      })
    );

  it('setStyle adds at the end and replaces in place', () => {
    const added = reducer(styled(), setStyle({ name: 'Blue', style: { notify: false } }));
    expect(Object.keys(added.editor.filter?.styles ?? {})).toEqual(['Gold', 'Red', 'Blue']);
    const replaced = reducer(added, setStyle({ name: 'Gold', style: { sound: 'tink.mp3' } }));
    expect(Object.keys(replaced.editor.filter?.styles ?? {})).toEqual(['Gold', 'Red', 'Blue']);
    expect(replaced.editor.filter?.styles?.Gold).toEqual({ sound: 'tink.mp3' });
    const before = styled();
    expect(reducer(before, setStyle({ name: '', style: {} }))).toBe(before);
  });

  it('renameStyle keeps the order and updates rules that use it', () => {
    const state = reducer(styled(), renameStyle({ from: 'Gold', to: 'Shiny' }));
    expect(Object.keys(state.editor.filter?.styles ?? {})).toEqual(['Shiny', 'Red']);
    expect(state.editor.filter?.rules.map((rule) => rule.useStyle)).toEqual(['Shiny', 'Red']);
  });

  it('renameStyle onto a taken, empty or missing name is a no-op', () => {
    const before = styled();
    expect(reducer(before, renameStyle({ from: 'Gold', to: 'Red' }))).toBe(before);
    expect(reducer(before, renameStyle({ from: 'Gold', to: '' }))).toBe(before);
    expect(reducer(before, renameStyle({ from: 'Nope', to: 'X' }))).toBe(before);
  });

  it('removeStyle removes it, keeps rule references and drops an empty styles object', () => {
    const state = reducer(styled(), removeStyle('Gold'));
    expect(Object.keys(state.editor.filter?.styles ?? {})).toEqual(['Red']);
    expect(state.editor.filter?.rules[0].useStyle).toBe('Gold');
    const empty = reducer(state, removeStyle('Red'));
    expect(empty.editor.filter && 'styles' in empty.editor.filter).toBe(false);
    expect(reducer(empty, removeStyle('Red'))).toBe(empty);
  });
});

describe('selectDiagnostics', () => {
  // The first two rules name an item: a hide rule without conditions gets its own "hides every ground item" warning.
  const text =
    '{"formatVersion": 1, "rules": [{"itemCodes": ["r01"], "hide": true}, {"itemCodes": ["r02"], "hide": true}, {"quality": "legendary", "hide": true}]}';

  it('follows the rules: shape diagnostics move with their rule and go when the key is fixed', () => {
    const opened = run(initialState, hydrate([{ ...entry('x'), text }]), { type: open.type, payload: { id: 'x', now: NOW } });
    expect(selectDiagnostics({ lootFilter: opened })).toEqual([
      expect.objectContaining({ severity: 'error', rule: 2, path: 'rules/2/quality' }),
    ]);

    const moved = reducer(opened, moveRule({ from: 2, to: 0 }));
    expect(selectDiagnostics({ lootFilter: moved })).toEqual([
      expect.objectContaining({ severity: 'error', rule: 0, path: 'rules/0/quality' }),
    ]);

    const fixed = reducer(moved, patchRule({ index: 0, patch: { quality: 'unique' } }));
    expect(selectDiagnostics({ lootFilter: fixed })).toEqual([]);
  });

  it('gives a disabled rule its disabledRules path and keeps its index', () => {
    const opened = run(initialState, hydrate([{ ...entry('x'), text }]), { type: open.type, payload: { id: 'x', now: NOW } });
    const off = reducer(opened, setRuleDisabled({ index: 0, disabled: true }));
    expect(selectDiagnostics({ lootFilter: off })).toEqual([
      expect.objectContaining({ severity: 'error', rule: 2, path: 'rules/1/quality' }),
    ]);
    const both = reducer(off, setRuleDisabled({ index: 2, disabled: true }));
    expect(selectDiagnostics({ lootFilter: both })).toEqual([
      expect.objectContaining({ severity: 'error', rule: 2, path: 'disabledRules/1/rule/quality' }),
    ]);
  });

  it('keeps the syntax error when there is no model', () => {
    const broken = run(initialState, hydrate([{ ...entry('bad'), text: '{' }]), { type: open.type, payload: { id: 'bad', now: NOW } });
    expect(selectDiagnostics({ lootFilter: broken })).toBe(broken.editor.parseDiagnostics);
  });
});

describe('replaceFilter', () => {
  it('replaces the model and parse diagnostics, sets dirty and clamps the selection', () => {
    const selected = reducer(openState(), selectRule(3));
    const { filter, diagnostics } = parseLootFilter('{"formatVersion": 1, "rules": [{"hide": true}], "odd": 1}');
    const state = reducer(selected, replaceFilter({ filter, diagnostics }));
    expect(state.editor.filter).toBe(filter);
    expect(state.editor.parseDiagnostics).toEqual(diagnostics);
    expect(state.editor).toMatchObject({ dirty: true, selectedRule: null });
  });

  it('also recovers an entry whose text was unreadable', () => {
    const broken = run(initialState, hydrate([{ ...entry('bad'), text: '{' }]), { type: open.type, payload: { id: 'bad', now: NOW } });
    const { filter, diagnostics } = parseLootFilter('{"formatVersion": 1, "rules": []}');
    const state = run(broken, replaceFilter({ filter, diagnostics }), { type: editorFlushed.type, payload: { now: LATER } });
    expect(state.editor.filter).not.toBeNull();
    expect(state.library.entries[0].text).toBe(serializeLootFilter(filter));
  });

  it('is ignored when no entry is open', () => {
    const { filter, diagnostics } = parseLootFilter('{"formatVersion": 1, "rules": []}');
    expect(reducer(initialState, replaceFilter({ filter, diagnostics }))).toBe(initialState);
  });
});

describe('text notes', () => {
  const text = '// top\n{\n  "formatVersion": 1,\n  "rules": [\n    // section\n    {"hide": true, "itemCodes": ["r01"]},\n  ]\n}';
  const openWith = (source: LootFilterEntry['source']) =>
    run(initialState, hydrate([{ ...entry('x'), source, text }]), { type: open.type, payload: { id: 'x', now: NOW } });

  it('open keeps the notes and the selector lists them first', () => {
    const state = openWith('upload');
    expect(state.editor.textNotes.map((note) => note.message)).toEqual([
      expect.stringMatching(/^Trailing commas were accepted \(first at line 6\)/),
      expect.stringMatching(/^1 comment inside the file/),
    ]);
    expect(state.editor.parseDiagnostics).toEqual([]);
    expect(selectDiagnostics({ lootFilter: state })).toEqual(state.editor.textNotes);
  });

  it('the notes stay through edits and go once the model is written back', () => {
    const edited = reducer(openWith('upload'), setHeader({ author: 'Me' }));
    expect(edited.editor.textNotes).toHaveLength(2);
    const flushed = reducer(edited, { type: editorFlushed.type, payload: { now: LATER } });
    expect(flushed.editor.textNotes).toEqual([]);
    expect(flushed.library.entries[0].text).not.toMatch(/section|,\s*\]/);
  });

  it('template entries get no notes', () => {
    expect(openWith('template').editor.textNotes).toEqual([]);
  });

  it('replaceFilter stores the applied text notes (none when not given)', () => {
    const { filter, diagnostics, notes } = parseLootFilter(text);
    const applied = reducer(openState(), replaceFilter({ filter, diagnostics, notes }));
    expect(applied.editor.textNotes).toBe(notes);
    expect(reducer(applied, replaceFilter({ filter, diagnostics })).editor.textNotes).toEqual([]);
  });
});
