import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import type { HtmUniqueItem } from '@/core/db';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { ItemSourceLine } from '@/features/game-data/components/ItemSourceLine';
import type { SourceIndex } from '@/features/game-data/engine/sourceLookup';
import { TierBadge } from '@/features/game-data/components/TierBadge';
import type { BaseTierIndex } from '@/features/game-data/hooks/useBaseTiers';
import { SkillRefText } from '@/features/skills/components/SkillRefText';
import { uniqueBaseTier } from '../utils/tierFilter';

interface HtmUniqueItemCardProps {
  readonly item: HtmUniqueItem;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (item: HtmUniqueItem) => void;
  /** Name index of the game-data sources bundle (from `useItemSources()`); omitted → no source line */
  readonly sourceIndex?: SourceIndex | null;
  /** Base tiers (from `useBaseTiers()`); omitted / null → no tier badge */
  readonly tierIndex?: BaseTierIndex | null;
}

export function HtmUniqueItemCard({
  item,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
  sourceIndex,
  tierIndex,
}: HtmUniqueItemCardProps) {
  const tier = tierIndex ? uniqueBaseTier(item.baseItemCode, tierIndex) : undefined;
  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <ItemIcon item={{ kind: 'unique', name: item.name, code: item.baseItemCode }} size={48} className="rounded-md bg-muted/50" />
            <div className="min-w-0 space-y-1">
              <CardTitle className="break-words text-lg text-amber-700 dark:text-amber-400">{item.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {item.baseItem}
                {item.baseItemCode ? ` (${item.baseItemCode})` : ''}
                {tier !== undefined && <TierBadge tier={tier} className="ml-1.5 align-middle" />}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {onToggleFavorite && (
              <FavoriteButton
                isFavorite={isFavorite}
                count={favoriteCount}
                pending={favoritePending}
                label={item.name}
                onToggle={() => {
                  onToggleFavorite(item);
                }}
              />
            )}
            <Badge variant="secondary">{item.category}</Badge>
            <Badge variant="outline">Lvl {item.reqLevel}</Badge>
          </div>
        </div>
        {item.isAncientCoupon && <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Ancient Coupon Unique</p>}
        {item.gambleItem && <p className="text-xs text-muted-foreground">Gamble: {item.gambleItem}</p>}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Properties */}
        {item.properties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-[#8080E6]">
              {item.properties.map((prop, idx) => (
                <li key={`${String(idx)}-${prop}`}>
                  <SkillRefText line={prop} item={{ kind: 'unique', name: item.name }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes (rare annotation from the source "Notes" column) */}
        {item.notes && <p className="border-t pt-2 text-center text-sm text-muted-foreground">{item.notes}</p>}

        <ItemSourceLine index={sourceIndex} name={item.name} kind="unique" />
      </CardContent>
    </Card>
  );
}
