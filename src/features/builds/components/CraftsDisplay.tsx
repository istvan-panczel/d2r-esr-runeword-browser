import { cn } from '@/lib/utils';
import type { CraftAnnotation, EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import { craftIdentity, renderCraft } from '../utils/crafts';
import { slotGroup } from '../utils/slotFit';

interface CraftsDisplayProps {
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  /** The slot's item: an anointment it cannot roll reads as outdated */
  readonly item: ItemRef;
  readonly crafts: readonly CraftAnnotation[];
  readonly craftData: CraftDataState;
}

/** Read-only crafting annotations under an item card: each title with its bonus lines from the current bundles. */
export function CraftsDisplay({ slot, item, crafts, craftData }: CraftsDisplayProps) {
  if (crafts.length === 0) return null;
  const family = slotGroup(slot);
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <p className="text-xs font-medium text-muted-foreground">
        Crafting:
        {craftData.status === 'error' && <span className="ml-1 font-normal">(game data unavailable)</span>}
      </p>
      <ul className="space-y-0.5">
        {crafts.map((craft, index) => {
          const rendered = renderCraft(craft, family, craftData.lookups, item);
          return (
            <li key={`${String(index)}:${craftIdentity(craft)}`}>
              <span className={cn(rendered.stale && craftData.status === 'ready' && 'text-muted-foreground')}>{rendered.title}</span>
              {rendered.stale && craftData.status === 'ready' && (
                <span className="block text-xs text-muted-foreground italic">Not in the current game data</span>
              )}
              {rendered.lines.length > 0 && <span className="block text-xs text-muted-foreground">{rendered.lines.join(', ')}</span>}
              {rendered.note !== undefined && <span className="block text-[11px] text-muted-foreground/80">{rendered.note}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
