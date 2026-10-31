import type { Runeword } from '@/core/db/models';
import type { SocketableLookup } from '@/core/utils/socketableLookup';
import { resolveRune } from '@/core/utils/socketableLookup';
import { isGemName } from '@/features/data-sync/parsers/gemsParser';
import type { ItemIconRef } from '@/features/game-data/hooks/useItemIcons';
import { socketableIconRef } from '@/features/socketables/utils/socketableIcon';

/** One socket of a runeword's socket row: a recipe ingredient, or a jewel slot (required, or optional up to `socketsMax`). */
export type SocketSlot = { readonly kind: 'rune' | 'gem'; readonly name: string } | { readonly kind: 'jewel'; readonly optional: boolean };

/** The fields the socket row reads; `ingredients` / `socketsMax` are missing on old cached rows. */
export type SocketSlotSource = Pick<Runeword, 'sockets' | 'runes'> & Partial<Pick<Runeword, 'ingredients' | 'socketsMax'>>;

/**
 * The sockets of a runeword, left to right: the required jewel slots, then the optional ones, then its ingredients in
 * recipe order (runes and gems interleaved). Jewels come first because ESR's runes.txt rows put them first
 * (`jew jew r93 r33 r43`); the site lists the jewels first too.
 *
 * Counts come from the socket numbers, not the `jewelInfo` text: the parser keeps `sockets` = ingredients + required
 * jewels (the ESR 3.2 per-count rows list their jewels as plain "Jewel" lines, e.g. Moonlight 4 sockets = 3 runes +
 * "(1) Jewel"), and `socketsMax` is set only on the ranged "(N-M Socket)" rows with "(0-K) Jewels", where
 * M − N = K optional slots (on the list, `foldJewelVariants` merges the rows into such ranges, e.g. Tourbillion
 * "5-6 Socket" with "(1-2) Jewels"). So required = sockets − ingredients, optional = socketsMax − sockets (each at
 * least 0).
 */
export function buildSocketSlots(runeword: SocketSlotSource): SocketSlot[] {
  const ingredients = runeword.ingredients !== undefined && runeword.ingredients.length > 0 ? runeword.ingredients : runeword.runes;
  const required = Math.max(0, runeword.sockets - ingredients.length);
  const optional =
    runeword.socketsMax === undefined ? 0 : Math.max(0, runeword.socketsMax - Math.max(runeword.sockets, ingredients.length));
  return [
    ...Array.from({ length: required }, (): SocketSlot => ({ kind: 'jewel', optional: false })),
    ...Array.from({ length: optional }, (): SocketSlot => ({ kind: 'jewel', optional: true })),
    ...ingredients.map((name): SocketSlot => ({ kind: isGemName(name) ? 'gem' : 'rune', name })),
  ];
}

/** Whether the recipe takes jewels at all (required or optional): the card then shows the Mythical Jewel note. */
export function hasJewelSlots(runeword: SocketSlotSource): boolean {
  return buildSocketSlots(runeword).some((slot) => slot.kind === 'jewel');
}

/**
 * The icon of a rune in a runeword: the rune as the card resolves it (LoD runewords prefer the LoD rune, see
 * `resolveRune`), so Ko gets the LoD art in a LoD runeword and the ESR art otherwise. Before the lookup has loaded (or
 * for a rune it does not know) the category follows the runeword, which picks the same Ko art.
 */
export function runeIconRef(lookup: SocketableLookup | null | undefined, runeName: string, isLod: boolean): ItemIconRef {
  const category = (lookup ? resolveRune(lookup, runeName, isLod)?.category : undefined) ?? (isLod ? 'lodRunes' : 'esrRunes');
  return socketableIconRef({ name: runeName, category });
}
