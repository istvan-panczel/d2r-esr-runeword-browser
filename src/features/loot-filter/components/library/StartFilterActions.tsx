import { useRef, useState } from 'react';
import { FilePlus2, GraduationCap, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useStartFilter } from '../../hooks/useStartFilter';
import { BUNDLED_TEMPLATE_LIST } from '../../utils/template';
import { NameDialog } from '../NameDialog';

interface StartFilterActionsProps {
  /** False until the library has been read from localStorage. */
  readonly ready: boolean;
}

/**
 * Start from Sully's (the primary button) / Start from the example / Upload / New (each makes a draft and opens it),
 * with the tip on where to start and the templates' credits.
 */
export function StartFilterActions({ ready }: StartFilterActionsProps) {
  const { createNew, upload, startFromTemplate, loadingTemplate } = useStartFilter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BUNDLED_TEMPLATE_LIST.map((template, index) => (
          <Button
            key={template.id}
            variant={index === 0 ? 'default' : 'outline'}
            onClick={() => void startFromTemplate(template.id)}
            disabled={!ready || loadingTemplate !== null}
          >
            {loadingTemplate === template.id ? <Spinner /> : index === 0 ? <Sparkles /> : <GraduationCap />}
            {template.startLabel}
          </Button>
        ))}
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
        <span className="font-medium text-foreground">Tip:</span> most players start from Sully&apos;s QoL filter for a full filter, or
        upload a filter someone shared, and change what they need. To learn how rules work, start from the example: a small filter whose
        every rule explains itself in its comment. A new filter starts blank, with no rules, so every item shows as the game shows it; start
        there only if you know the format. The Rules tab has example rules to add either way.
      </p>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {BUNDLED_TEMPLATE_LIST.map((template) => (
          <p key={template.id}>{template.credit}.</p>
        ))}
      </div>

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
