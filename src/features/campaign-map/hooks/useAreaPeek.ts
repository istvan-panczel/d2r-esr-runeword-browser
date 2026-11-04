import { useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { useHoverPopover } from '@/components/useHoverPopover';

type Station = HTMLElement | SVGElement;

/** The station element under an event target: the element carrying `data-area-id` around it (none on empty canvas) */
function stationOf(target: EventTarget | null): { element: Station; id: number } | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest('[data-area-id]');
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return null;
  const id = Number(element.dataset.areaId);
  return Number.isInteger(id) ? { element, id } : null;
}

/**
 * One hover / focus peek for every station of the map, by event delegation on a wrapper (the canvas only marks its
 * stations with `data-area-id`). Spread `wrapperProps` on the wrapper; render one `PeekPopover` with `peek` and
 * `peek.anchorRef`, showing the area `peekId`; `close` hides it.
 */
export function useAreaPeek() {
  const peek = useHoverPopover();
  const [peekId, setPeekId] = useState<number | null>(null);
  const hovered = useRef<Station | null>(null);

  const wrapperProps = {
    onPointerOver: (event: PointerEvent<HTMLElement>) => {
      const station = stationOf(event.target);
      if (station === null || station.element === hovered.current) return;
      hovered.current = station.element;
      setPeekId(station.id);
      peek.delegate.pointerEnter(station.element, event);
    },
    onPointerOut: (event: PointerEvent<HTMLElement>) => {
      const current = hovered.current;
      if (current === null) return;
      if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      // Moving onto a child of the same station is not a leave; onto another station, pointerover takes over.
      hovered.current = null;
      peek.delegate.pointerLeave(event);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      const station = stationOf(event.target);
      if (station === null) return;
      setPeekId(station.id);
      if (event.target instanceof Element) peek.delegate.focus(station.element, event.target);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      peek.delegate.blur(event);
    },
  };

  /** Closes the peek now (a selection, a jump or a tab switch can leave its anchor detached) */
  const close = () => {
    hovered.current = null;
    peek.setOpen(false);
  };

  return { peek, peekId, wrapperProps, close };
}
