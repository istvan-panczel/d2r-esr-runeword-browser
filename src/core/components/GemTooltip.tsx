import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { db } from '@/core/db';

interface GemTooltipProps {
  readonly gemName: string;
  readonly children: ReactNode;
}

export function GemTooltip({ gemName, children }: GemTooltipProps) {
  const gem = useLiveQuery(() => db.gems.get(gemName), [gemName]);

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
              <p className="font-medium text-muted-foreground">Weapons/Gloves:</p>
              <ul className="mt-0.5 space-y-0.5">
                {gem.bonuses.weaponsGloves.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {gem.bonuses.helmsBoots.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">Helms/Boots:</p>
              <ul className="mt-0.5 space-y-0.5">
                {gem.bonuses.helmsBoots.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {gem.bonuses.armorShieldsBelts.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">Armor/Shields/Belts:</p>
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
