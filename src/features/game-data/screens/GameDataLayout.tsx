import { Outlet, useLocation } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { getActiveNavItem } from '@/core/navigation/navConfig';
import { GameDataVersionBanner } from '../components/GameDataVersionBanner';

/** The shared frame of the Game Data pages; the heading is the menu label of the current page. */
export function GameDataLayout() {
  const { pathname } = useLocation();
  return (
    <PageShell title={getActiveNavItem(pathname)?.label ?? 'Game Data'}>
      <GameDataVersionBanner />
      <Outlet />
    </PageShell>
  );
}
