import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { db } from '@/core/db';
import type { SocketableBonuses } from '@/core/db/models';

interface RuneTooltipProps {
  readonly runeName: string;
  readonly children: ReactNode;
  /** Whether this rune belongs to a LoD runeword (affects lookup order for shared runes like Ko) */
  readonly isLod?: boolean;
}

interface RuneData {
  name: string;
  reqLevel: number;
  bonuses: SocketableBonuses;
  category: 'esrRunes' | 'lodRunes' | 'kanjiRunes';
  tier?: number;
  color?: string;
}

export function RuneTooltip({ runeName, children, isLod }: RuneTooltipProps) {
  // For LoD runewords, check LoD first to resolve shared runes (e.g. Ko) correctly.
  const runeData = useLiveQuery(async (): Promise<RuneData | null> => {
    if (isLod) {
      const lodRune = await db.lodRunes.get(runeName);
      if (lodRune) {
        return { ...lodRune, category: 'lodRunes' };
      }
    }

    // Try ESR runes
    const esrRune = await db.esrRunes.get(runeName);
    if (esrRune) {
      return { ...esrRune, category: 'esrRunes' };
    }

    // Try LoD runes (fallback when not isLod)
    if (!isLod) {
      const lodRune = await db.lodRunes.get(runeName);
      if (lodRune) {
        return { ...lodRune, category: 'lodRunes' };
      }
    }

    // Try Kanji runes
    const kanjiRune = await db.kanjiRunes.get(runeName);
    if (kanjiRune) {
      return { ...kanjiRune, category: 'kanjiRunes' };
    }

    return null;
  }, [runeName, isLod]);

  if (!runeData) {
    return <>{children}</>;
  }

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
              <p className="font-medium text-muted-foreground">Weapons/Gloves:</p>
              <ul className="mt-0.5 space-y-0.5">
                {runeData.bonuses.weaponsGloves.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {runeData.bonuses.helmsBoots.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">Helms/Boots:</p>
              <ul className="mt-0.5 space-y-0.5">
                {runeData.bonuses.helmsBoots.map((a) => (
                  <li key={a.rawText}>{a.rawText}</li>
                ))}
              </ul>
            </div>
          )}
          {runeData.bonuses.armorShieldsBelts.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">Armor/Shields/Belts:</p>
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
