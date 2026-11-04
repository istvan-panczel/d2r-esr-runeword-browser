import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { undo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { JsonCodeEditor, type JsonCodeEditorHandle } from './JsonCodeEditor';
import { diffChange } from './editorSetup';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

describe('diffChange', () => {
  it('keeps the common prefix and suffix', () => {
    expect(diffChange('{"a": 1}', '{"a": 22}')).toEqual({ from: 6, to: 7, insert: '22' });
    expect(diffChange('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
    expect(diffChange('', 'x')).toEqual({ from: 0, to: 0, insert: 'x' });
  });
});

describe('JsonCodeEditor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function editorView(): EditorView {
    const element = container.querySelector<HTMLElement>('.cm-editor');
    const view = element && EditorView.findFromDOM(element);
    if (!view) throw new Error('no editor');
    return view;
  }

  it('reports user edits only, keeps external replaces out of the history and selects through the ref', () => {
    const onChange = vi.fn();
    const ref = createRef<JsonCodeEditorHandle>();
    const render = (value: string, invalid = false) => {
      act(() => {
        root.render(<JsonCodeEditor value={value} onChange={onChange} dark ariaLabel="Filter file" invalid={invalid} ref={ref} />);
      });
    };

    render('{\n  "a": 1\n}');
    const view = editorView();
    expect(view.state.doc.toString()).toBe('{\n  "a": 1\n}');
    expect(view.contentDOM.getAttribute('aria-label')).toBe('Filter file');
    expect(view.contentDOM.getAttribute('aria-invalid')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();

    // A user edit.
    act(() => {
      view.dispatch({ changes: { from: 0, insert: '// x\n' }, userEvent: 'input' });
    });
    expect(onChange).toHaveBeenLastCalledWith('// x\n{\n  "a": 1\n}');

    // An external change (as after an edit in another tab): applied without onChange.
    render('// x\n{\n  "a": 2\n}', true);
    expect(view.state.doc.toString()).toBe('// x\n{\n  "a": 2\n}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(view.contentDOM.getAttribute('aria-invalid')).toBe('true');

    // Undo takes back the user edit only.
    act(() => {
      undo(view);
    });
    expect(view.state.doc.toString()).toBe('{\n  "a": 2\n}');

    act(() => {
      ref.current?.select(4, 7);
    });
    expect(view.state.selection.main.from).toBe(4);
    expect(view.state.selection.main.to).toBe(7);
    act(() => {
      ref.current?.select(-5, 1000);
    });
    expect(view.state.selection.main.to).toBe(view.state.doc.length);
  });
});
