import { useState } from 'react';
import { ChevronsUpDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ItemRef } from '../buildData';
import { useEquipmentItems } from '../hooks/useEquipmentItems';
import { freetextRef, gemwordToRef, itemRefName, mythicalToRef, runewordToRef, uniqueToRef } from '../utils/buildSnapshot';

const MAX_PER_GROUP = 8;

interface EquipmentSlotPickerProps {
  readonly label: string;
  readonly value: ItemRef | null;
  readonly onChange: (ref: ItemRef | null) => void;
  readonly disabled?: boolean;
}

/**
 * Inline autocomplete for one equipment slot. Searches the local item DB
 * (uniques, mythical uniques, runewords, gemwords) grouped by type, with a
 * freetext fallback for items not in the database.
 */
export function EquipmentSlotPicker({ label, value, onChange, disabled }: EquipmentSlotPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const items = useEquipmentItems();

  const q = query.trim().toLowerCase();
  const showResults = q.length > 0 && items !== undefined;
  const nameMatches = (name: string) => name.toLowerCase().includes(q);

  const uniques = showResults ? items.uniques.filter((i) => nameMatches(i.name)).slice(0, MAX_PER_GROUP) : [];
  const mythicals = showResults ? items.mythicals.filter((i) => nameMatches(i.name)).slice(0, MAX_PER_GROUP) : [];
  const runewords = showResults ? items.runewords.filter((i) => nameMatches(i.name)).slice(0, MAX_PER_GROUP) : [];
  const gemwords = showResults ? items.gemwords.filter((i) => nameMatches(i.name)).slice(0, MAX_PER_GROUP) : [];

  // Names with more than one variant get their allowed items appended to disambiguate.
  const runewordVariantCounts = new Map<string, number>();
  for (const rw of items?.runewords ?? []) runewordVariantCounts.set(rw.name, (runewordVariantCounts.get(rw.name) ?? 0) + 1);
  const gemwordVariantCounts = new Map<string, number>();
  for (const gw of items?.gemwords ?? []) gemwordVariantCounts.set(gw.name, (gemwordVariantCounts.get(gw.name) ?? 0) + 1);

  const select = (ref: ItemRef | null) => {
    onChange(ref);
    setOpen(false);
    setQuery('');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" disabled={disabled} className="w-full justify-between font-normal" aria-label={`${label} slot`}>
            <span className={cn('truncate', value === null && 'text-muted-foreground')}>
              {value !== null ? itemRefName(value) : 'Empty'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search items..." value={query} onValueChange={setQuery} />
            <CommandList>
              {value !== null && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      select(null);
                    }}
                  >
                    <X className="size-4" />
                    Clear slot
                  </CommandItem>
                </CommandGroup>
              )}

              {items === undefined && <div className="py-6 text-center text-sm text-muted-foreground">Loading items…</div>}

              {items !== undefined && !showResults && (
                <div className="py-6 text-center text-sm text-muted-foreground">Type to search items.</div>
              )}

              {uniques.length > 0 && (
                <CommandGroup heading="Unique Items">
                  {uniques.map((item) => {
                    const ref = uniqueToRef(item);
                    return ref === null ? null : (
                      <CommandItem
                        key={`u-${String(item.id)}`}
                        value={`u-${String(item.id)}`}
                        onSelect={() => {
                          select(ref);
                        }}
                      >
                        {item.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {mythicals.length > 0 && (
                <CommandGroup heading="Mythical Uniques">
                  {mythicals.map((item) => {
                    const ref = mythicalToRef(item);
                    return ref === null ? null : (
                      <CommandItem
                        key={`m-${String(item.id)}`}
                        value={`m-${String(item.id)}`}
                        onSelect={() => {
                          select(ref);
                        }}
                      >
                        {item.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {runewords.length > 0 && (
                <CommandGroup heading="Runewords">
                  {runewords.map((rw) => (
                    <CommandItem
                      key={`r-${rw.name}-${String(rw.variant)}`}
                      value={`r-${rw.name}-${String(rw.variant)}`}
                      onSelect={() => {
                        select(runewordToRef(rw));
                      }}
                    >
                      {rw.name}
                      {(runewordVariantCounts.get(rw.name) ?? 0) > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">({rw.allowedItems.join(', ')})</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {gemwords.length > 0 && (
                <CommandGroup heading="Gemwords">
                  {gemwords.map((gw) => (
                    <CommandItem
                      key={`g-${gw.name}-${String(gw.variant)}`}
                      value={`g-${gw.name}-${String(gw.variant)}`}
                      onSelect={() => {
                        select(gemwordToRef(gw));
                      }}
                    >
                      {gw.name}
                      {(gemwordVariantCounts.get(gw.name) ?? 0) > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">({gw.allowedItems.join(', ')})</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {showResults && (
                <CommandGroup heading="Custom">
                  <CommandItem
                    value="__freetext__"
                    onSelect={() => {
                      select(freetextRef(query));
                    }}
                  >
                    <Plus className="size-4" />
                    Use “{query.trim()}” as a custom item
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
