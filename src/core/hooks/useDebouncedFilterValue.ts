import { useEffect, useState } from 'react';

/**
 * Local input state that follows an external (Redux) value and commits local
 * edits back after a debounce. The external value is the source of truth:
 * when it changes from the outside (URL initialization, reset actions), the
 * local value is re-synced during render
 * (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
 *
 * Returns `[localValue, setLocalValue, commitValue]` where `commitValue`
 * updates the local value AND pushes it to the external store immediately,
 * bypassing the debounce (used by clear buttons).
 */
export function useDebouncedFilterValue<T>(
  externalValue: T,
  onCommit: (value: T) => void,
  debounceMs: number
): [T, (value: T) => void, (value: T) => void] {
  const [localValue, setLocalValue] = useState(externalValue);

  // Sync local state when the external value changes (adjust during render)
  const [prevExternalValue, setPrevExternalValue] = useState(externalValue);
  if (externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    setLocalValue(externalValue);
  }

  // Debounce committing local edits back to the external store
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== externalValue) {
        onCommit(localValue);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [localValue, externalValue, onCommit, debounceMs]);

  const commitValue = (value: T) => {
    setLocalValue(value);
    onCommit(value);
  };

  return [localValue, setLocalValue, commitValue];
}
