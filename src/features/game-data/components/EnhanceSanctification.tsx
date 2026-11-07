import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { filterSanctificationOutcomes, formatRate } from '../utils/enhance';
import { BonusLines, ComputedRate, NoMatches } from './EnhanceParts';
import { LIST_CARD_CLASS, ROW_LIST_COLUMNS } from './rowListColumns';
import { IngredientIcons } from './CellIcon';

interface EnhanceSanctificationProps {
  readonly bundle: EnhanceBundle;
  readonly search: string;
}

export function EnhanceSanctification({ bundle, search }: EnhanceSanctificationProps) {
  const { sanctification, sanctificationOutcomes: all, sanctificationBonuses: bonuses } = bundle;
  const outcomes = filterSanctificationOutcomes(all, search);
  const total = Math.max(all.length, 1);
  const item = sanctification.item.name.toLowerCase();

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <IngredientIcons
              items={[
                // The item is an item type (Jewel); the reagent an item
                { kind: 'type', code: sanctification.item.code },
                { kind: 'item', code: sanctification.reagent.code },
              ]}
            />
            {sanctification.item.name} + {sanctification.reagent.name}
          </CardTitle>
          <p className="text-sm">
            {all.length} outcomes, one per roll of {sanctification.rollRange}:{' '}
            <ComputedRate>{formatRate(1 / Math.max(sanctification.rollRange, 1))} chance each</ComputedRate>; every roll is a success (no
            brick rows).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 text-sm text-muted-foreground">
          <p>
            Cube the {item} with {sanctification.reagent.name}, then cube the {item} again on its own: the hidden roll picks one of the
            outcomes below.
            {sanctification.once && ` A ${item} is sanctified once.`}
          </p>
          {bonuses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase">How often each bonus comes up (outcomes with it)</p>
              <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {bonuses.map((bonus) => (
                  <li key={bonus.line} className="flex items-baseline justify-between gap-3">
                    <span className="text-blue-700 dark:text-blue-400">{bonus.line}</span>
                    <span className="shrink-0 font-mono text-xs">
                      <ComputedRate>{formatRate(bonus.outcomes / total)}</ComputedRate> ({bonus.outcomes})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {search !== '' && (
        <p className="text-sm text-muted-foreground">
          {outcomes.length} of {all.length} outcomes match
        </p>
      )}
      {outcomes.length === 0 ? (
        <NoMatches />
      ) : (
        <ol className={cn('divide-y', LIST_CARD_CLASS, ROW_LIST_COLUMNS)}>
          {outcomes.map((outcome) => (
            <li key={outcome.roll} className="flex gap-3 px-3 py-2 text-sm">
              <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground" title="Roll">
                #{outcome.roll}
              </span>
              <BonusLines lines={outcome.lines} className="min-w-0" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
