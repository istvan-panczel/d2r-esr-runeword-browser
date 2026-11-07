import type { Runeword } from '@/core/db';
import type { TxtRunewordRow } from '@/features/game-data/engine/schema';
import { SOCKETED_MAX_ENTRIES, type EquipmentSlot, type WeaponSwapSlot } from '../buildData';

/**
 * Most socket fillers a unique / mythical / set item in a slot can carry, by slot family
 * (the largest socket count any base of that family can have, rounded to the game's
 * rules of thumb): weapons, shields and body armour 6, helms 4, gloves / boots / belts 2,
 * amulets and rings 1. Runewords use their free jewel sockets instead (runewordJewelSockets).
 */
export const SLOT_SOCKET_CAPS: Readonly<Record<EquipmentSlot | WeaponSwapSlot, number>> = {
  weapon: 6,
  weapon2: 6,
  shield: 6,
  shield2: 6,
  armor: 6,
  helmet: 4,
  gloves: 2,
  boots: 2,
  belt: 2,
  amulet: 1,
  ring1: 1,
  ring2: 1,
};

export function slotSocketCap(slot: EquipmentSlot | WeaponSwapSlot): number {
  return Math.min(SLOT_SOCKET_CAPS[slot], SOCKETED_MAX_ENTRIES);
}

/** "(2) Jewels" → 2, "(0-3) Jewels" → 3, "(1) Jewel" → 1; 0 when absent or unreadable. */
export function parseJewelInfo(jewelInfo: string | undefined): number {
  if (jewelInfo === undefined) return 0;
  const match = /\(\s*(?:\d+\s*-\s*)?(\d+)\s*\)/.exec(jewelInfo);
  return match === null ? 0 : parseInt(match[1], 10);
}

/**
 * How many sockets of a runeword take a jewel (the only sockets the author can fill): the
 * largest `jewels` of the matched txt rows when there are any, else from the HTM recipe
 * (the most jewels of its "(N) Jewels" / "(N-M) Jewels" line, which counts the required and
 * optional ones, e.g. ESR 3.3 Moonlight "(4-6 Socket)" "(1-3) Jewels" → 3; else the socket range width).
 */
export function runewordJewelSockets(
  runeword: Pick<Runeword, 'sockets' | 'socketsMax'> & Partial<Pick<Runeword, 'jewelInfo'>>,
  matchedRows?: readonly Pick<TxtRunewordRow, 'jewels'>[]
): number {
  if (matchedRows !== undefined && matchedRows.length > 0) return Math.max(...matchedRows.map((row) => row.jewels));
  const fromInfo = parseJewelInfo(runeword.jewelInfo);
  if (fromInfo > 0) return fromInfo;
  if (runeword.socketsMax !== undefined) return Math.max(0, runeword.socketsMax - runeword.sockets);
  return 0;
}
