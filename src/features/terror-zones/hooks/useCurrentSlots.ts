import { currentWindow, nextSlotIndex, slotIndexAt, slotWindow, type TerrorZoneSchedule, type TerrorZoneSlot } from '../engine/schedule';
import { useClockValue } from '../store/clock';

export interface CurrentSlots {
  /** The terrorized window now; null before the start, after the end or in a break */
  readonly current: TerrorZoneSlot | null;
  /** The next window to start */
  readonly next: TerrorZoneSlot | null;
  /** The first slot index that starts after now */
  readonly nextSlot: number;
}

/** "slot:in-zone": changes once per slot (twice with breaks), so subscribers re-render then and not every second */
function phaseKey(schedule: TerrorZoneSchedule, now: number): string {
  return `${String(slotIndexAt(schedule, now))}:${String(currentWindow(schedule, now) !== null)}`;
}

/** The current and next window, re-rendering only when the slot changes. */
export function useCurrentSlots(schedule: TerrorZoneSchedule): CurrentSlots {
  const key = useClockValue((now) => phaseKey(schedule, now));
  // The phase key only says when to recompute; the windows are read from the slot index in it
  const [slotText = '0', inZone] = key.split(':');
  const slot = Number(slotText);
  const current = inZone === 'true' ? slotWindow(schedule, slot) : null;
  const nextSlot = nextSlotIndex(schedule, schedule.bundle.config.start + slot * schedule.period);
  return { current, next: slotWindow(schedule, nextSlot), nextSlot };
}
