import { Outlet } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';

/** Shared frame for every loot-filter route: the page width, then the page itself. */
export function LootFilterLayout() {
  return (
    <PageShell className="space-y-4">
      <Outlet />
    </PageShell>
  );
}
