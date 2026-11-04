import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { LabelChip } from '../../utils/labelChips';
import {
  chipFallbackText,
  externalChange,
  labelChipGutter,
  labelChipPositions,
  labelChipsField,
  parseCssRgba,
  setLabelChips,
  type ComputeLabelChips,
} from './labelChipGutter';

const chip = (offset: number, title = `chip ${String(offset)}`): LabelChip => ({
  offset,
  textColor: 'rgba(255, 77, 77, 1)',
  background: null,
  border: { color: 'rgba(240, 0, 0, 1)', width: 3 },
  title,
});

const DOC = '{\n  "rules": [\n    { "a": 1 },\n    { "b": 2 }\n  ]\n}';
const FIRST = DOC.indexOf('{ "a"');
const SECOND = DOC.indexOf('{ "b"');

describe('label chip field', () => {
  it('maps chip offsets through edits and keeps one marker per line', () => {
    let state = EditorState.create({ doc: DOC, extensions: [labelChipsField] });
    state = state.update({ effects: setLabelChips.of([chip(FIRST), chip(FIRST + 2, 'same line'), chip(SECOND)]) }).state;
    expect(state.field(labelChipsField).markers.size).toBe(2);

    state = state.update({ changes: { from: 0, insert: '// top\n' } }).state;
    expect(labelChipPositions(state).map(({ pos }) => state.sliceDoc(pos, pos + 5))).toEqual(['{ "a"', '"a": ', '{ "b"']);
    const lines: number[] = [];
    state.field(labelChipsField).markers.between(0, state.doc.length, (from) => {
      lines.push(state.doc.lineAt(from).number);
    });
    expect(lines).toEqual([4, 5]);
  });
});

describe('label chip gutter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function mount(compute: ComputeLabelChips) {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: DOC, extensions: [labelChipGutter({ compute, delay: 500 })] }),
    });
    return {
      view,
      cleanup: () => {
        view.destroy();
        parent.remove();
      },
    };
  }

  it('computes on mount, debounces edits and keeps the chips while the text does not parse', () => {
    const compute = vi.fn<ComputeLabelChips>((text) => (text.includes('BROKEN') ? undefined : [chip(text.indexOf('{ "b"'))]));
    const { view, cleanup } = mount(compute);
    vi.advanceTimersByTime(0);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(labelChipPositions(view.state).map(({ pos }) => pos)).toEqual([SECOND]);
    expect(view.dom.querySelector('.cm-label-chip')?.getAttribute('title')).toBe(`chip ${String(SECOND)}`);

    view.dispatch({ changes: { from: 0, insert: 'BROKEN' } });
    vi.advanceTimersByTime(499);
    expect(compute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(compute).toHaveBeenCalledTimes(2);
    // Kept, mapped past the insertion.
    expect(labelChipPositions(view.state).map(({ pos }) => pos)).toEqual([SECOND + 'BROKEN'.length]);

    view.dispatch({ changes: { from: 0, to: 'BROKEN'.length }, annotations: externalChange.of(true) });
    vi.advanceTimersByTime(0);
    expect(compute).toHaveBeenCalledTimes(3);
    expect(labelChipPositions(view.state).map(({ pos }) => pos)).toEqual([SECOND]);
    cleanup();
  });

  it('draws the chip with fallbacks and a capped border', () => {
    const { view, cleanup } = mount(() => [chip(FIRST)]);
    vi.advanceTimersByTime(0);
    const element = view.dom.querySelector<HTMLElement>('.cm-label-chip');
    expect(element?.textContent).toBe('Aa');
    expect(element?.getAttribute('aria-hidden')).toBe('true');
    expect(element?.style.backgroundColor).toBe('rgb(38, 38, 38)');
    expect(element?.style.backgroundImage).toBe('');
    expect(element?.style.color).toBe('rgb(255, 77, 77)');
    expect(element?.style.borderWidth).toBe('2px');
    cleanup();
  });
});

describe('chip text fallback', () => {
  it('parses the rgba() and rgb() forms', () => {
    expect(parseCssRgba('rgba(255, 255, 255, 0.8)')).toEqual([255, 255, 255, 0.8]);
    expect(parseCssRgba('rgb(1,2,3)')).toEqual([1, 2, 3, 1]);
    expect(parseCssRgba('#fff')).toBeUndefined();
  });

  it('uses near-black on light backgrounds and the label white otherwise', () => {
    expect(chipFallbackText(null)).toBe('rgb(240, 240, 240)');
    expect(chipFallbackText('rgba(255, 255, 255, 0.8)')).toBe('rgb(20, 20, 20)');
    expect(chipFallbackText('rgba(255, 215, 0, 1)')).toBe('rgb(20, 20, 20)');
    expect(chipFallbackText('rgba(128, 0, 128, 0.8)')).toBe('rgb(240, 240, 240)');
    // Faint white over the dark chip base stays dark.
    expect(chipFallbackText('rgba(255, 255, 255, 0.1)')).toBe('rgb(240, 240, 240)');
    expect(chipFallbackText('transparent')).toBe('rgb(240, 240, 240)');
  });
});
