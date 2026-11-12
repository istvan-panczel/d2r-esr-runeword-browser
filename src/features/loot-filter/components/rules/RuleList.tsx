import { useEffect, useRef } from 'react';
import type { DiagnosticSeverity, LootFilterRule } from '../../engine/types';
import type { CommentAddress, HeadingRow, NoteRow, SectionRow } from '../../utils/sections';
import { HeadingRowView, NoteRowView } from '../sections/SectionRows';
import { RuleRow } from './RuleRow';

export interface RuleListEntry {
  readonly index: number;
  readonly rule: LootFilterRule;
  readonly summary: string;
  readonly severity: DiagnosticSeverity | undefined;
}

interface RuleListProps {
  /** The rows to show (after the search and the folded sections): rules with their position in the filter, headings, notes. */
  readonly rows: readonly SectionRow<RuleListEntry>[];
  readonly ruleCount: number;
  /** False while a search filters the list: moving next to a hidden rule would be confusing. */
  readonly canMove: boolean;
  /** False while a search filters the list: folds do not apply to it. */
  readonly canFold: boolean;
  readonly selectedRule: number | null;
  /** Changes when a rule is revealed by an action: the selected row is scrolled into view once it is rendered. */
  readonly scrollRequest: number;
  /**
   * Changes when the rows change height (the game data arriving makes the summaries longer, a moment after the tab
   * mounts): the selected row is brought back into view.
   */
  readonly layoutKey: string;
  readonly onSelect: (index: number) => void;
  /** One step up (-1) or down (1) (`stepItem`); returns the rule's new index, undefined when it did not move. */
  readonly onMove: (index: number, direction: -1 | 1) => number | undefined;
  /** The first rule can still move up (a heading above it) / the last one down (comments after it). */
  readonly edges: { readonly firstUp: boolean; readonly lastDown: boolean };
  readonly onToggle: (index: number, disabled: boolean) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
  readonly sections: RuleListSectionHandlers;
  /** The heading row (by its address) where Add rule puts new rules, with the badge it shows (`addRuleTarget`). */
  readonly addTarget?: { readonly address: CommentAddress; readonly label: string; readonly description: string };
  readonly className?: string;
}

/** What the heading and note rows (and each rule's Add heading above) do. */
export interface RuleListSectionHandlers {
  readonly onToggle: (row: HeadingRow) => void;
  readonly onEditHeading: (row: HeadingRow) => void;
  readonly onMove: (address: CommentAddress, direction: -1 | 1) => void;
  readonly onRemoveHeading: (address: CommentAddress) => void;
  readonly onAddRule: (address: CommentAddress) => void;
  readonly onEditNote: (row: NoteRow) => void;
  readonly onRemoveNote: (row: NoteRow) => void;
  /** Add a heading or note above rule `index`. */
  readonly onAddAbove: (index: number) => void;
}

/** The rules in file order; keeps the selected row in view when the selection changes (e.g. from the JSON tab). */
export function RuleList({
  rows,
  ruleCount,
  edges,
  canMove,
  canFold,
  selectedRule,
  scrollRequest,
  layoutKey,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onDelete,
  sections,
  addTarget,
  className,
}: RuleListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Rows are keyed by position, so after a move the focused button belongs to the other rule: follow the moved one.
  const handleMove = (index: number, direction: -1 | 1) => {
    const to = onMove(index, direction);
    if (to === undefined) return;
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector(`[data-rule-index="${String(to)}"]`);
      const move = row?.querySelector<HTMLButtonElement>(`[data-move="${direction === -1 ? 'up' : 'down'}"]`);
      (move?.disabled === false ? move : row?.querySelector<HTMLElement>('[data-rule-main]'))?.focus();
    });
  };

  // After the commit that shows it (a reveal opens its headings in the same update) and again when the rows above it
  // change height, so the row ends where it stays; the nearest edge, so a row already in view (a click) does not move.
  useEffect(() => {
    if (selectedRule === null) return;
    listRef.current?.querySelector(`[data-rule-index="${String(selectedRule)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedRule, scrollRequest, layoutKey]);

  return (
    <ul ref={listRef} className={className} aria-label="Rules">
      {rows.map((row) => {
        if (row.kind === 'heading') {
          return (
            <HeadingRowView
              key={row.key}
              row={row}
              noun="rules"
              canMove={canMove}
              canFold={canFold}
              onToggle={sections.onToggle}
              onEdit={sections.onEditHeading}
              onMove={sections.onMove}
              onRemove={sections.onRemoveHeading}
              onAddItem={sections.onAddRule}
              badge={
                addTarget !== undefined && addTarget.address.at === row.address.at && addTarget.address.line === row.address.line
                  ? addTarget
                  : undefined
              }
            />
          );
        }
        if (row.kind === 'note')
          return <NoteRowView key={row.key} row={row} onEdit={sections.onEditNote} onRemove={sections.onRemoveNote} />;
        const { entry } = row;
        return (
          <RuleRow
            key={entry.index}
            index={entry.index}
            rule={entry.rule}
            summary={entry.summary}
            severity={entry.severity}
            selected={entry.index === selectedRule}
            isFirst={entry.index === 0 && !edges.firstUp}
            isLast={entry.index === ruleCount - 1 && !edges.lastDown}
            canMove={canMove}
            onSelect={onSelect}
            onMove={handleMove}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onAddComment={sections.onAddAbove}
          />
        );
      })}
    </ul>
  );
}
