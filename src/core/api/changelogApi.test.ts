import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fetchLatestVersion } from './changelogApi';

const changelogHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/changelogs.html'), 'utf-8');

function stubFetch(body: string, init?: { ok?: boolean; status?: number; statusText?: string }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      statusText: init?.statusText ?? 'OK',
      text: () => Promise.resolve(body),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLatestVersion', () => {
  it('should parse the newest version from the real changelog fixture', async () => {
    stubFetch(changelogHtml);
    const result = await fetchLatestVersion();
    // 3.12 is the first (newest) entry — a two-part version, which must not be skipped
    expect(result.version).toBe('3.12');
    expect(result.date).toBe('30/07/2026');
    expect(result.fullString).toBe('Eastern Sun Resurrected 3.12 - 30/07/2026');
  });

  it('should parse three-part versions', async () => {
    stubFetch('<div>Eastern Sun Resurrected 3.11.09 - 04/05/2026</div>');
    const result = await fetchLatestVersion();
    expect(result.version).toBe('3.11.09');
    expect(result.date).toBe('04/05/2026');
  });

  it('should parse two-part versions', async () => {
    stubFetch('<div>Eastern Sun Resurrected 3.12 - 30/07/2026</div>');
    const result = await fetchLatestVersion();
    expect(result.version).toBe('3.12');
  });

  it('should match the first entry when several versions are present', async () => {
    stubFetch('<div>Eastern Sun Resurrected 4.0 - 01/01/2027</div><div>Eastern Sun Resurrected 3.11.09 - 04/05/2026</div>');
    const result = await fetchLatestVersion();
    expect(result.version).toBe('4.0');
  });

  it('should handle version headings wrapped across lines', async () => {
    stubFetch('<b><span>Eastern\n    Sun Resurrected 3.12 -\n    30/07/2026</span></b>');
    const result = await fetchLatestVersion();
    expect(result.version).toBe('3.12');
    expect(result.date).toBe('30/07/2026');
    expect(result.fullString).toBe('Eastern Sun Resurrected 3.12 - 30/07/2026');
  });

  it('should throw when no version can be parsed', async () => {
    stubFetch('<div>no version here</div>');
    await expect(fetchLatestVersion()).rejects.toThrow('Could not parse version from changelog');
  });

  it('should throw when the response is not ok', async () => {
    stubFetch('', { ok: false, status: 404, statusText: 'Not Found' });
    await expect(fetchLatestVersion()).rejects.toThrow('Failed to fetch changelog: 404 Not Found');
  });
});
