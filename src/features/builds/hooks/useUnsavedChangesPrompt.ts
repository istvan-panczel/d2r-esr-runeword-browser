import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

const MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Warns before leaving a form with unsaved changes, covering both:
 * - in-app React Router navigation (back button, nav links) via useBlocker, and
 * - hard navigation (refresh, tab close) via the native beforeunload prompt.
 */
export function useUnsavedChangesPrompt(enabled: boolean) {
  // The blocker reads `enabled` from a ref so it always sees the current value.
  // Without this, a programmatic navigate right after disabling the guard (e.g.
  // navigating away on successful save) can hit a still-registered blocker
  // because useBlocker re-registers in an effect that runs after the navigate.
  const enabledRef = useRef(enabled);
  useLayoutEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // In-app navigation: block cross-route navigations while there are changes.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => enabledRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(MESSAGE)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  // Hard navigation: refresh / tab close / external URL.
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      // preventDefault() is the modern, spec-compliant way to trigger the native
      // prompt and is honoured by all current browsers; returnValue is deprecated.
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [enabled]);
}
