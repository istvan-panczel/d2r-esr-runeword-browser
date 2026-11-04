/**
 * Thin HTTP helpers for the review's online checks: a generic User-Agent, a timeout and at most a few requests at
 * once, so the official site and GitHub see a polite client.
 */

const USER_AGENT = 'esr-update-review/1.0 (+https://github.com/istvan-panczel/d2r-esr-runeword-browser)';
const TIMEOUT_MS = 20_000;
export const MAX_PARALLEL = 4;

export interface FetchResult {
  status: number | null;
  /** Body bytes (only when asked for) */
  body: Buffer | null;
  error: string | null;
}

/** GET `url` following redirects; the body is read only when `withBody`, else cancelled. Never throws. */
export async function get(url: string, withBody: boolean, headers: Record<string, string> = {}): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, ...headers },
    });
    if (!withBody) {
      await response.body?.cancel();
      return { status: response.status, body: null, error: null };
    }
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), error: null };
  } catch (error) {
    return { status: null, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Runs `task` over `items` with at most `limit` in flight; results in input order. */
export async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
