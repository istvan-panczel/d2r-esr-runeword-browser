import { Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StyleValueMarkProps {
  readonly origin: 'style' | 'changed';
  readonly styleName: string;
  /** Removes the rule's own value, so the style's shows again. */
  readonly onReset: () => void;
}

/** After a field's label: "from style X" (muted) or "changed from style X" with a Reset to style button. */
export function StyleValueMark({ origin, styleName, onReset }: StyleValueMarkProps) {
  if (origin === 'style') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 text-[0.7rem] text-muted-foreground"
        title={`The value of the style “${styleName}”; change it to override it for this rule`}
      >
        <Palette className="size-3" aria-hidden />
        from style {styleName}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className="rounded-sm border border-sky-500/50 px-1.5 text-[0.7rem] text-sky-700 dark:text-sky-400"
        title={`This rule's own value overrides the style “${styleName}”`}
      >
        changed from style {styleName}
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={onReset}>
        <RotateCcw className="size-3" aria-hidden />
        Reset to style
      </Button>
    </span>
  );
}
