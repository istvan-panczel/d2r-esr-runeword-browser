import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RuneBadge } from './RuneBadge';
import { RunewordPointsDisplay } from './RunewordPointsDisplay';
import { useRuneBonuses } from '../hooks/useRuneBonuses';
import { getRelevantCategories, CATEGORY_LABELS, type BonusCategory } from '../utils/itemCategoryMapping';
import type { Runeword } from '@/core/db/models';

interface RunewordCardProps {
  readonly runeword: Runeword;
}

export function RunewordCard({ runeword }: RunewordCardProps) {
  const { name, sockets, runes, allowedItems, excludedItems, affixes, tierPointTotals } = runeword;
  const runeBonuses = useRuneBonuses(runes);
  const relevantCategories = getRelevantCategories(allowedItems);

  // Get bonuses for a specific category
  const getBonusesForCategory = (category: BonusCategory): readonly string[] => {
    if (!runeBonuses) return [];
    return runeBonuses[category];
  };

  // Check if we have any rune bonuses to show
  const hasRuneBonuses = runeBonuses && relevantCategories.some((cat) => runeBonuses[cat].length > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg text-amber-700 dark:text-amber-400">{name}</CardTitle>
          <Badge variant="secondary">{sockets} Socket</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Rune sequence */}
        <div className="flex flex-wrap gap-1">
          {runes.map((rune, index) => (
            <RuneBadge key={`${rune}-${String(index)}`} runeName={rune} />
          ))}
        </div>

        {/* Tier point totals - check with 'in' for backwards compatibility with old cached data */}
        {'tierPointTotals' in runeword && tierPointTotals.length > 0 && <RunewordPointsDisplay tierTotals={tierPointTotals} />}

        {/* Allowed items */}
        <div>
          <p className="font-medium text-muted-foreground mb-1">Items:</p>
          <p className="text-sm">{allowedItems.join(', ')}</p>
          {excludedItems.length > 0 && <p className="text-sm text-muted-foreground mt-1">Excluded: {excludedItems.join(', ')}</p>}
        </div>

        {/* Runeword Affixes */}
        {affixes.length > 0 && (
          <div className="text-center">
            <p className="font-medium text-muted-foreground mb-1">Bonuses:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {affixes.map((affix, index) => (
                <li key={`${String(index)}-${affix.rawText}`}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rune Bonuses */}
        {hasRuneBonuses && (
          <div className="border-t pt-3">
            <p className="font-medium text-muted-foreground mb-2 text-center">Rune Bonuses:</p>
            {relevantCategories.length === 1 ? (
              // Single category - centered list
              <ul className="space-y-0.5 text-[#8080E6] text-center">
                {getBonusesForCategory(relevantCategories[0]).map((bonus, index) => (
                  <li key={`${String(index)}-${bonus}`}>{bonus}</li>
                ))}
              </ul>
            ) : (
              // Multiple categories - 2-column grid
              <div className="grid grid-cols-2 gap-3 text-sm">
                {relevantCategories.map((category) => {
                  const bonuses = getBonusesForCategory(category);
                  if (bonuses.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className="font-medium text-muted-foreground text-xs mb-1">{CATEGORY_LABELS[category]}:</p>
                      <ul className="space-y-0.5 text-[#8080E6] text-xs">
                        {bonuses.map((bonus, index) => (
                          <li key={`${String(index)}-${bonus}`}>{bonus}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
