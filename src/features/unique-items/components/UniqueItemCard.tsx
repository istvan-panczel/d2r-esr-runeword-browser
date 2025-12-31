import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { DisplayUniqueItem } from '../types';

interface UniqueItemCardProps {
  readonly item: DisplayUniqueItem;
  readonly onItemClick?: (item: DisplayUniqueItem) => void;
}

export function UniqueItemCard({ item, onItemClick }: UniqueItemCardProps) {
  const { index, itemName, itemCode, itemTier, level, levelReq, translatedProperties, isAncientCoupon } = item;

  const handleTitleClick = () => {
    onItemClick?.(item);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-amber-700 dark:text-amber-400 cursor-pointer hover:underline" onClick={handleTitleClick}>
          {index}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {itemName} ({itemCode}){itemTier ? ` [${itemTier}]` : ''}
        </p>
        {isAncientCoupon && <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Ancient Coupon Unique</p>}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Level info */}
        <div className="flex gap-4 text-sm">
          <span>
            <span className="text-muted-foreground">Level:</span> {level}
          </span>
          <span>
            <span className="text-muted-foreground">Req:</span> {levelReq}
          </span>
        </div>

        {/* Properties */}
        {translatedProperties.length > 0 && (
          <div className="text-center">
            <ul className="space-y-0.5 text-[#8080E6]">
              {translatedProperties.map((prop, idx) => (
                <li key={`${String(idx)}-${prop.rawCode}`}>{prop.text}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
