import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CategoryBadge } from './CategoryBadge';
import { getSocketableColorClass } from '../utils/socketableColors';
import type { UnifiedSocketable } from '../types';

interface SocketableCardProps {
  readonly socketable: UnifiedSocketable;
}

export function SocketableCard({ socketable }: SocketableCardProps) {
  const { name, category, color, reqLevel, bonuses, points } = socketable;

  // Get theme-aware color class for the name
  const colorClass = getSocketableColorClass(color, category);

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className={cn('text-base', colorClass)}>
            {name}
            {points !== undefined && <span className="text-muted-foreground font-normal"> ({points} pts)</span>}
          </CardTitle>
          <CategoryBadge category={category} />
        </div>
        <p className="text-sm text-muted-foreground">Req Level: {reqLevel}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Weapons/Gloves bonuses */}
        {bonuses.weaponsGloves.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Weapons/Gloves:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {bonuses.weaponsGloves.map((affix) => (
                <li key={affix.rawText}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Helms/Boots bonuses */}
        {bonuses.helmsBoots.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Helms/Boots:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {bonuses.helmsBoots.map((affix) => (
                <li key={affix.rawText}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Armor/Shields/Belts bonuses */}
        {bonuses.armorShieldsBelts.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Armor/Shields/Belts:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {bonuses.armorShieldsBelts.map((affix) => (
                <li key={affix.rawText}>{affix.rawText}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
