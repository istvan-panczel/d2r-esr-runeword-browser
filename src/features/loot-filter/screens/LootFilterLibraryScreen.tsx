import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FilePlus2, Filter, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { LibraryEntryCard } from '../components/LibraryEntryCard';
import { NameDialog } from '../components/NameDialog';
import { createBlank, duplicate, importText, remove, rename } from '../store/lootFilterSlice';
import { selectLibraryEntries, selectLibraryHydrated } from '../store/selectors';
import type { LootFilterEntry } from '../store/types';
import { checkFilterText, fileBaseName, importDescription } from '../utils/readFilterText';
import { TEMPLATE_CREDIT, TEMPLATE_NAME, fetchTemplateText } from '../utils/template';

const CODE = 'rounded bg-muted px-1 py-0.5 text-xs';

type NameDialogState = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly entry: LootFilterEntry } | null;

export function LootFilterLibraryScreen() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const hydrated = useSelector(selectLibraryHydrated);
  const entries = useSelector(selectLibraryEntries);
  const fileInput = useRef<HTMLInputElement>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  // The entry being deleted stays set while the dialog closes, so its text does not change during the animation.
  const [pendingDelete, setPendingDelete] = useState<LootFilterEntry | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreate = (name: string) => {
    const action = createBlank(name);
    dispatch(action);
    setNameDialog(null);
    void navigate(`/loot-filters/${action.payload.id}`);
  };

  const handleUpload = async (file: File) => {
    const text = await file.text();
    const check = checkFilterText(text);
    if (!check.ok) {
      toast.error(`Could not read ${file.name}`, { description: check.message });
      return;
    }
    const action = importText({ name: check.title ?? fileBaseName(file.name), text, source: 'upload' });
    dispatch(action);
    const problems = check.diagnostics.length + check.notes.length;
    toast.success(`Imported ${file.name}`, {
      description: importDescription(problems, check.notes),
    });
    void navigate(`/loot-filters/${action.payload.id}`);
  };

  const handleTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const text = await fetchTemplateText();
      const check = checkFilterText(text);
      if (!check.ok) throw new Error(check.message);
      const action = importText({ name: TEMPLATE_NAME, text, source: 'template' });
      dispatch(action);
      void navigate(`/loot-filters/${action.payload.id}`);
    } catch (error) {
      console.error('[Loot filters] Could not load the template', error);
      toast.error(`Could not load ${TEMPLATE_NAME}`, { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b pb-4">
        <h1 className="text-2xl font-bold">Loot Filters</h1>
        <div className="max-w-3xl space-y-2 text-sm text-muted-foreground">
          <p>
            Create and edit filters for ESR&apos;s loot filter plugin. Filters are saved in this browser only; download a filter to use it
            in the game. The launcher already gives every player Sully&apos;s QoL filter; start from a copy of it to change its rules.
          </p>
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleTemplate()} disabled={!hydrated || loadingTemplate}>
            {loadingTemplate ? <Spinner /> : <Sparkles />}
            Start from Sully&apos;s QoL filter
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!hydrated}>
            <Upload />
            Upload
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNameDialog({ kind: 'new' });
            }}
            disabled={!hydrated}
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
              if (file) void handleUpload(file);
            }}
          />
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> most players start from Sully&apos;s QoL filter, or upload a filter
          someone shared, and change what they need. A new filter starts blank, with no rules, so every item shows as the game shows it;
          start there only if you know the format. The Rules tab has example rules to add either way.
        </p>
        <p className="text-xs text-muted-foreground">{TEMPLATE_CREDIT}.</p>
      </div>

      {!hydrated ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="mx-auto max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Filter className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No filters yet</p>
            <p className="text-sm text-muted-foreground">
              Begin from Sully&apos;s QoL filter (recommended), upload one you already have, or start a blank filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((entry) => (
            <LibraryEntryCard
              key={entry.id}
              entry={entry}
              onDuplicate={() => dispatch(duplicate(entry.id))}
              onRename={() => {
                setNameDialog({ kind: 'rename', entry });
              }}
              onDelete={() => {
                setPendingDelete(entry);
                setDeleteOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <NameDialog
        open={nameDialog !== null}
        onOpenChange={(open) => {
          if (!open) setNameDialog(null);
        }}
        title={nameDialog?.kind === 'rename' ? 'Rename filter' : 'New filter'}
        description={
          nameDialog?.kind === 'rename'
            ? undefined
            : "A blank filter with no rules. The name also becomes the filter's title (Settings tab), which the launcher shows."
        }
        initialName={nameDialog?.kind === 'rename' ? nameDialog.entry.name : 'My filter'}
        submitLabel={nameDialog?.kind === 'rename' ? 'Rename' : 'Create'}
        onSubmit={(name) => {
          if (nameDialog?.kind === 'rename') {
            dispatch(rename({ id: nameDialog.entry.id, name }));
            setNameDialog(null);
          } else handleCreate(name);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        name={pendingDelete?.name ?? null}
        onCancel={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (pendingDelete) dispatch(remove(pendingDelete.id));
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
