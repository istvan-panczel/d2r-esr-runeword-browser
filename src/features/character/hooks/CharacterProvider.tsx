import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import { clearStoredCharacter, loadStoredCharacter, saveStoredCharacter, type CharacterFileMeta } from '../db/characterDb';
import { pickCharacterFiles, readCharacter, resolveSidecar, type CharacterLoadError } from '../engine/readCharacter';
import { CharacterContext, type CharacterLoadState } from './useCharacter';

interface CharacterProviderProps {
  readonly bundle: StashBundle;
  readonly children: ReactNode;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Holds the uploaded character for the My Stash section, the same way StashProvider does: reads the remembered file from
 * IndexedDB on mount and parses it, parses new uploads in the browser and remembers the ones that parse. Nothing
 * leaves the browser. Uploads and Clear are sequence-numbered: only the latest may change the state or the stored file.
 */
export function CharacterProvider({ bundle, children }: CharacterProviderProps) {
  const [state, setState] = useState<CharacterLoadState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<CharacterLoadError | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  /** Bumped by every upload and Clear */
  const latest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const started = latest.current;
    const superseded = () => cancelled || latest.current !== started;
    loadStoredCharacter().then(
      (stored) => {
        if (superseded()) return;
        if (stored === null) {
          setState({ status: 'empty' });
          return;
        }
        const result = readCharacter(stored.bytes, bundle);
        setState(
          result.ok
            ? { status: 'ready', file: stored.meta, character: result.character }
            : { status: 'error', file: stored.meta, error: result.error }
        );
      },
      (error: unknown) => {
        console.error('[Character] Could not read the remembered save:', error);
        if (!superseded()) setState({ status: 'error', file: null, error: { kind: 'storage', message: errorMessage(error) } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const upload = async (files: readonly File[]) => {
    const seq = ++latest.current;
    const isLatest = () => latest.current === seq;
    setUploadError(null);
    const picked = pickCharacterFiles(files);
    if (!picked.ok) {
      // Supersedes an upload still being read, which is then dropped
      setBusy(false);
      setUploadError(picked.error);
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await picked.save.arrayBuffer());
      if (!isLatest()) return;
      const result = readCharacter(bytes, bundle);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      const candidates = await Promise.all(
        picked.sidecars.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))
      );
      const sidecar = await resolveSidecar(candidates, bytes);
      if (!isLatest()) return;
      const meta: CharacterFileMeta = {
        name: picked.save.name,
        size: picked.save.size,
        lastModified: picked.save.lastModified > 0 ? picked.save.lastModified : null,
        uploadedAt: Date.now(),
        sidecar,
      };
      setState({ status: 'ready', file: meta, character: result.character });
      try {
        // Issued while this upload is the latest: IndexedDB applies writes in order, so a newer upload or Clear wins
        await saveStoredCharacter(meta, bytes);
        if (isLatest()) setStorageWarning(null);
      } catch (error) {
        console.error('[Character] Could not remember the save:', error);
        if (isLatest())
          setStorageWarning(
            `The browser did not let the page remember the save (${errorMessage(error)}); you will need to upload it again next time.`
          );
      }
    } catch (error) {
      if (isLatest()) setUploadError({ kind: 'unexpected', message: errorMessage(error) });
    } finally {
      if (isLatest()) setBusy(false);
    }
  };

  const clear = async () => {
    const seq = ++latest.current;
    setBusy(false);
    setUploadError(null);
    setStorageWarning(null);
    try {
      await clearStoredCharacter();
    } catch (error) {
      console.error('[Character] Could not forget the save:', error);
    }
    if (latest.current === seq) setState({ status: 'empty' });
  };

  const dismissUploadError = () => {
    setUploadError(null);
  };

  return (
    <CharacterContext value={{ state, bundle, busy, uploadError, storageWarning, upload, clear, dismissUploadError }}>
      {children}
    </CharacterContext>
  );
}
