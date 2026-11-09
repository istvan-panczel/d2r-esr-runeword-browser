import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FLOATING_BOTTOM_CLASS, FLOATING_GLASS_BUTTON_CLASS, floatingLift } from './floatingElements';

const SCROLL_THRESHOLD = 400;

function subscribeToScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => {
    window.removeEventListener('scroll', onChange);
  };
}

function isPastThreshold() {
  return window.scrollY > SCROLL_THRESHOLD;
}

/**
 * The floating scroll-to-top button, bottom-right on every page (mounted once by AppLayout). Reading the position as a
 * snapshot makes it right on mount (a restored scroll position fires no event for a late listener); after a route
 * change the `scroll` event is enough: a page that resets the position or is too short for it moves the window.
 */
export function ScrollToTopButton() {
  const { pathname } = useLocation();
  const visible = useSyncExternalStore(subscribeToScroll, isPastThreshold);

  if (!visible) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'fixed right-[max(1.5rem,env(safe-area-inset-right))] z-40',
        FLOATING_GLASS_BUTTON_CLASS,
        FLOATING_BOTTOM_CLASS[floatingLift(pathname)]
      )}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="Scroll to top"
    >
      <ChevronUp className="size-5" />
    </Button>
  );
}
