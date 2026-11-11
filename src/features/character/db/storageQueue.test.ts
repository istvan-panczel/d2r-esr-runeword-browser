import { describe, expect, it } from 'vitest';
import { createStorageQueue, type CharacterStore } from './storageQueue';

/** A store whose writes finish only when released, recording the order the operations ran in */
function slowStore() {
  const data = new Map<string, string>();
  const log: string[] = [];
  const pending: (() => void)[] = [];
  const later = (apply: () => void, label: string) =>
    new Promise<void>((resolve) => {
      log.push(`start ${label}`);
      pending.push(() => {
        apply();
        log.push(`done ${label}`);
        resolve();
      });
    });
  const store: CharacterStore<string> = {
    save: (name, meta) => later(() => data.set(name, meta), `save ${name}`),
    remove: (name) => later(() => data.delete(name), `remove ${name}`),
    clear: () => later(() => data.clear(), 'clear'),
  };
  /** Finishes the operations one by one as the queue starts them */
  const drain = async () => {
    for (let round = 0; round < 20; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      pending.shift()?.();
    }
  };
  return { store, data, log, drain };
}

describe('createStorageQueue', () => {
  it('a Clear asked for while an upload is writing waits for the writes and leaves nothing stored', async () => {
    const { store, data, log, drain } = slowStore();
    const queue = createStorageQueue(store);
    const saved = queue.saveAll([
      { name: 'A', meta: 'a', bytes: new Uint8Array() },
      { name: 'B', meta: 'b', bytes: new Uint8Array() },
    ]);
    const cleared = queue.clear();
    await drain();
    await Promise.all([saved, cleared]);
    expect(data.size).toBe(0);
    expect(log).toEqual(['start save A', 'done save A', 'start save B', 'done save B', 'start clear', 'done clear']);
  });

  it('a Remove of a character still being written runs after the write', async () => {
    const { store, data, drain } = slowStore();
    const queue = createStorageQueue(store);
    const saved = queue.saveAll([{ name: 'A', meta: 'a', bytes: new Uint8Array() }]);
    const removed = queue.remove('A');
    await drain();
    await Promise.all([saved, removed]);
    expect(data.has('A')).toBe(false);
  });

  it('reports a failed write and goes on with the next operations', async () => {
    const data = new Map<string, string>();
    const queue = createStorageQueue<string>({
      save: (name, meta) => (name === 'bad' ? Promise.reject(new Error('quota')) : Promise.resolve(void data.set(name, meta))),
      remove: (name) => Promise.resolve(void data.delete(name)),
      clear: () => Promise.resolve(data.clear()),
    });
    const failures = await queue.saveAll([
      { name: 'bad', meta: 'x', bytes: new Uint8Array() },
      { name: 'good', meta: 'y', bytes: new Uint8Array() },
    ]);
    expect(failures).toEqual(['quota']);
    expect([...data.keys()]).toEqual(['good']);
  });
});
