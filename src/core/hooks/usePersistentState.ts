import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface PersistentStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem?: (key: string) => void;
}

export type PersistentValueValidator<T> = (value: unknown) => value is T;

function getBrowserStorage(): PersistentStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readPersistentJson<T>(
  storage: PersistentStorage | null,
  key: string,
  fallback: T,
  isValid?: PersistentValueValidator<T>
): T {
  if (storage === null) return fallback;

  try {
    const rawValue = storage.getItem(key);
    if (rawValue === null) return fallback;

    const parsed: unknown = JSON.parse(rawValue);
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writePersistentJson(storage: PersistentStorage | null, key: string, value: unknown): boolean {
  if (storage === null) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removePersistentJson(storage: PersistentStorage | null, key: string): boolean {
  if (storage === null || !storage.removeItem) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid?: PersistentValueValidator<T>
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readPersistentJson(getBrowserStorage(), key, fallback, isValid));
  const isFirstWrite = useRef(true);

  useEffect(() => {
    // Skip the initial-mount write: it would only re-serialize what was just read,
    // and worse, persist the fallback over stored data that failed validation
    // (destroying it before e.g. a future schema migration could recover it)
    if (isFirstWrite.current) {
      isFirstWrite.current = false;
      return;
    }
    writePersistentJson(getBrowserStorage(), key, value);
  }, [key, value]);

  return [value, setValue];
}
