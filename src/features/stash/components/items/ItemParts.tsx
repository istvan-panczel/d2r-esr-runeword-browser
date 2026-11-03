/* eslint-disable react-refresh/only-export-components -- small row parts shared by the item table and the item cards */
import { itemPageUrl, kindLabel, type ItemRow } from '../../engine/items/allItems';
import { itemQuantityLabel } from '../../engine/items/itemNames';
import { NameLink } from '../shared/NameLink';
import { ToneBadge } from '../shared/ToneBadge';
import { itemNameClass } from './itemClasses';

/**
 * The item's name in its quality colour (a link for uniques, set items, runewords), the copy button and the stack size
 * (`quantity`, default on; the tooltip cards have it as their "Quantity" line instead)
 */
export function ItemName({ row, quantity: showQuantity = true }: { readonly row: ItemRow; readonly quantity?: boolean }) {
  const quantity = showQuantity ? itemQuantityLabel(row.item) : null;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
      <NameLink name={row.name} to={itemPageUrl(row)} className={itemNameClass(row)} />
      {quantity !== null && <span className="text-xs text-muted-foreground tabular-nums">{quantity}</span>}
    </span>
  );
}

/** "Shako · Helm": the base (unless the name is the base's) and its item type (unless it is the base's name) */
export function baseTypeText(row: ItemRow): string {
  const parts = [row.info.baseName === row.name ? null : row.info.baseName, row.info.typeName].filter(
    (part, index, list): part is string => part !== null && part !== '' && part !== row.name && list.indexOf(part) === index
  );
  return parts.join(' · ');
}

export function BaseTypeLine({ row }: { readonly row: ItemRow }) {
  return <span className="block text-xs font-normal break-words text-muted-foreground">{baseTypeText(row)}</span>;
}

/** "2/3 filled: Ber Rune, Jewel" ("3 sockets", "2 sockets, empty"); a dash (compact: nothing) without sockets */
export function SocketsInfo({ row, compact = false }: { readonly row: ItemRow; readonly compact?: boolean }) {
  const sockets = row.item.sockets ?? 0;
  if (sockets === 0) return compact ? null : <span className="text-muted-foreground">—</span>;
  const filled = row.socketed.length;
  return (
    <span className="min-w-0">
      <span className="tabular-nums whitespace-nowrap">
        {filled === sockets || filled === 0
          ? `${String(sockets)} socket${sockets === 1 ? '' : 's'}${filled === 0 ? ', empty' : ''}`
          : `${String(filled)}/${String(sockets)} filled`}
      </span>
      {filled > 0 && (
        <span className={compact ? undefined : 'block text-xs text-muted-foreground'}>
          {compact && ': '}
          {row.socketed.map((entry) => entry.name).join(', ')}
        </span>
      )}
    </span>
  );
}

export function EtherealBadge() {
  return <ToneBadge label="Ethereal" tone="neutral" />;
}

/** Quality label of a row ("Unique", "Gemword") */
export function KindText({ row }: { readonly row: ItemRow }) {
  return <span className="whitespace-nowrap">{kindLabel(row)}</span>;
}
