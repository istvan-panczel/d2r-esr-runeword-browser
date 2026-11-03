import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortDir } from '../../engine/urlState';
import { SORT_HEAD_CLASS } from './classes';

interface SortHeaderProps<K extends string> {
  readonly label: string;
  readonly column: K;
  readonly sort: K;
  readonly dir: SortDir;
  readonly onSort: (sort: K, dir: SortDir) => void;
  /** The direction a column starts in when first clicked */
  readonly initialDir: (column: K) => SortDir;
  readonly className?: string;
  readonly title?: string;
}

/** A sortable table header: click sorts by the column (in its initial direction), clicking again reverses. */
export function SortHeader<K extends string>({ label, column, sort, dir, onSort, initialDir, className, title }: SortHeaderProps<K>) {
  const active = sort === column;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      className={cn(SORT_HEAD_CLASS, className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          onSort(column, active ? (dir === 'asc' ? 'desc' : 'asc') : initialDir(column));
        }}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  );
}
