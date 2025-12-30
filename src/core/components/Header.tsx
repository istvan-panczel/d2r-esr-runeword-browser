import { NavLink } from 'react-router-dom';
import { Settings, Sun, Moon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openDrawer, selectTheme, setTheme } from '@/features/settings';

export function Header() {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);

  const handleThemeToggle = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-3 py-2 text-sm font-medium rounded-md transition-colors',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">D2R ESR</span>
          <nav className="flex gap-1">
            <NavLink to="/" className={navLinkClass} end>
              Runewords
            </NavLink>
            <NavLink to="/socketables" className={navLinkClass}>
              Socketables
            </NavLink>
            <NavLink to="/uniques" className={navLinkClass}>
              Uniques
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleThemeToggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => dispatch(openDrawer())} aria-label="Open settings">
            <Settings className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
