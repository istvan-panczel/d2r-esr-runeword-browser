import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/core/components/FavoriteButton';
import type { HtmUniqueItem } from '@/core/db';

interface HtmUniqueItemCardProps {
  readonly item: HtmUniqueItem;
  readonly isFavorite?: boolean;
  readonly favoriteCount?: number;
  readonly favoritePending?: boolean;
  readonly onToggleFavorite?: (item: HtmUniqueItem) => void;
}

export function HtmUniqueItemCard({
  item,
  isFavorite = false,
  favoriteCount = 0,
  favoritePending = false,
  onToggleFavorite,
}: HtmUniqueItemCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg text-amber-700 dark:text-amber-400">{item.name}</CardTitle>
          <div className="flex shrink-0 items-center gap-1">
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
        <p className="text-sm text-muted-foreground">
          {item.baseItem}
          {item.baseItemCode ? ` (${item.baseItemCode})` : ''}
        </p>
        {item.isAncientCoupon && <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Ancient Coupon Unique</p>}
        {item.gambleItem && <p className="text-xs text-muted-foreground">Gamble: {item.gambleItem}</p>}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Item level - temporarily hidden
        <div className="text-sm">
          <span className="text-muted-foreground">iLvl:</span> {item.itemLevel}
        </div>
        */}

        {/* Properties */}
        {item.properties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-[#8080E6]">
              {item.properties.map((prop, idx) => (
                <li key={`${String(idx)}-${prop}`}>{prop}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
