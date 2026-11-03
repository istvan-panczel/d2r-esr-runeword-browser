import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';

interface PageSelectProps {
  readonly id: string;
  /** The in-game pages to offer (1-based, ascending) */
  readonly pages: readonly number[];
  /** null: every page */
  readonly value: number | null;
  readonly onChange: (page: number | null) => void;
  readonly label?: string;
}

/** The "Stash page" filter: All pages, or one of the pages holding a listed item */
export function PageSelect({ id, pages, value, onChange, label = 'Stash page' }: PageSelectProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value === null ? ALL : String(value)}
        onValueChange={(next) => {
          onChange(next === ALL ? null : Number(next));
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All pages</SelectItem>
          {pages.map((page) => (
            <SelectItem key={page} value={String(page)}>
              Page {page}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
