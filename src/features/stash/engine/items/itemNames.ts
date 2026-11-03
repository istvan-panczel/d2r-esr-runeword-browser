/**
 * The display name of a stash item, as the game's tooltip titles it: the unique / set item / runeword name, a rare's
 * two names, a magic item's prefix + base + suffix, "Superior" / inferior prefixes, the personalized owner.
 *
 * CONTRACT (docs/features/STASH-ITEMS.md "Contracts"): the All items page workstream owns this file. The signature is
 * fixed; names fall back to the base name where a name table is missing, so it works with the placeholder text context
 * and lights up when itemtext.json's name tables arrive.
 */
import type { StashItem } from '../../parser/types';
import type { StashCatalog } from '../catalog';
import { describeStashItem } from '../describeItem';
import type { ItemTextContext } from './itemText';

const join = (...parts: (string | null)[]) => parts.filter((part) => part !== null && part !== '').join(' ');

/**
 * The item's name (one line). Without `text` (or with the placeholder context) affix and rare names fall back to the
 * base name; unique, set item and runeword names come from stash.json and are always there.
 */
export function itemDisplayName(item: StashItem, catalog: StashCatalog, text: ItemTextContext | null = null): string {
  const described = describeStashItem(item, catalog);
  const names = text?.names ?? null;
  const base = described.baseName;
  let name: string;
  if (described.unique !== null) name = described.unique.name;
  else if (described.setItem !== null) name = described.setItem.name;
  else if (described.runeword !== null) name = described.runeword.name;
  else if (item.rareNameIds !== null) {
    const [first, second] = item.rareNameIds;
    const rare = names === null ? '' : join(names.rareName(first), names.rareName(second));
    name = rare === '' ? base : rare;
  } else if (item.quality === 'magic') {
    name = names === null ? base : join(names.magicPrefix(item.prefixIds[0] ?? 0), base, names.magicSuffix(item.suffixIds[0] ?? 0));
  } else if (item.quality === 'superior') {
    name = join(names?.superior ?? 'Superior', base);
  } else if (item.quality === 'inferior') {
    name = join(item.qualityVariant === null ? null : (names?.lowQuality(item.qualityVariant) ?? null), base);
  } else {
    name = base;
  }
  return item.personalizedName === null ? name : `${item.personalizedName}'s ${name}`;
}

/**
 * The stack size of a quantity item (arrows, bolts, keys, tomes, throwing weapons): "×350"; null for other items. Kept
 * apart from the name, so the name stays what the in-game stash search finds.
 */
export function itemQuantityLabel(item: Pick<StashItem, 'quantity' | 'stackSize'>): string | null {
  const count = item.quantity ?? item.stackSize;
  return count === null ? null : `×${String(count)}`;
}
