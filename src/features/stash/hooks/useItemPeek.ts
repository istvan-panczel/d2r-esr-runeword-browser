import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { useHoverPopover } from '@/components/useHoverPopover';

/**
 * How long the pointer rests on another row before an open peek moves to it: the peek sits right above (or below) its
 * row, so the way into it crosses the next row, and that must not swap the peek away.
 */
const SWITCH_DELAY = 100;

interface PeekRow {
  readonly element: HTMLElement;
  readonly key: string;
}

/** The item row under an event target: the element carrying `data-item-row` (its row key) around it */
function rowOf(target: EventTarget | null): PeekRow | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest('[data-item-row]');
  if (!(element instanceof HTMLElement)) return null;
  const key = element.dataset.itemRow;
  return key === undefined ? null : { element, key };
}

/**
 * One hover / focus peek for every row of the item table, by event delegation on a wrapper (like the campaign map's
 * useAreaPeek): rows carry `data-item-row` (the row key) and the element a tap opens the peek on (the item name)
 * `data-item-peek`. Spread `wrapperProps` on the wrapper and render one `PeekPopover` with `peek` and `peek.anchorRef`
 * outside it, showing the row `peekKey`.
 *
 * Mouse: hovering a row opens its peek (useHoverPopover's delays); while one is open, another row takes over only
 * after the pointer rests on it a moment, so the pointer can cross a row on its way into the peek. Keyboard: focusing
 * a row's link or button (:focus-visible) opens it at once. Touch: tapping the name opens it, and a second tap on the
 * name of the open row follows the link (the peek's own name link works too); tapping elsewhere closes it.
 */
export function useItemPeek() {
  const peek = useHoverPopover();
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const switchTimer = useRef<number | undefined>(undefined);
  const tapTimer = useRef<number | undefined>(undefined);
  const pointerType = useRef('mouse');
  /** The row whose peek was open when the current tap began */
  const openOnTap = useRef<string | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(switchTimer.current);
      window.clearTimeout(tapTimer.current);
    },
    []
  );

  const show = (row: PeekRow, event: PointerEvent) => {
    setPeekKey(row.key);
    peek.delegate.pointerEnter(row.element, event);
  };

  const wrapperProps = {
    onPointerOver: (event: PointerEvent<HTMLElement>) => {
      const row = rowOf(event.target);
      if (row === null || row.element === hovered.current) return;
      hovered.current = row.element;
      window.clearTimeout(switchTimer.current);
      if (event.pointerType !== 'mouse') return;
      if (!peek.open) {
        show(row, event);
        return;
      }
      switchTimer.current = window.setTimeout(() => {
        show(row, event);
      }, SWITCH_DELAY);
    },
    onPointerOut: (event: PointerEvent<HTMLElement>) => {
      const current = hovered.current;
      if (current === null) return;
      if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      // Moving onto a child of the same row is not a leave; onto another row, pointerover takes over.
      hovered.current = null;
      window.clearTimeout(switchTimer.current);
      peek.delegate.pointerLeave(event);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      const row = rowOf(event.target);
      if (row === null) return;
      setPeekKey(row.key);
      peek.delegate.focus(row.element, event.target);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      peek.delegate.blur(event);
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pointerType.current = event.pointerType;
      openOnTap.current = peek.open ? peekKey : null;
    },
    // Capture phase: before the name link's own click handler (React Router's Link navigates unless prevented)
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      // Mouse clicks and keyboard activation (detail 0) keep their own meaning
      if (pointerType.current === 'mouse' || event.detail === 0 || !(event.target instanceof Element)) return;
      const name = event.target.closest('[data-item-peek]');
      if (name === null || event.target.closest('button') !== null) return;
      const row = rowOf(name);
      if (row === null || openOnTap.current === row.key) return;
      event.preventDefault();
      setPeekKey(row.key);
      // Places the peek against the row (a row is never :focus-visible, so this does not open it)
      peek.delegate.focus(row.element);
      // After the tap has closed a peek open on another row (Radix dismisses a touch outside on click)
      window.clearTimeout(tapTimer.current);
      tapTimer.current = window.setTimeout(() => {
        peek.setOpen(true);
      }, 0);
    },
  };

  return { peek, peekKey, wrapperProps };
}
