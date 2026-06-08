import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RuneBadge } from './RuneBadge';
import { GemBadge } from '@/core/components/GemBadge';
import { RunewordPointsDisplay } from './RunewordPointsDisplay';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import { useRuneBonuses } from '../hooks/useRuneBonuses';
import { getRelevantCategories, getCategoryLabel, type BonusCategory } from '@/core/utils/itemCategoryMapping';
import { isGemName } from '@/features/data-sync/parsers/gemsParser';
import type { Runeword } from '@/core/db/models';

interface RunewordCardProps {
  readonly runeword: Runeword;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (runeword: Runeword) => void;
}

// sortKey >= 10000 means LoD runeword (see runewordsParser.ts LOD_SORT_KEY_OFFSET)
const LOD_SORT_KEY_OFFSET = 10000;

export function RunewordCard({
  runeword,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
}: RunewordCardProps) {
  const { name, sockets, runes, allowedItems, excludedItems, affixes, tierPointTotals } = runeword;
  // Handle backwards compatibility for cached runewords without reqLevel
  const reqLevel = 'reqLevel' in runeword ? runeword.reqLevel : undefined;
  const isLod = 'sortKey' in runeword && runeword.sortKey >= LOD_SORT_KEY_OFFSET;
  const gems = 'gems' in runeword ? runeword.gems : undefined;
  const jewelInfo = 'jewelInfo' in runeword ? runeword.jewelInfo : undefined;
  const ingredientsList = 'ingredients' in runeword && runeword.ingredients.length > 0 ? runeword.ingredients : runes;
  const runeBonuses = useRuneBonuses(runes, gems);
  const relevantCategories = getRelevantCategories(allowedItems);

  // Check if runeword bonuses differ across relevant columns
  const columnAffixes = 'columnAffixes' in runeword ? runeword.columnAffixes : undefined;
  const hasColumnDifferences = (() => {
    if (!columnAffixes || relevantCategories.length <= 1) return false;
    const firstCol = columnAffixes[relevantCategories[0]];
    return relevantCategories.some((cat) => {
      const col = columnAffixes[cat];
      if (col.length !== firstCol.length) return true;
      return col.some((affix, i) => affix.rawText !== firstCol[i].rawText);
    });
  })();

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
          <div className="flex shrink-0 items-center gap-1">
            {onToggleFavorite && (
              <FavoriteButton
                isFavorite={isFavorite}
                count={favoriteCount}
                pending={favoritePending}
                label={name}
                onToggle={() => {
                  onToggleFavorite(runeword);
                }}
              />
            )}
            <Badge variant="secondary">{sockets} Socket</Badge>
            {reqLevel !== undefined && <Badge variant="outline">Lvl {reqLevel}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Ingredient sequence (runes + gems in original order) */}
        <div className="flex flex-wrap gap-1">
          {ingredientsList.map((item, index) =>
            isGemName(item) ? (
              <GemBadge key={`${item}-${String(index)}`} gemName={item} />
            ) : (
              <RuneBadge key={`${item}-${String(index)}`} runeName={item} isLod={isLod} />
            )
          )}
          {jewelInfo && <Badge variant="outline">{jewelInfo}</Badge>}
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
            {hasColumnDifferences && columnAffixes ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {relevantCategories.map((category) => {
                  const colAffixes = columnAffixes[category];
                  if (colAffixes.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className="font-medium text-muted-foreground text-xs mb-1">{getCategoryLabel(allowedItems, category)}:</p>
                      <ul className="space-y-0.5 text-[#8080E6] text-xs">
                        {colAffixes.map((affix, index) => (
                          <li key={`${String(index)}-${affix.rawText}`}>{affix.rawText}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="space-y-0.5 text-[#8080E6]">
                {affixes.map((affix, index) => (
                  <li key={`${String(index)}-${affix.rawText}`}>{affix.rawText}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Rune Bonuses */}
        {hasRuneBonuses && (
          <div className="border-t pt-3">
            <p className="font-medium text-muted-foreground mb-2 text-center">Socketable Bonuses:</p>
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
                      <p className="font-medium text-muted-foreground text-xs mb-1">{getCategoryLabel(allowedItems, category)}:</p>
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
