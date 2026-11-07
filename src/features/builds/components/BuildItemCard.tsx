import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '@/components/ui/card';
import type { Gemword, Runeword } from '@/core/db';
import { HtmUniqueItemCard } from '@/features/htm-unique-items';
import { MythicalUniqueCard } from '@/features/mythical-uniques';
import { RunewordCard } from '@/features/runewords';
import { GemwordCard, useGemBonusMap } from '@/features/gemwords';
import type { EquipmentSlot, ItemRef, RunewordItemRef, WeaponSwapSlot } from '../buildData';
import { useRunewordBases } from '../hooks/useRunewordBases';
import { hasItemChoices } from '../utils/itemChoices';
import { itemRefKey, resolveFullItem } from '../utils/resolveItem';
import { socketableGroupsFor } from '../utils/socketableGroups';
import { ItemChoicesDisplay } from './ItemChoicesDisplay';
import { ItemRefDisplay } from './ItemRefDisplay';
import { SetItemBuildCard } from './SetItemBuildCard';

// Gemwords need a gem-bonus map; load it here so callers don't have to thread it
// through the slot grids. A build has only a handful of gemwords, so the per-card
// load (vs. the browse screen's shared map) is negligible.
function GemwordSlotCard({ gemword, slot }: { readonly gemword: Gemword; readonly slot: EquipmentSlot | WeaponSwapSlot }) {
  const gemBonusMap = useGemBonusMap();
  return (
    <GemwordCard gemword={gemword} gemBonusMap={gemBonusMap} socketableGroups={socketableGroupsFor(gemword.socketableBonuses, { slot })} />
  );
}

interface RunewordSlotCardProps {
  readonly runeword: Runeword;
  readonly item: ItemRef;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
}

/** A runeword card showing the socketable bonus groups of its chosen base (else of its slot). */
function RunewordSlotCard({ runeword, item, slot }: RunewordSlotCardProps) {
  if (item.type === 'runeword' && item.base !== undefined) return <RunewordBaseCard runeword={runeword} item={item} slot={slot} />;
  return <RunewordCard runeword={runeword} socketableGroups={socketableGroupsFor(runeword.socketableBonuses, { slot })} />;
}

/** Loads the game-data bundles only for a runeword with a chosen base (bases.json resolves its item types). */
function RunewordBaseCard({ runeword, item, slot }: RunewordSlotCardProps & { readonly item: RunewordItemRef }) {
  const state = useRunewordBases(item, slot);
  const context =
    state.status === 'ready' && state.chosenBase !== undefined ? { slot, base: state.chosenBase, typeNames: state.typeNames } : { slot };
  return <RunewordCard runeword={runeword} socketableGroups={socketableGroupsFor(runeword.socketableBonuses, context)} />;
}

interface BuildItemCardProps {
  readonly item: ItemRef;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  /** Set items only: pieces of the item's set equipped in this section (marks its partial groups active/inactive). */
  readonly setPieces?: number;
  /** Show the author's choices (runeword base, socket fillers) under the card; off in the form, which edits them. */
  readonly showChoices?: boolean;
}

/**
 * Renders an equipped item using the same rich cards as the browse pages, resolved
 * from the viewer's current local data. Falls back to the saved snapshot text for
 * freetext items, items missing from the current ESR data, or while data loads.
 */
export function BuildItemCard({ item, slot, setPieces, showChoices = true }: BuildItemCardProps) {
  if (!showChoices || !hasItemChoices(item)) return <ItemCard item={item} slot={slot} setPieces={setPieces} />;
  return (
    <div className="flex h-full flex-col gap-1.5">
      <ItemCard item={item} slot={slot} setPieces={setPieces} />
      <ItemChoicesDisplay item={item} slot={slot} />
    </div>
  );
}

function ItemCard({ item, slot, setPieces }: Omit<BuildItemCardProps, 'showChoices'>) {
  const resolved = useLiveQuery(() => resolveFullItem(item), [itemRefKey(item)]);

  if (resolved) {
    switch (resolved.kind) {
      case 'unique':
        return <HtmUniqueItemCard item={resolved.item} />;
      case 'mythical':
        return <MythicalUniqueCard item={resolved.item} />;
      case 'runeword':
        return <RunewordSlotCard runeword={resolved.runeword} item={item} slot={slot} />;
      case 'gemword':
        return <GemwordSlotCard gemword={resolved.gemword} slot={slot} />;
      case 'set':
        return <SetItemBuildCard item={resolved.item} set={resolved.set} equippedPieces={setPieces} />;
    }
  }

  // Freetext, missing item, or still loading: show the saved snapshot details.
  return (
    <Card className="h-full p-3">
      <ItemRefDisplay item={item} slot={slot} setPieces={setPieces} />
    </Card>
  );
}
