import { useSelector, useDispatch } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/core/db';
import { selectIsDrawerOpen, closeDrawer, setTheme, selectTheme, setTextSize, selectTextSize, type TextSize } from '@/features/settings';
import { initDataLoad, selectIsLoading } from '@/core/store';

const TEXT_SIZE_LABELS = ['Small', 'Normal', 'Large', 'Extra Large'] as const;
const TEXT_SIZE_VALUES: TextSize[] = ['small', 'normal', 'large', 'extralarge'];

export function SettingsDrawer() {
  const dispatch = useDispatch();
  const isOpen = useSelector(selectIsDrawerOpen);
  const theme = useSelector(selectTheme);
  const textSize = useSelector(selectTextSize);
  const isLoading = useSelector(selectIsLoading);

  const textSizeIndex = TEXT_SIZE_VALUES.indexOf(textSize);

  // Live query for metadata
  const version = useLiveQuery(async () => {
    const meta = await db.metadata.get('esrVersion');
    return meta?.value ?? 'Unknown';
  });

  const lastUpdated = useLiveQuery(async () => {
    const meta = await db.metadata.get('lastUpdated');
    return meta?.value ?? 'Never';
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

          {/* Text Size Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Text Size</Label>
            <Slider value={[textSizeIndex]} onValueChange={handleTextSizeChange} min={0} max={3} step={1} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">{TEXT_SIZE_LABELS[textSizeIndex]}</p>
          </div>

          {/* Data Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data</Label>
            <Button onClick={() => dispatch(initDataLoad())} disabled={isLoading} className="w-full">
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>

          {/* Info Section */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Version: {version}</p>
            <p>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
