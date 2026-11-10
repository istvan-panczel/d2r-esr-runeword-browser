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

/** One of the signed-in user's saved filters in the list (its file is fetched when it is picked). */
export interface AiSavedFilterOption {
  readonly id: string;
  readonly name: string;
  /** A draft in this browser holds unsaved changes to it (the draft is listed too). */
  readonly hasDraft: boolean;
}

/** The "My saved filters" group: signed out (not listed), loading, failed or the list. */
export type AiSavedFilters =
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly items: readonly AiSavedFilterOption[] };

/** The example rules dialog's intro when it picks the AI starter (Pick example rules); the editor has its own. */
export const AI_STARTER_EXAMPLES_INTRO =
  'Tick the rules your filter should start from; the AI keeps them and extends them into a full filter. Each ticked rule shows its style, sound, minimap icon and chat line, ready to change. Sounds and icons come with the app’s .zip download.';

interface AiStarterPickerProps {
  readonly choice: AiStarterChoice;
  readonly onChoiceChange: (choice: AiStarterChoice) => void;
  /** The filter "Improve with AI" brought from the editor, if any. */
  readonly openFilter: AiOpenFilter | null;
  readonly drafts: readonly LootFilterEntry[];
  readonly savedFilters: AiSavedFilters;
  /** The uploaded file's name, once one is uploaded. */
  readonly uploadName: string | null;
  readonly onUpload: (file: File) => void;
  /** How many example rules were picked as a starter, once some were. */
  readonly rulesCount: number | null;
  /** Opens the example rules picker (on the previous selection, if any). */
  readonly onPickRules: () => void;
  /** What the chosen starter is: "223 rules", a spinner while a file loads, or why it cannot be used. */
  readonly status: AiStarterStatus;
  /** Shown with an error status when the starter can be fetched again (a saved filter whose fetch failed). */
  readonly onRetry?: () => void;
}

export type AiStarterStatus =
  { readonly kind: 'ready'; readonly text: string } | { readonly kind: 'loading' } | { readonly kind: 'error'; readonly text: string };

/**
 * The starter of the AI page: none, a bundled template, the filter from the editor, a draft of this browser, a saved
 * filter of the signed-in user, an uploaded file or example rules picked in the example rules dialog. Like the upload, the picked rules stay in the list
 * when another starter is chosen, and the button reopens the picker on them to change the set.
 */
export function AiStarterPicker({
  choice,
  onChoiceChange,
  openFilter,
  drafts,
  savedFilters,
  uploadName,
  onUpload,
  rulesCount,
  onPickRules,
  status,
  onRetry,
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
                  {template.name}
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
            {savedFilters.kind !== 'signedOut' && (
              <SelectGroup>
                <SelectLabel>My saved filters</SelectLabel>
                {savedFilters.kind === 'loading' ? (
                  <SelectItem value="saved-loading" disabled>
                    Loading your saved filters…
                  </SelectItem>
                ) : savedFilters.kind === 'error' ? (
                  <SelectItem value="saved-error" disabled>
                    Your saved filters could not be loaded
                  </SelectItem>
                ) : savedFilters.items.length === 0 ? (
                  <SelectItem value="saved-none" disabled>
                    No saved filters yet
                  </SelectItem>
                ) : (
                  savedFilters.items.map((item) => (
                    <SelectItem key={item.id} value={`saved:${item.id}`}>
                      {item.name}
                      {item.hasDraft && <span className="text-muted-foreground"> (saved version; a draft has changes)</span>}
                    </SelectItem>
                  ))
                )}
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
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-destructive">{status.text}</span>
            {onRetry !== undefined && (
              <Button variant="outline" size="sm" className="h-7" onClick={onRetry}>
                Try again
              </Button>
            )}
          </span>
        ) : (
          status.text
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {savedFilters.kind === 'signedOut'
          ? 'Your saved filters are listed here once you sign in; or open one in the editor and choose Improve with AI.'
          : 'A saved filter starts from its last saved version; unsaved changes are in its draft.'}{' '}
        The AI keeps what you do not ask it to change.
      </p>
    </div>
  );
}
