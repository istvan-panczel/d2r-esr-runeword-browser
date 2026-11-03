import { ESR_REPO_SLUG } from '@/core/api/remoteConfig';
import { DROP_FINDER_URL, officialDocsUrl } from '@/features/guide/engine/linkSchemes';

/**
 * Navigation config: the header's grouped desktop menus, its mobile accordion and the home page's section cards all
 * render from `NAV_ENTRIES`, so they never drift. `navConfig.test.ts` checks every path against the router and that
 * labels are unique.
 */

export const ESR_DOCS_URL = 'https://easternsunresurrected.com/';
export const ESR_CHANGELOG_URL = 'https://easternsunresurrected.com/changelogs.html';
export const GITHUB_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser';
/** The privacy policy lives at the repo root (PRIVACY_POLICY.md); linked from the sign-in consent gate and the home footer. */
export const PRIVACY_POLICY_URL = `${GITHUB_URL}/blob/master/PRIVACY_POLICY.md`;
export const DISCORD_URL = 'https://discord.com/invite/XfFmAYZAbA';
export const ESR_REPO_URL = `https://github.com/${ESR_REPO_SLUG}`;
/** The official Drop Finder; defined with the guide's link schemes (shared with the Node guide generator). */
export { DROP_FINDER_URL };
/** The official Frame Table (IAS and FCR breakpoints); not linked from the official site's own navigation. */
export const FRAME_TABLE_URL = officialDocsUrl('ias-calculator.html');

/** An official ESR link, listed in the header's external-links menu and on the home page. */
export interface OfficialLink {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly description: string;
}

export const OFFICIAL_LINKS: readonly OfficialLink[] = [
  {
    key: 'esr-site',
    label: 'Official site',
    href: ESR_DOCS_URL,
    description: "The mod's home page: downloads, documentation and news from the mod author.",
  },
  {
    key: 'drop-finder',
    label: 'Drop Finder',
    href: DROP_FINDER_URL,
    description: 'The official tool for where every item, rune and material drops.',
  },
  {
    key: 'frame-table',
    label: 'Frame Table',
    href: FRAME_TABLE_URL,
    description: 'Attack and cast speed breakpoints (IAS and FCR) per class, form, skill and weapon.',
  },
  { key: 'changelog', label: 'Changelog', href: ESR_CHANGELOG_URL, description: 'Release notes for every ESR version.' },
  { key: 'discord', label: 'ESR Discord', href: DISCORD_URL, description: 'The community server: announcements, help and bug reports.' },
  {
    key: 'esr-repo',
    label: 'ESR on GitHub',
    href: ESR_REPO_URL,
    description: "The mod's source repository, including the game data files and docs.",
  },
];

/** A fan-made ESR tool, listed on the home page and in the header's external-links menu. */
export interface CommunityTool {
  readonly key: string;
  readonly label: string;
  readonly author: string;
  readonly href: string;
  /** The project's source repository, when it is public and differs from `href`. */
  readonly sourceUrl?: string;
  readonly kind: 'web' | 'in-game' | 'archive';
  readonly description: string;
  readonly caveat?: string;
}

export const COMMUNITY_TOOL_KIND_LABELS: Readonly<Record<CommunityTool['kind'], string>> = {
  web: 'Web',
  'in-game': 'In-game',
  archive: 'Archive, may be outdated',
};

export const COMMUNITY_TOOLS: readonly CommunityTool[] = [
  {
    key: 'wiki-overlay',
    label: 'ESR Wiki Overlay',
    author: 'Sully',
    href: 'https://github.com/Thisisnotsully/ESR-Wiki-Overlay/releases/latest',
    sourceUrl: 'https://github.com/Thisisnotsully/ESR-Wiki-Overlay',
    kind: 'in-game',
    description: 'In-game wiki and Horadric Cube recipe overlay, loaded as a D2RLoader plugin.',
    caveat: 'Windows download; needs D2RLoader.',
  },
  {
    key: 'esr-docs',
    label: 'ESR Docs',
    author: 'dotsyzygy',
    href: 'https://dotsyzygy.github.io/esr-docs/',
    sourceUrl: 'https://github.com/dotsyzygy/esr-docs',
    kind: 'web',
    description: 'Searchable cube recipe reference, rebuilt automatically from the latest ESR game files.',
    caveat: 'Tracks the ESR GitHub main branch, so it can run ahead of the released version.',
  },
  {
    key: 'esr-tools',
    label: 'ESR Tools',
    author: 'DoubleEclipse',
    href: 'https://doubleeclipse.github.io/esr-tools',
    sourceUrl: 'https://github.com/DoubleEclipse/doubleeclipse.github.io',
    kind: 'web',
    description: 'Item database, cube recipe search, life calculator, area levels and materials finder.',
    caveat: 'Some tools were last updated in early 2026.',
  },
  {
    key: 'unofficial-wiki',
    label: 'Unofficial ESR Wiki',
    author: 'DoubleEclipse (archive)',
    href: 'https://doubleeclipse.github.io/esr-tools/unofficial-wiki/',
    kind: 'archive',
    description: 'Archived snapshot of the community Fandom wiki front page from June 2026.',
    caveat: 'May be outdated.',
  },
];

export interface NavItem {
  readonly key: string;
  readonly to: string;
  readonly label: string;
  /** One line shown under the label in the desktop dropdown (and the home card of a plain link). */
  readonly description: string;
  /** Active only on its own path, not on its child paths (an overview whose sibling pages live under it). */
  readonly exact?: boolean;
}

/** A page chip on a home section card. */
export interface HomeLink {
  readonly key: string;
  readonly to: string;
  readonly label: string;
}

export interface NavGroup {
  readonly kind: 'group';
  readonly key: string;
  readonly label: string;
  /** One line on the group's home section card. */
  readonly description: string;
  readonly items: readonly NavItem[];
}

export interface NavLinkEntry {
  readonly kind: 'link';
  readonly item: NavItem;
  /** Shown only when the Supabase backend is configured. */
  readonly requiresSupabase?: boolean;
  /** The chips of the link's home card when it should offer more than the page itself (the first one is the item). */
  readonly homeLinks?: readonly HomeLink[];
}

export type NavEntry = NavGroup | NavLinkEntry;

export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    kind: 'group',
    key: 'recipes',
    label: 'Recipes',
    description: 'Runeword and gemword recipes, and the runes, gems and jewels that go in them',
    items: [
      { key: 'runewords', to: '/runewords', label: 'Runewords', description: 'Rune recipes by base, sockets and level' },
      { key: 'gemwords', to: '/gemwords', label: 'Gemwords', description: 'Gem and jewel socket recipes' },
      { key: 'socketables', to: '/socketables', label: 'Socketables', description: 'Runes, gems and jewels with their bonuses' },
    ],
  },
  {
    kind: 'group',
    key: 'database',
    label: 'Database',
    description: 'Uniques, mythicals, sets, ascendancies, skills, every base item, material and area',
    items: [
      { key: 'uniques', to: '/uniques', label: 'Uniques', description: 'Unique items by category and coupon' },
      { key: 'mythicals', to: '/mythicals', label: 'Mythicals', description: 'Mythical unique items' },
      { key: 'sets', to: '/game-data/sets', label: 'Sets', description: 'Set items with their partial and full-set bonuses' },
      { key: 'ascendancies', to: '/ascendancies', label: 'Ascendancies', description: 'Ascendancies and their tier bonuses' },
      { key: 'skills', to: '/skills', label: 'Skills', description: 'Class skill trees and the items that grant each skill' },
      { key: 'bases', to: '/game-data/bases', label: 'Bases', description: 'Base items from the game files' },
      {
        key: 'materials',
        to: '/game-data/materials',
        label: 'Materials',
        description: 'Runes, gems, organs, coupons and every other misc item',
      },
      {
        key: 'areas',
        to: '/game-data/areas',
        label: 'Areas',
        description: "Every area's monster level per difficulty, density, waypoints and the endgame map tiers",
      },
    ],
  },
  {
    kind: 'group',
    key: 'tools',
    label: 'Tools',
    description: 'Pick a base, check affix rolls, plan enhancements and write loot filters',
    items: [
      { key: 'best-base', to: '/game-data/best-base', label: 'Best Base', description: 'Best base for a runeword and character' },
      { key: 'affixes', to: '/game-data/affixes', label: 'Affixes', description: 'Affixes and what can roll on a base' },
      { key: 'item-types', to: '/game-data/types', label: 'Item Types', description: 'Item type tree and socket caps' },
      { key: 'enhance', to: '/game-data/enhance', label: 'Enhance', description: 'Corruption, anointment and Vessel of Souls outcomes' },
      { key: 'cube', to: '/game-data/cube', label: 'Cube Recipes', description: 'Every cube recipe, grouped by family' },
      { key: 'loot-filters', to: '/loot-filters', label: 'Loot Filters', description: 'Build and test loot filters' },
    ],
  },
  {
    kind: 'group',
    key: 'stash',
    label: 'My Stash',
    description: 'Upload your shared stash (it stays in your browser) and see what is in it',
    items: [
      {
        key: 'stash-overview',
        to: '/stash',
        label: 'Overview',
        description: 'Upload your shared stash; it is read in your browser only',
        exact: true,
      },
      {
        key: 'stash-coupons',
        to: '/stash/coupons',
        label: 'Ancient Coupons',
        description: 'Your coupons, the uniques they make and where they are',
      },
    ],
  },
  {
    kind: 'link',
    item: { key: 'guide', to: '/guide', label: 'Guide', description: 'New-player guide: what ESR changes and where to go next' },
    homeLinks: [
      { key: 'guide', to: '/guide', label: 'Start here' },
      { key: 'guide-map', to: '/guide/map', label: 'Note map' },
    ],
  },
  {
    kind: 'link',
    item: { key: 'builds', to: '/builds', label: 'Builds', description: 'Character builds shared by other players' },
    requiresSupabase: true,
  },
];

/** The entries to render: drops the backend-only ones when Supabase is not configured. */
export function getNavEntries(isSupabaseEnabled: boolean): readonly NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.kind === 'group' || !entry.requiresSupabase || isSupabaseEnabled);
}

/** Every page item of the config, in order (groups flattened, plain links included). */
export function getAllNavItems(entries: readonly NavEntry[] = NAV_ENTRIES): readonly NavItem[] {
  return entries.flatMap((entry) => (entry.kind === 'group' ? entry.items : [entry.item]));
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return pathname === item.to || (item.exact !== true && pathname.startsWith(`${item.to}/`));
}

export function isNavGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item));
}
