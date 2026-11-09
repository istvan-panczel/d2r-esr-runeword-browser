import { CircleDot, Crown, Database, Gem, ScrollText, SlidersHorizontal, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { NAME_FOCUS_PAGES } from '../engine/linkSchemes';

interface AppLinkIconProps {
  readonly href: string;
  readonly className?: string;
}

/** The Game Data section's pages, top-level URLs that share no prefix. */
const GAME_DATA_PAGES: readonly string[] = [
  '/bases',
  '/sets',
  '/best-base',
  '/affixes',
  '/item-types',
  '/enhance',
  '/cube-recipes',
  '/materials',
  '/area-levels',
];

/** Icon for an in-app link by its target section (runewords is the fallback). */
export function AppLinkIcon({ href, className }: AppLinkIconProps) {
  if (GAME_DATA_PAGES.includes(href.split(/[?#]/)[0] ?? '')) return <Database className={className} aria-hidden />;
  if (href.startsWith(NAME_FOCUS_PAGES.gw)) return <Gem className={className} aria-hidden />;
  if (href.startsWith(NAME_FOCUS_PAGES.socketable)) return <CircleDot className={className} aria-hidden />;
  if (href.startsWith(NAME_FOCUS_PAGES.unique)) return <Crown className={className} aria-hidden />;
  if (href.startsWith(NAME_FOCUS_PAGES.mythical)) return <Sparkles className={className} aria-hidden />;
  if (href.startsWith('/ascendancies')) return <TrendingUp className={className} aria-hidden />;
  if (href.startsWith('/skills')) return <Zap className={className} aria-hidden />;
  if (href.startsWith('/modifiers')) return <SlidersHorizontal className={className} aria-hidden />;
  if (href.startsWith('/build') || href.startsWith('/user')) return <Users className={className} aria-hidden />;
  return <ScrollText className={className} aria-hidden />;
}
