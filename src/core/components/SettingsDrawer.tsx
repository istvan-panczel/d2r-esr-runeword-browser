import { useSelector, useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/core/db';
import { useDocsDataLine } from '@/core/hooks/useDocsDataLine';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import {
  selectIsDrawerOpen,
  closeDrawer,
  setTheme,
  selectTheme,
  setTextSize,
  selectTextSize,
  setUseDiabloFont,
  selectUseDiabloFont,
  setPageWidth,
  selectPageWidth,
  PAGE_WIDTH_OPTIONS,
  type TextSize,
} from '@/features/settings';
import { initDataLoad, selectIsLoading, selectNetworkWarning, selectIsUsingCachedData } from '@/core/store';
import appVersion from '@/assets/version.json';
import { ESR_DOCS_URL, GITHUB_URL } from '@/core/navigation/navConfig';

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
  const pageWidth = useSelector(selectPageWidth);
  const isLoading = useSelector(selectIsLoading);
  const networkWarning = useSelector(selectNetworkWarning);
  const isUsingCachedData = useSelector(selectIsUsingCachedData);
  const textSizeIndex = TEXT_SIZE_VALUES.indexOf(textSize);

  const docs = useDocsDataLine();
  const manifest = useManifest();

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
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-0 space-y-5 flex-1 overflow-y-auto px-4 pb-2">
          {/* Network Warning */}
          {networkWarning ? (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
              <p className="text-sm text-warning">{networkWarning}</p>
            </div>
          ) : null}

          {/* Theme Section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">Theme</legend>
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
          </fieldset>

          {/* Font Section */}
          <div className="space-y-3">
            <Label htmlFor="settings-diablo-font" className="text-sm font-medium">
              Font
            </Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="settings-diablo-font"
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
            <Slider
              value={[textSizeIndex]}
              onValueChange={handleTextSizeChange}
              min={0}
              max={3}
              step={1}
              className="w-full"
              thumbProps={{ 'aria-label': 'Text size', 'aria-valuetext': TEXT_SIZE_LABELS[textSizeIndex] }}
            />
            <p className="text-sm text-muted-foreground text-center">{TEXT_SIZE_LABELS[textSizeIndex]}</p>
          </div>

          {/* Page Width Section (also the header's width menu, md and up) */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium leading-none">Page width</legend>
            <div className="space-y-2">
              {PAGE_WIDTH_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pageWidth"
                    checked={pageWidth === option.value}
                    onChange={() => {
                      dispatch(setPageWidth(option.value));
                    }}
                    className="accent-primary"
                  />
                  <span>
                    {option.label}
                    {option.value === 'standard' && ' (default)'}
                    <span className="text-muted-foreground"> · {option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">How wide the pages may grow on large monitors.</p>
          </fieldset>

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
            {manifest !== null && (
              <p>
                Game files: ESR {manifest.esrVersion} (generated {manifest.generatedAt.slice(0, 10)})
              </p>
            )}
            {docs.line !== null && <p>{docs.line}</p>}
            <p>Last updated: {lastUpdated}</p>
            {isUsingCachedData ? <p className="text-warning">Using cached data</p> : null}
          </div>

          {/* Credits */}
          <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
            <p className="font-medium">Credits</p>
            <p>
              <a
                href={ESR_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                Eastern Sun Resurrected
              </a>{' '}
              by Celestialray
            </p>
            <p>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                Source code on GitHub
              </a>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
