import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Gem } from '@/core/db/models';
import { CATEGORY_LABELS } from '@/core/utils/itemCategoryMapping';

interface GemTooltipProps {
  readonly gem: Gem | undefined;
  readonly children: ReactNode;
}

export function GemTooltip({ gem, children }: GemTooltipProps) {
  if (!gem) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="font-medium mb-2">{gem.name}</div>
        <p className="text-sm text-muted-foreground mb-3">
          {gem.quality} {gem.type} &middot; Req Level: {gem.reqLevel}
        </p>

        <div className="space-y-2 text-xs">
          {gem.bonuses.weaponsGloves.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.weaponsGloves}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {gem.bonuses.weaponsGloves.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {gem.bonuses.helmsBoots.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.helmsBoots}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {gem.bonuses.helmsBoots.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {gem.bonuses.armorShieldsBelts.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.armorShieldsBelts}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {gem.bonuses.armorShieldsBelts.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
