import { CircleAlert, TriangleAlert } from 'lucide-react';
import { quirkOfMessage } from '../../engine/statQuirks';
import type { Diagnostic } from '../../engine/types';

/** A rule's own path in the file: `rules/<n>` or, for a disabled rule, `disabledRules/<n>/rule`. */
const RULE_PATH = /^(?:rules\/\d+|disabledRules\/\d+\/rule)(?:\/|$)/;

interface RuleDiagnosticsProps {
  /** This rule's diagnostics only. */
  readonly diagnostics: readonly Diagnostic[];
}

/** The rule's problems as a compact list (errors first); the path is shown relative to the rule. */
export function RuleDiagnostics({ diagnostics }: RuleDiagnosticsProps) {
  if (diagnostics.length === 0) return null;
  const sorted = [...diagnostics].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return (
    <ul className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm" aria-label="Problems with this rule">
      {sorted.map((diagnostic, position) => {
        const path = diagnostic.path.replace(RULE_PATH, '');
        // A stat the plugin reads as 0 here: its headline in red first, so it is not lost among the other warnings.
        const quirk = quirkOfMessage(diagnostic.message);
        return (
          <li key={`${diagnostic.path}-${String(position)}`} className="flex items-start gap-2">
            {diagnostic.severity === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Error" />
            ) : (
              <TriangleAlert
                className={
                  quirk?.confirmed === true
                    ? 'mt-0.5 size-4 shrink-0 text-destructive'
                    : 'mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400'
                }
                aria-label="Warning"
              />
            )}
            <span className="min-w-0 break-words">
              {quirk?.confirmed === true && <strong className="mr-1 font-medium text-destructive">{quirk.headline}.</strong>}
              {diagnostic.message}
              {path !== '' && <code className="ml-2 text-xs break-all text-muted-foreground">{path}</code>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
