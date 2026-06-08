import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Settings, Sun, Moon, ExternalLink, Menu, ChevronDown } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { openDrawer, selectTheme, setTheme } from '@/features/settings';
import { AuthControls, selectAuthIsConfigured } from '@/features/auth';

const ESR_DOCS_URL = 'https://easternsunresurrected.com/';
const CHANGELOG_URL = 'https://easternsunresurrected.com/changelogs.html';
const GITHUB_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser';

interface InternalEntry {
  readonly key: string;
  readonly kind: 'internal';
  readonly to: string;
  readonly label: string;
  readonly end: boolean;
}
interface ExternalEntry {
  readonly key: string;
  readonly kind: 'external';
  readonly href: string;
  readonly label: string;
}
type NavEntry = InternalEntry | ExternalEntry;

const INTERNAL_PAGES: readonly InternalEntry[] = [
  { key: 'runewords', kind: 'internal', to: '/', label: 'Runewords', end: true },
  { key: 'gemwords', kind: 'internal', to: '/gemwords', label: 'Gemwords', end: false },
  { key: 'socketables', kind: 'internal', to: '/socketables', label: 'Socketables', end: false },
  { key: 'uniques', kind: 'internal', to: '/uniques', label: 'Uniques', end: false },
  { key: 'mythicals', kind: 'internal', to: '/mythicals', label: 'Mythicals', end: false },
  { key: 'ascendancies', kind: 'internal', to: '/ascendancies', label: 'Ascendancies', end: false },
];
const BUILDS_ENTRY: InternalEntry = { key: 'builds', kind: 'internal', to: '/builds', label: 'Builds', end: false };
const EXTERNAL_LINKS: readonly ExternalEntry[] = [
  { key: 'esr-docs', kind: 'external', href: ESR_DOCS_URL, label: 'ESR Documentation' },
  { key: 'changelog', kind: 'external', href: CHANGELOG_URL, label: 'Changelog' },
];

// Shared nav-link styling so the visible items, the overflow trigger, and the hidden
// measurement row all render at identical widths.
const NAV_LINK_BASE = 'rounded-md px-3 py-2 text-sm font-medium transition-colors';
const NAV_LINK_INACTIVE = 'text-muted-foreground hover:text-foreground';
const NAV_LINK_ACTIVE = 'bg-accent text-accent-foreground';

// Flex gap between nav items (gap-1 = 4px) plus a small safety buffer so a measured
// item never ends up one pixel too wide for its slot.
const GAP = 4;
const SAFETY = 8;

function isActivePath(pathname: string, to: string, end: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** GitHub icon (lucide Github is deprecated, using simple-icons SVG path) */
function GitHubIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function Header() {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isSupabaseEnabled = useSelector(selectAuthIsConfigured);
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Full ordered nav: internal pages, then "Builds" (when the backend is configured), then external links.
  const entries: NavEntry[] = [...INTERNAL_PAGES, ...(isSupabaseEnabled ? [BUILDS_ENTRY] : []), ...EXTERNAL_LINKS];

  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(entries.length);

  // Priority-plus measurement: figure out how many leading items fit in the nav region,
  // and collapse the rest into the "More" menu. Re-runs on resize and when the item set changes.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const compute = () => {
      const measure = measureRef.current;
      if (!measure) return;
      const avail = nav.clientWidth;
      if (avail === 0) return; // hidden (below the md breakpoint) — nothing to compute

      const itemEls = measure.querySelectorAll<HTMLElement>('[data-measure-item]');
      const widths = Array.from(itemEls, (el) => el.getBoundingClientRect().width);
      const total = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1);
      if (total <= avail) {
        setVisibleCount(widths.length);
        return;
      }

      const moreWidth = moreRef.current?.getBoundingClientRect().width ?? 72;
      const budget = avail - moreWidth - GAP - SAFETY;
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = widths[i] + (i > 0 ? GAP : 0);
        if (used + next <= budget) {
          used += next;
          count += 1;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    };

    compute();
    // Web fonts can change item widths after the first paint without resizing the nav.
    void document.fonts.ready.then(compute);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(compute);
      observer.observe(nav);
    }
    return () => observer?.disconnect();
  }, [isSupabaseEnabled]);

  const visible = entries.slice(0, visibleCount);
  const overflow = entries.slice(visibleCount);
  const internalOverflow = overflow.filter((e): e is InternalEntry => e.kind === 'internal');
  const externalOverflow = overflow.filter((e): e is ExternalEntry => e.kind === 'external');
  const overflowHasActive = internalOverflow.some((e) => isActivePath(pathname, e.to, e.end));

  const handleThemeToggle = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  const handleMobileNavClick = () => {
    setMobileMenuOpen(false);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) => cn(NAV_LINK_BASE, isActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE);
  const externalLinkClass = cn(NAV_LINK_BASE, NAV_LINK_INACTIVE, 'inline-flex items-center gap-1');

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block w-full text-left px-4 py-3 text-base font-medium rounded-md transition-colors',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-14 items-center gap-3 px-4 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={() => {
            setMobileMenuOpen(true);
          }}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
        <span className="shrink-0 text-lg font-bold">D2R ESR</span>

        <nav ref={navRef} className="relative hidden min-w-0 flex-1 items-center gap-1 overflow-hidden md:flex">
          {visible.map((item) =>
            item.kind === 'internal' ? (
              <NavLink key={item.key} to={item.to} className={navLinkClass} end={item.end}>
                {item.label}
              </NavLink>
            ) : (
              <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" className={externalLinkClass}>
                {item.label}
                <ExternalLink className="size-3" />
              </a>
            )
          )}

          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  NAV_LINK_BASE,
                  overflowHasActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE,
                  'inline-flex items-center gap-1 outline-none'
                )}
                aria-label="More navigation links"
              >
                More
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {internalOverflow.map((item) => (
                  <DropdownMenuItem key={item.key} asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => cn('w-full cursor-pointer', isActive && 'bg-accent text-accent-foreground')}
                    >
                      {item.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                {internalOverflow.length > 0 && externalOverflow.length > 0 && <DropdownMenuSeparator />}
                {externalOverflow.map((item) => (
                  <DropdownMenuItem key={item.key} asChild>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full cursor-pointer items-center justify-between gap-2"
                    >
                      {item.label}
                      <ExternalLink className="size-3" />
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Hidden measurement row: always holds every item so we can size the visible set. */}
          <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-1">
            {entries.map((item) =>
              item.kind === 'internal' ? (
                <span key={item.key} data-measure-item className={cn(NAV_LINK_BASE, NAV_LINK_INACTIVE)}>
                  {item.label}
                </span>
              ) : (
                <span key={item.key} data-measure-item className={cn(NAV_LINK_BASE, NAV_LINK_INACTIVE, 'inline-flex items-center gap-1')}>
                  {item.label}
                  <ExternalLink className="size-3" />
                </span>
              )
            )}
            <span ref={moreRef} className={cn(NAV_LINK_BASE, NAV_LINK_INACTIVE, 'inline-flex items-center gap-1')}>
              More
              <ChevronDown className="size-4" />
            </span>
          </div>
        </nav>

        {/* On mobile the nav is hidden, so this spacer right-aligns the controls below the md breakpoint. */}
        <div className="flex-1 md:hidden" aria-hidden />

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleThemeToggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="View source on GitHub">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GitHubIcon className="size-5" />
            </a>
          </Button>
          <AuthControls />
          <Button variant="ghost" size="icon" onClick={() => dispatch(openDrawer())} aria-label="Open settings">
            <Settings className="size-5" />
          </Button>
        </div>
      </div>

      {/* Mobile navigation menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="mt-0 px-4 pb-2 flex flex-col gap-1">
            {entries.map((item) =>
              item.kind === 'internal' ? (
                <NavLink key={item.key} to={item.to} end={item.end} className={mobileNavLinkClass} onClick={handleMobileNavClick}>
                  {item.label}
                </NavLink>
              ) : (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 text-base font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1">
                    {item.label}
                    <ExternalLink className="size-3" />
                  </span>
                </a>
              )
            )}
            {isSupabaseEnabled && (
              <div className="mt-2 border-t px-1 pt-3">
                <AuthControls />
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
