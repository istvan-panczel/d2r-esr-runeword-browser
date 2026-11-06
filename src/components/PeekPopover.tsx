import type { ReactNode, RefObject } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { HoverPopover } from './useHoverPopover';

type PeekPopoverProps = {
  /** State from useHoverPopover; a `trigger` spreads `peek.triggerProps` itself */
  readonly peek: HoverPopover;
  /** False when there is nothing to show: the popover then never opens */
  readonly enabled?: boolean;
  /** Extra classes of the content (the guide passes its prose font) */
  readonly className?: string;
  /** Accessible name of the content (a dialog for assistive technology) */
  readonly label?: string;
  /** Hide the content while its anchor is out of view or no longer in the page (a shared, delegated peek) */
  readonly hideWhenDetached?: boolean;
  readonly children: ReactNode;
} & (
  | {
      /** The anchor element (rendered with asChild) */
      readonly trigger: ReactNode;
      readonly anchorRef?: never;
    }
  | {
      readonly trigger?: never;
      /**
       * One popover shared by many triggers (event delegation, see `useHoverPopover().delegate`): the element the
       * popover is placed against, usually `peek.anchorRef`
       */
      readonly anchorRef: RefObject<HTMLElement | SVGElement | null>;
    }
);

/** The hover/focus "peek" above a note link, glossary term, graph node or campaign map area. */
export function PeekPopover({ peek, trigger, anchorRef, enabled = true, className, label, hideWhenDetached, children }: PeekPopoverProps) {
  return (
    <Popover open={peek.open && enabled} onOpenChange={peek.setOpen}>
      {anchorRef === undefined ? <PopoverAnchor asChild>{trigger}</PopoverAnchor> : <PopoverAnchor virtualRef={anchorRef} />}
      {enabled && (
        <PopoverContent
          side="top"
          className={cn('w-72 p-3 text-sm', className)}
          aria-label={label}
          hideWhenDetached={hideWhenDetached}
          {...peek.contentProps}
        >
          {children}
        </PopoverContent>
      )}
    </Popover>
  );
}

interface PeekTextProps {
  readonly title: string;
  readonly text: string;
}

/** Title and muted text of a peek (a note's title + summary, a term + definition). */
export function PeekText({ title, text }: PeekTextProps) {
  return (
    <>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </>
  );
}
