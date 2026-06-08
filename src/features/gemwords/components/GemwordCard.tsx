import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GemBadge } from '@/core/components/GemBadge';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import { aggregateGemBonuses, type GemBonusMap } from '../hooks/useGemBonuses';
import { getRelevantCategories, getCategoryLabel, type BonusCategory } from '@/core/utils/itemCategoryMapping';
import type { Gemword } from '@/core/db/models';

interface GemwordCardProps {
  readonly gemword: Gemword;
  readonly gemBonusMap?: GemBonusMap;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (gemword: Gemword) => void;
}

export function GemwordCard({
  gemword,
  gemBonusMap,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
}: GemwordCardProps) {
  const { name, sockets, reqLevel, gems, allowedItems, affixes, jewelInfo } = gemword;
  const gemBonuses = gemBonusMap ? aggregateGemBonuses(gems, gemBonusMap) : undefined;
  const relevantCategories = getRelevantCategories(allowedItems);
  const columnAffixes = gemword.columnAffixes;

  const hasColumnDifferences = (() => {
    if (relevantCategories.length <= 1) return false;
    const firstColumn = columnAffixes[relevantCategories[0]];
    return relevantCategories.some((category) => {
      const column = columnAffixes[category];
      if (column.length !== firstColumn.length) return true;
      return column.some((affix, index) => affix.rawText !== firstColumn[index].rawText);
    });
  })();

  const getBonusesForCategory = (category: BonusCategory): readonly string[] => {
    if (!gemBonuses) return [];
    return gemBonuses[category];
  };

  const hasGemBonuses = gemBonuses && relevantCategories.some((category) => gemBonuses[category].length > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-lg text-amber-700 dark:text-amber-400">{name}</CardTitle>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleFavorite && (
              <FavoriteButton
                isFavorite={isFavorite}
                count={favoriteCount}
                pending={favoritePending}
                label={name}
                onToggle={() => {
                  onToggleFavorite(gemword);
                }}
              />
            )}
            <Badge variant="secondary">{sockets} Socket</Badge>
            <Badge variant="outline">Lvl {reqLevel}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {gems.map((gem, index) => (
            <GemBadge key={`${gem}-${String(index)}`} gemName={gem} />
          ))}
          {jewelInfo && <Badge variant="outline">{jewelInfo}</Badge>}
        </div>

        <div>
          <p className="font-medium text-muted-foreground mb-1">Items:</p>
          <p className="text-sm">{allowedItems.join(', ')}</p>
        </div>

        {affixes.length > 0 && (
          <div className="text-center">
            <p className="font-medium text-muted-foreground mb-1">Bonuses:</p>
            {hasColumnDifferences ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {relevantCategories.map((category) => {
                  const column = columnAffixes[category];
                  if (column.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className="font-medium text-muted-foreground text-xs mb-1">{getCategoryLabel(allowedItems, category)}:</p>
                      <ul className="space-y-0.5 text-[#8080E6] text-xs">
                        {column.map((affix, index) => (
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

        {hasGemBonuses && (
          <div className="border-t pt-3">
            <p className="font-medium text-muted-foreground mb-2 text-center">Gem Bonuses:</p>
            {relevantCategories.length === 1 ? (
              <ul className="space-y-0.5 text-[#8080E6] text-center">
                {getBonusesForCategory(relevantCategories[0]).map((bonus, index) => (
                  <li key={`${String(index)}-${bonus}`}>{bonus}</li>
                ))}
              </ul>
            ) : (
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
