import { Outlet } from 'react-router-dom';
import { Header } from '@/core/components/Header';
import { SettingsDrawer } from '@/core/components/SettingsDrawer';

export function AppLayout() {
  return (
    <div className="min-h-svh flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto p-4">
        <Outlet />
      </main>
      <SettingsDrawer />
    </div>
  );
}
