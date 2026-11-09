import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeadingRow, NoteRow } from '../../utils/ruleSections';

interface RuleHeadingRowProps {
  readonly row: HeadingRow;
  readonly onToggle: (key: string) => void;
}

/** A `// ====` part or `// ----` section of the rule list: click to fold its rules; its notes show under it. */
export function RuleHeadingRow({ row, onToggle }: RuleHeadingRowProps) {
  const Chevron = row.collapsed ? ChevronRight : ChevronDown;
  const part = row.level === 1;
  return (
    <li data-rule-heading={row.level} className={cn(part ? 'bg-muted' : 'bg-muted/40')}>
      <button
        type="button"
        aria-expanded={!row.collapsed}
        className={cn(
          'flex w-full items-center gap-1.5 py-1.5 pr-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
          part ? 'pl-2 text-sm font-semibold' : 'pl-5 text-sm font-medium'
        )}
        onClick={() => {
          onToggle(row.key);
        }}
      >
        <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 break-words">{row.title}</span>
        <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground tabular-nums">{row.ruleCount}</span>
      </button>
      {row.notes.length > 0 && !row.collapsed && (
        <p
          className={cn(
            'pr-3 pb-1.5 text-xs break-words whitespace-pre-line text-muted-foreground',
            part ? 'pl-[1.875rem]' : 'pl-[2.625rem]'
          )}
        >
          {row.notes.join('\n')}
        </p>
      )}
    </li>
  );
}

/** A comment between rules that is not a heading. */
export function RuleNoteRow({ row }: { readonly row: NoteRow }) {
  return <li className="py-1 pr-3 pl-[2.625rem] text-xs break-words text-muted-foreground italic">{row.text}</li>;
}
