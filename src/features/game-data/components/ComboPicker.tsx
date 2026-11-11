import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MAX_RESULTS = 100;

export interface ComboOption {
  readonly id: string;
  readonly label: string;
  /** Secondary text (recipe, key, sockets) */
  readonly detail: string;
  /** Lowercase text the query is matched against */
  readonly search: string;
}

interface ComboPickerProps {
  readonly id: string;
  readonly options: readonly ComboOption[];
  readonly selectedId: string | null;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly onSelect: (id: string) => void;
  readonly className?: string;
  /** The most options shown at once (default 100); a short list that must stay whole without typing passes its length */
  readonly maxResults?: number;
}

/** cmdk combobox in a popover; every whitespace-separated query term must appear in `search`. */
export function ComboPicker({
  id,
  options,
  selectedId,
  placeholder,
  searchPlaceholder,
  onSelect,
  className,
  maxResults = MAX_RESULTS,
}: ComboPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = options.filter((option) => terms.every((term) => option.search.includes(term))).slice(0, maxResults);
  const selected = options.find((option) => option.id === selectedId);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className={cn('justify-between font-normal', className)}>
          <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
            {selected === undefined ? placeholder : `${selected.label} · ${selected.detail}`}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            {matches.map((option) => (
              <CommandItem
                key={option.id}
                value={option.id}
                onSelect={() => {
                  onSelect(option.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{option.detail}</span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
