import { useState } from 'react';
import type { LootFilterRule, StatCheck } from '../../../engine/types';
import type { LootFilterData } from '../../../hooks/useLootFilterData';
import { EXCEPTION_LIST, formatStatCheck, newExceptionCheck, ruleExceptions, type ExceptionMode } from '../../../utils/statChecks';
import { StatPicker } from '../../pickers';
import { AffixBrowserDialog } from '../../pickers/AffixBrowserDialog';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

const MODES: readonly SegmentedOption<ExceptionMode>[] = [
  { value: 'any', label: 'Keep items with any of these' },
  { value: 'all', label: 'Keep items with all of these' },
];

type StatLists = Pick<LootFilterRule, 'itemStats' | 'itemStatsAnyOf'>;

interface ExceptionsControlProps {
  readonly id: string;
  readonly data: LootFilterData;
  readonly rule: StatLists;
  /** The changed list (`itemStats` or `itemStatsAnyOf`); an emptied list is `undefined`. */
  readonly onChange: (key: keyof StatLists, value: readonly StatCheck[] | undefined) => void;
}

/**
 * "Except items with…" on a hide rule: an input helper, not a list of its own. The file stores only plain checks, so an
 * exception is written as the opposite check (`>= 1` → `< 1`) into `itemStats` (keep items with any exception) or
 * `itemStatsAnyOf` (keep only items with all of them), where it is edited like any other check. The line below reads
 * the exceptions back from the `<`, `<=` and `!=` checks of those lists (`ruleExceptions`).
 */
export function ExceptionsControl({ id, data, rule, onChange }: ExceptionsControlProps) {
  const [mode, setMode] = useState<ExceptionMode>('any');
  const target = EXCEPTION_LIST[mode];
  const exceptions = ruleExceptions(rule);
  const format = (checks: readonly StatCheck[], joiner: string) => checks.map((check) => formatStatCheck(check, data.lookup)).join(joiner);
  const kept = [
    ...(exceptions.any.length > 0 ? [`items with ${format(exceptions.any, ' or ')}`] : []),
    ...(exceptions.all.length > 0 ? [`items with ${format(exceptions.all, ' and ')}`] : []),
  ];
  return (
    <div className="space-y-1.5">
      <SegmentedControl value={mode} options={MODES} onChange={setMode} aria-label="Which exceptions keep an item" />
      <div className="flex flex-wrap items-center gap-1.5">
        <StatPicker
          id={id}
          data={data}
          value={undefined}
          placeholder="Add exception"
          aria-label="Add exception"
          className="h-7 w-full text-xs sm:w-56"
          onChange={(stat) => {
            onChange(target, [...(rule[target] ?? []), newExceptionCheck(stat)]);
          }}
        />
        <AffixBrowserDialog
          mode={mode === 'any' ? 'except-any' : 'except-all'}
          value={rule[target]}
          onChange={(value) => {
            onChange(target, value);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {kept.length === 0 ? 'No exceptions: every item the rule matches is hidden.' : `Kept: ${kept.join('; or ')}.`}
      </p>
      {mode === 'all' && exceptions.mixedAll && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Item stats, any of already has other checks: an exception added there only keeps items that also fail those.
        </p>
      )}
    </div>
  );
}
