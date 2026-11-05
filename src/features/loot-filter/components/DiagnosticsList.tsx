import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Diagnostic, LootFilter } from '../engine/types';
import { CopyProblemsButton } from './ai/CopyProblemsButton';

export const DIAGNOSTICS_LIST_ID = 'loot-filter-diagnostics';

/** How many rows show before "Show all". */
const INITIAL_ROWS = 100;

interface DiagnosticsListProps {
  readonly diagnostics: readonly Diagnostic[];
  /** Selects the rule and switches to the Rules tab. */
  readonly onShowRule: (index: number) => void;
  /** When given, problems with a path also get a "Show in JSON" button (the JSON tab selects the path in its text). */
  readonly onShowInJson?: (diagnostic: Diagnostic) => void;
  /** The open model, for the rule comments of "Copy problems for the AI"; null when the text cannot be read. */
  readonly filter: LootFilter | null;
}

/**
 * Every problem with the filter: severity, path and message; rule problems link to their rule, and with `onShowInJson`
 * a problem with a path links to its place in the text. Errors come first. "Copy problems for the AI" copies them as a
 * follow-up message for an LLM.
 */
export function DiagnosticsList({ diagnostics, onShowRule, onShowInJson, filter }: DiagnosticsListProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...diagnostics].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const rows = showAll ? sorted : sorted.slice(0, INITIAL_ROWS);

  return (
    <section id={DIAGNOSTICS_LIST_ID} className="scroll-mt-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Problems</h2>
        <CopyProblemsButton diagnostics={sorted} filter={filter} />
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No problems found.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Unknown keys are warnings: they are kept in the file as they are, but only the JSON tab can edit them.
          </p>
          <ul className="divide-y rounded-md border">
            {rows.map((diagnostic, index) => (
              <li
                key={`${diagnostic.path}-${String(index)}`}
                className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-start sm:gap-3"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    'w-16 justify-center',
                    diagnostic.severity === 'error'
                      ? 'border-destructive/50 text-destructive'
                      : 'border-amber-500/50 text-amber-700 dark:text-amber-400'
                  )}
                >
                  {diagnostic.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="break-words">{diagnostic.message}</p>
                  {diagnostic.path !== '' && <code className="break-all text-xs text-muted-foreground">{diagnostic.path}</code>}
                </div>
                {(diagnostic.rule !== undefined || (onShowInJson && diagnostic.path !== '')) && (
                  <div className="flex shrink-0 gap-3 self-start">
                    {diagnostic.rule !== undefined && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => {
                          if (diagnostic.rule !== undefined) onShowRule(diagnostic.rule);
                        }}
                      >
                        Rule {diagnostic.rule + 1}
                      </Button>
                    )}
                    {onShowInJson && diagnostic.path !== '' && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => {
                          onShowInJson(diagnostic);
                        }}
                      >
                        Show in JSON
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {sorted.length > rows.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAll(true);
              }}
            >
              Show all {sorted.length}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
