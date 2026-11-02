import { useRef, useState } from 'react';
import type { LootFilterRule, StatCheck } from '../../../engine/types';
import type { LootFilterData } from '../../../hooks/useLootFilterData';
import {
  EXCEPTION_LIST,
  EXCEPTION_ROW_OPS,
  exceptionPlacement,
  formatStatCheck,
  invertStatCheck,
  isExceptionCheck,
  moveExceptions,
  newExceptionCheck,
  plainCheckCount,
  removeStatCheck,
  replaceStatCheck,
  replaceStatCheckWithMany,
  ruleExceptions,
  ruleStatQuirk,
  statCheckRows,
  storedException,
  type ExceptionMode,
  type ItemStatListsPatch,
} from '../../../utils/statChecks';
import { StatPicker } from '../../pickers';
import { AffixBrowserDialog } from '../../pickers/AffixBrowserDialog';
import { focusAfterRemoval } from '../../pickers/focusAfterRemoval';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';
import { StatCheckRow } from './StatCheckList';

const MODE_LABELS: Readonly<Record<ExceptionMode, string>> = {
  any: 'Keep items with any of these',
  all: 'Keep items with all of these',
};

/** The group headings when a hand-written file has exceptions in both lists. */
const GROUP_LABELS: Readonly<Record<ExceptionMode, string>> = {
  any: 'Keep items with any of these (stored in Item stats, all of)',
  all: 'Keep items with all of these (stored in Item stats, any of)',
};

const AMBER = 'text-xs text-amber-700 dark:text-amber-400';

interface ExceptionsControlProps {
  readonly id: string;
  readonly data: LootFilterData;
  readonly rule: LootFilterRule;
  /** `readsExceptions` of the rule's effective actions: false with `hideIfOtherConditionsFail`, which keeps nothing. */
  readonly keepsItems: boolean;
  /** The changed item stat lists (an emptied list is `undefined`). */
  readonly onChange: (patch: ItemStatListsPatch) => void;
}

/**
 * "Except items with…" on a hide rule. The file has no exception key: an exception is stored as its opposite check
 * (`Teleport >= 1` → `Teleport < 1`) in `itemStats` (keep items with any exception) or `itemStatsAnyOf` (keep only items
 * with all of them). This control owns those `<`, `<=` and `!=` checks: it lists them in their natural form (shown
 * inverted, written back inverted), the mode is where they are, and switching it moves them all to the other list
 * (`moveExceptions`). The regular item stat lists leave them out.
 */
export function ExceptionsControl({ id, data, rule, keepsItems, onChange }: ExceptionsControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Set when a stat is picked, so the popover's close moves focus to the new row's value.
  const addedRef = useRef(false);
  // Where new exceptions go while there are none (with exceptions, the mode is where they are).
  const [preferred, setPreferred] = useState<ExceptionMode>(() => (exceptionPlacement(rule) === 'all' ? 'all' : 'any'));
  const placement = exceptionPlacement(rule);
  // Exceptions moved into an any-of list holding plain checks would be ORed with them: not offered.
  const anyOfPlain = plainCheckCount(rule.itemStatsAnyOf);
  const allBlocked = anyOfPlain > 0 && placement !== 'all';
  const mode = placement === 'both' ? undefined : (placement ?? (allBlocked ? 'any' : preferred));
  const modes: readonly SegmentedOption<ExceptionMode>[] = [
    { value: 'any', label: MODE_LABELS.any },
    {
      value: 'all',
      label: MODE_LABELS.all,
      disabled: allBlocked,
      title: allBlocked ? 'Item stats, any of has other checks: exceptions there would be ORed with them' : undefined,
    },
  ];

  const exceptions = ruleExceptions(rule);
  const mixedAll = anyOfPlain > 0 && rule.itemStatsAnyOf?.some(isExceptionCheck) === true;
  const format = (checks: readonly StatCheck[], joiner: string) => checks.map((check) => formatStatCheck(check, data.lookup)).join(joiner);
  const kept = [
    ...(exceptions.any.length > 0 ? [`items with ${format(exceptions.any, ' or ')}`] : []),
    ...(exceptions.all.length > 0 ? [`items with ${format(exceptions.all, ' and ')}`] : []),
  ];

  const anyRows = statCheckRows(rule.itemStats, isExceptionCheck);
  const allRows = statCheckRows(rule.itemStatsAnyOf, isExceptionCheck);
  // Positions run on across both groups (row ids, focus after a removal).
  const groups = [
    { group: 'any' as const, key: EXCEPTION_LIST.any, list: rule.itemStats ?? [], rows: anyRows, start: 0 },
    { group: 'all' as const, key: EXCEPTION_LIST.all, list: rule.itemStatsAnyOf ?? [], rows: allRows, start: anyRows.length },
  ].filter((group) => group.rows.length > 0);
  const rowCount = anyRows.length + allRows.length;

  const renderRows = (group: (typeof groups)[number]) =>
    group.rows.map(({ check, index }, rowIndex) => {
      const position = group.start + rowIndex;
      const update = (next: readonly StatCheck[] | undefined) => {
        onChange({ [group.key]: next });
      };
      return (
        <StatCheckRow
          // Rows have no identity of their own (two can be equal), so the position in the list is the key.
          key={`${group.key}-${String(index)}`}
          id={position === 0 ? id : `${id}-${String(position)}`}
          data={data}
          check={invertStatCheck(check) ?? check}
          // Shown in natural form, "keep items with any of these" reads like an any-of list.
          anyOf={group.group === 'any'}
          ops={EXCEPTION_ROW_OPS}
          levelHint="only with “Keep items with any of these”"
          quirk={ruleStatQuirk(check, rule, data.reference)}
          removeLabel="Remove exception"
          onChange={(shown) => {
            update(replaceStatCheck(group.list, index, storedException(shown)));
          }}
          onReplace={(many) => {
            update(replaceStatCheckWithMany(group.list, index, many.map(storedException)));
          }}
          onRemove={() => {
            update(removeStatCheck(group.list, index));
            focusAfterRemoval(containerRef.current, position);
          }}
        />
      );
    });

  return (
    <div ref={containerRef} className="space-y-1.5">
      <SegmentedControl
        value={mode}
        options={modes}
        onChange={(next) => {
          setPreferred(next);
          const patch = moveExceptions(rule, next);
          if (Object.keys(patch).length > 0) onChange(patch);
        }}
        aria-label="Which exceptions keep an item"
      />
      {placement === 'both' && (
        <p className={AMBER}>
          This rule has exceptions in both lists, and both groups count. Pick a mode above to gather them into one list.
        </p>
      )}
      {allBlocked && (
        <p className="text-xs text-muted-foreground">
          “All of these” is off: Item stats, any of (in Advanced, below) has other checks, and exceptions there would be ORed with them.
        </p>
      )}
      {groups.map((group) => (
        <div key={group.key} className="space-y-1.5">
          {placement === 'both' && <p className="text-xs font-medium">{GROUP_LABELS[group.group]}</p>}
          <ul className="space-y-1.5">{renderRows(group)}</ul>
        </div>
      ))}
      {mode !== undefined && (
        <div data-focus-fallback className="flex flex-wrap items-center gap-1.5">
          <StatPicker
            id={rowCount === 0 ? id : undefined}
            data={data}
            value={undefined}
            placeholder="Add exception"
            aria-label="Add exception"
            className="h-7 w-full text-xs sm:w-56"
            onChange={(stat) => {
              const target = EXCEPTION_LIST[mode];
              onChange({ [target]: [...(rule[target] ?? []), newExceptionCheck(stat)] });
              addedRef.current = true;
            }}
            onCloseAutoFocus={(event) => {
              if (!addedRef.current) return;
              // An exception was added: its value is what the user sets next, not the add control.
              addedRef.current = false;
              event.preventDefault();
              Array.from(containerRef.current?.querySelectorAll<HTMLInputElement>('[data-stat-value]') ?? [])
                .at(-1)
                ?.focus();
            }}
          />
          <AffixBrowserDialog
            data={data}
            mode={mode === 'any' ? 'except-any' : 'except-all'}
            value={rule[EXCEPTION_LIST[mode]]}
            onChange={(value) => {
              onChange({ [EXCEPTION_LIST[mode]]: value });
            }}
          />
        </div>
      )}
      {keepsItems ? (
        <p className="text-xs text-muted-foreground">
          {kept.length === 0 ? 'No exceptions: every item the rule matches is hidden.' : `Kept: ${kept.join('; or ')}.`}
        </p>
      ) : (
        <p className={AMBER}>
          With “hide if other conditions fail” these exceptions keep nothing: items without the stat fail the rule and are hidden anyway.
          Turn it off to use exceptions.
        </p>
      )}
      {mixedAll && (
        <p className={AMBER}>
          Item stats, any of also has other checks (in Advanced, below), so its exceptions are ORed with them and are not listed under
          “Kept”: one there only keeps items that also fail those checks. Pick “any of these” to move them out.
        </p>
      )}
    </div>
  );
}
