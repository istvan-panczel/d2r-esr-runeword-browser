import { useState } from 'react';
import { ChevronsUpDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ItemRef } from '../buildData';
import { useEquipmentPickerData, useEquipmentPickerDataQuery, type EquipmentPickerData } from '../hooks/useEquipmentPickerData';
import { freetextRef, gemwordToRef, itemRefName, mythicalToRef, runewordToRef, setItemToRef, uniqueToRef } from '../utils/buildSnapshot';
import { itemFitsSlot, type PickerSlot } from '../utils/slotFit';
import { mythicalVariantHints, uniqueVariantHints } from '../utils/variantHints';

const MAX_PER_GROUP = 8;

interface EquipmentSlotPickerProps {
  readonly label: string;
  /** The slot being filled; results are filtered to items that fit it unless "Show all items" is on. */
  readonly slot: PickerSlot;
  readonly value: ItemRef | null;
  readonly onChange: (ref: ItemRef | null) => void;
  readonly disabled?: boolean;
}

/**
 * Inline autocomplete for one equipment slot. Searches the local item DB
 * (uniques, mythical uniques, runewords, gemwords) and the sets.json game-data
 * bundle (set items, matched by item or set name) grouped by type, with a
 * freetext fallback for items not in the database. Results are limited to items
 * that fit the slot (see utils/slotFit); "Show all items" lifts the limit.
 */
export function EquipmentSlotPicker(props: EquipmentSlotPickerProps) {
  // The build form provides the data once for all its pickers; without a provider the picker loads its own.
  const shared = useEquipmentPickerData();
  if (shared !== null) return <SlotPicker {...props} data={shared} />;
  return <OwnDataSlotPicker {...props} />;
}

function OwnDataSlotPicker(props: EquipmentSlotPickerProps) {
  const data = useEquipmentPickerDataQuery();
  return <SlotPicker {...props} data={data} />;
}

interface SlotPickerProps extends EquipmentSlotPickerProps {
  readonly data: EquipmentPickerData;
}

function SlotPicker({ label, slot, value, onChange, disabled, data }: SlotPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const items = data.items;
  // Loaded separately from the local DB; until it arrives (or if it fails) the group is just empty.
  const setItems = data.setItems ?? [];

  const q = query.trim().toLowerCase();
  const showResults = q.length > 0 && items !== undefined;
  const nameMatches = (name: string) => name.toLowerCase().includes(q);

  // Name matches per group, before the slot filter (to count what the filter hides).
  const uniqueMatches = showResults ? items.uniques.filter((i) => nameMatches(i.name)) : [];
  const mythicalMatches = showResults ? items.mythicals.filter((i) => nameMatches(i.name)) : [];
  const runewordMatches = showResults ? items.runewords.filter((i) => nameMatches(i.name)) : [];
  const gemwordMatches = showResults ? items.gemwords.filter((i) => nameMatches(i.name)) : [];
  const setMatches = showResults ? setItems.filter((entry) => nameMatches(entry.item.name) || nameMatches(entry.set.name)) : [];

  const fitUniques = uniqueMatches.filter((i) => showAll || itemFitsSlot(slot, { type: 'unique', category: i.category }));
  const fitMythicals = mythicalMatches.filter(
    (i) => showAll || itemFitsSlot(slot, { type: 'mythical', category: i.category, baseItem: i.baseItem })
  );
  const fitSetItems = setMatches.filter((entry) => showAll || itemFitsSlot(slot, { type: 'set', category: entry.item.category }));
  const fitRunewords = runewordMatches.filter((i) => showAll || itemFitsSlot(slot, { type: 'runeword', allowedItems: i.allowedItems }));
  const fitGemwords = gemwordMatches.filter((i) => showAll || itemFitsSlot(slot, { type: 'gemword', allowedItems: i.allowedItems }));
  const hiddenCount =
    uniqueMatches.length +
    mythicalMatches.length +
    setMatches.length +
    runewordMatches.length +
    gemwordMatches.length -
    (fitUniques.length + fitMythicals.length + fitSetItems.length + fitRunewords.length + fitGemwords.length);

  const uniques = fitUniques.slice(0, MAX_PER_GROUP);
  const mythicals = fitMythicals.slice(0, MAX_PER_GROUP);
  const setItemResults = fitSetItems.slice(0, MAX_PER_GROUP);
  const runewords = fitRunewords.slice(0, MAX_PER_GROUP);
  const gemwords = fitGemwords.slice(0, MAX_PER_GROUP);

  // Names with more than one variant get their allowed items appended to disambiguate.
  const runewordVariantCounts = new Map<string, number>();
  for (const rw of items?.runewords ?? []) runewordVariantCounts.set(rw.name, (runewordVariantCounts.get(rw.name) ?? 0) + 1);
  const gemwordVariantCounts = new Map<string, number>();
  for (const gw of items?.gemwords ?? []) gemwordVariantCounts.set(gw.name, (gemwordVariantCounts.get(gw.name) ?? 0) + 1);

  // Same-name uniques/mythicals that look identical by base item (+ coupon flag) get their
  // distinguishing property lines. Computed over the full lists so sliced results stay consistent.
  const uniqueHints = items !== undefined ? uniqueVariantHints(items.uniques) : undefined;
  const mythicalHints = items !== undefined ? mythicalVariantHints(items.mythicals) : undefined;

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
            <label className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <Checkbox
                checked={showAll}
                onCheckedChange={(checked) => {
                  setShowAll(checked === true);
                }}
              />
              Show all items
              {!showAll && hiddenCount > 0 && <span className="ml-auto">{hiddenCount} for other slots hidden</span>}
            </label>
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
                        <ItemOptionLabel
                          name={item.name}
                          baseItem={item.baseItem}
                          isAncientCoupon={item.isAncientCoupon}
                          hints={uniqueHints?.get(item)}
                        />
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
                        <ItemOptionLabel name={item.name} baseItem={item.baseItem} hints={mythicalHints?.get(item)} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {setItemResults.length > 0 && (
                <CommandGroup heading="Set Items">
                  {setItemResults.map(({ item, set }) => (
                    <CommandItem
                      key={`s-${item.name}`}
                      value={`s-${item.name}`}
                      onSelect={() => {
                        select(setItemToRef(item, set));
                      }}
                    >
                      <SetItemOptionLabel name={item.name} setName={set.name} baseItem={item.baseName} />
                    </CommandItem>
                  ))}
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

interface ItemOptionLabelProps {
  readonly name: string;
  readonly baseItem: string;
  readonly isAncientCoupon?: boolean;
  readonly hints?: readonly string[];
}

/** Picker row for a unique/mythical: name + muted base item (+ coupon marker), optional second line of distinguishing stats. */
function ItemOptionLabel({ name, baseItem, isAncientCoupon = false, hints }: ItemOptionLabelProps) {
  const hintText = hints !== undefined && hints.length > 0 ? hints.join(' · ') : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate" title={[name, baseItem, isAncientCoupon ? 'Ancient Coupon' : ''].filter(Boolean).join(' — ')}>
        {name}
        {baseItem !== '' && <span className="ml-1 text-xs text-muted-foreground">{baseItem}</span>}
        {isAncientCoupon && <span className="ml-1 text-xs font-medium text-purple-600 dark:text-purple-400">Ancient Coupon</span>}
      </span>
      {hintText !== null && (
        <span className="truncate text-xs text-muted-foreground" title={hintText}>
          {hintText}
        </span>
      )}
    </div>
  );
}

/** Picker row for a set item: green name + muted base, then the set name. */
function SetItemOptionLabel({ name, setName, baseItem }: { readonly name: string; readonly setName: string; readonly baseItem: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate" title={`${name} — ${baseItem}`}>
        <span className="text-green-700 dark:text-green-400">{name}</span>
        {baseItem !== '' && <span className="ml-1 text-xs text-muted-foreground">{baseItem}</span>}
      </span>
      <span className="truncate text-xs text-muted-foreground" title={setName}>
        {setName}
      </span>
    </div>
  );
}
