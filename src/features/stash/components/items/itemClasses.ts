/**
 * The All items page's item colours, the game's tooltip colours in the app's light / dark classes (the unique, set,
 * runeword, gemword and magic colours of the Skills, Sets and Affixes pages).
 */
import type { StashItemKind } from '../../engine/describeItem';
import type { ItemRow } from '../../engine/items/allItems';
import { UNIQUE_NAME_CLASS } from '../shared/classes';

/** Name colours with the link underline (NameLink) */
const KIND_NAME_CLASS: Readonly<Record<StashItemKind, string>> = {
  unique: UNIQUE_NAME_CLASS,
  set: 'text-green-700 decoration-green-700/30 hover:decoration-green-700 dark:text-green-400 dark:decoration-green-400/30',
  runeword: 'text-yellow-700 decoration-yellow-700/30 hover:decoration-yellow-700 dark:text-yellow-300 dark:decoration-yellow-300/30',
  rare: 'text-yellow-800 decoration-yellow-800/30 dark:text-yellow-200 dark:decoration-yellow-200/30',
  crafted: 'text-orange-700 decoration-orange-700/30 dark:text-orange-400 dark:decoration-orange-400/30',
  tempered: 'text-orange-700 decoration-orange-700/30 dark:text-orange-400 dark:decoration-orange-400/30',
  magic: 'text-blue-700 decoration-blue-700/30 dark:text-blue-400 dark:decoration-blue-400/30',
  superior: 'text-foreground decoration-foreground/30',
  inferior: 'text-muted-foreground decoration-muted-foreground/30',
  normal: 'text-foreground decoration-foreground/30',
  coupon: 'text-foreground decoration-foreground/30',
  simple: 'text-foreground decoration-foreground/30',
};

const GEMWORD_NAME_CLASS = 'text-sky-700 decoration-sky-700/30 hover:decoration-sky-700 dark:text-sky-300 dark:decoration-sky-300/30';

/** The name colour of a row: its kind's, gemwords apart */
export function itemNameClass(row: Pick<ItemRow, 'info'>): string {
  return row.info.kind === 'runeword' && row.info.runeword?.gemword === true ? GEMWORD_NAME_CLASS : KIND_NAME_CLASS[row.info.kind];
}

/** Stat lines (the game's blue) */
export const STAT_LINE_CLASS = 'text-blue-700 dark:text-blue-400';
/** Set bonus lines (the game's green) */
export const SET_LINE_CLASS = 'text-green-700 dark:text-green-400';
