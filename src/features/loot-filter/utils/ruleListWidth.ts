/**
 * The Rules tab's list width (the splitter between the rule list and the editor on two-pane layouts). The width is a
 * preference in rem (so it follows the Text size setting), stored per browser; null means the per-page-width default
 * of the CSS. Shown clamped between `RULE_LIST_MIN_REM` and `RULE_LIST_MAX_FRACTION` of the row.
 */

/** localStorage key of the chosen width (rem, as a number string). */
export const RULE_LIST_WIDTH_STORAGE_KEY = 'loot-filters/rule-list-width';
/** The narrowest list. */
export const RULE_LIST_MIN_REM = 18;
/** The widest list, as a share of the row (list, gap and editor). */
export const RULE_LIST_MAX_FRACTION = 0.6;
/** Arrow keys move the splitter this far (rem); with Shift `RULE_LIST_BIG_STEP_REM`. */
export const RULE_LIST_STEP_REM = 1;
export const RULE_LIST_BIG_STEP_REM = 4;

/** A stored value beyond this is junk (no screen is that wide in rem), not a preference. */
const MAX_STORED_REM = 400;

/** The stored width, or null when nothing usable is stored (missing, not a number, out of range). */
export function parseRuleListWidth(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < RULE_LIST_MIN_REM || value > MAX_STORED_REM) return null;
  return value;
}

/** The width (px) the list may take in a row `rowPx` wide: at least the minimum, even when 60% of the row is less. */
export function ruleListBounds(rowPx: number, remPx: number): { readonly min: number; readonly max: number } {
  const min = RULE_LIST_MIN_REM * remPx;
  return { min, max: Math.max(min, rowPx * RULE_LIST_MAX_FRACTION) };
}

/** `px` kept within the bounds. */
export function clampRuleListWidth(px: number, bounds: { readonly min: number; readonly max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, px));
}

/**
 * The width (px) after a key press on the splitter, or null for a key it does not handle: ArrowLeft / ArrowRight move
 * it a step (Shift: a bigger one), Home / End jump to the minimum / maximum.
 */
export function ruleListWidthForKey(
  key: string,
  shift: boolean,
  currentPx: number,
  bounds: { readonly min: number; readonly max: number },
  remPx: number
): number | null {
  const step = (shift ? RULE_LIST_BIG_STEP_REM : RULE_LIST_STEP_REM) * remPx;
  switch (key) {
    case 'ArrowLeft':
      return clampRuleListWidth(currentPx - step, bounds);
    case 'ArrowRight':
      return clampRuleListWidth(currentPx + step, bounds);
    case 'Home':
      return bounds.min;
    case 'End':
      return bounds.max;
    default:
      return null;
  }
}

/** Reads the stored width; null without storage (private windows, blocked site data) or a usable value. */
export function readRuleListWidth(): number | null {
  try {
    return parseRuleListWidth(window.localStorage.getItem(RULE_LIST_WIDTH_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Stores the width (rem, two decimals), or removes it for null (back to the default). Ignores storage errors. */
export function writeRuleListWidth(rem: number | null): void {
  try {
    if (rem === null) window.localStorage.removeItem(RULE_LIST_WIDTH_STORAGE_KEY);
    else window.localStorage.setItem(RULE_LIST_WIDTH_STORAGE_KEY, String(Math.round(rem * 100) / 100));
  } catch {
    // Not remembered; the width still applies until the page is left.
  }
}
