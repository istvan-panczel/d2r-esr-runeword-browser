import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PageShell } from '@/components/PageShell';
import { APP_FRAME_CLASS, pageShellWidthClass } from '@/components/pageWidthClasses';
import { PAGE_WIDTH_STORAGE_KEY, settingsReducer } from '@/features/settings';
import { PageWidthMenu } from './PageWidthMenu';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

describe('page width classes', () => {
  it('keeps the Standard frame and page as before and the narrow column in every mode', () => {
    expect(APP_FRAME_CLASS.standard).toBe('container mx-auto');
    expect(pageShellWidthClass('wide', 'standard')).toBe('max-w-7xl');
    expect(pageShellWidthClass('wide', 'wide')).toBe('max-w-9xl');
    expect(pageShellWidthClass('wide', 'full')).toBe('max-w-none');
    for (const mode of ['standard', 'wide', 'full'] as const) {
      expect(pageShellWidthClass('narrow', mode)).toBe('max-w-2xl');
    }
  });
});

describe('PageWidthMenu + PageShell', () => {
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
    localStorage.clear();
  });

  it('switches the page width from the header menu', () => {
    const store = configureStore({ reducer: { settings: settingsReducer } });
    act(() => {
      root.render(
        <Provider store={store}>
          <PageWidthMenu />
          <PageShell>
            <p>content</p>
          </PageShell>
          <PageShell width="narrow">
            <p>reading column</p>
          </PageShell>
        </Provider>
      );
    });
    const [wideShell, narrowShell] = container.querySelectorAll<HTMLElement>('.\\@container\\/page');
    expect(wideShell.className).toContain('max-w-7xl');
    expect(narrowShell.className).toContain('max-w-2xl');

    const trigger = container.querySelector<HTMLButtonElement>('button[title="Page width"]');
    if (trigger === null) throw new Error('no trigger');
    expect(trigger.getAttribute('aria-label')).toBe('Page width: Standard');

    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(items.map((item) => item.textContent)).toEqual(['Standard1280 px', 'Wide1920 px', 'FullFull screen']);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);

    act(() => {
      items[1].click();
    });
    expect(store.getState().settings.pageWidth).toBe('wide');
    expect(localStorage.getItem(PAGE_WIDTH_STORAGE_KEY)).toBe('wide');
    expect(wideShell.className).toContain('max-w-9xl');
    expect(narrowShell.className).toContain('max-w-2xl');
    expect(trigger.getAttribute('aria-label')).toBe('Page width: Wide');
  });
});
