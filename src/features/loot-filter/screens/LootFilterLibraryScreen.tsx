import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Globe, UserRound } from 'lucide-react';
import { ToolbarCard } from '@/components/ToolbarCard';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RootState } from '@/core/store';
import { selectAuthInitialized, selectAuthIsConfigured, selectAuthUserId } from '@/features/auth';
import { MyFiltersTab } from '../components/library/MyFiltersTab';
import { SharedFiltersTab } from '../components/library/SharedFiltersTab';
import { SharedFiltersToolbar } from '../components/library/SharedFiltersToolbar';
import { selectLibraryHydrated, selectVisibleDrafts } from '../store/selectors';
import { resolveLibraryTab, type LibraryTab } from '../utils/library';

const CODE = 'rounded bg-muted px-1 py-0.5 text-xs';
/** The Shared / My filters switch on the toolbar card: the active one filled like the page sub-tabs (`SUBTAB_ACTIVE`). */
const TRIGGER =
  'px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground';

/** How long the library waits for the sign-in state before treating the visitor as signed out. */
const AUTH_WAIT_MS = 4000;

export function LootFilterLibraryScreen() {
  const sharingEnabled = useSelector(selectAuthIsConfigured);
  const authInitialized = useSelector(selectAuthInitialized);
  const viewerId = useSelector(selectAuthUserId);
  const libraryHydrated = useSelector(selectLibraryHydrated);
  const hasLocalDrafts = useSelector((state: RootState) => selectVisibleDrafts(state, viewerId).length > 0);
  const [searchParams, setSearchParams] = useSearchParams();
  // The local drafts never wait on the sign-in state: if it does not arrive, the page goes on as signed out.
  const [authWaitOver, setAuthWaitOver] = useState(false);
  useEffect(() => {
    if (authInitialized) return;
    const timer = window.setTimeout(() => {
      setAuthWaitOver(true);
    }, AUTH_WAIT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [authInitialized]);
  const tab = resolveLibraryTab(searchParams.get('tab'), {
    authKnown: authInitialized || authWaitOver,
    signedIn: viewerId !== null,
    libraryHydrated,
    hasLocalDrafts,
  });

  const setTab = (next: LibraryTab) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Loot Filters</h1>
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm [&>p]:max-w-4xl">
          {sharingEnabled ? (
            <p>
              Create and edit filters for ESR&apos;s loot filter plugin, and browse the ones other players share. A filter stays in this
              browser until you save it to your account; saved filters are public unless you mark them private. Download a filter to use it
              in the game. The launcher already gives every player Sully&apos;s QoL filter; start from a copy of it to change its rules.
            </p>
          ) : (
            <p>
              Create and edit filters for ESR&apos;s loot filter plugin. Filters are saved in this browser only; download a filter to use it
              in the game. The launcher already gives every player Sully&apos;s QoL filter; start from a copy of it to change its rules.
            </p>
          )}
          <p>
            In the ESR launcher, open the <span className="font-medium text-foreground">Loot Filter</span> tab and choose{' '}
            <span className="font-medium text-foreground">Import</span> with the downloaded file. Your filters live in{' '}
            <code className={CODE}>{'<Saved Games>\\Diablo II Resurrected\\mods\\<mod>\\LootFilters\\'}</code>; sound files go in a{' '}
            <code className={CODE}>sounds</code> folder and minimap icons in an <code className={CODE}>icons</code> folder next to the
            filter. Import copies only the filter file, so when a filter uses the bundled sounds or icons, choose{' '}
            <span className="font-medium text-foreground">Download .zip with sounds and icons</span> and unzip it into your LootFilters
            folder.
          </p>
          <p>
            If a sound or icon does not work, check the <code className={CODE}>sounds</code>/<code className={CODE}>icons</code> folders
            next to the filter; if chat lines do not print, first check that the launcher&apos;s chat notifications are on (Enable chat
            notifications), then run <code className={CODE}>lootfilter</code> in the game console and read{' '}
            <code className={CODE}>{'d2rloader\\logs\\celestialrayone.loot-filter.log'}</code> (set{' '}
            <code className={CODE}>debug_log = true</code> in the plugin&apos;s TOML to log every chat line).
          </p>
        </div>
      </div>

      {!sharingEnabled ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Sharing is off in this build of the site: filters are kept in this browser only.</p>
          <MyFiltersTab sharingEnabled={false} viewerId={null} />
        </div>
      ) : tab === null ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" />
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === 'shared' || value === 'mine') setTab(value);
          }}
          className="gap-4"
        >
          <ToolbarCard className="flex flex-wrap items-center gap-x-4 gap-y-2 space-y-0">
            <TabsList>
              <TabsTrigger value="shared" className={TRIGGER}>
                <Globe />
                Shared
              </TabsTrigger>
              <TabsTrigger value="mine" className={TRIGGER}>
                <UserRound />
                My filters
              </TabsTrigger>
            </TabsList>
            {tab === 'shared' && <SharedFiltersToolbar />}
          </ToolbarCard>
          <TabsContent value="shared">
            <SharedFiltersTab />
          </TabsContent>
          <TabsContent value="mine">
            <MyFiltersTab sharingEnabled viewerId={viewerId} authPending={!authInitialized} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
