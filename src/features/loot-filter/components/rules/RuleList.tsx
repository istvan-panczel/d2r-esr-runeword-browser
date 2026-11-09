import { useEffect, useRef } from 'react';
import type { DiagnosticSeverity, LootFilterRule } from '../../engine/types';
import type { RuleListRow } from '../../utils/ruleSections';
import { RuleRow } from './RuleRow';
import { RuleHeadingRow, RuleNoteRow } from './RuleSectionRows';

export interface RuleListEntry {
  readonly index: number;
  readonly rule: LootFilterRule;
  readonly summary: string;
  readonly severity: DiagnosticSeverity | undefined;
}

interface RuleListProps {
  /** The rows to show (after the search and the folded sections): rules with their position in the filter, headings, notes. */
  readonly rows: readonly RuleListRow<RuleListEntry>[];
  readonly ruleCount: number;
  /** False while a search filters the list: moving next to a hidden rule would be confusing. */
  readonly canMove: boolean;
  readonly selectedRule: number | null;
  readonly onSelect: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onToggle: (index: number, disabled: boolean) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
  readonly onToggleHeading: (key: string) => void;
  readonly className?: string;
}

/** The rules in file order; keeps the selected row in view when the selection changes (e.g. from the JSON tab). */
export function RuleList({
  rows,
  ruleCount,
  canMove,
  selectedRule,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onDelete,
  onToggleHeading,
  className,
}: RuleListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Rows are keyed by position, so after a move the focused button belongs to the other rule: follow the moved one.
  const handleMove = (from: number, to: number) => {
    onMove(from, to);
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector(`[data-rule-index="${String(to)}"]`);
      const move = row?.querySelector<HTMLButtonElement>(`[data-move="${to < from ? 'up' : 'down'}"]`);
      (move?.disabled === false ? move : row?.querySelector<HTMLElement>('[data-rule-main]'))?.focus();
    });
  };

  useEffect(() => {
    if (selectedRule === null) return;
    listRef.current?.querySelector(`[data-rule-index="${String(selectedRule)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedRule]);

  return (
    <ul ref={listRef} className={className} aria-label="Rules">
      {rows.map((row) => {
        if (row.kind === 'heading') return <RuleHeadingRow key={row.key} row={row} onToggle={onToggleHeading} />;
        if (row.kind === 'note') return <RuleNoteRow key={row.key} row={row} />;
        const { entry } = row;
        return (
          <RuleRow
            key={entry.index}
            index={entry.index}
            rule={entry.rule}
            summary={entry.summary}
            severity={entry.severity}
            selected={entry.index === selectedRule}
            isFirst={entry.index === 0}
            isLast={entry.index === ruleCount - 1}
            canMove={canMove}
            onSelect={onSelect}
            onMove={handleMove}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        );
      })}
    </ul>
  );
}
