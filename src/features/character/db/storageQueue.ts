/**
 * The order of the My Character page's IndexedDB writes. Every save, remove and clear runs one after the other in the
 * order it was asked for, so a Clear all or a Remove clicked while an upload is still writing waits for those writes and
 * then wins: the saves can no longer come back after they were cleared. Pure over the injected store (tested with a fake).
 */
export interface CharacterStore<Meta> {
  save(name: string, meta: Meta, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
  clear(): Promise<void>;
}

export interface CharacterStorageQueue<Meta> {
  /** Queues one write per save; resolves with the failure messages (one per save that could not be written) */
  saveAll(entries: readonly { readonly name: string; readonly meta: Meta; readonly bytes: Uint8Array }[]): Promise<string[]>;
  remove(name: string): Promise<void>;
  clear(): Promise<void>;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createStorageQueue<Meta>(store: CharacterStore<Meta>): CharacterStorageQueue<Meta> {
  let tail: Promise<unknown> = Promise.resolve();
  /** Runs `task` after everything queued before it, whatever their outcome */
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
  return {
    async saveAll(entries) {
      // Queued synchronously, all at once: a Clear or Remove asked for later lands after every one of them
      const writes = entries.map((entry) =>
        enqueue(() => store.save(entry.name, entry.meta, entry.bytes)).then(
          () => null,
          (error: unknown) => messageOf(error)
        )
      );
      return (await Promise.all(writes)).filter((failure) => failure !== null);
    },
    remove: (name) => enqueue(() => store.remove(name)),
    clear: () => enqueue(() => store.clear()),
  };
}
