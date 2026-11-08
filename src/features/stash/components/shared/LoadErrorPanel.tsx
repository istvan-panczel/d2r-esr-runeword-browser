import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** One label + value row of the Details block (positions only, never item contents) */
export type LoadErrorRow = readonly [label: string, value: string];

interface LoadErrorPanelProps {
  readonly title: string;
  readonly message: string;
  /** What to do next */
  readonly hint?: string | null;
  /** File name, for an error of a remembered file */
  readonly fileName?: string;
  readonly onDismiss?: () => void;
  /** Shown under the message, e.g. "Forget stored file" */
  readonly action?: ReactNode;
  /** The Details block: the parser's failure point */
  readonly details?: readonly LoadErrorRow[] | null;
}

/** A failed upload or remembered file: what went wrong, what to do and where the parser stopped (My Stash, My Character). */
export function LoadErrorPanel({ title, message, hint, fileName, onDismiss, action, details }: LoadErrorPanelProps) {
  return (
    <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">
            {title}
            {fileName !== undefined && <span className="font-normal text-muted-foreground"> ({fileName})</span>}
          </p>
          <p className="break-words">{message}</p>
          {hint !== null && hint !== undefined && <p className="text-muted-foreground">{hint}</p>}
        </div>
        {onDismiss !== undefined && (
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={onDismiss} aria-label="Dismiss">
            <X className="size-4" />
          </Button>
        )}
      </div>
      {details !== null && details !== undefined && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Details</summary>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {action !== undefined && <div className="pl-6">{action}</div>}
    </div>
  );
}
