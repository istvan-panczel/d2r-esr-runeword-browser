import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { TAB_ACTIVE, TAB_BASE, TAB_INACTIVE } from '@/core/components/navTabClasses';
import type { RootState } from '@/core/store';
import { serializeLootFilter } from '../engine/serialize';
import { DiagnosticsChip } from '../components/DiagnosticsChip';
import { FilterDownloadMenu } from '../components/FilterDownloadMenu';
import { InlineName } from '../components/InlineName';
import { JsonTab, type JsonDraft } from '../components/JsonTab';
import { RulesTab } from '../components/RulesTab';
import { SettingsTab } from '../components/SettingsTab';
import { StylesTab } from '../components/StylesTab';
import { TestTab } from '../components/TestTab';
import { EDITOR_TABS, useEditorTab, type EditorTab } from '../hooks/useEditorTab';
import { useLootFilterReference } from '../hooks/useLootFilterReference';
import { close, editorFlushed, open, rename, selectRule } from '../store/lootFilterSlice';
import { selectDiagnostics, selectEditor, selectEditorText, selectLibraryEntry, selectLibraryHydrated } from '../store/selectors';
import { collectReferencedAssets, referencedAssetsOfText } from '../utils/referencedAssets';
import { defaultTestItem } from '../utils/testItemForm';

interface EntryDraft {
  /** The library entry the draft belongs to: opening another filter starts without one. */
  readonly entryId: string;
  readonly draft: JsonDraft;
}

export function LootFilterEditorScreen() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const hydrated = useSelector(selectLibraryHydrated);
  const entry = useSelector((state: RootState) => selectLibraryEntry(state, id));
  const editor = useSelector(selectEditor);
  // The open draft's stored text (the target's text: the entry's for this route's draft target).
  const storedText = useSelector(selectEditorText);
  const { reference } = useLootFilterReference();
  const diagnostics = useSelector((state: RootState) => selectDiagnostics(state, reference));
  const [tab, setTab] = useEditorTab();
  const entryExists = entry !== undefined;
  // State the tabs share or that must outlive a tab switch (each tab unmounts when another is shown).
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const jsonDraft = entryDraft !== null && entryDraft.entryId === id ? entryDraft.draft : null;
  const [problemsScroll, setProblemsScroll] = useState(0);
  const [testForm, setTestForm] = useState(defaultTestItem);

  // Open the entry once the library is loaded; closing (route change, unmount) writes pending edits back.
  useEffect(() => {
    if (!hydrated || !entryExists || id === undefined) return;
    dispatch(open(id));
    return () => {
      dispatch(close());
    };
  }, [dispatch, hydrated, entryExists, id]);

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
  const entryText = storedText ?? entry?.text;
  useEffect(() => {
    if (jsonDraft === null) return;
    const warn = (event: BeforeUnloadEvent) => {
      const modelText = editorFilter === null ? entryText : serializeLootFilter(editorFilter);
      if (jsonDraft.text !== modelText) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [jsonDraft, editorFilter, entryText]);

  const target = editor.target;
  if (!hydrated || (entryExists && (target?.kind !== 'draft' || target.entryId !== id))) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!entry) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Filter not found</CardTitle>
          <CardDescription>It may have been deleted, or it was saved in another browser.</CardDescription>
        </CardHeader>
        <CardContent>
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

  const filter = editor.filter;

  // The stored text keeps the file's comments and formatting; it is re-serialized only while edits are not yet saved.
  const text = storedText ?? entry.text;
  const downloadText = () => (editor.dirty && filter !== null ? serializeLootFilter(filter) : text);
  const assets = filter === null ? referencedAssetsOfText(text) : collectReferencedAssets(filter);

  const showDiagnostics = () => {
    setTab('json');
    // JsonTab scrolls once it has rendered (the tab switch runs in a transition).
    setProblemsScroll((count) => count + 1);
  };

  const handleDraftChange = (draft: JsonDraft | null) => {
    setEntryDraft(draft === null ? null : { entryId: entry.id, draft });
  };

  const showRule = (index: number) => {
    dispatch(selectRule(index));
    setTab('rules');
    window.scrollTo({ top: 0 });
  };

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
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
          <Link to="/loot-filters">
            <ArrowLeft />
            Back to library
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InlineName name={entry.name} onRename={(name) => dispatch(rename({ id: entry.id, name }))} />
          <div className="flex flex-wrap items-center gap-2">
            <DiagnosticsChip diagnostics={diagnostics} onClick={showDiagnostics} />
            <FilterDownloadMenu name={entry.name} getText={downloadText} assets={assets} />
          </div>
        </div>
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
    </div>
  );
}
