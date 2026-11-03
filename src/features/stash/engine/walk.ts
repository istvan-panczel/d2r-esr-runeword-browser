/**
 * Walking the items of a parsed stash: every listed item of the chosen tabs with its location, and optionally the
 * items in its sockets (with their parent). The All items page walks the pages only (the materials tab is left out by
 * the owner's decision); the coupons page walks pages and the materials tab, without sockets.
 */
import type { StashFile, StashItem, StashTabType } from '../parser/types';
import type { StashLocation } from './locations';

export interface WalkedItem {
  readonly item: StashItem;
  /** The cell of the item, or of its parent for a socketed item */
  readonly location: StashLocation;
  /** The item whose socket holds this one; null for an item listed on its page */
  readonly parent: StashItem | null;
  /** The socket index (0-based) inside `parent`; null for a listed item */
  readonly socket: number | null;
}

export interface WalkOptions {
  /** Which tabs: `pages` (1–1000), or `all` (pages and the materials tab). Default `pages`. */
  readonly tabs?: 'pages' | 'all';
  /** Also yield the socketed items, right after their parent (nested sockets depth-first). Default false. */
  readonly socketed?: boolean;
}

const TAB_FILTERS: Readonly<Record<NonNullable<WalkOptions['tabs']>, readonly StashTabType[]>> = {
  pages: ['normal'],
  all: ['normal', 'advanced'],
};

/** The items of the stash, in section order and then the save's item order. The Chronicle tab holds no items. */
export function walkStashItems(stash: StashFile, options: WalkOptions = {}): WalkedItem[] {
  const tabs = TAB_FILTERS[options.tabs ?? 'pages'];
  const result: WalkedItem[] = [];
  const visitSockets = (parent: StashItem, location: StashLocation) => {
    parent.socketed.forEach((child, socket) => {
      result.push({ item: child, location, parent, socket });
      visitSockets(child, location);
    });
  };
  for (const section of stash.sections) {
    if (!tabs.includes(section.tabType)) continue;
    for (const item of section.items) {
      const location: StashLocation = { section: section.index, tabType: section.tabType, x: item.x, y: item.y };
      result.push({ item, location, parent: null, socket: null });
      if (options.socketed === true) visitSockets(item, location);
    }
  }
  return result;
}
