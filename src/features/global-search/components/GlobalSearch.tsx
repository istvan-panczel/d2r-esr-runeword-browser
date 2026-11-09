import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isMacUserAgent, isSearchShortcut, searchShortcutLabel } from '../utils/searchShortcut';

// cmdk and the search code stay out of the entry bundle: the chunk loads on the first open
const GlobalSearchDialog = lazy(async () => {
  const module = await import('./GlobalSearchDialog');
  return { default: module.GlobalSearchDialog };
});

const IS_MAC = isMacUserAgent(navigator.userAgent);
const SHORTCUT_LABEL = searchShortcutLabel(IS_MAC);

/** Another modal already holds the page (its backdrop blocks the button too); popovers do not count. */
const OPEN_MODAL_SELECTOR = '[data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]';

/** The header's search button and the global Ctrl+K / Cmd+K shortcut. The dialog mounts on the first open and stays mounted. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  // Radix returns focus only to a DialogTrigger, which this dialog does not have (the shortcut opens it too)
  const returnFocusTo = useRef<Element | null>(null);

  const openFrom = (origin: Element | null) => {
    returnFocusTo.current = origin;
    setRequested(true);
    setOpen(true);
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isSearchShortcut(event, IS_MAC)) return;
    // Also while ignored, so the browser's own Ctrl+K never fires
    event.preventDefault();
    if (event.repeat) return;
    if (open) setOpen(false);
    else if (document.querySelector(OPEN_MODAL_SELECTOR) === null) openFrom(document.activeElement);
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus({ preventScroll: true });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => {
          openFrom(event.currentTarget);
        }}
        aria-label="Search"
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        title={`Search (${SHORTCUT_LABEL})`}
      >
        <Search className="size-5" />
      </Button>
      {requested && (
        <Suspense fallback={null}>
          <GlobalSearchDialog open={open} onOpenChange={setOpen} onCloseAutoFocus={restoreFocus} />
        </Suspense>
      )}
    </>
  );
}
