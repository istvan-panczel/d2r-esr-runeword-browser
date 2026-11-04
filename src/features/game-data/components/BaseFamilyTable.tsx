import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BaseItem } from '../engine/schema';
import { BASE_TIER_LABELS, TIER_BADGE_CLASS } from '../constants/bases';
import { baseStatParts } from '../utils/baseFamilies';
import type { FamilyView, FamilyViewCell } from '../utils/familyView';
import { ItemIcon } from './ItemIcon';

interface BaseFamilyTableProps {
  readonly view: FamilyView;
  /** Opens the base's card (cards view, search set to its name) */
  readonly onSelect: (base: BaseItem) => void;
}

function Stats({ base }: { readonly base: BaseItem }) {
  const parts = baseStatParts(base);
  return (
    <span className="block text-xs leading-snug text-muted-foreground">
      {/* The separator ends the preceding part, so a wrapped line never starts with "·" */}
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && ' '}
          <span className="whitespace-nowrap">
            {part}
            {index < parts.length - 1 && ' ·'}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function BaseButton({
  base,
  onSelect,
  className,
}: {
  readonly base: BaseItem;
  readonly onSelect: (base: BaseItem) => void;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      className={cn('text-left font-medium text-primary underline-offset-2 hover:underline', className)}
      title={`Show the ${base.name} card`}
      onClick={() => {
        onSelect(base);
      }}
    >
      {base.name}
    </button>
  );
}

function FamilyCell({ cell, onSelect }: { readonly cell: FamilyViewCell | null; readonly onSelect: (base: BaseItem) => void }) {
  if (cell === null) return <td className="border-t px-2 py-1.5 align-top text-muted-foreground">—</td>;
  return (
    <td className={cn('border-t px-2 py-1.5 align-top break-words', !cell.matches && 'opacity-50')}>
      <div className="flex items-start gap-2">
        {/* Hidden on phones: three 32 px icons would squeeze the names of the three tier columns */}
        <ItemIcon item={{ kind: 'base', code: cell.base.code }} size={32} className="hidden sm:inline-flex" />
        <div className="min-w-0">
          <BaseButton base={cell.base} onSelect={onSelect} className={cn(!cell.matches && 'text-muted-foreground')} />
          <Stats base={cell.base} />
        </div>
      </div>
    </td>
  );
}

/** The families view of the Bases page: one row per normal / exceptional / elite family, grouped by item type. */
export function BaseFamilyTable({ view, onSelect }: BaseFamilyTableProps) {
  const { columns, groups, loners } = view;
  const span = Math.max(columns.length, 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] table-fixed border-collapse text-sm">
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((tier) => (
                <th key={tier} scope="col" className="px-2 py-1 text-left">
                  <Badge variant="outline" className={TIER_BADGE_CLASS[tier]}>
                    {BASE_TIER_LABELS[tier]}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
        )}
        {groups.map((group) => (
          <tbody key={group.label}>
            <tr>
              <th colSpan={span} scope="colgroup" className="px-2 pt-5 pb-1 text-left text-base font-bold">
                {group.label}
              </th>
            </tr>
            {group.types.map((type) => (
              <Fragment key={type.code}>
                <tr>
                  <th colSpan={span} scope="colgroup" className="bg-muted/60 px-2 py-1 text-left font-semibold">
                    {type.name} <span className="font-normal text-muted-foreground">({type.rows.length})</span>
                  </th>
                </tr>
                {type.rows.map((row) => (
                  <tr key={row.key}>
                    {row.cells.map((cell, index) => (
                      <FamilyCell key={columns[index]} cell={cell} onSelect={onSelect} />
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        ))}
        {loners.length > 0 && (
          <tbody>
            <tr>
              <th colSpan={span} scope="colgroup" className="px-2 pt-5 pb-1 text-left text-base font-bold">
                Without a family{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  (mythical bases, accessories and bases outside their own family)
                </span>
              </th>
            </tr>
            <tr>
              <td colSpan={span} className="border-t px-2 py-2">
                <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7">
                  {loners.map(({ base, typeName }) => (
                    <li key={base.code} className="flex min-w-0 items-start gap-2">
                      <ItemIcon item={{ kind: 'base', code: base.code }} size={32} />
                      <div className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <BaseButton base={base} onSelect={onSelect} />
                          <Badge variant="outline" className={cn('px-1.5 py-0 text-[0.7rem]', TIER_BADGE_CLASS[base.tier])}>
                            {BASE_TIER_LABELS[base.tier]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{typeName}</span>
                        </span>
                        <Stats base={base} />
                      </div>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}
