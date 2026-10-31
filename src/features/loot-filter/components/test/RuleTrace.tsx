import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EvaluationResult, RuleTrace as RuleTraceEntry } from '../../engine/evaluate';
import { effectiveActions } from '../../engine/actions';
import type { LootFilter } from '../../engine/types';
import type { LootFilterLookup } from '../../utils/lookup';
import { ruleSummary } from '../../utils/ruleSummary';
import { readsExceptions } from '../../utils/statChecks';

const OUTCOMES: Readonly<Record<RuleTraceEntry['outcome'], { readonly label: string; readonly className: string }>> = {
  applied: { label: 'applied', className: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  hidden: { label: 'hidden', className: 'border-red-600/40 bg-red-500/15 text-red-800 dark:text-red-300' },
  hiddenByOtherConditions: {
    label: 'hidden: other conditions',
    className: 'border-red-600/40 bg-red-500/15 text-red-800 dark:text-red-300',
  },
  skipped: { label: 'skipped', className: 'border-border bg-muted text-muted-foreground' },
  disabled: { label: 'disabled', className: 'border-dashed border-border bg-muted text-muted-foreground' },
};

/** Rules that did nothing; listed only with "Show skipped rules". */
const isQuiet = (entry: RuleTraceEntry): boolean => entry.outcome === 'skipped' || entry.outcome === 'disabled';

interface RuleTraceProps {
  readonly filter: LootFilter;
  readonly result: EvaluationResult;
  readonly lookup: LootFilterLookup;
  readonly onShowRule: (index: number) => void;
}

/**
 * One row per rule that ran, in order: outcome, summary, and the conditions that failed. Skipped and disabled rules show
 * (muted) only when "Show skipped rules" is ticked. Clicking opens the rule.
 */
export function RuleTrace({ filter, result, lookup, onShowRule }: RuleTraceProps) {
  const [showSkipped, setShowSkipped] = useState(false);
  const skipped = result.trace.filter((entry) => entry.outcome === 'skipped').length;
  const disabled = result.trace.filter((entry) => entry.outcome === 'disabled').length;
  const quietText = `${String(skipped)} skipped${disabled > 0 ? `, ${String(disabled)} disabled` : ''}`;
  const shown = showSkipped ? result.trace : result.trace.filter((entry) => !isQuiet(entry));
  const stoppedAt = result.hiddenBy;
  const notRun = stoppedAt === null ? 0 : filter.rules.length - stoppedAt - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Rule trace</span>
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="loot-filter-test-show-skipped"
            checked={showSkipped}
            onCheckedChange={(checked) => {
              setShowSkipped(checked === true);
            }}
          />
          <Label htmlFor="loot-filter-test-show-skipped" className="text-sm font-normal">
            Show skipped rules ({quietText})
          </Label>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {filter.rules.length === 0 ? 'The filter has no rules.' : `No rule matched; ${quietText}.`}
        </p>
      ) : (
        <ol className="flex flex-col divide-y rounded-md border">
          {shown.map((entry) => {
            const rule = filter.rules.at(entry.index);
            const outcome = OUTCOMES[entry.outcome];
            const summary = rule === undefined ? '' : ruleSummary(rule, lookup, readsExceptions(effectiveActions(rule, filter)));
            return (
              <li key={entry.index}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-w-0 items-start gap-2 px-2 py-1.5 text-left hover:bg-muted/50',
                    entry.outcome === 'disabled' && 'opacity-60',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset'
                  )}
                  title={`Open rule ${String(entry.index + 1)} in the Rules tab`}
                  onClick={() => {
                    onShowRule(entry.index);
                  }}
                >
                  <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {entry.index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn('px-1.5 py-0 text-[0.7rem]', outcome.className)}>
                        {outcome.label}
                      </Badge>
                      {rule?.useStyle !== undefined && (
                        <Badge variant="secondary" className="max-w-40 px-1.5 py-0 text-[0.7rem]">
                          <span className="truncate">{rule.useStyle}</span>
                        </Badge>
                      )}
                      <span className={cn('min-w-0 truncate text-sm', isQuiet(entry) && 'text-muted-foreground')} title={summary}>
                        {summary}
                      </span>
                    </span>
                    {entry.failed.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[0.7rem] text-muted-foreground">failed:</span>
                        {entry.failed.map((key) => (
                          <span key={key} className="rounded bg-muted px-1 font-mono text-[0.7rem] text-muted-foreground">
                            {key}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {stoppedAt !== null && notRun > 0 && (
        <p className="text-xs text-muted-foreground">
          Rule {stoppedAt + 1} hid the item; the {notRun === 1 ? 'rule after it does' : `${String(notRun)} rules after it do`} not run.
        </p>
      )}
    </div>
  );
}
