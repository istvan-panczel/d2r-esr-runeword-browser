import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { formatHaveNeed, initialSortDir, type CouponRow, type CouponSortKey, type SortDir } from '../engine/coupons';
import { BaseLine, CouponTierBadge, craftsText, LocationList, StatusBadge, UniqueLink, WildCardRecipe } from './CouponParts';
import { SORT_HEAD_CLASS as HEAD_CLASS } from './shared/classes';
import { SortHeader as SharedSortHeader } from './shared/SortHeader';

interface CouponTableProps {
  readonly rows: readonly CouponRow[];
  readonly sort: CouponSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: CouponSortKey, dir: SortDir) => void;
}

const CELL_CLASS = 'border-t px-2 py-1.5 align-top';
/** The Unique column stays visible while the table scrolls sideways on phones */
const STICKY_CLASS = 'sticky left-0 z-10 bg-card';

interface SortHeaderProps {
  readonly label: string;
  readonly column: CouponSortKey;
  readonly sort: CouponSortKey;
  readonly dir: SortDir;
  readonly onSort: (sort: CouponSortKey, dir: SortDir) => void;
  readonly className?: string;
  readonly title?: string;
}

function SortHeader(props: SortHeaderProps) {
  return <SharedSortHeader {...props} initialDir={initialSortDir} />;
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
                <span className="flex items-start gap-2">
                  <ItemIcon
                    item={{ kind: 'unique', name: row.unique.name, code: row.base?.code }}
                    size={32}
                    className="rounded bg-muted/50"
                  />
                  <span className="min-w-0">
                    <UniqueLink row={row} />
                    <BaseLine row={row} />
                  </span>
                </span>
              </th>
              <td className={CELL_CLASS}>
                <StatusBadge row={row} />
              </td>
              <td className={`${CELL_CLASS} whitespace-nowrap`}>
                <span className="font-medium tabular-nums">{formatHaveNeed(row)}</span>
                {craftsText(row) !== null && <span className="block text-xs text-muted-foreground">{craftsText(row)}</span>}
              </td>
              <td className={`${CELL_CLASS} max-w-[12rem] whitespace-nowrap text-muted-foreground`}>
                <WildCardRecipe recipe={row.withWildCards} />
              </td>
              <td className={`${CELL_CLASS} min-w-[14rem]`}>
                <span>{row.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{row.code}</span>
              </td>
              <td className={`${CELL_CLASS} whitespace-nowrap`}>
                <CouponTierBadge row={row} />
              </td>
              <td className={`${CELL_CLASS} min-w-[12rem] text-xs`}>
                <LocationList row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
