/**
 * The text of a stash item: its tooltip lines (grouped like the game's tooltip), the displayed value of every stat for
 * the stat filters, and the affix / rare name tables for item names. Built from itemtext.json (lazy, /stash/items only)
 * and the stash catalog; the lines come from the generator's stat renderer (game-data/engine/stats) fed with the saved
 * stats (textData.ts).
 *
 * CONTRACT (docs/features/STASH-ITEMS.md "Contracts"): the stat text workstream owns this file; the All items page
 * codes against these signatures only. `createItemTextContext(null, catalog)` gives the placeholder context (no
 * itemtext.json yet): name tables return null, `renderItemText` has only the base lines, `statValues` is empty.
 */
import type { ItemTextBundle } from '@/features/game-data/engine/schema';
import { renderLines } from '@/features/game-data/engine/stats/renderLines';
import type { StashItem, StashStat } from '../../parser/types';
import type { StashCatalog } from '../catalog';
import { baseText, socketStats, totalStats } from './baseLines';
import { createTextData, toEntries, type TextData } from './textData';
import { itemStatValues } from './statValues';

/** Affix and rare names by the ids a save stores (`StashItem.prefixIds` …); null for 0 or an unknown id */
export interface ItemNameTables {
  /** magicprefix.txt name by 1-based id ("Shimmering") */
  magicPrefix(id: number): string | null;
  /** magicsuffix.txt name by 1-based id ("of the Fox") */
  magicSuffix(id: number): string | null;
  /** automagic.txt name by 1-based id */
  autoAffix(id: number): string | null;
  /** The rare / crafted / tempered name of an id (`StashItem.rareNameIds` [first, second]: "Grim", "Shell") */
  rareName(id: number): string | null;
  /** The inferior prefix of a quality variant ("Cracked"); null when unknown */
  lowQuality(variant: number): string | null;
  /** "Superior" */
  readonly superior: string;
}

export interface ItemTextContext {
  readonly catalog: StashCatalog;
  readonly names: ItemNameTables;
  /** False for the placeholder context (no itemtext.json): names are null, no stat lines, no stat values */
  readonly hasText: boolean;
}

/** An item's tooltip text in the game's groups, top to bottom. Lines are display text without colour codes. */
export interface ItemTextGroups {
  /**
   * The base lines above the stats: Defense, damage, Durability ("Durability: 15 of 20", "Indestructible"), quantity,
   * requirements, "Socketed (N)", "Ethereal (Cannot be Repaired)"
   */
  readonly base: readonly string[];
  /** The item's own stats (magic, rare, crafted, unique, set item stats; a runeword base's own), sorted like the game */
  readonly stats: readonly string[];
  /** A runeword's (or gemword's) stats; [] otherwise */
  readonly runeword: readonly string[];
  /** A set item's bonus lists, one per bonus the item carries; `pieces` = items of the set worn for it (null when unknown) */
  readonly setBonuses: readonly { readonly pieces: number | null; readonly lines: readonly string[] }[];
  /**
   * The items in the sockets, in socket order: runes and gems with no lines (shown by name), jewels with their stats.
   * Their names come from `itemDisplayName` (items/itemNames.ts).
   */
  readonly socketed: readonly { readonly item: StashItem; readonly lines: readonly string[] }[];
}

/**
 * The displayed value of one filterable stat of an item, for the stat filters ("Faster Cast Rate ≥ 20", "All
 * Resistances ≥ 15", "+ to Fire Ball ≥ 3").
 *
 * - One entry per `key` per item: values of the same key are added up (the item's own stats, its runeword stats and
 *   the stats of the jewels in its sockets, like the game's tooltip); set bonuses are not included (they need the set
 *   worn). Hidden stats (descfunc 0) have no entry.
 * - Grouped stats get an entry of their own besides their members: `g.<name>` when every member is present, with the
 *   smallest member value (All Resistances = min of the four resistances), so a filter on the group and one on a
 *   single member both work.
 */
export interface StatValue {
  /**
   * Stable, URL-safe filter key: `s<statId>` for a stat whose line names no param, `s<statId>.<param>` for one that
   * names its param (a skill, class, skill tab or monster type), `g.<name>` for a grouped stat (`g.allres`,
   * `g.dmg-fire`). The same stat on two items has the same key.
   */
  readonly key: string;
  /** `key` without its param (`s<statId>`, or `key` itself): stats that differ only by param share it (the picker's first level) */
  readonly statKey: string;
  /** itemstatcost.txt id; null for a grouped stat */
  readonly statId: number | null;
  /** The saved param the key names (skill id, class, packed tab); null without one */
  readonly param: number | null;
  /** The key's label, `#` for the value; never contains the item's numbers: "+#% Faster Cast Rate", "+# to Fire Ball (Sorceress Only)" */
  readonly label: string;
  /** The label of `statKey` with the param as a placeholder: "+# to [Skill] ([Class] Only)"; equals `label` without a param */
  readonly statLabel: string;
  /** The param's display name ("Fire Ball", "Sorceress", "Fire Skills"); null without a param */
  readonly paramLabel: string | null;
  /**
   * The value as the tooltip shows it (after ValShift, the per-level divisor, ×100/128 and the like, poison totals; the
   * sign as shown): what `#` stands for. For a range ("Adds 10-20 Fire Damage") the max, see `range`.
   */
  readonly value: number;
  /** Both ends of a range line */
  readonly range?: { readonly min: number; readonly max: number };
  /** The value is per character level ("(Based on Character Level)"): `value` is the per-level amount */
  readonly perLevel?: true;
}

const NO_NAMES: ItemNameTables = {
  magicPrefix: () => null,
  magicSuffix: () => null,
  autoAffix: () => null,
  rareName: () => null,
  lowQuality: () => null,
  superior: 'Superior',
};

/** The renderer data of each real context (the context's fields are the contract; the data stays internal) */
const textData = new WeakMap<ItemTextContext, TextData>();

/** The renderer data of a context; null for the placeholder */
export function textDataOf(ctx: ItemTextContext): TextData | null {
  return textData.get(ctx) ?? null;
}

/** The text context of a loaded itemtext.json; `null` gives the placeholder context (base lines and names only). */
export function createItemTextContext(bundle: ItemTextBundle | null, catalog: StashCatalog): ItemTextContext {
  if (bundle === null) return { catalog, names: NO_NAMES, hasText: false };
  const byId = (names: readonly (string | null)[]) => (id: number) => (id > 0 ? (names[id] ?? null) : null);
  const ctx: ItemTextContext = {
    catalog,
    hasText: true,
    names: {
      magicPrefix: byId(bundle.magicPrefixes),
      magicSuffix: byId(bundle.magicSuffixes),
      autoAffix: byId(bundle.autoAffixes),
      rareName: byId(bundle.rareNames),
      lowQuality: (variant) => bundle.lowQuality[variant] ?? null,
      superior: bundle.superior,
    },
  };
  textData.set(ctx, createTextData(bundle));
  return ctx;
}

/** The display lines of a stat list (game order: summed, damage pairs and dgrp sets merged, by descpriority) */
export function statLines(stats: readonly StashStat[], data: TextData): string[] {
  return stats.length === 0 ? [] : renderLines(toEntries(stats, data), data.render);
}

/** The items of the set worn for each set bonus list of a set item (2, 3, … unless itemtext.json says otherwise) */
function bonusPieces(item: StashItem, data: TextData): (index: number) => number | null {
  if (item.setId === null) return () => null;
  const pieces = data.bundle.setBonusPieces?.[String(item.setId)];
  return (index) => (pieces === undefined ? index + 2 : (pieces[index] ?? null));
}

/** The tooltip lines of an item; the placeholder context has the base lines only. */
export function renderItemText(item: StashItem, ctx: ItemTextContext): ItemTextGroups {
  const data = textDataOf(ctx);
  if (data === null) {
    return {
      base: baseText(item, null).lines,
      stats: [],
      runeword: [],
      setBonuses: [],
      socketed: item.socketed.map((child) => ({ item: child, lines: [] })),
    };
  }
  const pieces = bonusPieces(item, data);
  return {
    base: baseText(item, data).lines,
    stats: statLines(item.stats, data),
    runeword: statLines(item.runewordStats, data),
    setBonuses: item.setBonusStats.map((stats, index) => ({ pieces: pieces(index), lines: statLines(stats, data) })),
    // runes and gems: their gems.txt column for this item's gem apply type; jewels: their saved stats
    socketed: item.socketed.map((child) => ({ item: child, lines: statLines(socketStats(child, item, data), data) })),
  };
}

/** The displayed value of every filterable stat of an item (rules: `StatValue`); the placeholder has none. */
export function statValues(item: StashItem, ctx: ItemTextContext): StatValue[] {
  const data = textDataOf(ctx);
  return data === null ? [] : [...baseText(item, data).values, ...itemStatValues(totalStats(item, data), data)];
}
