import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StashBundle } from '@/features/game-data/engine/schema';
import {
  clearStoredCharacters,
  loadStoredCharacters,
  removeStoredCharacter,
  saveStoredCharacter,
  type CharacterFileMeta,
} from '../db/characterDb';
import { loadSelectedCharacter, saveSelectedCharacter } from '../db/characterSelection';
import { createStorageQueue } from '../db/storageQueue';
import { selectedCharacterEntry, sortCharacterEntries, upsertCharacterEntries, type CharacterEntry } from '../engine/characterList';
import {
  pickCharacterFiles,
  readCharacter,
  relatedSidecars,
  resolveSidecar,
  type CharacterUploadError,
  type SidecarCandidate,
} from '../engine/readCharacter';
import { CharacterContext, type CharacterListState } from './useCharacter';

interface CharacterProviderProps {
  readonly bundle: StashBundle;
  readonly children: ReactNode;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Every IndexedDB write of the page in the order asked for: a Clear or Remove waits for an upload's writes, then wins */
const storage = createStorageQueue<CharacterFileMeta>({
  save: saveStoredCharacter,
  remove: removeStoredCharacter,
  clear: clearStoredCharacters,
});

/**
 * Holds the stored characters of the My Character page: reads every remembered save from IndexedDB on mount and parses
 * it, parses new uploads in the browser (any number of saves at once, each with its .d2rl) and remembers the ones that
 * parse, one per character name. Nothing leaves the browser. Clear supersedes a load or an upload still running: it
 * bumps `generation`, and their results are then dropped; writes already queued run first (`storage`), so a Clear or
 * Remove during an upload's writes can never be undone by them.
 */
export function CharacterProvider({ bundle, children }: CharacterProviderProps) {
  const [list, setList] = useState<CharacterListState>({ status: 'loading' });
  const [selectedKey, setSelectedKey] = useState<string | null>(loadSelectedCharacter);
  const [busy, setBusy] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<readonly CharacterUploadError[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  /** Bumped by Clear */
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const started = generation.current;
    loadStoredCharacters().then(
      (stored) => {
        if (cancelled) return;
        const loaded: CharacterEntry[] =
          generation.current === started
            ? stored.map(({ characterName, meta, bytes }) => ({
                key: characterName,
                file: meta,
                bytes,
                result: readCharacter(bytes, bundle),
              }))
            : [];
        // An upload that finished first is newer than what was stored
        setList((previous) =>
          previous.status === 'ready'
            ? { status: 'ready', entries: upsertCharacterEntries(loaded, previous.entries) }
            : { status: 'ready', entries: sortCharacterEntries(loaded) }
        );
      },
      (error: unknown) => {
        console.error('[Character] Could not read the remembered saves:', error);
        if (!cancelled) setList({ status: 'error', error: { kind: 'storage', message: errorMessage(error) } });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const entries = list.status === 'ready' ? list.entries : [];
  const selected = selectedCharacterEntry(entries, selectedKey);

  const select = (key: string) => {
    setSelectedKey(key);
    saveSelectedCharacter(key);
  };

  const remember = async (added: readonly CharacterEntry[], started: number) => {
    const failures = await storage.saveAll(added.map((entry) => ({ name: entry.key, meta: entry.file, bytes: entry.bytes })));
    for (const failure of failures) console.error('[Character] Could not remember the save:', failure);
    // Cleared meanwhile: the writes ran before the clear, and the warning no longer applies
    if (generation.current !== started) return;
    setStorageWarning(
      failures.length === 0
        ? null
        : `The browser did not let the page remember ${added.length === 1 ? 'the save' : 'every save'} (${failures[0] ?? ''}); you will need to upload it again next time.`
    );
  };

  const upload = async (files: readonly File[]) => {
    if (busy) return;
    const started = generation.current;
    setUploadErrors([]);
    const picked = pickCharacterFiles(files);
    if (!picked.ok) {
      setUploadErrors([{ fileName: null, error: picked.error }]);
      return;
    }
    setBusy(true);
    try {
      const errors: CharacterUploadError[] = [...picked.skipped];
      const candidates: SidecarCandidate[] = await Promise.all(
        picked.sidecars.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }))
      );
      const added: CharacterEntry[] = [];
      for (const save of picked.saves) {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(await save.arrayBuffer());
        } catch (error) {
          errors.push({ fileName: save.name, error: { kind: 'unexpected', message: errorMessage(error) } });
          continue;
        }
        const result = readCharacter(bytes, bundle);
        if (!result.ok) {
          errors.push({ fileName: save.name, error: result.error });
          continue;
        }
        const related = relatedSidecars(save.name, candidates, picked.saves.length);
        const meta: CharacterFileMeta = {
          name: save.name,
          size: save.size,
          lastModified: save.lastModified > 0 ? save.lastModified : null,
          uploadedAt: Date.now(),
          sidecar: await resolveSidecar(candidates, bytes, related),
        };
        added.push({ key: result.character.name, file: meta, bytes, result });
      }
      // Cleared meanwhile: the upload no longer counts
      if (generation.current !== started) return;
      setUploadErrors(errors);
      const first = added.at(0);
      if (first === undefined) return;
      setList((previous) => ({
        status: 'ready',
        entries: upsertCharacterEntries(previous.status === 'ready' ? previous.entries : [], added),
      }));
      select(first.key);
      // Queued at once, before any later Clear or Remove (no await between the check above and here)
      await remember(added, started);
    } catch (error) {
      if (generation.current === started)
        setUploadErrors([{ fileName: null, error: { kind: 'unexpected', message: errorMessage(error) } }]);
    } finally {
      if (generation.current === started) setBusy(false);
    }
  };

  const remove = async (key: string) => {
    setList((previous) =>
      previous.status === 'ready' ? { status: 'ready', entries: previous.entries.filter((entry) => entry.key !== key) } : previous
    );
    if (selectedKey === key) {
      setSelectedKey(null);
      saveSelectedCharacter(null);
    }
    try {
      await storage.remove(key);
    } catch (error) {
      console.error('[Character] Could not forget the save:', error);
    }
  };

  const clear = async () => {
    generation.current += 1;
    setBusy(false);
    setUploadErrors([]);
    setStorageWarning(null);
    setList({ status: 'ready', entries: [] });
    setSelectedKey(null);
    saveSelectedCharacter(null);
    try {
      await storage.clear();
    } catch (error) {
      console.error('[Character] Could not forget the saves:', error);
    }
  };

  const dismissUploadErrors = () => {
    setUploadErrors([]);
  };

  return (
    <CharacterContext
      value={{ list, entries, selected, select, bundle, busy, uploadErrors, storageWarning, upload, remove, clear, dismissUploadErrors }}
    >
      {children}
    </CharacterContext>
  );
}
