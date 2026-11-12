import { useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ListPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { effectiveActions } from '../engine/actions';
import type { Diagnostic, DiagnosticSeverity, LootFilter, LootFilterRule } from '../engine/types';
import { useLootFilterData } from '../hooks/useLootFilterData';
import {
  addCustomRule,
  addRuleToSection,
  duplicateRule,
  editRuleComments,
  foldSelection,
  stepRule,
  removeRule,
  selectRule,
  setRuleDisabled,
} from '../store/lootFilterSlice';
import { selectEditor } from '../store/selectors';
import { ruleMatchesSearch, ruleSearchText, ruleSummary } from '../utils/ruleSummary';
import { readRuleListWidth, writeRuleListWidth } from '../utils/ruleListWidth';
import { openAfterEdit, ruleHeadingKeys, toggleHeading, withOpened } from '../utils/sectionFolds';
import {
  buildSectionRows,
  commentLinesText,
  hasHeadings,
  headingKeyChanges,
  headingKeys,
  stepEdges,
  stepItem,
  type CommentAccess,
  type SectionEdit,
} from '../utils/sections';
import { readsExceptions } from '../utils/statChecks';
import {
  ADD_CUSTOM_RULE_TITLE,
  CUSTOM_RULES_BADGE,
  CUSTOM_RULES_BADGE_DESCRIPTION,
  addRuleTarget,
  addedRuleToast,
} from '../utils/addRuleTarget';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RULE_EDITOR_ID, RuleEditor } from './rules/RuleEditor';
import { ExampleRulesButton } from './rules/ExampleRulesButton';
import { RuleList, type RuleListEntry, type RuleListSectionHandlers } from './rules/RuleList';
import { SectionDialog, type SectionDialogState } from './sections/SectionDialog';
import { SectionToolbar } from './sections/SectionRows';
import { RuleListSplitter } from './rules/RuleListSplitter';

/** For the index a rule step lands on (the store's reducer applies the step itself), so the comments are not written. */
const RULE_STEP_ACCESS: CommentAccess<LootFilterRule> = { get: (rule) => rule.commentsBefore, set: (rule) => rule };

/** Below this width the list and the editor are stacked. */
const TWO_PANE_QUERY = '(min-width: 1024px)';
const RULE_LIST_ID = 'loot-filter-rule-list';

interface RulesTabProps {
  readonly filter: LootFilter;
  readonly selectedRule: number | null;
  /** Every diagnostic of the open filter (the screen computes them once for all tabs). */
  readonly diagnostics: readonly Diagnostic[];
  /** The unfolded headings (`useSectionFolds`, remembered per filter); every other heading is folded. */
  readonly open: ReadonlySet<string>;
  readonly onOpenChange: (change: (open: ReadonlySet<string>) => ReadonlySet<string>) => void;
  /**
   * The selected rule was folded away by hand (or by Collapse all): not listed under its folded headings. Otherwise a
   * selection inside folded headings (a rule moved into a folded section) is still listed.
   */
  readonly selectionFolded: boolean;
  /** Bumped whenever a rule is revealed by an action; the list then scrolls the selected rule into view. */
  readonly revealCount: number;
  readonly onReveal: () => void;
  /** The editor's `reloads`: bumped when the content is replaced in place (part of the rule editor's key). */
  readonly reloads: number;
}

/** The rule list (search, add, reorder, duplicate, delete) next to the selected rule's editor. */
export function RulesTab({
  filter,
  selectedRule,
  diagnostics,
  open,
  onOpenChange,
  selectionFolded,
  revealCount,
  onReveal,
  reloads,
}: RulesTabProps) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const data = useLootFilterData();
  const [query, setQuery] = useState('');
  const [sectionDialog, setSectionDialog] = useState<SectionDialogState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The list width (rem) once the splitter has moved, remembered per browser; null = the per-page-width default.
  const [listWidth, setListWidth] = useState<number | null>(readRuleListWidth);
  const rowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);

  const severities = new Map<number, DiagnosticSeverity>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.rule === undefined || severities.get(diagnostic.rule) === 'error') continue;
    severities.set(diagnostic.rule, diagnostic.severity);
  }

  const all: RuleListEntry[] = filter.rules.map((rule, index) => ({
    index,
    rule,
    summary: ruleSummary(rule, data.lookup, readsExceptions(effectiveActions(rule, filter))),
    severity: severities.get(index),
  }));
  const searching = query.trim() !== '';
  const matches = (index: number) => {
    const entry = all[index];
    return ruleMatchesSearch(ruleSearchText(entry.rule, data.lookup, entry.summary), query);
  };
  const endComments = filter.rulesEndComments ?? [];
  const commentsOf = (entry: RuleListEntry) => entry.rule.commentsBefore;
  // A search lists the matching rules under their headings; a heading whose title matches lists its whole section.
  const rows = buildSectionRows(all, commentsOf, endComments, {
    open,
    keep: selectionFolded ? null : selectedRule,
    search: searching ? { matches, headingMatches: (title) => ruleMatchesSearch(title.toLowerCase(), query) } : undefined,
  });
  const shownRules = rows.filter((row) => row.kind === 'item').length;
  const hiddenCount = searching ? all.length - shownRules : 0;
  const disabledCount = filter.rules.filter((entry) => entry.disabled === true).length;
  const countNotes = [
    disabledCount > 0 ? `${String(disabledCount)} disabled` : undefined,
    hiddenCount > 0 ? `${String(hiddenCount)} hidden by search` : undefined,
  ].filter((note) => note !== undefined);
  const usesSections = hasHeadings(all, commentsOf, endComments);
  const fileNotes = usesSections ? commentLinesText(filter.leadingComments) : '';

  // A renamed, moved or re-levelled heading keeps its fold; a heading added here starts open.
  const editComments = (edit: SectionEdit) => {
    const changes = headingKeyChanges({ items: filter.rules, end: endComments }, { get: (rule) => rule.commentsBefore }, edit);
    dispatch(editRuleComments(edit));
    if (changes !== undefined) {
      onOpenChange((current) => openAfterEdit(current, changes));
    }
  };
  // A rule selected by an action (not a click on its row, which is in view) shows among its neighbours: its part and
  // section open, the others stay as they are. Read from the store, which the action has already updated.
  const revealSelected = () => {
    const { filter: current, selectedRule: index } = selectEditor(store.getState());
    if (current === null || index === null) return;
    const keys = ruleHeadingKeys(current, index);
    onOpenChange((now) => withOpened(now, keys));
    onReveal();
  };
  // Stacked layout: the editor is below the list, so bring it into view (after a click on a rule or an added rule).
  const scrollToEditor = () => {
    if (window.matchMedia(TWO_PANE_QUERY).matches) return;
    requestAnimationFrame(() => {
      document.getElementById(RULE_EDITOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const sections: RuleListSectionHandlers = {
    onToggle: (row) => {
      // Folding by hand folds the selected rule away too, when it is under that heading.
      if (!row.collapsed && selectedRule !== null && ruleHeadingKeys(filter, selectedRule).includes(row.key)) dispatch(foldSelection());
      onOpenChange((current) => toggleHeading(current, row, headingKeys(all, commentsOf, endComments)));
    },
    onEditHeading: (row) => {
      setSectionDialog({ kind: 'heading', row });
    },
    onMove: (address, direction) => {
      editComments({ kind: 'move', address, direction });
    },
    onRemoveHeading: (address) => {
      editComments({ kind: 'removeHeading', address });
    },
    onAddRule: (address) => {
      setQuery('');
      dispatch(addRuleToSection(address));
      revealSelected();
      scrollToEditor();
    },
    onEditNote: (row) => {
      setSectionDialog({ kind: 'note', row });
    },
    onRemoveNote: (row) => {
      editComments({ kind: 'replace', address: row.address, count: row.count, lines: [] });
    },
    onAddAbove: (index) => {
      setSectionDialog({ kind: 'add', at: index, where: `above rule ${String(index + 1)}` });
    },
  };

  // Where Add section puts its heading or note: the tooltip and the dialog say the same.
  const addSection =
    selectedRule === null
      ? { at: all.length, where: 'after the last rule' }
      : { at: selectedRule, where: `above rule ${String(selectedRule + 1)}` };

  const pendingEntry = pendingDelete === null ? undefined : all.at(pendingDelete);

  const rule = selectedRule === null ? undefined : filter.rules.at(selectedRule);
  const ruleDiagnostics = selectedRule === null ? [] : diagnostics.filter((diagnostic) => diagnostic.rule === selectedRule);

  const handleSelect = (index: number) => {
    dispatch(selectRule(index));
    scrollToEditor();
  };

  // A filter with a Protection part gets the rule in its Custom rules section, with Show (`addCustomRule`).
  const addTarget = addRuleTarget(filter);
  const handleAdd = () => {
    setQuery('');
    dispatch(addCustomRule({ at: selectedRule === null ? undefined : selectedRule + 1 }));
    revealSelected();
    scrollToEditor();
    const added = addedRuleToast(addTarget);
    if (added !== undefined) toast.success(added.message, { description: added.description });
  };

  return (
    // Two panes from lg: the list is `--rule-list-width` wide, kept between 18rem and 60% of the row (the clamp also
    // holds when the window shrinks). The default grows on Wide and Full pages (`/page` container steps, see PageShell;
    // Standard pages never reach @8xl), so summaries truncate less and RuleEditor fills the rest with more columns.
    // Moving the splitter sets the width inline (straight on the element while dragging, as state once released).
    <div
      ref={rowRef}
      className={cn(
        'grid items-start gap-4 lg:grid-cols-[minmax(0,clamp(18rem,var(--rule-list-width),60%))_minmax(0,1fr)]',
        '[--rule-list-width:24rem] @8xl/page:[--rule-list-width:28rem] @9xl/page:[--rule-list-width:32rem]',
        '@10xl/page:[--rule-list-width:36rem] @11xl/page:[--rule-list-width:40rem]'
      )}
      // A custom property is not one of CSSProperties' keys.
      style={listWidth === null ? undefined : ({ '--rule-list-width': `${String(listWidth)}rem` } as React.CSSProperties)}
    >
      <section
        ref={listRef}
        id={RULE_LIST_ID}
        aria-label="Rule list"
        className="relative flex min-w-0 flex-col rounded-xl border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"
      >
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                aria-label="Search rules"
                placeholder="Search rules"
                className="h-8 pl-8"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  // Clearing a search: the rule picked from the results shows in its section.
                  if (searching && event.target.value.trim() === '') revealSelected();
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              title={addTarget.kind === 'custom' ? ADD_CUSTOM_RULE_TITLE : undefined}
              onClick={() => {
                handleAdd();
              }}
            >
              <ListPlus />
              Add rule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {all.length} {all.length === 1 ? 'rule' : 'rules'}
            {countNotes.length > 0 && ` (${countNotes.join(', ')})`}
          </p>
          {!searching && (
            <SectionToolbar
              addWhere={addSection.where}
              onAdd={() => {
                setSectionDialog({ kind: 'add', ...addSection });
              }}
              onCollapseAll={
                usesSections
                  ? () => {
                      dispatch(foldSelection());
                      onOpenChange(() => new Set());
                    }
                  : undefined
              }
              onExpandAll={
                usesSections
                  ? () => {
                      onOpenChange(() => new Set(headingKeys(all, commentsOf, endComments)));
                    }
                  : undefined
              }
            />
          )}
          {fileNotes !== '' && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">About this filter</summary>
              <p className="mt-1 max-h-48 overflow-y-auto break-words whitespace-pre-line">{fileNotes}</p>
            </details>
          )}
          <ExampleRulesButton
            filter={filter}
            insertAt={selectedRule === null ? undefined : selectedRule + 1}
            onAdded={() => {
              setQuery('');
              revealSelected();
              scrollToEditor();
            }}
          />
        </div>
        {all.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No rules yet. Rules run top to bottom; add the first one, or one of the example rules above. Most players start from{' '}
            <Link to="/loot-filters" className="underline underline-offset-2 hover:text-foreground">
              Sully&apos;s QoL filter
            </Link>{' '}
            instead and adapt it.
          </p>
        ) : searching && shownRules === 0 ? (
          // Only a search can leave no rule row: folded sections still show their heading rows.
          <p className="p-4 text-sm text-muted-foreground">No rule matches the search.</p>
        ) : (
          <RuleList
            className="max-h-[45vh] divide-y overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            rows={rows}
            ruleCount={all.length}
            canMove={!searching}
            canFold={!searching}
            selectedRule={selectedRule}
            scrollRequest={revealCount}
            layoutKey={data.status}
            onSelect={handleSelect}
            edges={stepEdges({ items: filter.rules, end: endComments }, { get: (entry) => entry.commentsBefore })}
            onMove={(index, direction) => {
              const step = stepItem({ items: filter.rules, end: endComments }, RULE_STEP_ACCESS, index, direction);
              if (step === undefined) return undefined;
              dispatch(stepRule({ index, direction }));
              return step.index;
            }}
            onToggle={(index, disabled) => dispatch(setRuleDisabled({ index, disabled }))}
            onDuplicate={(index) => dispatch(duplicateRule(index))}
            onDelete={(index) => {
              setPendingDelete(index);
              setDeleteOpen(true);
            }}
            sections={sections}
            addTarget={
              addTarget.kind === 'custom'
                ? { address: addTarget.part, label: CUSTOM_RULES_BADGE, description: CUSTOM_RULES_BADGE_DESCRIPTION }
                : undefined
            }
          />
        )}
        {/* Last in the pane, so the tab order runs list, splitter, editor. */}
        <RuleListSplitter
          rowRef={rowRef}
          listRef={listRef}
          listId={RULE_LIST_ID}
          onResize={(rem) => {
            setListWidth(rem);
            writeRuleListWidth(rem);
          }}
        />
      </section>

      <div className="min-w-0">
        {selectedRule !== null && rule !== undefined ? (
          <RuleEditor
            // A new editor per rule: local field state (half-typed numbers, folds, the items-first step) must not leak
            // into the next rule. Rules have no ids, so the rule count joins the index (a rule added or removed above:
            // Check in game puts its test rule at the selected index), and so does `reloads` (the whole content
            // replaced: a source update, Discard, JSON Apply, an AI import), which a plain edit leaves alone.
            key={`${String(selectedRule)}/${String(filter.rules.length)}/${String(reloads)}`}
            filter={filter}
            index={selectedRule}
            rule={rule}
            diagnostics={ruleDiagnostics}
            data={data}
            onRuleAdded={revealSelected}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No rule selected</CardTitle>
              <CardDescription>
                Pick a rule in the list, or add one. Every rule whose conditions all hold applies, top to bottom, until one hides the item.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <SectionDialog
        state={sectionDialog}
        onClose={() => {
          setSectionDialog(null);
        }}
        onEdit={editComments}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        name={pendingDelete === null ? null : `rule ${String(pendingDelete + 1)}`}
        title={pendingDelete === null ? 'Delete rule?' : `Delete rule ${String(pendingDelete + 1)}?`}
        description={
          // As the row reads: the comment (when there is one) over the summary.
          <>
            {pendingEntry?.rule.comment !== undefined && pendingEntry.rule.comment.trim() !== '' && (
              <span className="block font-medium break-words text-foreground">{pendingEntry.rule.comment}</span>
            )}
            <span className="block break-words">{pendingEntry?.summary ?? ''}</span>
          </>
        }
        onCancel={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (pendingDelete !== null) dispatch(removeRule(pendingDelete));
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
