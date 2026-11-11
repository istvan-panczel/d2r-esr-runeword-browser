import { ESR_REPO_SLUG } from '@/core/api/remoteConfig';
import { DROP_FINDER_URL, officialDocsUrl } from '@/features/guide/engine/linkSchemes';

/**
 * Navigation config: the header's grouped desktop menus, its page row, its mobile accordion and the home page's section
 * cards all render from `NAV_ENTRIES`, so they never drift. `navConfig.test.ts` checks every path against the router and that
 * labels are unique.
 */

export const ESR_DOCS_URL = 'https://easternsunresurrected.com/';
export const ESR_INSTALL_GUIDE_URL = officialDocsUrl('installation_guide.html');
/** The target of the official site's "Documentation" nav link (the cube recipe page, whose nav reaches every table). */
export const ESR_DOCUMENTATION_URL = officialDocsUrl('Eastern Sun Resurrected Cube Recipes.html');
/** The official changelog page; it stops at 3.2.02 (August 2026), later notes are in the repo's patchnotes/ folder. */
export const ESR_CHANGELOG_URL = 'https://easternsunresurrected.com/changelogs.html';
export const GITHUB_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser';
/** The privacy policy lives at the repo root (PRIVACY_POLICY.md); linked from the sign-in consent gate and the home footer. */
export const PRIVACY_POLICY_URL = `${GITHUB_URL}/blob/master/PRIVACY_POLICY.md`;
export const DISCORD_URL = 'https://discord.com/invite/XfFmAYZAbA';
export const ESR_REPO_URL = `https://github.com/${ESR_REPO_SLUG}`;
export const ESR_PATCH_NOTES_URL = `${ESR_REPO_URL}/tree/main/patchnotes`;
export const ESR_RELEASES_URL = `${ESR_REPO_URL}/releases`;
/** The ESR 3.3 patch notes, which announce Sully's wiki overlay built into the game */
export const ESR_WIKI_OVERLAY_NOTE_URL = `${ESR_REPO_URL}/blob/main/patchnotes/3.3.md`;
/** The official Drop Finder; defined with the guide's link schemes (shared with the Node guide generator). */
export { DROP_FINDER_URL };
/** The official Frame Table (IAS and FCR breakpoints); the docs pages link it as "IAS Calculator", the site's home page does not. */
export const FRAME_TABLE_URL = officialDocsUrl('ias-calculator.html');
/** The official "Mercenary and Oskill Information" page (skilldetails.json `infoPage` / `mercenaries` come from it). */
export const ESR_SKILL_INFO_URL = officialDocsUrl('skill_information.htm');

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
    description: "The mod's home page: feature overview, installation guide and documentation, in 13 languages.",
  },
  {
    key: 'install-guide',
    label: 'Installation Guide',
    href: ESR_INSTALL_GUIDE_URL,
    description: 'How to install and update ESR: download the official launcher and press Install / Update.',
  },
  {
    key: 'documentation',
    label: 'Documentation',
    href: ESR_DOCUMENTATION_URL,
    description: 'The official tables: items, affixes, uniques, sets, runewords, cube recipes and the endgame systems.',
  },
  {
    key: 'drop-finder',
    label: 'Drop Finder',
    href: DROP_FINDER_URL,
    description: 'Per-kill drop chances by zone and monster, or which monsters drop an item, rune, unique or set.',
  },
  {
    key: 'frame-table',
    label: 'Frame Table',
    href: FRAME_TABLE_URL,
    description: 'Attack and cast speed breakpoints (IAS and FCR) per class, shapeshift form, skill and weapon.',
  },
  {
    key: 'patch-notes',
    label: 'Patch notes',
    href: ESR_PATCH_NOTES_URL,
    description: 'Patch notes of the recent releases, from 3.2.04 on, in the ESR GitHub repository.',
  },
  {
    key: 'changelog',
    label: 'Changelog',
    href: ESR_CHANGELOG_URL,
    description: 'The full release history from 1.02 up to 3.2.02 (August 2026); later releases are in the patch notes.',
  },
  {
    key: 'releases',
    label: 'Releases',
    href: ESR_RELEASES_URL,
    description: 'Every ESR release on GitHub, with the launcher (ESRLauncher.exe) download.',
  },
  { key: 'discord', label: 'ESR Discord', href: DISCORD_URL, description: 'The community server: announcements, help and bug reports.' },
  {
    key: 'esr-repo',
    label: 'ESR on GitHub',
    href: ESR_REPO_URL,
    description: "The mod's source repository: the game data files, patch notes and the launcher releases.",
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
  /** One sentence: what the tool is. */
  readonly description: string;
  /** What it offers, as short labels (most useful first); shown as a dot-separated line on the home card. */
  readonly features: readonly string[];
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
    // Built into ESR since 3.3 (d2rloader/plugins/esr-wiki-overlay/): the link is the patch note that announces it, the
    // author's repository stays as the source
    href: ESR_WIKI_OVERLAY_NOTE_URL,
    sourceUrl: 'https://github.com/Thisisnotsully/ESR-Wiki-Overlay',
    kind: 'in-game',
    description:
      'In-game ESR wiki and Horadric Cube recipe browser, built into ESR since 3.3: open it from the cube button or the main menu, or bind a hotkey.',
    features: [
      'Cube recipes',
      'Runewords and uniques',
      'Bases and affixes',
      'IAS calculator',
      'Endgame systems',
      '13 languages',
      'Controller support',
    ],
    caveat: 'Ships with ESR since 3.3, nothing to install (a D2RLoader plugin, Windows only). Its tabs refresh from the official site.',
  },
  {
    key: 'esr-docs',
    label: 'ESR Docs',
    author: 'dotsyzygy',
    href: 'https://dotsyzygy.github.io/esr-docs/',
    sourceUrl: 'https://github.com/dotsyzygy/esr-docs',
    kind: 'web',
    description: 'Reference pages rebuilt automatically from the ESR game files, plus a skill planner and a save viewer.',
    features: ['Cube recipes', 'Skill calculator', 'Skill planner', 'Character save viewer', 'Terror zones', 'Vessel of Souls'],
    caveat: 'Built from the ESR GitHub main branch, so it can be ahead of the latest release.',
  },
  {
    key: 'esr-tools',
    label: 'ESR Tools',
    author: 'DoubleEclipse',
    href: 'https://doubleeclipse.github.io/esr-tools/',
    sourceUrl: 'https://github.com/DoubleEclipse/doubleeclipse.github.io',
    kind: 'web',
    description: 'Item and cube recipe search over the official docs, plus a life calculator, area levels and organ drops.',
    features: ['Item search', 'Cube recipe search', 'Area levels', 'Life calculator', 'Organ drop finder'],
    caveat: 'Area, drop and life data are from older ESR versions (3.9 and 3.10), without the Warlock.',
  },
  {
    key: 'unofficial-wiki',
    label: 'Unofficial ESR Wiki',
    author: 'DoubleEclipse (archive)',
    href: 'https://doubleeclipse.github.io/esr-tools/unofficial-wiki/',
    kind: 'archive',
    description: 'Saved copy (June 2026) of the community Fandom wiki, whose front page holds the whole wiki.',
    features: ["Beginner's guide", 'Game mechanics', 'Breakpoints', 'Endgame', 'Author Q&A'],
    caveat: 'Mostly written for older ESR versions (3.9 and 3.10).',
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
    description: 'Runewords, gemwords, cube recipes, item enhancements and the materials they use',
    items: [
      { key: 'runewords', to: '/runewords', label: 'Runewords', description: 'Rune recipes by base, sockets and level' },
      { key: 'gemwords', to: '/gemwords', label: 'Gemwords', description: 'Gem and jewel socket recipes' },
      { key: 'socketables', to: '/socketables', label: 'Socketables', description: 'Runes, gems and jewels with their bonuses' },
      { key: 'best-base', to: '/best-base', label: 'Best Base', description: 'Best base for a runeword and character' },
      { key: 'cube', to: '/cube-recipes', label: 'Cube Recipes', description: 'Every cube recipe, grouped by family' },
      {
        key: 'enhance',
        to: '/enhance',
        label: 'Enhance',
        description: 'Corruption, anointment, sanctification and Vessel of Souls outcomes',
      },
      {
        key: 'materials',
        to: '/materials',
        label: 'Materials',
        description: 'Runes, gems, organs, coupons and every other misc item',
      },
    ],
  },
  {
    kind: 'group',
    key: 'items',
    label: 'Items',
    description: 'Uniques, mythicals, sets and bases, the affixes and modifiers on them, and elixirs',
    items: [
      { key: 'uniques', to: '/uniques', label: 'Uniques', description: 'Unique items by category and coupon' },
      { key: 'mythicals', to: '/mythicals', label: 'Mythicals', description: 'Mythical unique items' },
      { key: 'sets', to: '/sets', label: 'Sets', description: 'Set items with their partial and full-set bonuses' },
      { key: 'bases', to: '/bases', label: 'Bases', description: 'Base items from the game files' },
      { key: 'item-types', to: '/item-types', label: 'Item Types', description: 'Item type tree and socket caps' },
      { key: 'affixes', to: '/affixes', label: 'Affixes', description: 'Affixes and what can roll on a base' },
      {
        key: 'modifiers',
        to: '/modifiers',
        label: 'Modifiers',
        description: 'What item modifiers do in ESR: leech, crushing blow, resists, procs, speed, magic find',
      },
      {
        key: 'elixirs',
        to: '/elixirs',
        label: 'Elixirs',
        description: 'Utility elixirs: effects at your level, drop chances and the Alchemist perks',
      },
    ],
  },
  {
    kind: 'group',
    key: 'character',
    label: 'Character',
    description: 'Skills, ascendancies, specializations, weapon masteries, mercenaries and the Kill Ledger',
    items: [
      { key: 'skills', to: '/skills', label: 'Skills', description: 'Class skill trees and the items that grant each skill' },
      { key: 'ascendancies', to: '/ascendancies', label: 'Ascendancies', description: 'Ascendancies and their tier bonuses' },
      {
        key: 'specializations',
        to: '/specializations',
        label: 'Specializations',
        description: 'The four perk trees of ESR 3.3, how to unlock them and what each perk does',
      },
      {
        key: 'weapon-masteries',
        to: '/weapon-masteries',
        label: 'Weapon Masteries',
        description: 'How each class weapon changes your skills, its recipe and how to remove it',
      },
      {
        key: 'mercenaries',
        to: '/mercenaries',
        label: 'Mercenaries',
        description: 'Every hireling: act, gold, skill levels and stats at each level band',
      },
      {
        key: 'kill-ledger',
        to: '/kill-ledger',
        label: 'Kill Ledger',
        description: 'Every kill and boss bonus the book can take, and how each one unlocks',
      },
    ],
  },
  {
    kind: 'group',
    key: 'areas',
    label: 'Areas',
    description: "The campaign map, every area's monster levels and the terror zone schedule",
    items: [
      {
        key: 'campaign-map',
        to: '/campaign-map',
        label: 'Campaign Map',
        description: 'Acts, quest items, special areas, uber portals and endgame maps on one map per act',
      },
      {
        key: 'area-levels',
        to: '/area-levels',
        label: 'Area Levels',
        description: "Every area's monster level per difficulty, density, waypoints and the endgame map tiers",
      },
      {
        key: 'terror-zones',
        to: '/terror-zones',
        label: 'Terror Zones',
        description: 'Offline terror zone schedule: now, next and your watched zones',
      },
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
      {
        key: 'stash-items',
        to: '/stash/items',
        label: 'All Items',
        description: 'Every item on your stash pages: search names and stats, filter and sort',
      },
    ],
  },
  {
    kind: 'link',
    item: {
      key: 'my-character',
      to: '/character',
      label: 'My Character',
      description: 'Your characters from their save files: gear, skills, storage and progress; read in your browser only',
    },
  },
  {
    kind: 'link',
    item: { key: 'guide', to: '/guide', label: 'Guide', description: 'New-player guide: what ESR changes and where to go next' },
  },
  {
    kind: 'link',
    item: { key: 'builds', to: '/builds', label: 'Builds', description: 'Character builds shared by other players' },
    requiresSupabase: true,
  },
  {
    kind: 'link',
    item: { key: 'loot-filters', to: '/loot-filters', label: 'Loot Filters', description: 'Build, test and share loot filters' },
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

/** `/stash/` is the same page as `/stash` to the router; `/` stays `/`. */
function withoutTrailingSlash(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const path = withoutTrailingSlash(pathname);
  return path === item.to || (item.exact !== true && path.startsWith(`${item.to}/`));
}

export function isNavGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item));
}

/** The menu group the path belongs to: the page row shows its pages. Undefined on the plain links (Guide, Builds, Loot Filters) and off the menu. */
export function getActiveNavGroup(pathname: string, entries: readonly NavEntry[] = NAV_ENTRIES): NavGroup | undefined {
  return entries.find((entry): entry is NavGroup => entry.kind === 'group' && isNavGroupActive(pathname, entry));
}

/** The menu page the path belongs to (its label is the shared title of the Game Data pages). */
export function getActiveNavItem(pathname: string, entries: readonly NavEntry[] = NAV_ENTRIES): NavItem | undefined {
  return getAllNavItems(entries).find((item) => isNavItemActive(pathname, item));
}
