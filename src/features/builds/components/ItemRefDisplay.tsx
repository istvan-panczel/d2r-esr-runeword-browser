import type { EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import { slotToColumn } from '../utils/buildSnapshot';

interface ItemRefDisplayProps {
  readonly item: ItemRef;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
}

function AffixList({ lines }: { readonly lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
      {lines.map((line, index) => (
        <li key={`${String(index)}:${line}`}>{line}</li>
      ))}
    </ul>
  );
}

/** Renders a single item reference (name + stats) for the build detail page. */
export function ItemRefDisplay({ item, slot }: ItemRefDisplayProps) {
  if (item.type === 'freetext') {
    return (
      <p className="text-sm font-medium">
        {item.name} <span className="text-xs font-normal text-muted-foreground">(custom)</span>
      </p>
    );
  }

  if (item.type === 'unique' || item.type === 'mythical') {
    return (
      <div>
        <p className="text-sm font-medium">{item.snapshot.name}</p>
        <p className="text-xs text-muted-foreground">{item.snapshot.baseItem}</p>
        <AffixList lines={item.snapshot.properties} />
      </div>
    );
  }

  // Runeword or gemword: show the recipe and the bonus column for this slot.
  const recipe = item.type === 'runeword' ? item.snapshot.runes : item.snapshot.gems;
  const affixes = item.snapshot.columnAffixes[slotToColumn(slot)];
  return (
    <div>
      <p className="text-sm font-medium">
        {item.name} <span className="text-xs font-normal text-muted-foreground">({recipe.join(' ')})</span>
      </p>
      <AffixList lines={affixes} />
    </div>
  );
}
