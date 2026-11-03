/* eslint-disable react-refresh/only-export-components -- small row parts shared by the coupon table and the detail cards */
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TierBadge } from '@/features/game-data/components/TierBadge';
import { COUPON_STATUS_LABELS, formatLocation, uniquePageUrl, type CouponRow, type CouponStatus } from '../engine/coupons';
import { CopyTextButton } from './CopyTextButton';

const STATUS_BADGES: Readonly<Record<CouponStatus, { label: string; className: string } | null>> = {
  ready: { label: COUPON_STATUS_LABELS.ready, className: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  wildcards: { label: COUPON_STATUS_LABELS.wildcards, className: 'border-sky-600/40 bg-sky-500/15 text-sky-800 dark:text-sky-300' },
  almost: { label: '1 short', className: 'border-amber-600/40 bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  other: null,
};

export function StatusBadge({ row }: { readonly row: CouponRow }) {
  const badge = STATUS_BADGES[row.status];
  if (badge === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', badge.className)}>{badge.label}</span>
  );
}

/** "2 crafts, 1 left over"; null without a craft */
export function craftsText(row: CouponRow): string | null {
  if (row.crafts === 0) return null;
  const spare = row.have - row.crafts * row.need;
  return `${String(row.crafts)} craft${row.crafts === 1 ? '' : 's'}${spare > 0 ? `, ${String(spare)} left over` : ''}`;
}

export function WildCardRecipe({ recipe }: { readonly recipe: CouponRow['withWildCards'] }) {
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

/** The unique's name as a link to its Uniques page card, plus the copy button for the in-game stash search */
export function UniqueLink({ row }: { readonly row: CouponRow }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Link
        to={uniquePageUrl(row.unique.name)}
        className="min-w-0 font-medium text-amber-700 underline decoration-amber-700/30 underline-offset-2 hover:decoration-amber-700 dark:text-amber-400 dark:decoration-amber-400/30"
      >
        {row.unique.name}
      </Link>
      <CopyTextButton text={row.unique.name} label={`Copy "${row.unique.name}" for the in-game stash search`} />
    </span>
  );
}

/** "Sash · Belt": the base and its item type, so an item type search match is visible */
export function BaseLine({ row }: { readonly row: CouponRow }) {
  if (row.base === null) return null;
  const type = row.baseTypeName !== null && row.baseTypeName !== row.base.name ? ` · ${row.baseTypeName}` : '';
  return (
    <span className="block text-xs font-normal text-muted-foreground">
      {row.base.name}
      {type}
    </span>
  );
}

/** The data's base tier as the app's tier badge; the itemtypes name as text when the type has no base tier */
export function CouponTierBadge({ row }: { readonly row: CouponRow }) {
  return row.tier === null ? <span>{row.tierLabel}</span> : <TierBadge tier={row.tier} />;
}

export function LocationList({ row, className }: { readonly row: CouponRow; readonly className?: string }) {
  return (
    <ul className={cn('space-y-0.5', className)}>
      {row.locations.map((location) => (
        <li key={`${String(location.section)}:${String(location.x)}:${String(location.y)}`} className="whitespace-nowrap tabular-nums">
          {formatLocation(location)}
        </li>
      ))}
    </ul>
  );
}
