import { parseLootFilter } from '../engine/parse';
import { templateOfFile, templateVersionOf } from './basedOn';
import { BUNDLED_TEMPLATES, fetchBundledTemplateText, type BundledTemplate, type BundledTemplateId } from './template';

/**
 * Where a bundled template's text comes from. A template with a `liveUrl` (Sully's) loads its upstream file first and
 * uses it whenever it passes `checkTemplateText`, even when its version is lower than the bundled copy's (the ESR
 * launcher does the same); anything else (network, timeout, HTTP status, an invalid file) falls back to the copy under
 * `public/loot-filters/`. Only the JSON is fetched live: icons and sounds always come from the site.
 */

export type TemplateOrigin = 'live' | 'bundled';

export interface TemplateSource {
  readonly id: BundledTemplateId;
  readonly text: string;
  /** The text's `version` as a template version (`templateVersionOf`); null when the bundled copy has none. */
  readonly version: string | null;
  readonly origin: TemplateOrigin;
  /** Why the live file was not used, when the template has a live URL (null otherwise, or when it was used). */
  readonly liveError: string | null;
  /** When this source was settled (epoch ms): the next call after `TEMPLATE_RECHECK_MS` checks the live file again. */
  readonly loadedAt: number;
}

export type TemplateTextVerdict =
  { readonly ok: true; readonly version: string; readonly ruleCount: number } | { readonly ok: false; readonly reason: string };

/** The largest live text accepted (characters; Sully's v0.9.2 is about 0.5 MB). */
export const TEMPLATE_MAX_CHARS = 5 * 1024 * 1024;
/** How long a live request may take before the bundled copy is used. */
export const TEMPLATE_LIVE_TIMEOUT_MS = 5000;
/** How old a settled source may get before the next call checks the live file again (the launcher pulls every 10 minutes). */
export const TEMPLATE_RECHECK_MS = 10 * 60 * 1000;

/**
 * Whether `text` can stand in for template `id`: at most `TEMPLATE_MAX_CHARS`, valid JSON (with comments) that the
 * parser reads without an error diagnostic, at least one rule, a title or author that names this template, and a
 * `version` that reads as a template version.
 */
export function checkTemplateText(id: BundledTemplateId, text: string): TemplateTextVerdict {
  if (text.length > TEMPLATE_MAX_CHARS)
    return { ok: false, reason: `the file is larger than ${String(TEMPLATE_MAX_CHARS / 1024 / 1024)} MB` };
  let parsed: ReturnType<typeof parseLootFilter>;
  try {
    parsed = parseLootFilter(text);
  } catch (error) {
    return { ok: false, reason: `not a readable filter (${error instanceof Error ? error.message : String(error)})` };
  }
  const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) {
    const first = errors[0];
    return {
      ok: false,
      reason: `${String(errors.length)} ${errors.length === 1 ? 'error' : 'errors'} in the file (first at ${first.path || 'the top'}: ${first.message})`,
    };
  }
  const { filter } = parsed;
  if (filter.rules.length === 0) return { ok: false, reason: 'the file has no rules' };
  if (templateOfFile(filter.title, filter.author) !== id) {
    return {
      ok: false,
      reason: `the file is not ${BUNDLED_TEMPLATES[id].name} (title "${filter.title ?? ''}", author "${filter.author ?? ''}")`,
    };
  }
  const version = templateVersionOf(filter.version);
  if (version === null) return { ok: false, reason: `its version "${filter.version ?? ''}" is not a version number` };
  return { ok: true, version, ruleCount: filter.rules.length };
}

/** A text's `version` as a template version, or null when it cannot be read. */
function versionOfText(text: string): string | null {
  try {
    return templateVersionOf(parseLootFilter(text).filter.version);
  } catch {
    return null;
  }
}

/** A short reason for a failed request ("timed out after 5 s", "HTTP 404", "Failed to fetch"). */
function requestErrorReason(error: unknown): string {
  if (isTimeout(error)) return `timed out after ${String(TEMPLATE_LIVE_TIMEOUT_MS / 1000)} s`;
  const { message } = typeof error === 'object' && error !== null ? (error as { message?: unknown }) : {};
  return typeof message === 'string' && message !== '' ? message : String(error);
}

/** The request hit `TEMPLATE_LIVE_TIMEOUT_MS` (a DOMException, which is not an Error in every runtime). */
function isTimeout(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'TimeoutError';
}

type LiveResult =
  | { readonly ok: true; readonly text: string; readonly version: string }
  /** `timedOut`: the host did not answer in time (the only failure that is remembered). */
  | { readonly ok: false; readonly reason: string; readonly timedOut: boolean };

/** The live file: a plain GET (no custom headers, so no CORS preflight; the browser's HTTP cache revalidates it). */
async function fetchLive(id: BundledTemplateId, url: string, fetchImpl: typeof fetch): Promise<LiveResult> {
  let text: string;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TEMPLATE_LIVE_TIMEOUT_MS), referrerPolicy: 'no-referrer' });
    if (!response.ok) return { ok: false, reason: `HTTP ${String(response.status)}`, timedOut: false };
    text = await response.text();
  } catch (error) {
    return { ok: false, reason: requestErrorReason(error), timedOut: isTimeout(error) };
  }
  const verdict = checkTemplateText(id, text);
  return verdict.ok ? { ok: true, text, version: verdict.version } : { ok: false, reason: verdict.reason, timedOut: false };
}

/** Where a timed-out live attempt is remembered for the browser session (`sessionStorage`; injectable for tests). */
export type LiveFailureStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface LoadDeps {
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  /** null: remember nothing. Default: `sessionStorage` when the browser allows it. */
  readonly storage?: LiveFailureStore | null;
}

const liveFailureKey = (id: BundledTemplateId) => `loot-filters/live-template-failed/${id}`;

function sessionStore(): LiveFailureStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

interface LiveFailure {
  readonly at: number;
  readonly reason: string;
}

/** A live attempt that timed out less than `TEMPLATE_RECHECK_MS` ago in this browser session, or null. */
function recentLiveFailure(store: LiveFailureStore | null, id: BundledTemplateId, now: number): LiveFailure | null {
  try {
    const raw = store?.getItem(liveFailureKey(id)) ?? null;
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<LiveFailure>;
    if (typeof value.at !== 'number' || typeof value.reason !== 'string') return null;
    const age = now - value.at;
    return age >= 0 && age < TEMPLATE_RECHECK_MS ? { at: value.at, reason: value.reason } : null;
  } catch {
    return null;
  }
}

function rememberLiveFailure(store: LiveFailureStore | null, id: BundledTemplateId, failure: LiveFailure | null): void {
  try {
    if (failure === null) store?.removeItem(liveFailureKey(id));
    else store?.setItem(liveFailureKey(id), JSON.stringify(failure));
  } catch {
    // Storage full or blocked: the next page load simply tries the live file again.
  }
}

/** "HTTP 503 (tried 3 min ago)": the reason of a remembered failure, with its age. */
function rememberedReason(failure: LiveFailure, now: number): string {
  const minutes = Math.floor((now - failure.at) / 60_000);
  return `${failure.reason} (tried ${minutes < 1 ? 'under a minute' : `${String(minutes)} min`} ago)`;
}

/**
 * Settles a source: the live file when it is valid; else, on a re-check, the previous source (a live one is kept, a
 * bundled one gets the new reason); else the bundled copy. Rejects only when there is no previous source and the
 * bundled copy cannot be fetched either. A live attempt that timed out is remembered for the browser session: for the
 * next `TEMPLATE_RECHECK_MS` page loads skip the live request (a host that hangs would cost every load the full timeout)
 * and go straight to the bundled copy; a live load that works forgets it. Any other failure (refused, an HTTP status,
 * an invalid file, a request cut short by leaving the page) fails fast, so it is not remembered: the next load tries
 * the live file again.
 */
async function settle(id: BundledTemplateId, deps: LoadDeps, previous: TemplateSource | null): Promise<TemplateSource> {
  const template = BUNDLED_TEMPLATES[id];
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const store = deps.storage === undefined ? sessionStore() : deps.storage;
  let liveError: string | null = null;
  if (template.liveUrl !== undefined) {
    const remembered = recentLiveFailure(store, id, now());
    if (remembered !== null) {
      liveError = rememberedReason(remembered, now());
    } else {
      const live = await fetchLive(id, template.liveUrl, fetchImpl);
      if (live.ok) {
        rememberLiveFailure(store, id, null);
        return { id, text: live.text, version: live.version, origin: 'live', liveError: null, loadedAt: now() };
      }
      liveError = live.reason;
      if (live.timedOut) rememberLiveFailure(store, id, { at: now(), reason: live.reason });
      console.warn(`[Loot filters] Not using the live ${template.name} (${template.liveUrl}): ${live.reason}`);
    }
    if (previous !== null) return { ...previous, liveError: previous.origin === 'live' ? null : liveError, loadedAt: now() };
  }
  const text = await fetchBundledTemplateText(id, fetchImpl);
  return { id, text, version: versionOfText(text), origin: 'bundled', liveError, loadedAt: now() };
}

interface CacheEntry {
  readonly promise: Promise<TemplateSource>;
  /** The source the promise settles to (the previous one while a re-check runs); null while the first load runs. */
  readonly settled: () => TemplateSource | null;
  readonly pending: () => boolean;
}

const cache = new Map<BundledTemplateId, CacheEntry>();

function start(id: BundledTemplateId, deps: LoadDeps, previous: TemplateSource | null): Promise<TemplateSource> {
  let settled = previous;
  let pending = true;
  const promise = settle(id, deps, previous).then(
    (source) => {
      settled = source;
      pending = false;
      return source;
    },
    (error: unknown) => {
      // A load that failed outright is forgotten, so the next call retries.
      if (cache.get(id)?.promise === promise) cache.delete(id);
      throw error;
    }
  );
  cache.set(id, { promise, settled: () => settled, pending: () => pending });
  return promise;
}

/**
 * A template's text and where it came from, once per id: concurrent callers share one request. A source older than
 * `TEMPLATE_RECHECK_MS` checks the live file again on the next call (a failed re-check keeps the previous source); a
 * load that failed outright is forgotten so the next call retries. Nothing is stored beyond the page (the text is 0.5 MB).
 */
export function loadTemplate(id: BundledTemplateId, deps: LoadDeps = {}): Promise<TemplateSource> {
  const entry = cache.get(id);
  if (entry !== undefined) {
    const settled = entry.settled();
    if (entry.pending() || settled === null) return entry.promise;
    const now = deps.now ?? Date.now;
    if (BUNDLED_TEMPLATES[id].liveUrl === undefined || now() - settled.loadedAt < TEMPLATE_RECHECK_MS) return entry.promise;
    return start(id, deps, settled);
  }
  return start(id, deps, null);
}

/** The last settled source of a template (no request): lets a page that already loaded it render without a loading flash. */
export function peekTemplateSource(id: BundledTemplateId): TemplateSource | null {
  return cache.get(id)?.settled() ?? null;
}

/** Forgets every loaded source (tests). */
export function resetTemplateSources(): void {
  cache.clear();
}

/** "github.com/Thisisnotsully/QoL-Filter" for a repository URL. */
export function repoLabel(repoUrl: string): string {
  return repoUrl.replace(/^https?:\/\//, '');
}

/** Where the text came from, for a template with a live URL: "latest from Sully's GitHub" / "the copy bundled with this site"; null without one. */
export function templateOriginText(template: BundledTemplate, source: TemplateSource): string | null {
  if (template.liveUrl === undefined) return null;
  return source.origin === 'live' ? `latest from ${template.author}'s GitHub` : 'the copy bundled with this site';
}

/** Why the bundled copy is shown: "Could not load the latest from github.com/…: <reason>"; null when nothing failed. */
export function templateLiveErrorText(template: BundledTemplate, source: TemplateSource): string | null {
  if (source.liveError === null) return null;
  const from = template.repoUrl === undefined ? 'the live file' : repoLabel(template.repoUrl);
  return `Could not load the latest from ${from}: ${source.liveError}`;
}
