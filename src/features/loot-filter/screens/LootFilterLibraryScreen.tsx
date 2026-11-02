import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Globe, UserRound } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { selectAuthInitialized, selectAuthIsConfigured, selectAuthUserId } from '@/features/auth';
import { MyFiltersTab } from '../components/library/MyFiltersTab';
import { SharedFiltersTab } from '../components/library/SharedFiltersTab';
import { resolveLibraryTab, type LibraryTab } from '../utils/library';

const CODE = 'rounded bg-muted px-1 py-0.5 text-xs';

export function LootFilterLibraryScreen() {
  const sharingEnabled = useSelector(selectAuthIsConfigured);
  const authInitialized = useSelector(selectAuthInitialized);
  const viewerId = useSelector(selectAuthUserId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveLibraryTab(searchParams.get('tab'), authInitialized, viewerId !== null);

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
      <div className="space-y-3 border-b pb-4">
        <h1 className="text-2xl font-bold">Loot Filters</h1>
        <div className="max-w-3xl space-y-2 text-sm text-muted-foreground">
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
            next to the filter; if chat lines do not print, run <code className={CODE}>lootfilter</code> in the game console and read{' '}
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
          <TabsList>
            <TabsTrigger value="shared" className="px-3">
              <Globe />
              Shared
            </TabsTrigger>
            <TabsTrigger value="mine" className="px-3">
              <UserRound />
              My filters
            </TabsTrigger>
          </TabsList>
          <TabsContent value="shared">
            <SharedFiltersTab />
          </TabsContent>
          <TabsContent value="mine">
            <MyFiltersTab sharingEnabled viewerId={viewerId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
