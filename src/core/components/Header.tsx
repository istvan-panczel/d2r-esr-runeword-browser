import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Settings, Sun, Moon, ExternalLink, Menu, BookOpen } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { APP_FRAME_CLASS } from '@/components/pageWidthClasses';
import { openDrawer, selectPageWidth, selectTheme, setTheme } from '@/features/settings';
import { AuthControls, selectAuthIsConfigured } from '@/features/auth';
import { GlobalSearch } from '@/features/global-search/components/GlobalSearch';
import {
  COMMUNITY_TOOLS,
  GITHUB_URL,
  OFFICIAL_LINKS,
  getNavEntries,
  isNavGroupActive,
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from '@/core/navigation/navConfig';
// Shared nav-link styling (also the page sub-tabs), so the group triggers and the plain links look the same.
import { TAB_ACTIVE, TAB_BASE, TAB_INACTIVE } from './navTabClasses';
import { GroupPagesBar } from './GroupPagesBar';
import { PageWidthMenu } from './PageWidthMenu';

const DROPDOWN_LINK_CLASS = 'flex w-full cursor-pointer items-center justify-between gap-2';
const MOBILE_EXTERNAL_LINK_CLASS =
  'flex items-center gap-1 rounded-md px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground';

/** GitHub icon (lucide Github is deprecated, using simple-icons SVG path) */
function GitHubIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** A group with more items than this opens as two columns. */
const MAX_SINGLE_COLUMN_ITEMS = 4;

/** One dropdown entry: label plus a one-line description. */
function GroupItemLink({ item, active }: { readonly item: NavItem; readonly active: boolean }) {
  return (
    <li>
      <NavigationMenuLink asChild active={active} className="data-active:bg-accent data-active:text-accent-foreground">
        <Link to={item.to}>
          <span className={cn('text-sm leading-none', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
          <span className={cn('text-xs leading-snug', active ? 'text-accent-foreground/80' : 'text-muted-foreground')}>
            {item.description}
          </span>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

function DesktopGroup({ group, pathname }: { readonly group: NavGroup; readonly pathname: string }) {
  const groupActive = isNavGroupActive(pathname, group);
  const twoColumns = group.items.length > MAX_SINGLE_COLUMN_ITEMS;
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(TAB_BASE, 'h-auto bg-transparent px-3', groupActive ? TAB_ACTIVE : TAB_INACTIVE)}
        data-group-active={groupActive || undefined}
      >
        {group.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent className="z-50">
        {/* Two columns fill downwards (the rows come from the item count), the order the keyboard moves in. */}
        <ul
          className={cn('grid gap-1', twoColumns ? 'w-[36rem] grid-flow-col grid-cols-2' : 'w-72')}
          style={twoColumns ? { gridTemplateRows: `repeat(${String(Math.ceil(group.items.length / 2))}, auto)` } : undefined}
        >
          {group.items.map((item) => (
            <GroupItemLink key={item.key} item={item} active={isNavItemActive(pathname, item)} />
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block w-full rounded-md px-4 py-2.5 text-left text-base font-medium transition-colors',
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
  );

export function Header() {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const pageWidth = useSelector(selectPageWidth);
  const isSupabaseEnabled = useSelector(selectAuthIsConfigured);
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const entries = getNavEntries(isSupabaseEnabled);
  const activeGroupKeys = entries.filter((e): e is NavGroup => e.kind === 'group' && isNavGroupActive(pathname, e)).map((g) => g.key);

  const handleThemeToggle = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="relative z-50 border-b bg-card">
      {/*
        Same frame as <main> (Page width setting), so in Wide and Full the logo and the icons line up with the page edges.
        The frame is the `header` size container: the `@desktop-nav/header:` classes swap the hamburger for the desktop nav
        when this row really has the room. A viewport breakpoint cannot do it: the row's content grows with the Text size
        setting, and a media query's rem ignores that setting.
      */}
      <div className={cn(APP_FRAME_CLASS[pageWidth], '@container/header')}>
        <div className="flex h-14 items-center gap-3 px-4 @desktop-nav/header:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 @desktop-nav/header:hidden"
            onClick={() => {
              setMobileMenuOpen(true);
            }}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <Link to="/" className="shrink-0 text-lg font-bold">
            D2R ESR
          </Link>

          <NavigationMenu viewport={false} aria-label="Main" className="hidden max-w-none flex-1 justify-start @desktop-nav/header:flex">
            <NavigationMenuList className="justify-start">
              {entries.map((entry) => {
                if (entry.kind === 'group') return <DesktopGroup key={entry.key} group={entry} pathname={pathname} />;
                const active = isNavItemActive(pathname, entry.item);
                return (
                  <NavigationMenuItem key={entry.item.key}>
                    <NavigationMenuLink asChild active={active}>
                      <Link to={entry.item.to} className={cn(TAB_BASE, 'block whitespace-nowrap', active ? TAB_ACTIVE : TAB_INACTIVE)}>
                        {entry.item.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          {/* While the nav is hidden, this spacer right-aligns the controls. */}
          <div className="flex-1 @desktop-nav/header:hidden" aria-hidden />

          <div className="flex shrink-0 items-center gap-1">
            <GlobalSearch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden @desktop-nav/header:inline-flex"
                  aria-label="ESR and community links"
                  title="ESR links"
                >
                  <BookOpen className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {OFFICIAL_LINKS.map((link) => (
                  <DropdownMenuItem key={link.key} asChild>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={DROPDOWN_LINK_CLASS}>
                      {link.label}
                      <ExternalLink className="size-3" />
                    </a>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Community tools</DropdownMenuLabel>
                {COMMUNITY_TOOLS.map((tool) => (
                  <DropdownMenuItem key={tool.key} asChild>
                    <a href={tool.href} target="_blank" rel="noopener noreferrer" className={DROPDOWN_LINK_CLASS}>
                      {tool.label}
                      <ExternalLink className="size-3" />
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <PageWidthMenu />
            <Button variant="ghost" size="icon" onClick={handleThemeToggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            {/* GitHub and the sign-in control live in the sheet when a phone row has no room for them. */}
            <Button variant="ghost" size="icon" className="hidden @md/header:inline-flex" asChild aria-label="View source on GitHub">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GitHubIcon className="size-5" />
              </a>
            </Button>
            <div className="hidden @md/header:contents">
              <AuthControls />
            </div>
            <Button variant="ghost" size="icon" onClick={() => dispatch(openDrawer())} aria-label="Open settings">
              <Settings className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      <GroupPagesBar />

      {/* Mobile navigation: the same groups as an accordion (the active route's group starts open). */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav aria-label="Main" className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
            <Accordion type="multiple" defaultValue={activeGroupKeys}>
              {entries.map((entry) =>
                entry.kind === 'group' ? (
                  <AccordionItem key={entry.key} value={entry.key}>
                    <AccordionTrigger
                      className={cn(
                        'px-4 py-3 text-base hover:no-underline',
                        activeGroupKeys.includes(entry.key) ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {entry.label}
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-0.5 pb-2 pl-3">
                      {entry.items.map((item) => (
                        <NavLink
                          key={item.key}
                          to={item.to}
                          end={item.exact === true}
                          className={mobileNavLinkClass}
                          onClick={closeMobileMenu}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  <NavLink
                    key={entry.item.key}
                    to={entry.item.to}
                    end={entry.item.exact === true}
                    className={(state) => cn(mobileNavLinkClass(state), 'mt-1 py-3')}
                    onClick={closeMobileMenu}
                  >
                    {entry.item.label}
                  </NavLink>
                )
              )}
            </Accordion>
            <div className="mt-2 border-t pt-2">
              {OFFICIAL_LINKS.map((link) => (
                <a key={link.key} href={link.href} target="_blank" rel="noopener noreferrer" className={MOBILE_EXTERNAL_LINK_CLASS}>
                  {link.label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
              <p className="px-4 pt-2 text-xs font-medium text-muted-foreground">Community tools</p>
              {COMMUNITY_TOOLS.map((tool) => (
                <a key={tool.key} href={tool.href} target="_blank" rel="noopener noreferrer" className={MOBILE_EXTERNAL_LINK_CLASS}>
                  {tool.label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={MOBILE_EXTERNAL_LINK_CLASS}>
                Source on GitHub
                <ExternalLink className="size-3" />
              </a>
            </div>
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
