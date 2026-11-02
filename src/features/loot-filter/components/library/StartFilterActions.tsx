import { useRef, useState } from 'react';
import { FilePlus2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useStartFilter } from '../../hooks/useStartFilter';
import { TEMPLATE_CREDIT } from '../../utils/template';
import { NameDialog } from '../NameDialog';

interface StartFilterActionsProps {
  /** False until the library has been read from localStorage. */
  readonly ready: boolean;
}

/** New / Upload / Start from Sully's (each makes a draft and opens it), with the tip on where to start. */
export function StartFilterActions({ ready }: StartFilterActionsProps) {
  const { createNew, upload, startFromTemplate, loadingTemplate } = useStartFilter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void startFromTemplate()} disabled={!ready || loadingTemplate}>
          {loadingTemplate ? <Spinner /> : <Sparkles />}
          Start from Sully&apos;s QoL filter
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!ready}>
          <Upload />
          Upload
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setNewOpen(true);
          }}
          disabled={!ready}
        >
          <FilePlus2 />
          New filter
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tip:</span> most players start from Sully&apos;s QoL filter, or upload a filter
        someone shared, and change what they need. A new filter starts blank, with no rules, so every item shows as the game shows it; start
        there only if you know the format. The Rules tab has example rules to add either way.
      </p>
      <p className="text-xs text-muted-foreground">{TEMPLATE_CREDIT}.</p>

      <NameDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title="New filter"
        description="A blank filter with no rules. The name also becomes the filter's title (Settings tab), which the launcher shows."
        initialName="My filter"
        submitLabel="Create"
        onSubmit={(name) => {
          setNewOpen(false);
          createNew(name);
        }}
      />
    </div>
  );
}
