/**
 * Resolves the link schemes of the guide's markdown (see docs/features/GUIDE.md) into `{ kind, href }`.
 * App hrefs are app paths without the base URL; `docs:` becomes an absolute URL of the official site and `dropfinder:` the
 * official Drop Finder page.
 */
import { normaliseItemName } from '../../../core/utils/itemName.ts';
import { DROP_FINDER_URL, NAME_FOCUS_PAGES, officialDocsUrl } from '../engine/linkSchemes.ts';
import type { LinkKind } from '../engine/schema.ts';
import type { BuildError, GuideContext } from './context.ts';

export interface ResolvedLink {
  kind: LinkKind;
  href: string;
  /** Non-fatal problem (docs file or anchor not found) */
  warning?: string;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function search(path: string, name: string): string {
  return `${path}?search=${encodeURIComponent(`"${name}"`)}`;
}

/** Exact-name focus of a list page: shows only the items named exactly `name` (case-insensitive), not affix matches. */
function exactName(path: string, name: string): string {
  return `${path}?name=${encodeURIComponent(name)}`;
}

/** App routes a `page:` link may point at (path only; a query string is allowed). */
export const APP_PAGES: readonly string[] = [
  '/',
  '/runewords',
  '/gemwords',
  '/socketables',
  '/uniques',
  '/mythicals',
  '/ascendancies',
  '/skills',
  '/modifiers',
  '/specializations',
  '/weapon-masteries',
  '/mercenaries',
  '/elixirs',
  '/game-data/bases',
  '/game-data/sets',
  '/game-data/best-base',
  '/game-data/affixes',
  '/game-data/types',
  '/game-data/enhance',
  '/game-data/cube',
  '/game-data/materials',
  '/game-data/areas',
  '/campaign-map',
  '/guide',
];

/** `docs:<file>#<anchor>` → official site URL, plus a warning when the clone's docs/ folder lacks the file or anchor. */
export function resolveDocsLink(target: string, ctx: Pick<GuideContext, 'docs'>): ResolvedLink | BuildError {
  const hashAt = target.indexOf('#');
  const file = hashAt === -1 ? target : target.slice(0, hashAt);
  const anchor = hashAt === -1 ? '' : target.slice(hashAt + 1);
  if (file === '') return { error: `docs: link "${target}" has no file name` };
  const href = officialDocsUrl(file, anchor);
  let warning: string | undefined;
  if (ctx.docs !== null) {
    const anchors = ctx.docs.get(file);
    if (anchors === undefined) warning = `docs: file "${file}" not found in the ESR clone's docs/`;
    else if (anchor !== '' && !anchors.has(anchor)) warning = `docs: anchor "#${anchor}" not found in "${file}"`;
  }
  return warning === undefined ? { kind: 'external', href } : { kind: 'external', href, warning };
}

/** Resolves a markdown link URL (as parsed by mdast, i.e. possibly percent-encoded). */
export function resolveLink(url: string, ctx: GuideContext): ResolvedLink | BuildError {
  if (/^https?:\/\//i.test(url)) return { kind: 'external', href: url };
  const colon = url.indexOf(':');
  if (colon === -1) return { error: `link "${url}" has no scheme (use [[slug]] for notes, page:/path for app pages)` };
  const scheme = url.slice(0, colon);
  const target = decode(url.slice(colon + 1)).trim();
  if (target === '') return { error: `link "${url}" has an empty target` };

  switch (scheme) {
    case 'rw':
      if (!ctx.runewordNames.has(target)) return { error: `unknown runeword "${target}" (rw:)` };
      return { kind: 'app', href: exactName(NAME_FOCUS_PAGES.rw, target) };
    // Not validated: no game-data bundle carries gemword names.
    case 'gw':
      return { kind: 'app', href: exactName(NAME_FOCUS_PAGES.gw, target) };
    // Validated against sources.json like ::source (exact name, case-insensitive), split into what each page shows
    // (see linkTargetNames): uniques without the mythicals, mythicals, socketables (gems, runes, crystals).
    case 'unique':
    case 'mythical':
    case 'socketable': {
      if (!ctx.linkNames[scheme].has(normaliseItemName(target))) {
        const what =
          scheme === 'socketable' ? 'socketable (gem, rune or crystal)' : scheme === 'mythical' ? 'mythical unique' : 'unique item';
        return { error: `unknown ${what} "${target}" (${scheme}:, checked against sources.json and the ESR item tables)` };
      }
      return { kind: 'app', href: exactName(NAME_FOCUS_PAGES[scheme], target) };
    }
    case 'base': {
      const name = ctx.baseNames.get(target);
      if (name === undefined) return { error: `unknown base code "${target}" (base:)` };
      return { kind: 'app', href: search('/game-data/bases', name) };
    }
    case 'type':
      if (!ctx.typeCodes.has(target)) return { error: `unknown item type code "${target}" (type:)` };
      return { kind: 'app', href: `/game-data/types?type=${encodeURIComponent(target)}` };
    case 'bestbase':
      return { kind: 'app', href: `/game-data/best-base?rw=${encodeURIComponent(target)}` };
    case 'affixes':
      return { kind: 'app', href: `/game-data/affixes?${target}` };
    case 'page': {
      const path = target.split(/[?#]/)[0] ?? '';
      if (!APP_PAGES.includes(path)) {
        return { error: `page: link "${target}" is not an app page (known: ${APP_PAGES.join(', ')})` };
      }
      if (path === '/modifiers') {
        const query = target.match(/\?([^#]*)/)?.[1] ?? '';
        const kind = new URLSearchParams(query).get('kind');
        if (kind !== null && !ctx.modifierKinds.has(kind)) {
          return { error: `page: link "${target}": unknown modifier kind "${kind}" (a kind key of public/game-data/modifiers.json)` };
        }
      }
      return { kind: 'app', href: target };
    }
    case 'docs':
      return resolveDocsLink(target, ctx);
    // Validated against sources.json (any item kind: unique, set or misc) so a typo fails the build, but not carried in
    // the URL: the Drop Finder's deep links (`#i=…`) are positional and change with every ESR release.
    case 'dropfinder': {
      const name = normaliseItemName(target);
      if (!Object.values(ctx.sourceNames).some((names) => names.has(name))) {
        return { error: `unknown item "${target}" (dropfinder:, checked against sources.json: uniques, set items and misc items)` };
      }
      return { kind: 'external', href: DROP_FINDER_URL };
    }
    default:
      return { error: `unknown link scheme "${scheme}:" in "${url}"` };
  }
}
