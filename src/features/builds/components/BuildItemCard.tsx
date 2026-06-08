import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '@/components/ui/card';
import type { Gemword } from '@/core/db';
import { HtmUniqueItemCard } from '@/features/htm-unique-items';
import { MythicalUniqueCard } from '@/features/mythical-uniques';
import { RunewordCard } from '@/features/runewords';
import { GemwordCard, useGemBonusMap } from '@/features/gemwords';
import type { EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import { itemRefKey, resolveFullItem } from '../utils/resolveItem';
import { ItemRefDisplay } from './ItemRefDisplay';

// Gemwords need a gem-bonus map; load it here so callers don't have to thread it
// through the slot grids. A build has only a handful of gemwords, so the per-card
// load (vs. the browse screen's shared map) is negligible.
function GemwordSlotCard({ gemword }: { readonly gemword: Gemword }) {
  const gemBonusMap = useGemBonusMap();
  return <GemwordCard gemword={gemword} gemBonusMap={gemBonusMap} />;
}

interface BuildItemCardProps {
  readonly item: ItemRef;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
}

/**
 * Renders an equipped item using the same rich cards as the browse pages, resolved
 * from the viewer's current local data. Falls back to the saved snapshot text for
 * freetext items, items missing from the current ESR data, or while data loads.
 */
export function BuildItemCard({ item, slot }: BuildItemCardProps) {
  const resolved = useLiveQuery(() => resolveFullItem(item), [itemRefKey(item)]);

  if (resolved) {
    switch (resolved.kind) {
      case 'unique':
        return <HtmUniqueItemCard item={resolved.item} />;
      case 'mythical':
        return <MythicalUniqueCard item={resolved.item} />;
      case 'runeword':
        return <RunewordCard runeword={resolved.runeword} />;
      case 'gemword':
        return <GemwordSlotCard gemword={resolved.gemword} />;
    }
  }

  // Freetext, missing item, or still loading: show the saved snapshot details.
  return (
    <Card className="h-full p-3">
      <ItemRefDisplay item={item} slot={slot} />
    </Card>
  );
}
