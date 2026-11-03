interface EmptyResultsProps {
  /** "No coupon matches." */
  readonly message: string;
  /** "Show every coupon you own" */
  readonly resetLabel: string;
  readonly onReset: () => void;
}

/** What a filtered stash list shows when nothing matches, with a reset link */
export function EmptyResults({ message, resetLabel, onReset }: EmptyResultsProps) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      <button
        type="button"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        onClick={onReset}
      >
        {resetLabel}
      </button>
    </div>
  );
}
