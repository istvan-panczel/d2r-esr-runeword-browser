import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GemBadge } from '@/core/components/GemBadge';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import { aggregateGemBonuses, type GemBonusMap } from '../hooks/useGemBonuses';
import { RecipeAffixes, SocketableBonusGroupsSection, SocketableBonusesSection } from '@/core/components/RecipeBonuses';
import { getRelevantCategories } from '@/core/utils/itemCategoryMapping';
import type { Gemword } from '@/core/db/models';

interface GemwordCardProps {
  readonly gemword: Gemword;
  readonly gemBonusMap?: GemBonusMap;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (gemword: Gemword) => void;
  /** Builds: indexes of the page's socketable bonus groups that apply to the slot; all when omitted */
  readonly socketableGroups?: readonly number[];
}

export function GemwordCard({
  gemword,
  gemBonusMap,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
  socketableGroups,
}: GemwordCardProps) {
  const { name, sockets, reqLevel, gems, allowedItems, affixes, jewelInfo } = gemword;
  // The page's gem bonuses per item-type group (ESR 3.3+); old cached rows fall back to the gems table
  const pageSocketableBonuses =
    gemword.socketableBonuses !== undefined && gemword.socketableBonuses.length > 0 ? gemword.socketableBonuses : null;
  const gemBonuses = gemBonusMap && pageSocketableBonuses === null ? aggregateGemBonuses(gems, gemBonusMap) : undefined;
  const relevantCategories = getRelevantCategories(allowedItems);

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

        <RecipeAffixes
          affixes={affixes}
          columnAffixes={gemword.columnAffixes}
          columnBonusPools={gemword.columnBonusPools}
          allowedItems={allowedItems}
          categories={relevantCategories}
          skillItem={{ kind: 'gemword', name }}
        />

        {pageSocketableBonuses ? (
          <SocketableBonusGroupsSection title="Gem Bonuses:" groups={pageSocketableBonuses} shown={socketableGroups} />
        ) : (
          <SocketableBonusesSection title="Gem Bonuses:" bonuses={gemBonuses} allowedItems={allowedItems} categories={relevantCategories} />
        )}
      </CardContent>
    </Card>
  );
}
