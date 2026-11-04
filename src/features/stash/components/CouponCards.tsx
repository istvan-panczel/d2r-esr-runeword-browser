import { Spinner } from '@/components/ui/spinner';
import type { SourceIndex } from '@/features/game-data/engine/sourceLookup';
import { useBaseTiers, type BaseTierIndex } from '@/features/game-data/hooks/useBaseTiers';
import { useItemSources } from '@/features/game-data/hooks/useItemSources';
import { HtmUniqueItemCard } from '@/features/htm-unique-items/components/HtmUniqueItemCard';
import { formatHaveNeed, formatLocation, type CouponRow } from '../engine/coupons';
import { findUniqueDetails } from '../engine/uniqueDetails';
import { useUniqueDetails, type UniqueDetailsState } from '../hooks/useUniqueDetails';
import { BaseLine, CouponTierBadge, craftsText, StatusBadge, UniqueLink, WildCardRecipe } from './CouponParts';

/** "Show all item information": one card per owned coupon, its facts above the unique's Uniques page card. */
export function CouponCards({ rows }: { readonly rows: readonly CouponRow[] }) {
  const details = useUniqueDetails();
  const sourceIndex = useItemSources();
  const tierIndex = useBaseTiers().index;
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7">
      {rows.map((row) => (
        <li key={row.code} className="flex flex-col gap-2">
          <CouponFacts row={row} />
          <UniqueDetails row={row} details={details} sourceIndex={sourceIndex} tierIndex={tierIndex} />
        </li>
      ))}
    </ul>
  );
}

function CouponFacts({ row }: { readonly row: CouponRow }) {
  const crafts = craftsText(row);
  return (
    <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <UniqueLink row={row} />
          <BaseLine row={row} />
        </span>
        <StatusBadge row={row} />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Have / need</dt>
        <dd>
          <span className="font-medium tabular-nums">{formatHaveNeed(row)}</span>
          {crafts !== null && <span className="text-muted-foreground"> · {crafts}</span>}
        </dd>
        <dt className="text-muted-foreground">With Wild Cards</dt>
        <dd>
          <WildCardRecipe recipe={row.withWildCards} />
        </dd>
        <dt className="text-muted-foreground">Coupon</dt>
        <dd className="flex flex-wrap items-center gap-x-2">
          <span>
            {row.name} <span className="font-mono text-muted-foreground">{row.code}</span>
          </span>
          <CouponTierBadge row={row} />
        </dd>
        <dt className="text-muted-foreground">Where</dt>
        <dd className="tabular-nums">{row.locations.map(formatLocation).join('; ')}</dd>
      </dl>
    </div>
  );
}

interface UniqueDetailsProps {
  readonly row: CouponRow;
  readonly details: UniqueDetailsState;
  readonly sourceIndex: SourceIndex | null;
  readonly tierIndex: BaseTierIndex | null;
}

/** The unique's Uniques page card, or why it cannot be shown (docs data still loading, unavailable, unique not listed) */
function UniqueDetails({ row, details, sourceIndex, tierIndex }: UniqueDetailsProps) {
  if (details.status === 'loading') {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Loading the item details from the ESR docs...
      </p>
    );
  }
  if (details.status === 'unavailable') {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Item details are unavailable: the ESR docs data could not be loaded. The coupon facts above still apply.
      </p>
    );
  }
  const item = findUniqueDetails(details.index, row.unique.name, row.base?.code ?? null);
  if (item === undefined) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        The ESR docs list no unique named &quot;{row.unique.name}&quot;, so there are no item details for it.
      </p>
    );
  }
  return <HtmUniqueItemCard item={item} sourceIndex={sourceIndex} tierIndex={tierIndex} />;
}
