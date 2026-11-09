import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ListPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { effectiveActions } from '../engine/actions';
import type { Diagnostic, DiagnosticSeverity, LootFilter, LootFilterRule } from '../engine/types';
import { useLootFilterData } from '../hooks/useLootFilterData';
import {
  addRule,
  addRuleToSection,
  duplicateRule,
  editRuleComments,
  moveRule,
  removeRule,
  selectRule,
  setRuleDisabled,
} from '../store/lootFilterSlice';
import { ruleMatchesSearch, ruleSearchText, ruleSummary } from '../utils/ruleSummary';
import { readRuleListWidth, writeRuleListWidth } from '../utils/ruleListWidth';
import { buildSectionRows, commentLinesText, hasHeadings, headingKeys, type SectionEdit } from '../utils/sections';
import { readsExceptions } from '../utils/statChecks';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RULE_EDITOR_ID, RuleEditor } from './rules/RuleEditor';
import { ExampleRulesButton } from './rules/ExampleRulesButton';
import { RuleList, type RuleListEntry, type RuleListSectionHandlers } from './rules/RuleList';
import { SectionDialog, type SectionDialogState } from './sections/SectionDialog';
import { SectionToolbar } from './sections/SectionRows';
import { RuleListSplitter } from './rules/RuleListSplitter';

/** Below this width the list and the editor are stacked. */
const TWO_PANE_QUERY = '(min-width: 1024px)';
const RULE_LIST_ID = 'loot-filter-rule-list';

interface RulesTabProps {
  readonly filter: LootFilter;
  readonly selectedRule: number | null;
  /** Every diagnostic of the open filter (the screen computes them once for all tabs). */
  readonly diagnostics: readonly Diagnostic[];
}

/** The rule list (search, add, reorder, duplicate, delete) next to the selected rule's editor. */
export function RulesTab({ filter, selectedRule, diagnostics }: RulesTabProps) {
  const dispatch = useDispatch();
  const data = useLootFilterData();
  const [query, setQuery] = useState('');
  // Folds last while the tab is open (owner decision: no memory across tab switches or reloads).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
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
    collapsed,
    keep: selectedRule,
    search: searching ? { matches, headingMatches: (title) => ruleMatchesSearch(title, query) } : undefined,
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

  const editComments = (edit: SectionEdit) => {
    dispatch(editRuleComments(edit));
  };
  const sections: RuleListSectionHandlers = {
    onToggle: (key) => {
      setCollapsed((current) => {
        const next = new Set(current);
        if (!next.delete(key)) next.add(key);
        return next;
      });
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

  const pendingEntry = pendingDelete === null ? undefined : all.at(pendingDelete);

  const rule = selectedRule === null ? undefined : filter.rules.at(selectedRule);
  const ruleDiagnostics = selectedRule === null ? [] : diagnostics.filter((diagnostic) => diagnostic.rule === selectedRule);

  const handleSelect = (index: number) => {
    dispatch(selectRule(index));
    // Stacked layout: the editor is below the list, so bring it into view.
    if (!window.matchMedia(TWO_PANE_QUERY).matches) {
      requestAnimationFrame(() => {
        document.getElementById(RULE_EDITOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleAdd = (rule?: LootFilterRule) => {
    setQuery('');
    dispatch(addRule({ rule, at: selectedRule === null ? undefined : selectedRule + 1 }));
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
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
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
              addWhere={selectedRule === null ? 'after the last rule' : 'above the selected rule'}
              onAdd={() => {
                setSectionDialog(
                  selectedRule === null
                    ? { kind: 'add', at: all.length, where: 'after the last rule' }
                    : { kind: 'add', at: selectedRule, where: `above rule ${String(selectedRule + 1)}` }
                );
              }}
              onCollapseAll={
                usesSections
                  ? () => {
                      setCollapsed(new Set(headingKeys(all, commentsOf, endComments)));
                    }
                  : undefined
              }
              onExpandAll={
                usesSections
                  ? () => {
                      setCollapsed(new Set());
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
        ) : shownRules === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No rule matches the search.</p>
        ) : (
          <RuleList
            className="max-h-[45vh] divide-y overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            rows={rows}
            ruleCount={all.length}
            canMove={!searching}
            selectedRule={selectedRule}
            onSelect={handleSelect}
            onMove={(from, to) => dispatch(moveRule({ from, to }))}
            onToggle={(index, disabled) => dispatch(setRuleDisabled({ index, disabled }))}
            onDuplicate={(index) => dispatch(duplicateRule(index))}
            onDelete={(index) => {
              setPendingDelete(index);
              setDeleteOpen(true);
            }}
            sections={sections}
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
            // A new editor per rule: local field state (half-typed numbers) must not leak into the next rule. Rules have
            // no ids, so the rule count joins the index: a rule added or removed above (Check in game puts its test rule
            // at the selected index) changes which rule sits there.
            key={`${String(selectedRule)}/${String(filter.rules.length)}`}
            filter={filter}
            index={selectedRule}
            rule={rule}
            diagnostics={ruleDiagnostics}
            data={data}
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
