import { ArrowDown, ArrowUp, ArrowUpDown, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import {
  COUPON_STATUS_LABELS,
  formatHaveNeed,
  formatLocation,
  initialSortDir,
  uniquePageUrl,
  type CouponRow,
  type CouponSortKey,
  type CouponStatus,
  type SortDir,
} from '../engine/coupons';
import { CopyTextButton } from './CopyTextButton';

interface CouponTableProps {
  readonly rows: readonly CouponRow[];
  readonly sort: CouponSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: CouponSortKey, dir: SortDir) => void;
}

const HEAD_CLASS = 'px-2 py-1.5 text-left font-medium whitespace-nowrap';
const CELL_CLASS = 'border-t px-2 py-1.5 align-top';
/** The Unique column stays visible while the table scrolls sideways on phones */
const STICKY_CLASS = 'sticky left-0 z-10 bg-card';

const STATUS_BADGES: Readonly<Record<CouponStatus, { label: string; className: string } | null>> = {
  ready: { label: COUPON_STATUS_LABELS.ready, className: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  wildcards: { label: COUPON_STATUS_LABELS.wildcards, className: 'border-sky-600/40 bg-sky-500/15 text-sky-800 dark:text-sky-300' },
  almost: { label: '1 short', className: 'border-amber-600/40 bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  other: null,
};

function StatusBadge({ row }: { readonly row: CouponRow }) {
  const badge = STATUS_BADGES[row.status];
  if (badge === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', badge.className)}>{badge.label}</span>
  );
}

interface SortHeaderProps {
  readonly label: string;
  readonly column: CouponSortKey;
  readonly sort: CouponSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: CouponSortKey, dir: SortDir) => void;
  readonly className?: string;
  readonly title?: string;
}

function SortHeader({ label, column, sort, dir, onSort, className, title }: SortHeaderProps) {
  const active = sort === column;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      className={cn(HEAD_CLASS, className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          onSort(column, active ? (dir === 'asc' ? 'desc' : 'asc') : initialSortDir(column));
        }}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  );
}

function crafts(row: CouponRow): string | null {
  if (row.crafts === 0) return null;
  const spare = row.have - row.crafts * row.need;
  return `${String(row.crafts)} craft${row.crafts === 1 ? '' : 's'}${spare > 0 ? `, ${String(spare)} left over` : ''}`;
}

function WildCardRecipe({ recipe }: { readonly recipe: CouponRow['withWildCards'] }) {
  if (recipe === null) return <>—</>;
  const { qty, wildCards, suspect } = recipe;
  return (
    <>
      {qty} + {wildCards} Wild Card{wildCards === 1 ? '' : 's'}
      {suspect === true && (
        <span className="mt-0.5 flex items-start gap-1 text-xs whitespace-normal text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          This recipe looks broken in ESR&apos;s data (its item count is wrong); it may not work.
        </span>
      )}
    </>
  );
}

/** The owned coupons: the unique each makes (link + copy for the in-game stash search), count, recipes, locations. */
export function CouponTable({ rows, sort, dir, onSort }: CouponTableProps) {
  const header = { sort, dir, onSort };
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <SortHeader label="Unique" column="unique" className={`${STICKY_CLASS} bg-muted`} {...header} />
            <SortHeader label="Status" column="status" title="Ready, ready with your Wild Cards, one short" {...header} />
            <SortHeader label="Have / need" column="have" {...header} />
            <th scope="col" className={HEAD_CLASS} title="The alternative recipe: fewer coupons plus Coupon Wild Cards">
              With Wild Cards
            </th>
            <SortHeader label="Coupon" column="coupon" {...header} />
            <SortHeader label="Tier" column="tier" {...header} />
            <SortHeader label="Where" column="location" title="Page, row and column, counted from 1 at the top left" {...header} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <th scope="row" className={`${CELL_CLASS} ${STICKY_CLASS} max-w-[13rem] text-left font-medium sm:max-w-none`}>
                <span className="flex items-center gap-2">
                  <ItemIcon item={{ kind: 'unique', name: row.unique.name }} size={32} className="rounded bg-muted/50" />
                  <Link
                    to={uniquePageUrl(row.unique.name)}
                    className="min-w-0 text-amber-700 underline decoration-amber-700/30 underline-offset-2 hover:decoration-amber-700 dark:text-amber-400 dark:decoration-amber-400/30"
                  >
                    {row.unique.name}
                  </Link>
                  <CopyTextButton text={row.unique.name} label={`Copy "${row.unique.name}" for the in-game stash search`} />
                </span>
              </th>
              <td className={CELL_CLASS}>
                <StatusBadge row={row} />
              </td>
              <td className={`${CELL_CLASS} whitespace-nowrap`}>
                <span className="font-medium tabular-nums">{formatHaveNeed(row)}</span>
                {crafts(row) !== null && <span className="block text-xs text-muted-foreground">{crafts(row)}</span>}
              </td>
              <td className={`${CELL_CLASS} max-w-[12rem] whitespace-nowrap text-muted-foreground`}>
                <WildCardRecipe recipe={row.withWildCards} />
              </td>
              <td className={`${CELL_CLASS} min-w-[14rem]`}>
                <span>{row.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{row.code}</span>
              </td>
              <td className={`${CELL_CLASS} whitespace-nowrap`}>{row.tierLabel}</td>
              <td className={`${CELL_CLASS} min-w-[12rem] text-xs`}>
                <ul className="space-y-0.5">
                  {row.locations.map((location) => (
                    <li
                      key={`${String(location.section)}:${String(location.x)}:${String(location.y)}`}
                      className="whitespace-nowrap tabular-nums"
                    >
                      {formatLocation(location)}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
