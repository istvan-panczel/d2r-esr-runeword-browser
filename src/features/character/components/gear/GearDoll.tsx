import type { EquipSlot } from '../../parser/types';
import type { GearSlot } from '../../engine/characterItems';
import { ItemTile } from './ItemTile';

/**
 * The in-game equipment screen's arrangement: helm and amulet on top, the hands beside the body armor, the rings beside
 * the belt, gloves and boots at the bottom. CSS grid areas, so every slot keeps its place even when others are hidden.
 */
const AREAS = `". head neck" "rightHand torso leftHand" "rightRing belt leftRing" "gloves . feet"`;

interface GearDollProps {
  readonly slots: readonly GearSlot[];
  /** The selection key of a slot */
  readonly keyOf: (slot: GearSlot) => string;
  readonly selected: string | null;
  readonly onSelect: (key: string) => void;
  /** Labels of the hand slots when they differ from the slot names ("Right hand" → "Weapon set II, right") */
  readonly handLabel?: (slot: Extract<EquipSlot, 'rightHand' | 'leftHand'>) => string;
}

/** A paperdoll of item tiles; each filled slot is a button that shows the item's full card. */
export function GearDoll({ slots, keyOf, selected, onSelect, handLabel }: GearDollProps) {
  return (
    <div className="grid max-w-md grid-cols-3 gap-2" style={{ gridTemplateAreas: AREAS }}>
      {slots.map((slot) => {
        const key = keyOf(slot);
        const label = handLabel !== undefined && (slot.key === 'rightHand' || slot.key === 'leftHand') ? handLabel(slot.key) : slot.label;
        return (
          <ItemTile
            key={key}
            label={label}
            row={slot.row}
            selected={selected === key}
            onSelect={() => {
              onSelect(key);
            }}
            style={{ gridArea: slot.key }}
            className={slot.key === 'rightHand' || slot.key === 'leftHand' || slot.key === 'torso' ? 'min-h-28' : undefined}
          />
        );
      })}
    </div>
  );
}
