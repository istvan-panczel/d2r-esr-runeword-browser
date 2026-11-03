/**
 * Where an item lies in the stash: the location of an item on a page or in the materials tab, its in-game page and the
 * "Page N · row R, col C" text the stash pages show (1-based, counted from the top left).
 */
import type { StashTabType } from '../parser/types';

export interface StashLocation {
  /** Stash section, 0-based */
  readonly section: number;
  readonly tabType: StashTabType;
  readonly x: number;
  readonly y: number;
}

/** Stash sections 0–999 are pages */
export const MAX_PAGE = 1000;

/** The in-game page of a stash section (1-based), null for the materials tab */
export function pageOf(location: Pick<StashLocation, 'section' | 'tabType'>): number | null {
  return location.tabType === 'normal' ? location.section + 1 : null;
}

/**
 * "Page 3 · row 2, col 15" (1-based). The materials tab is just "Materials tab": its items have no grid cell (their
 * x / y mostly spell the stack count, x + 16 · y).
 */
export function formatLocation(location: StashLocation): string {
  const page = pageOf(location);
  if (page === null) return 'Materials tab';
  return `Page ${String(page)} · row ${String(location.y + 1)}, col ${String(location.x + 1)}`;
}

/** By page (section), then row, then column */
export function compareLocations(a: StashLocation, b: StashLocation): number {
  return a.section - b.section || a.y - b.y || a.x - b.x;
}

/** A key unique per cell of the stash (React keys of location lists) */
export function locationKey(location: StashLocation): string {
  return `${String(location.section)}:${String(location.x)}:${String(location.y)}`;
}

/** The distinct in-game pages of the locations, ascending (the materials tab has none) */
export function pagesOf(locations: Iterable<Pick<StashLocation, 'section' | 'tabType'>>): number[] {
  const pages = new Set<number>();
  for (const location of locations) {
    const page = pageOf(location);
    if (page !== null) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
