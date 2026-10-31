import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { GemTooltip } from '@/core/components/GemTooltip';
import { useSocketableLookup } from '@/core/hooks/useSocketableLookup';
import { resolveRune } from '@/core/utils/socketableLookup';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import type { ItemIconRef } from '@/features/game-data/hooks/useItemIcons';
import { RuneTooltip } from './RuneTooltip';
import { buildSocketSlots, runeIconRef, type SocketSlotSource } from '../utils/socketSlots';

/** Socket circle and icon sizes (px): the row adds about 42 px to the card (36 px sockets + the 6 px gap below). */
const SOCKET_SIZE = 'size-9';
const ICON_SIZE = 30;

/** A dark, inset socket hole, like the in-game sockets; it reads the same on the light and dark card backgrounds. */
const SOCKET_BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#3a3530,#121010_75%)] shadow-[inset_0_2px_5px_rgba(0,0,0,0.85)]';
const SOCKET_RING = 'ring-1 ring-stone-500/60 dark:ring-stone-400/40';
/** Optional jewel sockets: dimmed, with a dashed outline instead of the ring. */
const OPTIONAL_SOCKET = 'border border-dashed border-stone-500 opacity-45 dark:border-stone-400';

interface RunewordSocketRowProps {
  readonly runeword: SocketSlotSource;
  readonly isLod: boolean;
}

/**
 * The runeword's sockets as the item shows them: the required jewel sockets (empty) and the optional ones up to
 * `socketsMax` (dimmed, dashed outline; jewel sockets are not interactive), then one per ingredient with its HD icon
 * (click / tap opens the same popover as its badge; no hover title, details come from the popover only). An icon that is
 * missing or fails to load leaves the empty socket; the circles keep their size meanwhile.
 */
export function RunewordSocketRow({ runeword, isLod }: RunewordSocketRowProps) {
  const lookup = useSocketableLookup();
  const slots = buildSocketSlots(runeword);

  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((slot, index) => {
        const key = `${slot.kind}-${String(index)}`;
        if (slot.kind === 'jewel') {
          return (
            <span
              key={key}
              role="img"
              aria-label={slot.optional ? 'Optional jewel socket' : 'Jewel socket'}
              className={cn(SOCKET_BASE, SOCKET_SIZE, slot.optional ? OPTIONAL_SOCKET : SOCKET_RING)}
            />
          );
        }
        if (slot.kind === 'gem') {
          return (
            <GemTooltip key={key} gem={lookup?.gems.get(slot.name)}>
              <FilledSocket name={slot.name} icon={{ kind: 'misc', name: slot.name }} />
            </GemTooltip>
          );
        }
        return (
          <RuneTooltip key={key} rune={lookup ? resolveRune(lookup, slot.name, isLod) : null}>
            <FilledSocket name={slot.name} icon={runeIconRef(lookup, slot.name, isLod)} />
          </RuneTooltip>
        );
      })}
    </div>
  );
}

type FilledSocketProps = Omit<ComponentProps<'button'>, 'children'> & {
  readonly name: string;
  readonly icon: ItemIconRef;
};

/** The popover trigger: the tooltips' `asChild` triggers pass their handlers, aria state and ref through the props. */
function FilledSocket({ name, icon, className, ...buttonProps }: FilledSocketProps) {
  return (
    <button
      type="button"
      aria-label={name}
      {...buttonProps}
      className={cn(
        SOCKET_BASE,
        SOCKET_SIZE,
        SOCKET_RING,
        'cursor-pointer transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <ItemIcon item={icon} size={ICON_SIZE} />
    </button>
  );
}
