import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { useHoverPopover } from '@/components/useHoverPopover';
import { decodeSkillRef, SKILL_REF_SELECTOR, type SkillRef } from '../utils/skillRefData';

/** Another popover's content (the stash table's item peek): skill names in there keep only their link */
const POPPER_CONTENT = '[data-radix-popper-content-wrapper]';

/** The skill name anchor under an event target, outside other popovers */
function anchorOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest(SKILL_REF_SELECTOR);
  if (!(anchor instanceof HTMLElement) || anchor.closest(POPPER_CONTENT) !== null) return null;
  return anchor;
}

/**
 * One hover / focus / tap peek for every skill name in item lines (`SkillRefText` anchors carry `data-skill-ref`), by
 * event delegation on a wrapper around the page (like the stash table's useItemPeek). Spread `wrapperProps` on the
 * wrapper and render one `PeekPopover` with `peek` and `peek.anchorRef`, showing `skillRef`.
 *
 * Mouse: hovering a name opens its peek (useHoverPopover's delays); a click follows the link. Keyboard: focusing the
 * link (:focus-visible) opens it; Enter follows it. Touch: the first tap on a name opens its peek instead of following
 * the link, a second tap on the same name follows it (as does the peek's own link); tapping elsewhere closes it.
 * Inside a form (the build editor) a click, tap or Enter only opens the peek: leaving the page would drop the edits.
 */
export function useSkillRefPeek() {
  const peek = useHoverPopover();
  const [skillRef, setSkillRef] = useState<SkillRef | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const pointerType = useRef('mouse');
  /** The anchor whose peek was open when the current tap began */
  const openOnTap = useRef<HTMLElement | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(tapTimer.current);
    },
    []
  );

  /** Shows the anchor's reference; false when its attribute does not decode */
  const select = (anchor: HTMLElement): boolean => {
    const ref = decodeSkillRef(anchor.dataset.skillRef);
    if (ref === null) return false;
    setSkillRef(ref);
    return true;
  };

  const wrapperProps = {
    onPointerOver: (event: PointerEvent<HTMLElement>) => {
      const anchor = anchorOf(event.target);
      if (anchor === null || anchor === hovered.current) return;
      hovered.current = anchor;
      if (event.pointerType !== 'mouse' || !select(anchor)) return;
      peek.delegate.pointerEnter(anchor, event);
    },
    onPointerOut: (event: PointerEvent<HTMLElement>) => {
      const current = hovered.current;
      if (current === null) return;
      if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      hovered.current = null;
      peek.delegate.pointerLeave(event);
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      const anchor = anchorOf(event.target);
      if (anchor === null || !select(anchor)) return;
      peek.delegate.focus(anchor, event.target);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (anchorOf(event.target) !== null) peek.delegate.blur(event);
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pointerType.current = event.pointerType;
      const anchor = peek.anchorRef.current;
      openOnTap.current = peek.open && anchor instanceof HTMLElement ? anchor : null;
    },
    // Capture phase: before the link's own click handler (React Router's Link navigates unless prevented)
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      const anchor = anchorOf(event.target);
      if (anchor === null) return;
      // Mouse clicks and keyboard activation (detail 0) follow the link, a tap on the name of the open peek too
      const tap = pointerType.current !== 'mouse' && event.detail !== 0 && openOnTap.current !== anchor;
      if ((!tap && anchor.closest('form') === null) || !select(anchor)) return;
      event.preventDefault();
      // Places the peek against the name (a tapped link is not :focus-visible, so this does not open it)
      peek.delegate.focus(anchor);
      // After the tap has closed a peek open on another name (Radix dismisses a touch outside on click)
      window.clearTimeout(tapTimer.current);
      tapTimer.current = window.setTimeout(() => {
        peek.setOpen(true);
      }, 0);
    },
  };

  return { peek, skillRef, wrapperProps };
}
