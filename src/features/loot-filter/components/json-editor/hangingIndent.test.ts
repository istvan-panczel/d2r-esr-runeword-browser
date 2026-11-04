import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { hangingIndent, hangingIndentStyle } from './hangingIndent';

describe('hanging indent', () => {
  it('indents the continuation by the leading whitespace plus two columns', () => {
    expect(hangingIndentStyle('"a": 1', 4)).toBe('padding-left: calc(2ch + 6px); text-indent: -2ch');
    expect(hangingIndentStyle('    "text": "long"', 4)).toBe('padding-left: calc(6ch + 6px); text-indent: -6ch');
    expect(hangingIndentStyle('\t  x', 4)).toBe('padding-left: calc(8ch + 6px); text-indent: -8ch');
  });

  it('styles the rendered lines', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: '{\n  "a": 1\n}', extensions: [hangingIndent()] }) });
    const styles = [...view.contentDOM.querySelectorAll<HTMLElement>('.cm-line')].map((line) => line.style.textIndent);
    expect(styles).toEqual(['-2ch', '-4ch', '-2ch']);
    view.destroy();
    parent.remove();
  });
});
