import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Download, FileArchive, FileBraces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { downloadFilterZip, downloadTextFile, filterFileName } from '../utils/download';
import type { ReferencedAssets } from '../utils/referencedAssets';

const MISSING_SHOWN = 4;

interface FilterDownloadMenuProps {
  /** The library name the file names come from. */
  readonly name: string;
  /** The file text, read when a download starts. */
  readonly getText: () => string;
  readonly assets: ReferencedAssets;
  readonly variant?: 'default' | 'outline';
  /** Called when a download starts (the shared download count). */
  readonly onDownload?: () => void;
}

/**
 * Download: the filter file alone, or (when the filter uses bundled sounds or icons) a zip with the filter and
 * its `sounds`/`icons` folders, since the launcher's Import copies only the filter file.
 */
export function FilterDownloadMenu({ name, getText, assets, variant = 'default', onDownload }: FilterDownloadMenuProps) {
  const [zipping, setZipping] = useState(false);

  const downloadJson = () => {
    downloadTextFile(filterFileName(name), getText());
    onDownload?.();
  };

  if (assets.bundled.length === 0) {
    return (
      <Button size="sm" variant={variant} onClick={downloadJson}>
        <Download />
        Download
      </Button>
    );
  }

  const downloadZip = async () => {
    setZipping(true);
    try {
      await downloadFilterZip(name, getText(), assets.bundled);
      onDownload?.();
    } catch (error) {
      console.error('[Loot filters] Could not build the zip', error);
      toast.error('Could not download the sounds and icons', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setZipping(false);
    }
  };

  const shownMissing = assets.missing.slice(0, MISSING_SHOWN);
  const moreMissing = assets.missing.length - shownMissing.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={variant} disabled={zipping}>
          {zipping ? <Spinner /> : <Download />}
          Download
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-72">
        <DropdownMenuItem onSelect={downloadJson}>
          <FileBraces />
          Download .json
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadZip()}>
          <FileArchive />
          Download .zip with sounds and icons
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="space-y-1 px-2 py-1.5 text-xs text-muted-foreground">
          <p>Unzip into your LootFilters folder: the filter goes next to its sounds and icons folders.</p>
          {shownMissing.length > 0 && (
            <p>
              Not bundled, add them yourself: <span className="break-all font-mono">{shownMissing.join(', ')}</span>
              {moreMissing > 0 && ` and ${String(moreMissing)} more`}.
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
