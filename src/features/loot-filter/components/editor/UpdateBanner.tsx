import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Info, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { isSupabaseConfigured } from '@/core/supabase/config';
import { RequestState } from '@/core/types';
import { selectAuthUserId } from '@/features/auth';
import { fetchSourceFilterRequested, fetchSourceRevisionsRequested, selectSourceFilter, selectSourceRevisions } from '../../sharing';
import { takeUpdate } from '../../store/lootFilterSlice';
import type { LootFilterBasedOn } from '../../store/types';
import { sharedBasedOn, templateBasedOn } from '../../utils/basedOn';
import { authorLabelOf, sourceUpdateOf } from '../../utils/editorRoute';
import { BUNDLED_TEMPLATES, bundledTemplate } from '../../utils/template';
import { useTemplateSource } from '../../hooks/useTemplateSource';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';

interface UpdateBannerProps {
  /** What the open filter (a draft or the owner's saved filter) is based on. */
  readonly basedOn: LootFilterBasedOn | null;
  /** Replace with the latest would drop unsaved changes: ask first. */
  readonly hasUnsavedChanges: boolean;
  /**
   * Whether Replace with the latest is offered: a saved filter (or a draft of one), which Discard changes can take back
   * to the saved version. A never-saved draft is the only copy of its filter, so it only gets Add as a new filter.
   */
  readonly replaceable: boolean;
}

/**
 * "Update available" for a copy whose source has a newer revision (looked up when the filter opens), or a filter
 * started from an older version of a bundled template (Sully's, the example): Replace with the latest (as unsaved changes; saved filters only) or Add
 * as a new filter. A source that was deleted or made private reads "no longer shared" (dismissable).
 */
export function UpdateBanner({ basedOn, hasUnsavedChanges, replaceable }: UpdateBannerProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const viewerId = useSelector(selectAuthUserId);
  const revisions = useSelector(selectSourceRevisions);
  const sourceFilter = useSelector(selectSourceFilter);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const sourceId = basedOn?.id;
  // A template-based filter: the template's text in use (live or bundled). The banner announces its version and
  // Replace / Add take its text, so both come from the same source.
  const templateId = sourceId === undefined ? (bundledTemplate(basedOn?.template)?.id ?? null) : null;
  const templateState = useTemplateSource(templateId);
  const templateSource = templateState.status === 'ready' ? templateState.source : null;

  // Look the source up when the filter opens (and again for another viewer: private sources depend on who asks).
  useEffect(() => {
    if (!isSupabaseConfigured || sourceId === undefined) return;
    dispatch(fetchSourceRevisionsRequested([sourceId]));
  }, [dispatch, sourceId, viewerId]);

  const update = sourceUpdateOf(basedOn, revisions, templateSource === null ? {} : { [templateSource.id]: templateSource.version });
  const newerId = update.kind === 'shared' ? update.id : null;
  const newerRevision = update.kind === 'shared' ? update.revision : null;

  // A newer shared version: fetch its file now so the buttons act at once.
  useEffect(() => {
    if (newerId === null) return;
    dispatch(fetchSourceFilterRequested(newerId));
  }, [dispatch, newerId, newerRevision]);

  if (update.kind === 'none') return null;

  if (update.kind === 'gone') {
    const dismissKey = update.id ?? basedOn?.label ?? '';
    if (dismissed === dismissKey) return null;
    return (
      <div role="note" className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="flex-1">
          The original{basedOn ? ` (${basedOn.label})` : ''} is no longer shared, so there are no updates to take. This filter keeps
          working.
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(dismissKey);
          }}
        >
          <X />
        </Button>
      </div>
    );
  }

  const source = update.kind === 'shared' && sourceFilter.id === update.id ? sourceFilter : null;
  const sourceDetail = source?.status === RequestState.SUCCESS ? source.detail : null;
  const busy = update.kind === 'shared' && source?.status === RequestState.LOADING;
  const ready = update.kind === 'template' ? templateSource !== null : sourceDetail !== null;

  const take = (mode: 'replace' | 'new') => {
    let text: string;
    let next: LootFilterBasedOn;
    if (update.kind === 'template') {
      // The very source whose version the banner announced (`update` was computed from it).
      if (templateSource === null) return;
      text = templateSource.text;
      next = templateBasedOn(templateSource.id, templateSource.version);
    } else {
      if (sourceDetail === null) return;
      text = sourceDetail.content;
      next = sharedBasedOn(sourceDetail, authorLabelOf(sourceDetail.profiles));
    }
    const action = dispatch(takeUpdate({ text, basedOn: next, mode: replaceable ? mode : 'new' }));
    if (mode === 'new' || !replaceable) {
      void navigate(`/loot-filters/draft/${action.payload.id}`);
      toast.success('Added the latest version as a new filter', { description: 'The filter you had open stays as it is.' });
    } else {
      toast.success('Loaded the latest version', {
        description: 'Save to keep it, or Discard changes to go back to the saved version.',
      });
    }
  };

  const handleReplace = () => {
    if (hasUnsavedChanges) setConfirmReplace(true);
    else take('replace');
  };

  return (
    <div role="note" className="space-y-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        <RefreshCw className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="flex-1 space-y-1">
          <p>
            <span className="font-semibold">Update available.</span>{' '}
            {update.kind === 'shared'
              ? `“${update.name}”, the filter this one is based on, has a newer version.`
              : `${BUNDLED_TEMPLATES[update.template].name} v${update.toVersion} is out; this filter started from ${update.fromVersion === null ? 'an older version' : `v${update.fromVersion}`}.`}
          </p>
          {!replaceable && (
            <p className="text-muted-foreground">
              This filter was never saved, so the latest version is added as a new filter beside it: yours stays as it is.
            </p>
          )}
          {update.kind === 'shared' && update.changeNote !== null && (
            <p className="text-muted-foreground">
              What changed: <span className="italic">{update.changeNote}</span>
            </p>
          )}
          {source?.status === RequestState.ERROR && !source.notFound && (
            <p className="text-destructive">Could not load the newer version. Reload the page to try again.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {replaceable && (
          <Button size="sm" variant="outline" disabled={!ready || busy} onClick={handleReplace}>
            {busy && <Spinner />}
            Replace with the latest
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            take('new');
          }}
        >
          {busy && !replaceable && <Spinner />}
          Add as a new filter
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmReplace}
        name={null}
        title="Replace your unsaved changes?"
        description="The latest version replaces your unsaved changes to this filter, which are dropped. Save afterwards to keep the latest version; Discard changes goes back to the saved version, not to these edits."
        confirmLabel="Replace"
        onCancel={() => {
          setConfirmReplace(false);
        }}
        onConfirm={() => {
          setConfirmReplace(false);
          take('replace');
        }}
      />
    </div>
  );
}
