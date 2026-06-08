import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BuildWithAuthor } from '../types';
import { buildExportFilename, buildExportPayload } from '../utils/buildExport';

interface ExportBuildButtonProps {
  readonly build: BuildWithAuthor;
}

/** Header action: opens a modal and downloads the build as a raw .json file. */
export function ExportBuildButton({ build }: ExportBuildButtonProps) {
  const [open, setOpen] = useState(false);

  const handleDownload = () => {
    const payload = buildExportPayload(build, window.location.href, new Date().toISOString());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildExportFilename(build);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Download className="size-4" />
        Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export build as JSON</DialogTitle>
            <DialogDescription>
              This downloads a raw JSON snapshot of the entire build — its gear, notes, charms, and metadata — so you can keep your own
              copy. It’s a plain export for safekeeping, not an import format.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button onClick={handleDownload}>
              <Download className="size-4" />
              Download JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
