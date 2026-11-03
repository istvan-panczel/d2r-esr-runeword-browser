/* eslint-disable react-refresh/only-export-components -- small row parts shared by the coupon table and the detail cards */
import { TriangleAlert } from 'lucide-react';
import { TierBadge } from '@/features/game-data/components/TierBadge';
import { COUPON_STATUS_LABELS, uniquePageUrl, type CouponRow, type CouponStatus } from '../engine/coupons';
import { LocationList as SharedLocationList } from './shared/LocationList';
import { NameLink } from './shared/NameLink';
import { ToneBadge, type BadgeTone } from './shared/ToneBadge';

const STATUS_BADGES: Readonly<Record<CouponStatus, { label: string; tone: BadgeTone } | null>> = {
  ready: { label: COUPON_STATUS_LABELS.ready, tone: 'success' },
  wildcards: { label: COUPON_STATUS_LABELS.wildcards, tone: 'info' },
  almost: { label: '1 short', tone: 'warning' },
  other: null,
};

export function StatusBadge({ row }: { readonly row: CouponRow }) {
  const badge = STATUS_BADGES[row.status];
  if (badge === null) return <span className="text-muted-foreground">—</span>;
  return <ToneBadge label={badge.label} tone={badge.tone} />;
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
  return <NameLink name={row.unique.name} to={uniquePageUrl(row.unique.name)} />;
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
  return <SharedLocationList locations={row.locations} className={className} />;
}
