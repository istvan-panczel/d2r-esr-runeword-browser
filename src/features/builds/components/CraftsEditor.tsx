import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CRAFT_USES_MAX,
  CRAFTS_MAX_PER_SLOT,
  type CraftAnnotation,
  type EquipmentSlot,
  type ItemRef,
  type WeaponSwapSlot,
} from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import { addCraft, craftIdentity, craftPickerGroups, removeCraft, renderCraft, setCraftUses, type CraftLookups } from '../utils/crafts';
import { slotGroup } from '../utils/slotFit';

const MAX_OPTIONS_PER_GROUP = 40;

interface CraftsEditorProps {
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  /** The slot's item: its base type picks the anointment pool */
  readonly item: ItemRef;
  readonly crafts: readonly CraftAnnotation[];
  readonly craftData: CraftDataState;
  readonly onChange: (crafts: readonly CraftAnnotation[]) => void;
  readonly disabled?: boolean;
}

/** "Crafting": a chip per annotation (− / + uses on D-stoning and melds) and an "Add…" picker. */
export function CraftsEditor({ slot, item, crafts, craftData, onChange, disabled }: CraftsEditorProps) {
  const family = slotGroup(slot);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Crafting</span>
      {crafts.map((craft, index) => {
        const rendered = renderCraft(craft, family, craftData.lookups, item);
        const stacking = craft.kind === 'dstone' || craft.kind === 'meld';
        return (
          <Badge
            key={`${String(index)}:${craftIdentity(craft)}`}
            variant="secondary"
            className={cn('max-w-full gap-1 pr-1', rendered.stale && craftData.status === 'ready' && 'text-muted-foreground')}
            title={[...rendered.lines, ...(rendered.note !== undefined ? [rendered.note] : [])].join('\n') || undefined}
          >
            <span className="truncate">{rendered.title}</span>
            {stacking && (
              <>
                <button
                  type="button"
                  disabled={disabled || craft.uses <= 1}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-40"
                  aria-label={`Fewer uses of ${rendered.title}`}
                  onClick={() => {
                    onChange(setCraftUses(crafts, index, craft.uses - 1));
                  }}
                >
                  <Minus className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={disabled || craft.uses >= CRAFT_USES_MAX}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-40"
                  aria-label={`More uses of ${rendered.title}`}
                  onClick={() => {
                    onChange(setCraftUses(crafts, index, craft.uses + 1));
                  }}
                >
                  <Plus className="size-3" />
                </button>
              </>
            )}
            <button
              type="button"
              disabled={disabled}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Remove ${rendered.title}`}
              onClick={() => {
                onChange(removeCraft(crafts, index));
              }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        );
      })}
      {crafts.length < CRAFTS_MAX_PER_SLOT && (
        <CraftPicker
          slot={slot}
          item={item}
          crafts={crafts}
          craftData={craftData}
          disabled={disabled}
          onSelect={(craft) => {
            onChange(addCraft(crafts, craft));
          }}
        />
      )}
    </div>
  );
}

interface CraftPickerProps {
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  readonly item: ItemRef;
  readonly crafts: readonly CraftAnnotation[];
  readonly craftData: CraftDataState;
  readonly disabled?: boolean;
  readonly onSelect: (craft: CraftAnnotation) => void;
}

function CraftPicker({ slot, item, crafts, craftData, disabled, onSelect }: CraftPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // The anointment pool picked first when the item's base is unknown (several item type pools)
  const [pool, setPool] = useState<string | undefined>(undefined);

  const select = (craft: CraftAnnotation) => {
    onSelect(craft);
    setOpen(false);
    setQuery('');
    setPool(undefined);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setPool(undefined);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-6 gap-1 px-2 text-xs">
          <Plus className="size-3" />
          Add…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Forging, D-stone, meld, corruption..." value={query} onValueChange={setQuery} />
          <CommandList>
            {craftData.status === 'ready' ? (
              <CraftOptions
                slot={slot}
                item={item}
                crafts={crafts}
                lookups={craftData.lookups}
                query={query}
                pool={pool}
                onSelect={select}
                onPool={(next) => {
                  setPool(next);
                  setQuery('');
                }}
              />
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {craftData.status === 'error' ? 'Game data unavailable.' : 'Loading…'}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CraftOptionsProps {
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  readonly item: ItemRef;
  readonly crafts: readonly CraftAnnotation[];
  readonly lookups: CraftLookups;
  readonly query: string;
  /** The anointment pool picked for an item with an unknown base */
  readonly pool: string | undefined;
  readonly onSelect: (craft: CraftAnnotation) => void;
  readonly onPool: (pool: string) => void;
}

function CraftOptions({ slot, item, crafts, lookups, query, pool, onSelect, onPool }: CraftOptionsProps) {
  const q = query.trim().toLowerCase();
  const groups = craftPickerGroups(slot, lookups, crafts, item, pool)
    .map((group) => {
      const matches = group.options.filter((option) => q === '' || option.search.includes(q));
      return { ...group, total: matches.length, options: matches.slice(0, MAX_OPTIONS_PER_GROUP) };
    })
    .filter((group) => group.options.length > 0);

  if (groups.length === 0) return <div className="py-6 text-center text-sm text-muted-foreground">No matching crafting option.</div>;
  return groups.map((group) => (
    <CommandGroup
      key={group.heading}
      heading={
        group.total > group.options.length ? `${group.heading} (${String(group.options.length)} of ${String(group.total)})` : group.heading
      }
    >
      {group.options.map((option) => (
        <CommandItem
          key={option.id}
          value={`${group.heading}:${option.id}`}
          onSelect={() => {
            if (option.craft !== null) onSelect(option.craft);
            else if (option.pool !== undefined) onPool(option.pool);
          }}
        >
          <span className="min-w-0">
            <span className="block truncate text-xs">{option.label}</span>
            {option.detail !== '' && <span className="block truncate text-[11px] text-muted-foreground">{option.detail}</span>}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  ));
}
