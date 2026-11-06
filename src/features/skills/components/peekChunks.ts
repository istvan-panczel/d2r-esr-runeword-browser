/**
 * The peek's lazily loaded chunks (the shared popover host and the two cards), in one place so the lazy components and
 * the prefetch import the same modules. The ref index loaders (useSkillRefIndex, useModifierRefIndex) call
 * `prefetchPeekChunks` once their data is in: a page whose lines can open a peek then fetches the chunks on idle, and
 * the first peek opens without a "Loading…" step.
 */
export const loadPeekHost = () => import('./SkillPeekHost');
export const loadSkillPeekCard = () => import('./SkillPeekCard');
export const loadModifierPeekCard = () => import('@/features/modifiers/components/ModifierPeekCard');

/** How long the prefetch may wait for an idle moment */
const IDLE_TIMEOUT = 5000;
/** Without requestIdleCallback (Safari) */
const FALLBACK_DELAY = 1500;

let prefetched = false;

function prefetch() {
  // A failed prefetch is harmless: the lazy component imports again on the first peek
  for (const load of [loadPeekHost, loadSkillPeekCard, loadModifierPeekCard]) load().catch(() => undefined);
}

/** Fetches the peek chunks once, when the browser is idle */
export function prefetchPeekChunks(): void {
  if (prefetched) return;
  prefetched = true;
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(prefetch, { timeout: IDLE_TIMEOUT });
  else window.setTimeout(prefetch, FALLBACK_DELAY);
}
