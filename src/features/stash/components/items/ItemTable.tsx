import { PeekPopover } from '@/components/PeekPopover';
import { TierBadge } from '@/features/game-data/components/TierBadge';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { cn } from '@/lib/utils';
import { fillStatLabel, initialItemSortDir, kindLabel, type ItemRow, type ItemSortKey, type SortDir } from '../../engine/items/allItems';
import { formatLocation } from '../../engine/locations';
import { useItemPeek } from '../../hooks/useItemPeek';
import { SORT_HEAD_CLASS } from '../shared/classes';
import { SortHeader as SharedSortHeader } from '../shared/SortHeader';
import { ItemCard } from './ItemCards';
import { BaseTypeLine, EtherealBadge, ItemName, KindText, SocketsInfo } from './ItemParts';
import { STAT_LINE_CLASS } from './itemClasses';

interface ItemTableProps {
  readonly rows: readonly ItemRow[];
  readonly sort: ItemSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: ItemSortKey, dir: SortDir) => void;
  /** The stat keys shown in their own column: the stat conditions' and the stat sort's */
  readonly shownStats: readonly string[];
}

const CELL_CLASS = 'border-t px-2 py-1.5 align-top';
/** Columns beside the item: from md up; phones get them as one line under the name */
const WIDE_HEAD = `hidden md:table-cell ${SORT_HEAD_CLASS}`;
const WIDE_CELL = `hidden md:table-cell ${CELL_CLASS}`;

interface SortHeaderProps {
  readonly label: string;
  readonly column: ItemSortKey;
  readonly sort: ItemSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: ItemSortKey, dir: SortDir) => void;
  readonly className?: string;
  readonly title?: string;
}

function SortHeader(props: SortHeaderProps) {
  return <SharedSortHeader {...props} initialDir={initialItemSortDir} />;
}

/** "+20% Faster Cast Rate": the shown stats the row has, each with the row's value */
function StatValues({
  row,
  shownStats,
  className,
}: {
  readonly row: ItemRow;
  readonly shownStats: readonly string[];
  readonly className?: string;
}) {
  const values = shownStats.flatMap((key) => {
    const stat = row.stats.get(key);
    return stat === undefined ? [] : [{ key, line: fillStatLabel(stat.label, stat) }];
  });
  if (values.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className={className}>
      {values.map((value) => (
        <li key={value.key} className={STAT_LINE_CLASS}>
          {value.line}
        </li>
      ))}
    </ul>
  );
}

/**
 * One row per item: icon, name, base · type, quality, tier, item level, ethereal, sockets, location (and chosen stats).
 * Hovering a row, focusing its name or copy button, or tapping its name peeks at the item's whole tooltip card
 * (useItemPeek: one popover for the table, above the row, or below it when there is no room).
 */
export function ItemTable({ rows, sort, dir, onSort, shownStats }: ItemTableProps) {
  const header = { sort, dir, onSort };
  const { peek, peekKey, wrapperProps } = useItemPeek();
  const peekRow = peekKey === null ? undefined : rows.find((row) => row.key === peekKey);
  return (
    <div className="rounded-md border bg-card">
      <table className="w-full border-collapse text-sm" {...wrapperProps}>
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <SortHeader label="Item" column="name" {...header} />
            <SortHeader label="Quality" column="quality" className="hidden md:table-cell" {...header} />
            <th scope="col" className={WIDE_HEAD}>
              Tier
            </th>
            <SortHeader label="iLvl" column="ilvl" title="Item level" className="hidden md:table-cell" {...header} />
            <th scope="col" className={WIDE_HEAD} title="Ethereal">
              Eth.
            </th>
            <th scope="col" className={WIDE_HEAD}>
              Sockets
            </th>
            {shownStats.length > 0 && (
              <th scope="col" className={WIDE_HEAD}>
                Stats
              </th>
            )}
            <SortHeader
              label="Where"
              column="location"
              title="Page, row and column, counted from 1 at the top left"
              className="hidden md:table-cell"
              {...header}
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              data-item-row={row.key}
              className={cn('hover:bg-muted/30', peek.open && peekKey === row.key && 'bg-muted/40')}
            >
              <th scope="row" className={`${CELL_CLASS} text-left font-medium`}>
                <div className="flex items-start gap-2">
                  <ItemIcon item={row.info.icon} size={32} className="rounded bg-muted/50" />
                  <div className="min-w-0 flex-1">
                    <span data-item-peek>
                      <ItemName row={row} />
                    </span>
                    <BaseTypeLine row={row} />
                    <PhoneFacts row={row} shownStats={shownStats} />
                  </div>
                </div>
              </th>
              <td className={WIDE_CELL}>
                <KindText row={row} />
              </td>
              <td className={`${WIDE_CELL} whitespace-nowrap`}>{row.info.tier === null ? '—' : <TierBadge tier={row.info.tier} />}</td>
              <td className={`${WIDE_CELL} tabular-nums`}>{row.item.level ?? '—'}</td>
              <td className={WIDE_CELL}>{row.item.ethereal ? <EtherealBadge /> : <span className="text-muted-foreground">—</span>}</td>
              <td className={`${WIDE_CELL} max-w-[14rem]`}>
                <SocketsInfo row={row} />
              </td>
              {shownStats.length > 0 && (
                <td className={`${WIDE_CELL} text-xs`}>
                  <StatValues row={row} shownStats={shownStats} />
                </td>
              )}
              <td className={`${WIDE_CELL} text-xs whitespace-nowrap tabular-nums`}>{formatLocation(row.location)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Outside the table: React bubbles the portaled peek's events through its parents */}
      {peekRow !== undefined && (
        <PeekPopover
          peek={peek}
          anchorRef={peek.anchorRef}
          className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto p-0"
        >
          <ItemCard row={peekRow} className="rounded-md border-0 shadow-none" />
        </PeekPopover>
      )}
    </div>
  );
}

/** The columns a phone does not show, as lines under the name */
function PhoneFacts({ row, shownStats }: { readonly row: ItemRow; readonly shownStats: readonly string[] }) {
  const facts = [kindLabel(row), row.item.level === null ? null : `ilvl ${String(row.item.level)}`].filter((fact) => fact !== null);
  return (
    <div className="mt-1 space-y-0.5 text-xs font-normal text-muted-foreground md:hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{facts.join(' · ')}</span>
        {row.info.tier !== null && <TierBadge tier={row.info.tier} />}
        {row.item.ethereal && <EtherealBadge />}
      </div>
      {(row.item.sockets ?? 0) > 0 && (
        <div className="break-words">
          <SocketsInfo row={row} compact />
        </div>
      )}
      {shownStats.some((key) => row.stats.has(key)) && <StatValues row={row} shownStats={shownStats} className="text-foreground" />}
      <div className="tabular-nums">{formatLocation(row.location)}</div>
    </div>
  );
}
