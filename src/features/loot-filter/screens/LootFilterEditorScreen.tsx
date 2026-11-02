import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileWarning, Heart, Download as DownloadIcon, Lock, Pencil, Save, Settings2, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { TAB_ACTIVE, TAB_BASE, TAB_INACTIVE } from '@/core/components/navTabClasses';
import type { RootState } from '@/core/store';
import { isSupabaseConfigured } from '@/core/supabase/config';
import { RequestState } from '@/core/types';
import { openSignInDialog, selectAuthInitialized, selectAuthUserId } from '@/features/auth';
import { serializeLootFilter } from '../engine/serialize';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { DiagnosticsChip } from '../components/DiagnosticsChip';
import { FilterDownloadMenu } from '../components/FilterDownloadMenu';
import { InlineName } from '../components/InlineName';
import { JsonTab, type JsonDraft } from '../components/JsonTab';
import { RulesTab } from '../components/RulesTab';
import { SettingsTab } from '../components/SettingsTab';
import { StylesTab } from '../components/StylesTab';
import { TestTab } from '../components/TestTab';
import { DetailsDialog } from '../components/editor/DetailsDialog';
import { SandboxBanner } from '../components/editor/SandboxBanner';
import { SaveDialog } from '../components/editor/SaveDialog';
import { UpdateBanner } from '../components/editor/UpdateBanner';
import { EDITOR_TABS, useEditorTab, type EditorTab } from '../hooks/useEditorTab';
import { useLootFilterReference } from '../hooks/useLootFilterReference';
import { useSandboxLeavePrompt } from '../hooks/useSandboxLeavePrompt';
import {
  clearSharedFilterDetail,
  deleteSharedFilterRequested,
  detailToRow,
  downloadCounted,
  fetchMyFiltersRequested,
  fetchSharedFilterRequested,
  resetDeleteSharedFilterStatus,
  resetFilterDetailsStatus,
  resetSaveStatus,
  saveFilterRequested,
  selectDeleteSharedFilterStatus,
  selectFilterDetailsStatus,
  selectMyFilters,
  selectMyFiltersStatus,
  selectSaveFilterStatus,
  selectSavedFilterId,
  selectSharedFilterDetail,
  selectSharedFilterDetailNotFound,
  selectSharedFilterDetailStatus,
} from '../sharing';
import {
  close,
  copyToMyFilters,
  discardChanges,
  editorFlushed,
  open,
  openSandbox,
  openSaved,
  remove,
  rename,
  selectRule,
} from '../store/lootFilterSlice';
import {
  countDiagnostics,
  selectDiagnostics,
  selectEditor,
  selectEditorBasedOn,
  selectEditorName,
  selectEditorTarget,
  selectEditorText,
  selectHasUnsavedChanges,
  selectLibraryEntries,
  selectLibraryEntry,
  selectLibraryHydrated,
} from '../store/selectors';
import type { EditorTarget } from '../store/types';
import { templateBasedOn } from '../utils/basedOn';
import { authorLabelOf, editorRouteOf, keepsOwnerSandbox, saveDialogDetailsOf, targetMatchesRoute } from '../utils/editorRoute';
import { collectReferencedAssets, referencedAssetsOfText } from '../utils/referencedAssets';
import { BUNDLED_TEMPLATES, fetchTemplateText, type BundledTemplateId } from '../utils/template';
import { defaultTestItem } from '../utils/testItemForm';

/** A JSON-tab draft and the editing session it belongs to (opening another filter starts a new session). */
interface SessionJsonDraft {
  readonly session: number;
  readonly draft: JsonDraft;
}

/** How the Save dialog is open: from the Save button (`dialog`), or only to show a failed direct save (`direct`). */
type SaveFlow = 'closed' | 'dialog' | 'direct';

/** Identifies the open filter for the editing session: changes when another filter opens (or the open one moves). */
function filterKeyOf(target: EditorTarget | null): string | null {
  if (target === null) return null;
  if (target.kind === 'draft') return `draft:${target.entryId}`;
  return `${target.kind}:${target.savedId ?? `template:${target.basedOn?.template ?? ''}`}`;
}

/** `search` without `?save=1` (the Save dialog opener), as a `to.search` value. */
function searchWithoutSave(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('save');
  const rest = params.toString();
  return rest === '' ? '' : `?${rest}`;
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Spinner className="size-8" />
    </div>
  );
}

function BackToLibrary() {
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
      <Link to="/loot-filters">
        <ArrowLeft />
        Back to library
      </Link>
    </Button>
  );
}

interface MessageCardProps {
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}

function MessageCard({ title, description, children }: MessageCardProps) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {children}
        <Button asChild variant="outline">
          <Link to="/loot-filters">
            <ArrowLeft />
            Back to library
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The filter editor on its three routes: `/loot-filters/draft/:draftId` (a draft in this browser), `/loot-filters/:id`
 * (a saved filter: its owner edits it, anyone else gets the sandbox; a local draft id redirects to the draft route) and
 * `/loot-filters/sully` and `/loot-filters/example` (the sandboxes on the bundled templates). The routes share this component, so moving from a
 * draft's route to its saved route after Save (or from the sandbox to the new draft after Copy to my filters) keeps the
 * screen mounted: tabs, the selected rule, the Test form and unapplied JSON text stay.
 */
export function LootFilterEditorScreen() {
  const location = useLocation();
  const route = editorRouteOf(useParams(), location.pathname);
  const routeKind = route.kind;
  const routeId = route.kind === 'template' ? null : route.id;
  const routeTemplate = route.kind === 'template' ? route.template : null;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const store = useStore<RootState>();

  const hydrated = useSelector(selectLibraryHydrated);
  const authInitialized = useSelector(selectAuthInitialized);
  const viewerId = useSelector(selectAuthUserId);
  const editor = useSelector(selectEditor);
  const target = editor.target;
  const routeEntry = useSelector((state: RootState) => (routeId === null ? undefined : selectLibraryEntry(state, routeId)));
  const draftEntry = useSelector((state: RootState) => (target?.kind === 'draft' ? selectLibraryEntry(state, target.entryId) : undefined));
  const entries = useSelector(selectLibraryEntries);
  const storedText = useSelector(selectEditorText);
  const name = useSelector(selectEditorName) ?? '';
  const hasUnsavedChanges = useSelector(selectHasUnsavedChanges);
  const basedOn = useSelector(selectEditorBasedOn);
  const detail = useSelector(selectSharedFilterDetail);
  const detailStatus = useSelector(selectSharedFilterDetailStatus);
  const detailNotFound = useSelector(selectSharedFilterDetailNotFound);
  const saveStatus = useSelector(selectSaveFilterStatus);
  const savedFilterId = useSelector(selectSavedFilterId);
  const deleteStatus = useSelector(selectDeleteSharedFilterStatus);
  const detailsStatus = useSelector(selectFilterDetailsStatus);
  const myFilters = useSelector(selectMyFilters);
  const myFiltersStatus = useSelector(selectMyFiltersStatus);
  const { reference } = useLootFilterReference();
  const diagnostics = useSelector((state: RootState) => selectDiagnostics(state, reference));
  const [tab, setTab] = useEditorTab();

  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  // A failed fetch of a bundled template's file (the template it was for, so another template's route does not show it).
  const [templateError, setTemplateError] = useState<{ readonly template: BundledTemplateId; readonly message: string } | null>(null);
  const [templateAttempt, setTemplateAttempt] = useState(0);
  const [saveFlow, setSaveFlow] = useState<SaveFlow>('closed');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [deleting, setDeleting] = useState(false);
  // State the tabs share or that must outlive a tab switch (each tab unmounts when another is shown).
  const [jsonState, setJsonState] = useState<SessionJsonDraft | null>(null);
  const [problemsScroll, setProblemsScroll] = useState(0);
  const [testForm, setTestForm] = useState(defaultTestItem);

  // The open filter moving to another route without being another filter: Save (a draft becoming the saved row, or
  // Save as a new filter) and Copy to my filters (the sandbox becoming a draft).
  const switching =
    (target?.kind === 'saved' && saveStatus === RequestState.SUCCESS && target.savedId === savedFilterId) ||
    (target?.kind === 'draft' && target.entryId === copiedDraftId);

  // A new editing session (no carried-over JSON text) whenever another filter opens.
  const filterKey = filterKeyOf(target);
  const [session, setSession] = useState({ key: 0, filterKey });
  let sessionKey = session.key;
  if (session.filterKey !== filterKey) {
    sessionKey = switching ? session.key : session.key + 1;
    setSession({ key: sessionKey, filterKey });
  }
  const jsonDraft = jsonState !== null && jsonState.session === sessionKey ? jsonState.draft : null;

  // Leaving the screen: write pending edits back and forget a finished save.
  useEffect(
    () => () => {
      dispatch(close());
      dispatch(resetSaveStatus());
    },
    [dispatch]
  );

  // Open what the route shows, once the library is loaded. Reads the store (not this render's values): a target that
  // already matches (the same filter after Save or Copy moved the route) is left alone.
  useEffect(() => {
    if (!hydrated) return;
    const state = store.getState();
    const current = selectEditorTarget(state);
    if (routeKind === 'draft' && routeId !== null) {
      if (current?.kind === 'draft' && current.entryId === routeId) return;
      dispatch(resetSaveStatus());
      if (selectLibraryEntry(state, routeId)) dispatch(open(routeId));
      return;
    }
    if (routeKind === 'saved' && routeId !== null) {
      if (current !== null && current.kind !== 'draft' && current.savedId === routeId) {
        // Still this filter (Save or Copy moved the route, or only `?tab=` changed): fetch its row only when it is
        // missing (cleared, or another filter's), so Details, Private and the change note come back.
        const loaded = selectSharedFilterDetail(state)?.id === routeId;
        const status = selectSharedFilterDetailStatus(state);
        if (!isSupabaseConfigured || loaded || status === RequestState.LOADING || selectSharedFilterDetailNotFound(state)) return;
        dispatch(fetchSharedFilterRequested(routeId));
        return;
      }
      dispatch(resetSaveStatus());
      // Local drafts and saved rows both have uuids: an old `/loot-filters/:id` link to a draft goes to its route.
      if (selectLibraryEntry(state, routeId)) {
        void navigate({ pathname: `/loot-filters/draft/${routeId}`, search: location.search }, { replace: true });
        return;
      }
      if (!isSupabaseConfigured) return;
      dispatch(clearSharedFilterDetail());
      dispatch(fetchSharedFilterRequested(routeId));
      return;
    }
    if (routeTemplate === null) return;
    if (targetMatchesRoute(current, { kind: 'template', template: routeTemplate }, null)) return;
    dispatch(resetSaveStatus());
    let cancelled = false;
    fetchTemplateText(routeTemplate).then(
      (text) => {
        if (cancelled) return;
        const { name } = BUNDLED_TEMPLATES[routeTemplate];
        dispatch(openSandbox({ text, name, basedOn: templateBasedOn(routeTemplate) }));
      },
      (error: unknown) => {
        console.error(`[Loot filters] Could not load the template ${routeTemplate}`, error);
        if (!cancelled) setTemplateError({ template: routeTemplate, message: error instanceof Error ? error.message : String(error) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [dispatch, navigate, store, hydrated, routeKind, routeId, routeTemplate, location.search, templateAttempt]);

  // The viewer changed (signed in, out or as someone else): a private filter's row depends on who asks, so a saved
  // route fetches its row again (a private filter that was "not found" signed out loads once its owner signs in).
  const viewerSeen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!authInitialized) return;
    const previous = viewerSeen.current;
    viewerSeen.current = viewerId;
    if (previous === undefined || previous === viewerId) return;
    if (!hydrated || !isSupabaseConfigured || routeKind !== 'saved' || routeId === null) return;
    if (selectLibraryEntry(store.getState(), routeId)) return;
    dispatch(fetchSharedFilterRequested(routeId));
  }, [dispatch, store, hydrated, authInitialized, viewerId, routeKind, routeId]);

  // A saved filter's row has arrived (or the viewer changed): open it for its owner, as the sandbox for anyone else.
  // The owner signing in on their own filter's sandbox with edits keeps the sandbox (a banner offers the switch); once
  // it has no edits (undone), it switches by itself.
  const editorDirty = editor.dirty;
  useEffect(() => {
    if (routeKind !== 'saved' || routeId === null || !authInitialized) return;
    const state = store.getState();
    const row = selectSharedFilterDetail(state);
    if (selectSharedFilterDetailStatus(state) !== RequestState.SUCCESS || row === null || row.id !== routeId) return;
    const current = selectEditorTarget(state);
    const savedRoute = { kind: 'saved', id: routeId } as const;
    if (targetMatchesRoute(current, savedRoute, viewerId)) return;
    if (keepsOwnerSandbox(current, selectEditor(state).dirty, savedRoute, viewerId)) return;
    dispatch(openSaved({ row: detailToRow(row), viewerId, authorLabel: authorLabelOf(row.profiles) }));
  }, [dispatch, store, routeKind, routeId, authInitialized, viewerId, detail, detailStatus, editorDirty]);

  // A draft of a saved filter on its own route: its privacy comes from My filters (fetched here when not loaded yet),
  // so the Save dialog never treats a private filter as public.
  const draftSavedId = draftEntry?.savedId ?? null;
  useEffect(() => {
    if (!isSupabaseConfigured || draftSavedId === null || viewerId === null || myFiltersStatus !== RequestState.IDLE) return;
    if (selectSharedFilterDetail(store.getState())?.id === draftSavedId) return;
    dispatch(fetchMyFiltersRequested());
  }, [dispatch, store, draftSavedId, viewerId, myFiltersStatus]);

  // After Save the open filter is the saved row: replace the draft's (or the previous row's) route with its own.
  useEffect(() => {
    const state = store.getState();
    const id = selectSavedFilterId(state);
    if (selectSaveFilterStatus(state) !== RequestState.SUCCESS || id === null) return;
    const current = selectEditorTarget(state);
    if (current?.kind !== 'saved' || current.savedId !== id) return;
    if (routeKind === 'saved' && routeId === id) return;
    void navigate({ pathname: `/loot-filters/${id}`, search: searchWithoutSave(location.search) }, { replace: true });
  }, [dispatch, navigate, store, routeKind, routeId, location.search, saveStatus, savedFilterId, target]);

  // Deleted: drop its unsaved changes and go back to the library.
  useEffect(() => {
    if (!deleting || deleteStatus !== RequestState.SUCCESS) return;
    if (selectEditorTarget(store.getState())?.kind === 'saved') dispatch(discardChanges());
    dispatch(resetDeleteSharedFilterStatus());
    void navigate('/loot-filters', { replace: true });
  }, [dispatch, navigate, store, deleting, deleteStatus]);

  // Leaving the page before the debounced save: write pending edits now.
  useEffect(() => {
    const flush = () => {
      dispatch(editorFlushed());
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [dispatch]);

  // Unapplied JSON text lives only in this component: ask before the page unloads with it.
  const editorFilter = editor.filter;
  const text = storedText ?? '';
  const modelText = jsonDraft === null ? null : editorFilter === null ? text : serializeLootFilter(editorFilter);
  const jsonUnapplied = jsonDraft !== null && jsonDraft.text !== modelText;
  useEffect(() => {
    if (!jsonUnapplied) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [jsonUnapplied]);

  useSandboxLeavePrompt(target?.kind === 'sandbox' && editor.dirty);

  // The owner signed in on their own filter's sandbox with edits: the sandbox stays until they switch or copy.
  const ownerSandbox = keepsOwnerSandbox(target, editor.dirty, route, viewerId);
  const showEditor = target !== null && (targetMatchesRoute(target, route, viewerId) || switching || ownerSandbox);
  if (!showEditor) {
    if (!hydrated) return <CenteredSpinner />;
    if (route.kind === 'draft' && routeEntry === undefined) {
      return <MessageCard title="Filter not found" description="It may have been deleted or saved, or it was made in another browser." />;
    }
    if (route.kind === 'saved' && routeEntry === undefined) {
      const localDraft = entries.find((entry) => entry.savedId === route.id);
      if (!isSupabaseConfigured || detailNotFound) {
        return (
          <MessageCard
            title="Filter not found"
            description={
              isSupabaseConfigured
                ? 'It may have been deleted or made private, or the link is wrong.'
                : 'Saving and sharing are off in this build: only filters in this browser open here.'
            }
          >
            {localDraft !== undefined && (
              <Button asChild>
                <Link to={`/loot-filters/draft/${localDraft.id}`}>Open your unsaved copy in this browser</Link>
              </Button>
            )}
          </MessageCard>
        );
      }
      if (detailStatus === RequestState.ERROR) {
        return (
          <MessageCard title="Could not load the filter" description="Check your connection and try again.">
            <Button
              onClick={() => {
                dispatch(fetchSharedFilterRequested(route.id));
              }}
            >
              Try again
            </Button>
          </MessageCard>
        );
      }
    }
    if (route.kind === 'template' && templateError?.template === route.template) {
      return (
        <MessageCard title={`Could not load ${BUNDLED_TEMPLATES[route.template].name}`} description={templateError.message}>
          <Button
            onClick={() => {
              setTemplateError(null);
              setTemplateAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </Button>
        </MessageCard>
      );
    }
    return <CenteredSpinner />;
  }

  const filter = editor.filter;
  // The shared row of a saved or sandbox target, once loaded.
  const row = target.kind !== 'draft' && detail?.id === target.savedId ? detail : null;
  const newDraft = target.kind === 'draft' && draftEntry?.savedId === undefined;
  // A draft opened on its own route that holds unsaved edits of a saved filter.
  const draftOfSaved = target.kind === 'draft' ? (draftEntry?.savedId ?? null) : null;
  const saving = saveStatus === RequestState.LOADING;
  const canSave = isSupabaseConfigured && target.kind !== 'sandbox';
  const isOwnerSaved = target.kind === 'saved';
  const countedId = isSupabaseConfigured && target.kind !== 'draft' ? target.savedId : null;
  // The saved filter a saved target or a draft of one edits: its loaded row, else its My filters entry (privacy).
  const savedId = target.kind === 'draft' ? draftOfSaved : target.savedId;
  const savedSummary =
    row ?? (savedId === null ? null : (myFilters.find((item) => item.id === savedId) ?? (detail?.id === savedId ? detail : null)));
  const saveDetails = saveDialogDetailsOf(name, newDraft, target.kind === 'sandbox' ? null : savedSummary);

  // The stored text keeps the file's comments and formatting; it is re-serialized only while edits are not yet saved.
  const downloadText = () => (editor.dirty && filter !== null ? serializeLootFilter(filter) : text);
  const assets = filter === null ? referencedAssetsOfText(text) : collectReferencedAssets(filter);

  const wantsSaveParam = searchParams.get('save') === '1';
  const saveDialogOpen =
    canSave &&
    (((saveFlow === 'dialog' || wantsSaveParam) && saveStatus !== RequestState.SUCCESS) ||
      (saveFlow === 'direct' && saveStatus === RequestState.ERROR));

  const closeSaveDialog = () => {
    setSaveFlow('closed');
    dispatch(resetSaveStatus());
    if (wantsSaveParam) {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.delete('save');
          return params;
        },
        { replace: true }
      );
    }
  };

  const handleSave = () => {
    if (viewerId === null) {
      dispatch(openSignInDialog());
      return;
    }
    dispatch(resetSaveStatus());
    // A private filter's later saves need nothing from the dialog; it opens only to show a failure.
    if (!newDraft && saveDetails.isPrivate === true && !jsonUnapplied) {
      setSaveFlow('direct');
      dispatch(saveFilterRequested({ mode: 'normal' }));
    } else {
      setSaveFlow('dialog');
    }
  };

  const handleCopy = () => {
    if (isSupabaseConfigured && viewerId === null) {
      dispatch(openSignInDialog());
      return;
    }
    const action = dispatch(copyToMyFilters());
    setCopiedDraftId(action.payload.id);
    void navigate({ pathname: `/loot-filters/draft/${action.payload.id}`, search: location.search }, { replace: true });
    toast.success('Copied to your filters', {
      description: isSupabaseConfigured ? 'It stays in this browser until you save it.' : undefined,
    });
  };

  const handleOpenEditable = () => {
    if (row === null) return;
    dispatch(openSaved({ row: detailToRow(row), viewerId, authorLabel: authorLabelOf(row.profiles) }));
  };

  const handleDiscard = () => {
    setConfirm(null);
    if (draftOfSaved !== null && target.kind === 'draft') {
      dispatch(remove(target.entryId));
      void navigate(`/loot-filters/${draftOfSaved}`, { replace: true });
      return;
    }
    dispatch(discardChanges());
  };

  const handleDelete = () => {
    setConfirm(null);
    if (target.kind !== 'saved') return;
    setDeleting(true);
    dispatch(deleteSharedFilterRequested(target.savedId));
  };

  const showDiagnostics = () => {
    setTab('json');
    // JsonTab scrolls once it has rendered (the tab switch runs in a transition).
    setProblemsScroll((count) => count + 1);
  };

  const handleDraftChange = (draft: JsonDraft | null) => {
    setJsonState(draft === null ? null : { session: sessionKey, draft });
  };

  const showRule = (index: number) => {
    dispatch(selectRule(index));
    setTab('rules');
    window.scrollTo({ top: 0 });
  };

  let status: string | null;
  if (saving) status = 'Saving…';
  else if (target.kind === 'sandbox') status = editor.dirty ? 'Edited here, not saved' : null;
  else if (newDraft) status = isSupabaseConfigured ? 'Not saved yet: kept in this browser' : 'Kept in this browser';
  else status = hasUnsavedChanges ? 'Unsaved changes' : 'Saved';

  const renderTab = (active: EditorTab) => {
    if (active === 'json') {
      return (
        <JsonTab
          filter={filter}
          entryText={text}
          diagnostics={diagnostics}
          onShowRule={showRule}
          draft={jsonDraft}
          onDraftChange={handleDraftChange}
          scrollToProblems={problemsScroll}
          onScrolledToProblems={() => {
            setProblemsScroll(0);
          }}
        />
      );
    }
    if (filter === null) {
      return (
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="size-4 text-destructive" aria-hidden />
              This filter cannot be read
            </CardTitle>
            <CardDescription>Its text is not valid JSON. Fix it in the JSON tab, then the other tabs open.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                setTab('json');
              }}
            >
              Open the JSON tab
            </Button>
          </CardContent>
        </Card>
      );
    }
    switch (active) {
      case 'rules':
        return <RulesTab filter={filter} selectedRule={editor.selectedRule} diagnostics={diagnostics} />;
      case 'styles':
        return <StylesTab filter={filter} />;
      case 'settings':
        return <SettingsTab filter={filter} />;
      case 'test':
        return <TestTab filter={filter} form={testForm} onFormChange={setTestForm} onShowRule={showRule} />;
    }
  };

  return (
    <div>
      <div className="mb-4 space-y-3 border-b pb-3">
        <BackToLibrary />
        {ownerSandbox && (
          <div role="note" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <p>
              <span className="font-semibold">This is your filter.</span> You signed in while trying changes here, and they are not saved.{' '}
              <span className="font-medium">Copy to my filters</span> keeps them as a new filter; opening the editable version drops them.
            </p>
            <Button size="sm" variant="outline" disabled={row === null} onClick={handleOpenEditable}>
              <Pencil />
              Open the editable version
            </Button>
          </div>
        )}
        {target.kind === 'sandbox' && <SandboxBanner target={target} detail={row} dirty={editor.dirty} onCopy={handleCopy} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {newDraft ? (
              <InlineName name={name} onRename={(next) => dispatch(rename({ id: target.entryId, name: next }))} />
            ) : (
              <h1 className="truncate text-2xl font-bold">{name}</h1>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {isOwnerSaved && row?.is_private === true && (
                <Badge variant="secondary">
                  <Lock aria-hidden />
                  Private
                </Badge>
              )}
              {status !== null && (
                <span className="inline-flex items-center gap-1.5" aria-live="polite">
                  {saving && <Spinner className="size-3.5" />}
                  {status}
                </span>
              )}
              {draftOfSaved !== null && (
                <Link to={`/loot-filters/${draftOfSaved}`} className="underline-offset-4 hover:underline">
                  Open the saved filter
                </Link>
              )}
              {isOwnerSaved && row !== null && (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1" title="Likes">
                    <Heart className="size-3.5" aria-hidden />
                    {row.likes_count}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Downloads">
                    <DownloadIcon className="size-3.5" aria-hidden />
                    {row.download_count}
                  </span>
                </span>
              )}
              {target.kind !== 'sandbox' && basedOn !== null && <span>Based on {basedOn.label}</span>}
            </div>
            {isOwnerSaved && row?.change_note != null && (
              <p className="text-sm text-muted-foreground">
                Latest change: <span className="italic">{row.change_note}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DiagnosticsChip diagnostics={diagnostics} onClick={showDiagnostics} />
            {canSave && (
              <Button size="sm" onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
                {saving ? <Spinner /> : <Save />}
                Save
              </Button>
            )}
            {((isOwnerSaved && hasUnsavedChanges) || draftOfSaved !== null) && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setConfirm('discard');
                }}
              >
                <Undo2 />
                Discard changes
              </Button>
            )}
            {canSave && isOwnerSaved && (
              <Button
                size="sm"
                variant="outline"
                disabled={row === null}
                onClick={() => {
                  dispatch(resetFilterDetailsStatus());
                  setDetailsOpen(true);
                }}
              >
                <Settings2 />
                Details
              </Button>
            )}
            <FilterDownloadMenu
              name={name}
              getText={downloadText}
              assets={assets}
              variant={target.kind === 'sandbox' ? 'outline' : 'default'}
              onDownload={
                countedId === null
                  ? undefined
                  : () => {
                      dispatch(downloadCounted(countedId));
                    }
              }
            />
            {canSave && isOwnerSaved && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label="Delete filter"
                disabled={deleting && deleteStatus === RequestState.LOADING}
                onClick={() => {
                  setConfirm('delete');
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        {!isSupabaseConfigured && target.kind !== 'sandbox' && (
          <p className="text-xs text-muted-foreground">Saving and sharing are off in this build: filters stay in this browser.</p>
        )}
        {target.kind !== 'sandbox' && <UpdateBanner basedOn={basedOn} hasUnsavedChanges={hasUnsavedChanges} replaceable={!newDraft} />}
        <div role="tablist" className="flex flex-wrap gap-1" aria-label="Filter editor tabs">
          {EDITOR_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              id={`loot-filter-tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls="loot-filter-tab-panel"
              className={cn(TAB_BASE, tab === item.id ? TAB_ACTIVE : TAB_INACTIVE)}
              onClick={() => {
                setTab(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div id="loot-filter-tab-panel" role="tabpanel" aria-labelledby={`loot-filter-tab-${tab}`}>
        {renderTab(tab)}
      </div>

      {canSave && (
        <SaveDialog
          open={saveDialogOpen}
          onClose={closeSaveDialog}
          kind={newDraft ? 'insert' : 'update'}
          details={saveDetails}
          counts={countDiagnostics(diagnostics)}
          jsonUnapplied={jsonUnapplied}
        />
      )}
      {canSave && isOwnerSaved && row !== null && (
        <DetailsDialog
          open={detailsOpen && detailsStatus !== RequestState.SUCCESS}
          onClose={() => {
            setDetailsOpen(false);
          }}
          id={row.id}
          details={{ name: row.name, description: row.description ?? '', isPrivate: row.is_private }}
        />
      )}
      <ConfirmDeleteDialog
        open={confirm === 'discard'}
        name={null}
        title="Discard your changes?"
        description={
          draftOfSaved === null
            ? 'The saved version is loaded again; your unsaved changes are dropped.'
            : 'This draft of a saved filter is removed from this browser; the saved filter stays as it is.'
        }
        confirmLabel="Discard changes"
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={handleDiscard}
      />
      <ConfirmDeleteDialog
        open={confirm === 'delete'}
        name={null}
        title="Delete this filter?"
        description={`“${name}” is deleted from your account and no longer shared. Copies other players made keep working. Download it first if you want to keep a copy; this cannot be undone.`}
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
