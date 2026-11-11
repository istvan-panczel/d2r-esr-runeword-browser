import type { CSSProperties } from 'react';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { itemNameClass } from '@/features/stash/components/items/itemClasses';
import type { ItemRow } from '@/features/stash/engine/items/allItems';
import { cn } from '@/lib/utils';

interface ItemTileProps {
  /** Slot or place label above the icon ("Head", "Row 2, col 3"); omitted on the charm tiles */
  readonly label?: string;
  /** null: an empty slot (not selectable) */
  readonly row: ItemRow | null;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly iconSize?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * One compact item: icon, name in its quality colour and the slot. A button: clicking, tapping or Enter / Space shows the
 * item's full tooltip card next to the grid (`aria-pressed` while it is the one shown).
 */
export function ItemTile({ label, row, selected, onSelect, iconSize = 44, className, style }: ItemTileProps) {
  if (row === null) {
    return (
      <div
        style={style}
        className={cn(
          'flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-1.5 text-center text-xs text-muted-foreground',
          className
        )}
      >
        {label !== undefined && <span className="text-[0.65rem] font-medium tracking-wide uppercase">{label}</span>}
        <span>Empty</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      style={style}
      aria-pressed={selected}
      title={`${row.name}${label === undefined ? '' : ` (${label})`}`}
      className={cn(
        'flex min-h-20 min-w-0 flex-col items-center justify-start gap-1 rounded-lg border bg-card p-1.5 text-center shadow-sm transition-colors outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary',
        className
      )}
      onClick={onSelect}
    >
      {label !== undefined && <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>}
      <ItemIcon item={row.info.icon} size={iconSize} />
      <span className={cn('line-clamp-2 text-xs leading-tight font-medium break-words', itemNameClass(row))}>{row.name}</span>
    </button>
  );
}
