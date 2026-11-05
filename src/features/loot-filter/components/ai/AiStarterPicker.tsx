import { useRef } from 'react';
import { BookOpenCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { LootFilterEntry } from '../../store/types';
import { parseStarterChoice, starterChoiceValue, type AiOpenFilter, type AiStarterChoice } from '../../utils/aiStarter';
import { BUNDLED_TEMPLATE_LIST } from '../../utils/template';

const TEMPLATE_IDS = BUNDLED_TEMPLATE_LIST.map((template) => template.id);

/** The example rules dialog's intro when it picks the AI starter (Pick example rules); the editor has its own. */
export const AI_STARTER_EXAMPLES_INTRO =
  'Tick the rules your filter should start from; the AI keeps them and extends them into a full filter. Each ticked rule shows its style, sound, minimap icon and chat line, ready to change. Sounds and icons come with the app’s .zip download.';

interface AiStarterPickerProps {
  readonly choice: AiStarterChoice;
  readonly onChoiceChange: (choice: AiStarterChoice) => void;
  /** The filter "Improve with AI" brought from the editor, if any. */
  readonly openFilter: AiOpenFilter | null;
  readonly drafts: readonly LootFilterEntry[];
  /** The uploaded file's name, once one is uploaded. */
  readonly uploadName: string | null;
  readonly onUpload: (file: File) => void;
  /** How many example rules were picked as a starter, once some were. */
  readonly rulesCount: number | null;
  /** Opens the example rules picker (on the previous selection, if any). */
  readonly onPickRules: () => void;
  /** What the chosen starter is: "223 rules", a spinner while a template loads, or why it cannot be used. */
  readonly status:
    { readonly kind: 'ready'; readonly text: string } | { readonly kind: 'loading' } | { readonly kind: 'error'; readonly text: string };
}

/**
 * The starter of the AI page: none, a bundled template, the filter from the editor, a draft of this browser, an
 * uploaded file or example rules picked in the example rules dialog. Like the upload, the picked rules stay in the list
 * when another starter is chosen, and the button reopens the picker on them to change the set.
 */
export function AiStarterPicker({
  choice,
  onChoiceChange,
  openFilter,
  drafts,
  uploadName,
  onUpload,
  rulesCount,
  onPickRules,
  status,
}: AiStarterPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label htmlFor="loot-filter-ai-starter">Start from</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={starterChoiceValue(choice)}
          onValueChange={(value) => {
            onChoiceChange(parseStarterChoice(value, TEMPLATE_IDS));
          }}
        >
          <SelectTrigger id="loot-filter-ai-starter" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nothing: a new filter</SelectItem>
            {openFilter !== null && (
              <SelectGroup>
                <SelectLabel>From the editor</SelectLabel>
                <SelectItem value="open">{openFilter.name} (the filter you came from)</SelectItem>
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel>Bundled filters</SelectLabel>
              {BUNDLED_TEMPLATE_LIST.map((template) => (
                <SelectItem key={template.id} value={`template:${template.id}`}>
                  {template.name} v{template.version}
                </SelectItem>
              ))}
            </SelectGroup>
            {drafts.length > 0 && (
              <SelectGroup>
                <SelectLabel>Your drafts in this browser</SelectLabel>
                {drafts.map((entry) => (
                  <SelectItem key={entry.id} value={`entry:${entry.id}`}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {rulesCount !== null && (
              <SelectGroup>
                <SelectLabel>Picked example rules</SelectLabel>
                <SelectItem value="rules">
                  {rulesCount} example {rulesCount === 1 ? 'rule' : 'rules'}
                </SelectItem>
              </SelectGroup>
            )}
            {uploadName !== null && (
              <SelectGroup>
                <SelectLabel>Uploaded</SelectLabel>
                <SelectItem value="upload">{uploadName}</SelectItem>
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onPickRules}>
          <BookOpenCheck />
          {rulesCount === null ? 'Pick example rules' : 'Change example rules'}
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          <Upload />
          Upload .json
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onUpload(file);
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {status.kind === 'loading' ? (
          <span className="inline-flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            Loading…
          </span>
        ) : status.kind === 'error' ? (
          <span className="text-destructive">{status.text}</span>
        ) : (
          status.text
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        To start from one of your saved filters, open it in the editor and choose Improve with AI. The AI keeps what you do not ask it to
        change.
      </p>
    </div>
  );
}
