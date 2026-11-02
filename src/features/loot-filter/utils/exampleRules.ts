/**
 * Example rules for new filter authors (the Rules tab's "Example rules" box): common goals, each built to teach one
 * concept of the format (exceptions on a hide rule, all-of vs any-of stat lists, narrow hide rules, item code lists,
 * sockets, unique ids). Every rule uses real ESR 3.2.24 codes and stat names and passes the validator without warnings
 * against the game data (exampleRules.test.ts). None checks Enhanced Damage or Enhanced Defense: the plugin reads them as
 * 0 on weapons and armour (see "Known plugin limits" in docs/features/LOOT-FILTER.md).
 */
import type { LootFilterRule } from '../engine/types';
import { newExceptionCheck } from './statChecks';

export interface ExampleRule {
  readonly id: string;
  readonly title: string;
  /** What the rule does and why it is built that way, one or two sentences. */
  readonly description: string;
  readonly rule: LootFilterRule;
}

/** Ist (r74) to Zod (r83): ESR keeps the classic runes as r51 (El) to r83 (Zod). */
const IST_TO_ZOD = ['r74', 'r75', 'r76', 'r77', 'r78', 'r79', 'r80', 'r81', 'r82', 'r83'];

export const EXAMPLE_RULES: readonly ExampleRule[] = [
  {
    id: 'hide-weapons-except',
    title: 'Hide magic and rare weapons, except useful ones',
    description:
      'A hide rule with exceptions: the stats under "Except items with…" are written as < 1 checks, and every check must hold to hide, so a weapon with any one of +All Skills, Faster Cast Rate or Increased Attack Speed keeps its label.',
    rule: {
      comment: 'Example: hide magic and rare weapons without +All Skills, Faster Cast Rate or Increased Attack Speed',
      itemTypes: ['weap'],
      quality: ['magic', 'rare'],
      itemStats: [
        newExceptionCheck('item_allskills'),
        newExceptionCheck('item_fastercastrate'),
        newExceptionCheck('item_fasterattackrate'),
      ],
      hide: true,
    },
  },
  {
    id: 'jewellery-all-of',
    title: 'Rings and amulets with Faster Cast Rate and Magic Find',
    description:
      '"Item stats, all of" needs every check, so only jewellery with both stats gets the border; the two item types in one list mean either (OR).',
    rule: {
      comment: 'Example: rings and amulets with both 10% Faster Cast Rate and 10% Magic Find',
      itemTypes: ['ring', 'amul'],
      itemStats: [
        { stat: 'item_fastercastrate', op: '>=', value: 10 },
        { stat: 'item_magicbonus', op: '>=', value: 10 },
      ],
      labelBorder: { color: [0, 160, 255, 255], width: 2 },
      chatMessage: 'FCR + MF: {name}',
    },
  },
  {
    id: 'charms-any-of',
    title: 'Small charms with Magic Find or Faster Hit Recovery',
    description:
      '"Item stats, any of" needs only one of its checks, so either stat is enough. Compare the all-of example above: there both stats must be on the item.',
    rule: {
      comment: 'Example: small charms with Magic Find or Faster Hit Recovery',
      itemTypes: ['scha'],
      itemStatsAnyOf: [
        { stat: 'item_magicbonus', op: '>=', value: 5 },
        { stat: 'item_fastergethitrate', op: '>=', value: 5 },
      ],
      labelBorder: { color: [0, 200, 80, 255], width: 1 },
    },
  },
  {
    id: 'high-runes',
    title: 'Ist to Zod runes with a sound and a minimap icon',
    description:
      'Item codes list the runes; any of them matches. tink.mp3 and the rune icon are files from Sully’s filter: download the filter as .zip with sounds and icons so they land in your sounds and icons folders.',
    rule: {
      comment: 'Example: Ist to Zod runes with a sound, a minimap icon and a red border',
      itemCodes: IST_TO_ZOD,
      sound: 'tink.mp3',
      icon: { iconName: 'rune', iconSize: 50 },
      labelBorder: { color: [255, 0, 0, 255], width: 2 },
    },
  },
  {
    id: 'hide-inferior',
    title: 'Hide cracked, damaged and crude gear',
    description:
      'A narrow hide rule: one quality (inferior) on weapons and armour. A hidden item loses its label for good, so keep hide rules this specific and try them in the Test tab.',
    rule: {
      comment: 'Example: hide inferior (cracked, damaged, crude) weapons and armour',
      itemTypes: ['weap', 'armo'],
      quality: 'inferior',
      hide: true,
    },
  },
  {
    id: 'runeword-bases',
    title: 'White and grey 4-socket swords for runewords',
    description:
      'Normal and superior items both take runewords. Sockets counts the sockets the item has now; use Max sockets instead for bases you socket yourself.',
    rule: {
      comment: 'Example: normal or superior swords with exactly 4 sockets (runeword bases)',
      itemTypes: ['swor'],
      quality: ['normal', 'superior'],
      sockets: 4,
      labelBorder: { color: [255, 255, 255, 255], width: 1 },
      nameSuffix: ' [4 sockets]',
    },
  },
  {
    id: 'unique-by-id',
    title: 'One unique by name: The Oculus',
    description:
      'Uniques and sets are matched by row id (the picker finds them by name). ESR has two rows for many uniques, one that drops and one cubed from an Ancient Coupon, so both are listed; quality unique keeps set items with the same numbers out.',
    rule: {
      comment: 'Example: The Oculus (the dropped row 418 and the Ancient Coupon row 973)',
      uniqueOrSetIds: [418, 973],
      quality: 'unique',
      sound: 'unique.mp3',
      labelBorder: { color: [199, 179, 119, 255], width: 2 },
    },
  },
];
