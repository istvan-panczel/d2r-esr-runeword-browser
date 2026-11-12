import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FoldSection } from './FoldSection';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

function Fold() {
  const [open, setOpen] = useState(false);
  return (
    <FoldSection id="fold" title="Sound" summary="tink.mp3" open={open} onOpenChange={setOpen} variant="action">
      <input aria-label="Sound file" />
    </FoldSection>
  );
}

describe('FoldSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root.render(<Fold />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('is a heading holding a disclosure button that controls the panel', () => {
    const button = container.querySelector<HTMLButtonElement>('#fold > h3 > button[type="button"]');
    if (button === null) throw new Error('no header button');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel?.contains(container.querySelector('input'))).toBe(true);

    // Folded: the summary is read with the button's name, the panel is hidden.
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toBe('Sound: tink.mp3');
    expect(panel?.hidden).toBe(true);

    act(() => {
      button.click();
    });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toBe('Sound');
    expect(panel?.hidden).toBe(false);

    act(() => {
      button.click();
    });
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
