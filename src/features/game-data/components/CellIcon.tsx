import { cn } from '@/lib/utils';
import type { CubeIconRef } from '../engine/cubeIcons';
import type { ItemIconRef } from '../hooks/useItemIcons';
import { ItemIcon } from './ItemIcon';

/** Side of the icons next to cube ingredients, results and materials, in CSS pixels */
export const CELL_ICON_SIZE = 28;

const TYPE_TITLE = 'Example art: any item of this type works';

/**
 * A fixed-width icon slot in front of a cube cell or material name, so the names of a list line up whether or not
 * each has art. `item` null keeps the empty slot; an item without art (or a broad type such as Weapon) leaves it empty
 * too. Decorative: the name is next to it.
 */
export function CellIcon({ item }: { readonly item: CubeIconRef | ItemIconRef | null }) {
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center"
      title={item?.kind === 'type' ? TYPE_TITLE : undefined}
      aria-hidden="true"
    >
      {item !== null && <ItemIcon item={item} size={CELL_ICON_SIZE} />}
    </span>
  );
}

/** Inline icons of a recipe's ingredients (a card title's "Weapon + Worldstone Shard"); items without art are left out */
export function IngredientIcons({ items, size = CELL_ICON_SIZE }: { readonly items: readonly ItemIconRef[]; readonly size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-hidden="true">
      {items.map((item, i) => (
        <ItemIcon key={`${String(i)}-${item.kind}`} item={item} size={size} />
      ))}
    </span>
  );
}

/** Side of the icons inside a line of text (Vessel of Souls materials) */
export const INLINE_ICON_SIZE = 22;

/** "2× Heart + Brain + Tail" with each item's icon in front of its name; wraps between items */
export function IconList({
  items,
  className,
}: {
  readonly items: readonly { readonly item: ItemIconRef; readonly text: string }[];
  readonly className?: string;
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
      {items.map(({ item, text }, i) => (
        <span key={`${String(i)}-${text}`} className="inline-flex items-center gap-1">
          {i > 0 && <span aria-hidden="true">+</span>}
          <ItemIcon item={item} size={INLINE_ICON_SIZE} />
          {text}
        </span>
      ))}
    </span>
  );
}
