import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SortDir } from '../../engine/urlState';

interface SortSelectProps<K extends string> {
  readonly id: string;
  readonly keys: readonly K[];
  readonly labels: Readonly<Record<K, string>>;
  readonly sort: K;
  readonly dir: SortDir;
  readonly onChange: (sort: K, dir: SortDir) => void;
  readonly className?: string;
}

/** Sort key + direction for card views without column headers (the same state the table headers set) */
export function SortSelect<K extends string>({ id, keys, labels, sort, dir, onChange, className = 'w-32' }: SortSelectProps<K>) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Sort by
      </Label>
      <Select
        value={sort}
        onValueChange={(value) => {
          const key = keys.find((entry) => entry === value);
          if (key !== undefined) onChange(key, dir);
        }}
      >
        <SelectTrigger id={id} size="sm" className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {keys.map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => {
          onChange(sort, dir === 'asc' ? 'desc' : 'asc');
        }}
        aria-label={dir === 'asc' ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'}
        title={dir === 'asc' ? 'Ascending' : 'Descending'}
      >
        {dir === 'asc' ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
      </Button>
    </div>
  );
}
