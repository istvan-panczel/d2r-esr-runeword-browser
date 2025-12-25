import { useSelector, useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/core/db';
import {
  selectIsDrawerOpen,
  closeDrawer,
  setTheme,
  selectTheme,
  setTextSize,
  selectTextSize,
  setUseDiabloFont,
  selectUseDiabloFont,
  type TextSize,
} from '@/features/settings';
import { initDataLoad, selectIsLoading, selectNetworkWarning, selectIsUsingCachedData } from '@/core/store';
import appVersion from '@/assets/version.json';

const TEXT_SIZE_LABELS = ['Small', 'Normal', 'Large', 'Extra Large'] as const;
const TEXT_SIZE_VALUES: TextSize[] = ['small', 'normal', 'large', 'extralarge'];

function formatLastUpdated(isoString: string | undefined): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Never';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function SettingsDrawer() {
  const dispatch = useDispatch();
  const isOpen = useSelector(selectIsDrawerOpen);
  const theme = useSelector(selectTheme);
  const textSize = useSelector(selectTextSize);
  const useDiabloFont = useSelector(selectUseDiabloFont);
  const isLoading = useSelector(selectIsLoading);
  const networkWarning = useSelector(selectNetworkWarning);
  const isUsingCachedData = useSelector(selectIsUsingCachedData);

  const textSizeIndex = TEXT_SIZE_VALUES.indexOf(textSize);

  // Live query for metadata
  const version = useLiveQuery(async () => {
    const meta = await db.metadata.get('esrVersion');
    return meta?.value ?? 'Unknown';
  });

  const lastUpdated = useLiveQuery(async () => {
    const meta = await db.metadata.get('lastUpdated');
    return formatLastUpdated(meta?.value);
  });

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    dispatch(setTheme(newTheme));
  };

  const handleTextSizeChange = (value: number[]) => {
    dispatch(setTextSize(TEXT_SIZE_VALUES[value[0]]));
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) dispatch(closeDrawer());
      }}
    >
      <SheetContent className="p-6">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Network Warning */}
          {networkWarning ? (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-500">{networkWarning}</p>
            </div>
          ) : null}

          {/* Theme Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Theme</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  checked={theme === 'dark'}
                  onChange={() => {
                    handleThemeChange('dark');
                  }}
                  className="accent-primary"
                />
                <span>Dark (default)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  checked={theme === 'light'}
                  onChange={() => {
                    handleThemeChange('light');
                  }}
                  className="accent-primary"
                />
                <span>Light</span>
              </label>
            </div>
          </div>

          {/* Font Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Font</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDiabloFont}
                onChange={(e) => {
                  dispatch(setUseDiabloFont(e.target.checked));
                }}
                className="accent-primary"
              />
              <span>Use Diablo 2 style font</span>
            </label>
          </div>

          {/* Text Size Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Text Size</Label>
            <Slider value={[textSizeIndex]} onValueChange={handleTextSizeChange} min={0} max={3} step={1} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">{TEXT_SIZE_LABELS[textSizeIndex]}</p>
          </div>

          {/* Data Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data</Label>
            <Button onClick={() => dispatch(initDataLoad({ force: true }))} disabled={isLoading} className="w-full">
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? 'Refreshing...' : 'Force Refresh Data'}
            </Button>
            <p className="text-xs text-muted-foreground">Re-downloads all data from ESR documentation.</p>
          </div>

          {/* Info Section */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>App Version: {appVersion.version}</p>
            <p>ESR Version: {version}</p>
            <p>Last updated: {lastUpdated}</p>
            {isUsingCachedData ? <p className="text-yellow-500">Using cached data</p> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
