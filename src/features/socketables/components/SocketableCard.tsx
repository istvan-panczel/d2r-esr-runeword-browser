import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CategoryBadge } from './CategoryBadge';
import { getSocketableColorClass } from '../utils/socketableColors';
import type { UnifiedSocketable } from '../types';
import { socketableIconRef } from '../utils/socketableIcon';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { ItemSourceLine } from '@/features/game-data/components/ItemSourceLine';
import type { SourceIndex } from '@/features/game-data/engine/sourceLookup';
import { SkillRefText } from '@/features/skills/components/SkillRefText';

interface SocketableCardProps {
  readonly socketable: UnifiedSocketable;
  /** Name index of the game-data sources bundle (from `useItemSources()`); omitted → no source line */
  readonly sourceIndex?: SourceIndex | null;
}

export function SocketableCard({ socketable, sourceIndex }: SocketableCardProps) {
  const { name, category, color, reqLevel, bonuses, points } = socketable;

  // Get theme-aware color class for the name
  const colorClass = getSocketableColorClass(color, category);

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ItemIcon item={socketableIconRef(socketable)} size={44} className="rounded-md bg-muted/50" />
            <div className="min-w-0 space-y-1">
              <CardTitle className={cn('break-words text-base', colorClass)}>
                {name}
                {points !== undefined && <span className="text-muted-foreground font-normal"> ({points} pts)</span>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Req Level: {reqLevel}</p>
            </div>
          </div>
          <CategoryBadge category={category} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Weapons/Gloves bonuses */}
        {bonuses.weaponsGloves.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Weapons/Gloves:</p>
            <ul className="space-y-0.5 text-[#8080E6]">
              {bonuses.weaponsGloves.map((affix) => (
                <li key={affix.rawText}>
                  <SkillRefText line={affix.rawText} />
                </li>
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
                <li key={affix.rawText}>
                  <SkillRefText line={affix.rawText} />
                </li>
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
                <li key={affix.rawText}>
                  <SkillRefText line={affix.rawText} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <ItemSourceLine index={sourceIndex} name={name} kind="misc" />
      </CardContent>
    </Card>
  );
}
