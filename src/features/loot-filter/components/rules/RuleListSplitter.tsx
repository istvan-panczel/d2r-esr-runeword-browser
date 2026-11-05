import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { clampRuleListWidth, ruleListBounds, ruleListValueText, ruleListWidthForKey } from '../../utils/ruleListWidth';

interface RuleListSplitterProps {
  /** The two-pane grid (list, gap, editor): the 60% maximum is of its width. */
  readonly rowRef: React.RefObject<HTMLElement | null>;
  /** The list pane, whose rendered width is the splitter's value. */
  readonly listRef: React.RefObject<HTMLElement | null>;
  /** The id of the list pane (`aria-controls`). */
  readonly listId: string;
  /** A new width in rem, or null for the default: once a drag ends, on a key press and on reset. */
  readonly onResize: (rem: number | null) => void;
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startPx: number;
  /** The row and root font size at the press (neither changes while dragging). */
  readonly rowPx: number;
  readonly remPx: number;
  /** The latest pointer x, applied on the next animation frame. */
  clientX: number;
  frame: number | null;
  rem: number | null;
}

function rootFontPx(): number {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

const width = (ref: React.RefObject<HTMLElement | null>) => ref.current?.getBoundingClientRect().width ?? 0;

/** Text selection and the cursor while a drag is on (the pointer leaves the thin handle). */
function setDragStyles(on: boolean) {
  document.body.style.userSelect = on ? 'none' : '';
  document.body.style.cursor = on ? 'col-resize' : '';
}

/**
 * The vertical splitter between the rule list and the editor (two-pane layouts only; hidden when stacked). Drag it
 * (pointer capture), use ArrowLeft / ArrowRight (Shift: bigger steps), Home / End, or double-click to reset.
 */
export function RuleListSplitter({ rowRef, listRef, listId, onResize }: RuleListSplitterProps) {
  const [size, setSize] = useState({ row: 0, list: 0, rem: 16 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // The value and the bounds for assistive tech follow the rendered widths (window resizes, page width, text size).
  // Not while dragging: the drag writes the width and the value straight to the DOM, and the state catches up once.
  useEffect(() => {
    const row = rowRef.current;
    const list = listRef.current;
    if (!row || !list) return;
    const observer = new ResizeObserver(() => {
      if (drag.current) return;
      setSize({ row: width(rowRef), list: width(listRef), rem: rootFontPx() });
    });
    observer.observe(row);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [rowRef, listRef]);

  // A drag cut short by unmounting (the tab switches) must not leave the page unselectable.
  useEffect(
    () => () => {
      const active = drag.current;
      if (!active) return;
      if (active.frame !== null) cancelAnimationFrame(active.frame);
      setDragStyles(false);
    },
    []
  );

  const bounds = ruleListBounds(size.row, size.rem);
  const current = () => {
    const rem = rootFontPx();
    return { rem, px: width(listRef), bounds: ruleListBounds(width(rowRef), rem) };
  };

  // A drag moves the list by writing `--rule-list-width` on the row (no React render per pointer move, which would
  // re-render the whole Rules tab), at most once per animation frame; the width is committed on release.
  const applyDrag = () => {
    const active = drag.current;
    if (!active) return;
    active.frame = null;
    const px = clampRuleListWidth(active.startPx + active.clientX - active.startX, ruleListBounds(active.rowPx, active.remPx));
    active.rem = px / active.remPx;
    rowRef.current?.style.setProperty('--rule-list-width', `${String(active.rem)}rem`);
    handleRef.current?.setAttribute('aria-valuenow', String(Math.round(px)));
    handleRef.current?.setAttribute('aria-valuetext', ruleListValueText(px, active.rowPx, active.remPx));
  };

  const endDrag = () => {
    const ended = drag.current;
    if (!ended) return;
    if (ended.frame !== null) {
      cancelAnimationFrame(ended.frame);
      applyDrag();
    }
    drag.current = null;
    setDragging(false);
    setDragStyles(false);
    setSize({ row: width(rowRef), list: width(listRef), rem: rootFontPx() });
    if (ended.rem !== null) onResize(ended.rem);
  };

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the rule list"
      aria-controls={listId}
      aria-valuenow={Math.round(size.list)}
      aria-valuetext={ruleListValueText(size.list, size.row, size.rem)}
      aria-valuemin={Math.round(bounds.min)}
      aria-valuemax={Math.round(bounds.max)}
      title="Drag to resize the rule list; double-click to reset"
      tabIndex={0}
      // Centred in the 1rem grid gap, along the (sticky) list's height.
      className="group/splitter absolute top-0 -right-4 bottom-0 z-10 hidden w-4 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none lg:flex"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // No text selection or native drag from the press.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startPx: width(listRef),
          rowPx: width(rowRef),
          remPx: rootFontPx(),
          clientX: event.clientX,
          frame: null,
          rem: null,
        };
        setDragging(true);
        setDragStyles(true);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (active?.pointerId !== event.pointerId) return;
        active.clientX = event.clientX;
        active.frame ??= requestAnimationFrame(applyDrag);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => {
        onResize(null);
      }}
      onKeyDown={(event) => {
        const { rem, px, bounds: now } = current();
        const next = ruleListWidthForKey(event.key, event.shiftKey, px, now, rem);
        if (next === null) return;
        event.preventDefault();
        onResize(next / rem);
      }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/splitter:bg-border',
          dragging && 'bg-border'
        )}
      />
      <span
        aria-hidden
        className={cn(
          'relative',
          'h-12 w-1 rounded-full bg-border transition-colors group-hover/splitter:bg-primary/60 group-focus-visible/splitter:bg-primary group-focus-visible/splitter:ring-2 group-focus-visible/splitter:ring-ring',
          dragging && 'bg-primary'
        )}
      />
    </div>
  );
}
