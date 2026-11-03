import { useEffect, useState, type ReactNode } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import { clearStoredStash, loadStoredStash, saveStoredStash, type StashFileMeta } from '../db/stashDb';
import { checkStashUpload, readStash, type StashLoadError } from '../engine/readStash';
import { StashContext, type StashLoadState } from './useStash';

interface StashProviderProps {
  readonly bundle: StashBundle;
  readonly children: ReactNode;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Holds the uploaded stash for the My Stash pages: reads the remembered file from IndexedDB on mount and parses it,
 * parses new uploads in the browser and remembers the ones that parse. Nothing leaves the browser.
 */
export function StashProvider({ bundle, children }: StashProviderProps) {
  const [state, setState] = useState<StashLoadState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<StashLoadError | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStoredStash().then(
      (stored) => {
        if (cancelled) return;
        if (stored === null) {
          setState({ status: 'empty' });
          return;
        }
        const started = performance.now();
        const result = readStash(stored.bytes, bundle);
        console.log(`[Stash] Parsed the remembered ${stored.meta.name} in ${String(Math.round(performance.now() - started))} ms`);
        setState(
          result.ok
            ? { status: 'ready', file: stored.meta, stash: result.stash }
            : { status: 'error', file: stored.meta, error: result.error }
        );
      },
      (error: unknown) => {
        console.error('[Stash] Could not read the remembered stash:', error);
        if (!cancelled) setState({ status: 'error', file: null, error: { kind: 'storage', message: errorMessage(error) } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const upload = async (file: File) => {
    setUploadError(null);
    const rejected = checkStashUpload(file.name, file.size);
    if (rejected !== null) {
      setUploadError(rejected);
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = readStash(bytes, bundle);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      const meta: StashFileMeta = {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified > 0 ? file.lastModified : null,
        uploadedAt: Date.now(),
      };
      setState({ status: 'ready', file: meta, stash: result.stash });
      try {
        await saveStoredStash(meta, bytes);
        setStorageWarning(null);
      } catch (error) {
        console.error('[Stash] Could not remember the stash:', error);
        setStorageWarning(
          `The browser did not let the page remember the file (${errorMessage(error)}); you will need to upload it again next time.`
        );
      }
    } catch (error) {
      setUploadError({ kind: 'unexpected', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setUploadError(null);
    setStorageWarning(null);
    try {
      await clearStoredStash();
    } catch (error) {
      console.error('[Stash] Could not forget the stash:', error);
    }
    setState({ status: 'empty' });
  };

  const dismissUploadError = () => {
    setUploadError(null);
  };

  return (
    <StashContext value={{ state, bundle, busy, uploadError, storageWarning, upload, clear, dismissUploadError }}>{children}</StashContext>
  );
}
