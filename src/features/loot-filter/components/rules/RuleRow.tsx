import { ArrowDown, ArrowUp, Copy, Heading, Power, PowerOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DiagnosticSeverity, LootFilterRule } from '../../engine/types';
import { isInGameCheckRule } from '../../utils/inGameCheck';
import { levelsBadge, locationBadge } from '../../utils/ruleSummary';

export interface RuleRowProps {
  readonly index: number;
  readonly rule: LootFilterRule;
  readonly summary: string;
  readonly selected: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  /** False while the list is filtered by a search (the neighbour may be hidden), which disables Move up/down. */
  readonly canMove: boolean;
  /** The worst diagnostic of the rule, if any. */
  readonly severity: DiagnosticSeverity | undefined;
  readonly onSelect: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onToggle: (index: number, disabled: boolean) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
  /** Add a section heading or a note right above this rule. */
  readonly onAddComment: (index: number) => void;
}

/**
 * One rule: number, the comment as the main line with the summary in small grey under it (no comment: the summary is
 * the main line), badges and a problem dot (a disabled rule is dimmed with a "disabled" badge); move, disable/enable,
 * duplicate, add a heading above and delete on hover/focus (always on touch).
 */
export function RuleRow({
  index,
  rule,
  summary,
  selected,
  isFirst,
  isLast,
  canMove,
  severity,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onDelete,
  onAddComment,
}: RuleRowProps) {
  const disabled = rule.disabled === true;
  const levels = levelsBadge(rule.activeInLevels);
  const location = locationBadge(rule.location);
  const number = String(index + 1);
  const isCheck = isInGameCheckRule(rule);
  // The author's words first when there are any: the summary under it is the generated detail.
  const comment = rule.comment === undefined || rule.comment.trim() === '' ? undefined : rule.comment;
  const hasBadges =
    disabled || isCheck || rule.hide === true || rule.useStyle !== undefined || levels !== undefined || location !== undefined;

  return (
    <li
      data-rule-index={index}
      className={cn(
        // Rows outside the list's scroll view skip layout, so moving the splitter on a long filter stays smooth.
        'group relative flex flex-wrap items-stretch border-l-2 [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]',
        selected ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted/50'
      )}
    >
      <button
        type="button"
        data-rule-main
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex min-w-0 flex-1 basis-full items-start gap-2 px-2 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
          disabled && 'opacity-60'
        )}
        onClick={() => {
          onSelect(index);
        }}
      >
        <span className="w-7 shrink-0 pt-px text-right font-mono text-xs text-muted-foreground tabular-nums">{number}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm" title={comment ?? summary}>
              {comment ?? summary}
            </span>
            {severity !== undefined && (
              <span
                className={cn('size-2 shrink-0 rounded-full', severity === 'error' ? 'bg-destructive' : 'bg-amber-500')}
                role="img"
                aria-label={severity === 'error' ? 'Has errors' : 'Has warnings'}
                title={severity === 'error' ? 'Has errors' : 'Has warnings'}
              />
            )}
          </span>
          {comment !== undefined && (
            <span className="-mt-0.5 truncate text-xs text-muted-foreground" title={summary}>
              {summary}
            </span>
          )}
          {hasBadges && (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {disabled && (
                <Badge
                  variant="outline"
                  className="border-dashed px-1.5 py-0 text-[0.7rem] text-muted-foreground"
                  title="Kept in the file under disabledRules, which the game ignores"
                >
                  disabled
                </Badge>
              )}
              {isCheck && (
                <Badge
                  variant="outline"
                  className="border-sky-600/50 px-1.5 py-0 text-[0.7rem] text-sky-700 dark:text-sky-300"
                  title="Prints what the plugin reads for the next rule's stats; delete it after testing"
                >
                  in-game check
                </Badge>
              )}
              {rule.hide === true && (
                <Badge variant="outline" className="border-destructive/50 px-1.5 py-0 text-[0.7rem] text-destructive">
                  hide
                </Badge>
              )}
              {rule.show === true && (
                <Badge
                  variant="outline"
                  className="border-emerald-600/50 px-1.5 py-0 text-[0.7rem] text-emerald-700 dark:text-emerald-300"
                  title="Show: no later rule can hide the item"
                >
                  show
                </Badge>
              )}
              {rule.useStyle !== undefined && (
                <Badge variant="secondary" className="max-w-40 px-1.5 py-0 text-[0.7rem]">
                  <span className="truncate">{rule.useStyle}</span>
                </Badge>
              )}
              {levels !== undefined && (
                <Badge variant="outline" className="px-1.5 py-0 text-[0.7rem]" title="Active at these filter levels">
                  {levels}
                </Badge>
              )}
              {location !== undefined && (
                <Badge variant="outline" className="px-1.5 py-0 text-[0.7rem]" title="Location">
                  {location}
                </Badge>
              )}
            </span>
          )}
        </span>
      </button>
      <div
        className={cn(
          // On touch the buttons are always there, on their own line under the text (right-aligned), so the comment
          // keeps the row's full width.
          'ml-auto flex shrink-0 items-start gap-0.5 pr-1 pb-1 transition-opacity',
          // With a mouse the buttons float over the row's end, so a hidden toolbar takes no room from the summary.
          'pointer-fine:absolute pointer-fine:top-0.5 pointer-fine:right-0.5 pointer-fine:rounded-md pointer-fine:bg-card pointer-fine:py-0.5 pointer-fine:pl-0.5 pointer-fine:shadow-xs',
          !selected && 'pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100'
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={!canMove || isFirst}
          data-move="up"
          aria-label={`Move rule ${number} up`}
          onClick={() => {
            onMove(index, index - 1);
          }}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={!canMove || isLast}
          data-move="down"
          aria-label={`Move rule ${number} down`}
          onClick={() => {
            onMove(index, index + 1);
          }}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label={`${disabled ? 'Enable' : 'Disable'} rule ${number}`}
          title={disabled ? 'Enable rule' : 'Disable rule'}
          aria-pressed={disabled}
          onClick={() => {
            onToggle(index, !disabled);
          }}
        >
          {disabled ? <Power /> : <PowerOff />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label={`Duplicate rule ${number}`}
          onClick={() => {
            onDuplicate(index);
          }}
        >
          <Copy />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label={`Add a heading or note above rule ${number}`}
          title="Add a section heading or a note above this rule"
          onClick={() => {
            onAddComment(index);
          }}
        >
          <Heading />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 hover:text-destructive"
          aria-label={`Delete rule ${number}`}
          onClick={() => {
            onDelete(index);
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
