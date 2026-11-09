import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_GUARD_MS, mayReloadAfterChunkError } from './chunkReload';

const NOW = 1_800_000_000_000;

describe('mayReloadAfterChunkError', () => {
  it('reloads when the tab never reloaded for a failed chunk', () => {
    expect(mayReloadAfterChunkError(null, NOW)).toBe(true);
  });

  it('does not reload again right after a reload, which would loop on a broken server', () => {
    expect(mayReloadAfterChunkError(String(NOW - 1000), NOW)).toBe(false);
    expect(mayReloadAfterChunkError(String(NOW - CHUNK_RELOAD_GUARD_MS + 1), NOW)).toBe(false);
  });

  it('reloads again once the guard has expired, for the next deploy in the same tab', () => {
    expect(mayReloadAfterChunkError(String(NOW - CHUNK_RELOAD_GUARD_MS), NOW)).toBe(true);
    expect(mayReloadAfterChunkError(String(NOW - 86_400_000), NOW)).toBe(true);
  });

  it('reloads when the stored value is unreadable', () => {
    expect(mayReloadAfterChunkError('not a time', NOW)).toBe(true);
  });
});
