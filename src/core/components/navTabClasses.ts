/** Styling of the header nav links (triggers, desktop links, mobile sheet links). */
export const TAB_BASE = 'rounded-md px-3 py-2 text-sm font-medium transition-colors';
export const TAB_INACTIVE = 'text-muted-foreground hover:text-foreground';
export const TAB_ACTIVE = 'bg-accent text-accent-foreground';

/**
 * Styling of the page sub-tabs (Game Data, My Stash, Enhance sections, campaign map sections, loot filter editor tabs).
 * They sit in a `ToolbarCard` (`bg-card`), where the header's `bg-accent` pill barely shows, so the active sub-tab is a
 * filled `bg-primary` pill. The focus ring is inset so a tab row that scrolls sideways (`overflow-x-auto`) does not clip it.
 */
export const SUBTAB_BASE =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
export const SUBTAB_INACTIVE = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';
export const SUBTAB_ACTIVE = 'bg-primary text-primary-foreground shadow-sm';
