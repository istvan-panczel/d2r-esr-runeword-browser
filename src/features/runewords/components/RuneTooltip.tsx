import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ResolvedRune } from '@/core/utils/socketableLookup';
import { CATEGORY_LABELS } from '@/core/utils/itemCategoryMapping';

interface RuneTooltipProps {
  readonly rune: ResolvedRune | null;
  readonly children: ReactNode;
}

export function RuneTooltip({ rune, children }: RuneTooltipProps) {
  if (!rune) {
    return <>{children}</>;
  }

  const runeData = rune.rune;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        {/* Rune name */}
        <div className="font-medium mb-2">{runeData.name}</div>
        <p className="text-sm text-muted-foreground mb-3">Req Level: {runeData.reqLevel}</p>

        {/* Bonuses */}
        <div className="space-y-2 text-xs">
          {runeData.bonuses.weaponsGloves.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.weaponsGloves}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {runeData.bonuses.weaponsGloves.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {runeData.bonuses.helmsBoots.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.helmsBoots}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {runeData.bonuses.helmsBoots.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {runeData.bonuses.armorShieldsBelts.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">{CATEGORY_LABELS.armorShieldsBelts}:</p>
              <ul className="mt-0.5 space-y-0.5">
                {runeData.bonuses.armorShieldsBelts.map((a) => (
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
