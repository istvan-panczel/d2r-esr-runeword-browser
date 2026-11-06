import { useEffect, useRef } from 'react';

/** Tailwind `lg`: the detail card sits next to the trees from here on */
const WIDE_QUERY = '(min-width: 1024px)';

/**
 * Below `lg` the skill detail card is under the trees: after a tap (`requestScroll`, then the selection changes) the
 * card (`ref`) is scrolled into view. Nothing happens on a wide screen or when the selection changes without a tap
 * (page load, a link).
 */
export function useDetailScroll(selected: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current || selected === null) return;
    pending.current = false;
    if (window.matchMedia(WIDE_QUERY).matches) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);
  const requestScroll = () => {
    pending.current = true;
  };
  return { ref, requestScroll };
}

/** The nearest ancestor that scrolls vertically (the sticky detail column from `lg`), or null for the page */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Brings an element's top into view (block start), also when it is taller than the viewport: below `lg` the page scrolls
 * (the element's `scroll-mt-*` keeps it clear of the sticky header); in the sticky detail column the column scrolls,
 * not the page.
 */
export function scrollToTop(element: HTMLElement) {
  const scroller = scrollParent(element);
  if (scroller === null) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
}
