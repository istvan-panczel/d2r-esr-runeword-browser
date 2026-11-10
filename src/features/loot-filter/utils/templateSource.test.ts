import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SULLYS_QOL_TEMPLATE, EXAMPLE_TEMPLATE, lootFilterAssetUrl } from './template';
import {
  TEMPLATE_RECHECK_MS,
  checkTemplateText,
  loadTemplate,
  peekTemplateSource,
  resetTemplateSources,
  templateLiveErrorText,
  templateOriginText,
  type TemplateSource,
} from './templateSource';

const SULLY_TEXT = readFileSync(
  resolve(process.cwd(), 'src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json'),
  'utf8'
);

/** A small valid file of Sully's at `version`. */
const sully = (version: string, extra = '') =>
  `{"formatVersion": 1, "title": "Sully's QoL Filter", "author": "Sully", "version": "${version}"${extra}, "rules": [{"itemCodes": ["r01"]}]}`;

const LIVE = SULLYS_QOL_TEMPLATE.liveUrl ?? '';
const BUNDLED = lootFilterAssetUrl(SULLYS_QOL_TEMPLATE.file);

type Reply = string | number | Error | DOMException;

/** A fake fetch: each URL answers from its queue (a text = 200, a number = that status, an Error = rejects); the last reply repeats. */
function fakeFetch(replies: Record<string, Reply[]>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const queue = replies[url] ?? [404];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (typeof reply === 'object') return Promise.reject(reply);
    if (typeof reply === 'number') return Promise.resolve(new Response('Not Found', { status: reply }));
    return Promise.resolve(new Response(reply ?? '', { status: 200 }));
  });
  return { fetch: fetchImpl as unknown as typeof fetch, calls, count: (url: string) => calls.filter((call) => call.url === url).length };
}

function clock(start = 1_000_000) {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('checkTemplateText', () => {
  it("accepts Sully's v0.9.2 (one parser warning is fine) with its version and rule count", () => {
    expect(checkTemplateText('sullys-qol', SULLY_TEXT)).toEqual({ ok: true, version: '0.9.2', ruleCount: 689 });
  });

  it('accepts a "v"-prefixed version as the bare number', () => {
    expect(checkTemplateText('sullys-qol', sully('v1.0'))).toEqual({ ok: true, version: '1.0', ruleCount: 1 });
  });

  it('refuses a syntax error', () => {
    expect(checkTemplateText('sullys-qol', `${sully('1.0').slice(0, -2)}`)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not a readable filter'),
    });
    expect(checkTemplateText('sullys-qol', '<!doctype html><html></html>')).toMatchObject({ ok: false });
  });

  it('refuses a file with an error diagnostic', () => {
    const verdict = checkTemplateText('sullys-qol', sully('1.0', ', "filterLevels": "all"'));
    expect(verdict).toMatchObject({ ok: false, reason: expect.stringMatching(/^1 error in the file \(first at filterLevels: /) });
  });

  it('refuses a file of another title and author, and the example for Sully', () => {
    const other = '{"formatVersion": 1, "title": "My filter", "author": "Bob", "version": "1.0", "rules": [{"itemCodes": ["r01"]}]}';
    expect(checkTemplateText('sullys-qol', other)).toEqual({
      ok: false,
      reason: `the file is not Sully's QoL Filter (title "My filter", author "Bob")`,
    });
    expect(checkTemplateText('example', sully('1.0'))).toMatchObject({ ok: false });
  });

  it('refuses a file without rules', () => {
    expect(checkTemplateText('sullys-qol', sully('1.0').replace('[{"itemCodes": ["r01"]}]', '[]'))).toEqual({
      ok: false,
      reason: 'the file has no rules',
    });
  });

  it('refuses a version that is not a version number', () => {
    expect(checkTemplateText('sullys-qol', sully('.5'))).toEqual({ ok: false, reason: 'its version ".5" is not a version number' });
    expect(checkTemplateText('sullys-qol', sully('latest'))).toMatchObject({ ok: false });
  });

  it('refuses a file over 5 MB', () => {
    expect(checkTemplateText('sullys-qol', sully('1.0', `, "description": "${'x'.repeat(5 * 1024 * 1024)}"`))).toMatchObject({
      ok: false,
      reason: 'the file is larger than 5 MB',
    });
  });
});

describe('loadTemplate', () => {
  beforeEach(() => {
    resetTemplateSources();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a valid live file, with a plain GET (no headers, no referrer, a timeout)', async () => {
    const net = fakeFetch({ [LIVE]: [sully('0.9.3')], [BUNDLED]: [sully('0.9.2')] });
    const source = await loadTemplate('sullys-qol', { fetch: net.fetch, now: () => 5 });
    expect(source).toEqual({ id: 'sullys-qol', text: sully('0.9.3'), version: '0.9.3', origin: 'live', liveError: null, loadedAt: 5 });
    expect(net.calls).toHaveLength(1);
    const init = net.calls[0].init;
    expect(init?.headers).toBeUndefined();
    expect(init?.referrerPolicy).toBe('no-referrer');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses the live file even when its version is lower than the bundled copy', async () => {
    const net = fakeFetch({ [LIVE]: [sully('0.8.0')], [BUNDLED]: [sully('0.9.2')] });
    expect(await loadTemplate('sullys-qol', { fetch: net.fetch })).toMatchObject({ version: '0.8.0', origin: 'live' });
  });

  it.each<[string, Reply, string]>([
    ['an HTTP error', 404, 'HTTP 404'],
    ['a network error', new TypeError('Failed to fetch'), 'Failed to fetch'],
    ['a timeout', new DOMException('signal timed out', 'TimeoutError'), 'timed out after 5 s'],
    ['an invalid file', '{"formatVersion": 1, "title": "Sully\'s QoL Filter", "rules": []}', 'the file has no rules'],
  ])('falls back to the bundled copy on %s, with the reason', async (_, reply, reason) => {
    const net = fakeFetch({ [LIVE]: [reply], [BUNDLED]: [sully('0.9.2')] });
    const source = await loadTemplate('sullys-qol', { fetch: net.fetch });
    expect(source).toMatchObject({ text: sully('0.9.2'), version: '0.9.2', origin: 'bundled', liveError: reason });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('loads a template without a live URL from its bundled copy only', async () => {
    const example =
      '{"formatVersion": 1, "title": "Example filter (with explanations)", "version": "2.2.0", "rules": [{"itemCodes": ["r01"]}]}';
    const net = fakeFetch({ [lootFilterAssetUrl(EXAMPLE_TEMPLATE.file)]: [example] });
    expect(await loadTemplate('example', { fetch: net.fetch })).toMatchObject({ version: '2.2.0', origin: 'bundled', liveError: null });
    expect(net.calls).toHaveLength(1);
  });

  it('shares one request between concurrent callers, and caches the result', async () => {
    const net = fakeFetch({ [LIVE]: [sully('0.9.3')] });
    const [a, b] = await Promise.all([loadTemplate('sullys-qol', { fetch: net.fetch }), loadTemplate('sullys-qol', { fetch: net.fetch })]);
    expect(a).toBe(b);
    expect(await loadTemplate('sullys-qol', { fetch: net.fetch })).toBe(a);
    expect(net.count(LIVE)).toBe(1);
    expect(peekTemplateSource('sullys-qol')).toBe(a);
  });

  it('checks the live file again after 10 minutes', async () => {
    const time = clock();
    const net = fakeFetch({ [LIVE]: [sully('0.9.3'), sully('0.9.4')] });
    const deps = { fetch: net.fetch, now: time.now };
    expect((await loadTemplate('sullys-qol', deps)).version).toBe('0.9.3');
    time.advance(TEMPLATE_RECHECK_MS - 1);
    expect((await loadTemplate('sullys-qol', deps)).version).toBe('0.9.3');
    time.advance(1);
    expect((await loadTemplate('sullys-qol', deps)).version).toBe('0.9.4');
    expect(net.count(LIVE)).toBe(2);
  });

  it('keeps the last good live source when a re-check fails, and keeps it visible meanwhile', async () => {
    const time = clock();
    const net = fakeFetch({ [LIVE]: [sully('0.9.3'), 503], [BUNDLED]: [sully('0.9.2')] });
    const deps = { fetch: net.fetch, now: time.now };
    const first = await loadTemplate('sullys-qol', deps);
    time.advance(TEMPLATE_RECHECK_MS);
    const recheck = loadTemplate('sullys-qol', deps);
    expect(peekTemplateSource('sullys-qol')).toBe(first);
    const kept: TemplateSource = await recheck;
    expect(kept).toMatchObject({ text: first.text, version: '0.9.3', origin: 'live', liveError: null, loadedAt: time.now() });
    expect(net.count(BUNDLED)).toBe(0);
    // The next check waits another 10 minutes.
    expect(await loadTemplate('sullys-qol', deps)).toBe(kept);
    expect(net.count(LIVE)).toBe(2);
  });

  it('switches from the bundled copy to the live file once a re-check succeeds', async () => {
    const time = clock();
    const net = fakeFetch({ [LIVE]: [500, sully('0.9.3')], [BUNDLED]: [sully('0.9.2')] });
    const deps = { fetch: net.fetch, now: time.now };
    expect(await loadTemplate('sullys-qol', deps)).toMatchObject({ origin: 'bundled', liveError: 'HTTP 500' });
    time.advance(TEMPLATE_RECHECK_MS);
    expect(await loadTemplate('sullys-qol', deps)).toMatchObject({ origin: 'live', version: '0.9.3', liveError: null });
    expect(net.count(BUNDLED)).toBe(1);
  });

  it('rejects when both fail, and the next call retries', async () => {
    const net = fakeFetch({ [LIVE]: [new TypeError('Failed to fetch'), sully('0.9.3')], [BUNDLED]: [404, sully('0.9.2')] });
    await expect(loadTemplate('sullys-qol', { fetch: net.fetch })).rejects.toThrow('HTTP 404');
    expect(peekTemplateSource('sullys-qol')).toBeNull();
    expect(await loadTemplate('sullys-qol', { fetch: net.fetch })).toMatchObject({ origin: 'live', version: '0.9.3' });
  });
});

describe('origin texts', () => {
  const source = (origin: 'live' | 'bundled', liveError: string | null): TemplateSource => ({
    id: 'sullys-qol',
    text: '',
    version: '0.9.2',
    origin,
    liveError,
    loadedAt: 0,
  });

  it('says where the text came from, only for a template with a live file', () => {
    expect(templateOriginText(SULLYS_QOL_TEMPLATE, source('live', null))).toBe("latest from Sully's GitHub");
    expect(templateOriginText(SULLYS_QOL_TEMPLATE, source('bundled', 'HTTP 503'))).toBe('the copy bundled with this site');
    expect(templateOriginText(EXAMPLE_TEMPLATE, { ...source('bundled', null), id: 'example' })).toBeNull();
  });

  it('says why the live file was not used', () => {
    expect(templateLiveErrorText(SULLYS_QOL_TEMPLATE, source('bundled', 'HTTP 503'))).toBe(
      'Could not load the latest from github.com/Thisisnotsully/QoL-Filter: HTTP 503'
    );
    expect(templateLiveErrorText(SULLYS_QOL_TEMPLATE, source('live', null))).toBeNull();
  });
});
