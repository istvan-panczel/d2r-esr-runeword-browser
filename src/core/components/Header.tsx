import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Settings, Sun, Moon, ExternalLink, Menu } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { openDrawer, selectTheme, setTheme } from '@/features/settings';

const ESR_DOCS_URL = 'https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/';
const GITHUB_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser';

const NAV_ITEMS = [
  { to: '/', label: 'Runewords', end: true },
  { to: '/socketables', label: 'Socketables', end: false },
  { to: '/uniques', label: 'Uniques', end: false },
] as const;

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleThemeToggle = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-3 py-2 text-sm font-medium rounded-md transition-colors',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-4 py-3 text-base font-medium rounded-md transition-colors',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4 md:gap-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {
              setMobileMenuOpen(true);
            }}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <span className="text-lg font-bold">D2R ESR</span>
          <nav className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.end}>
                {item.label}
              </NavLink>
            ))}
            <a
              href={ESR_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              ESR Documentation
              <ExternalLink className="size-3" />
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleThemeToggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="View source on GitHub">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GitHubIcon className="size-5" />
            </a>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => dispatch(openDrawer())} aria-label="Open settings">
            <Settings className="size-5" />
          </Button>
        </div>
      </div>

      {/* Mobile navigation menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <SheetClose key={item.to} asChild>
                <NavLink to={item.to} className={mobileNavLinkClass} end={item.end}>
                  {item.label}
                </NavLink>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <a
                href={ESR_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 text-base font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <span className="inline-flex items-center gap-1">
                  ESR Documentation
                  <ExternalLink className="size-3" />
                </span>
              </a>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
