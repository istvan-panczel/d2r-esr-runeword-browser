/**
 * Example rules for a starter filter (the Rules tab's "Example rules" dialog): some seventy rules in groups modelled on
 * the sections of Sully's QoL filter (runes, gems, uniques, sets, mythicals, coupons, bases, charms and jewels, class
 * items, endgame items, crafting reagents, maps, gold and potions, junk), written for this site. An example is its
 * conditions (plus any fixed name tag or hide) and default presentation choices: a style preset, a sound, a minimap
 * icon and a chat line, each of which the player can change or switch off (`buildExampleRule`). Hide rules have no
 * presentation: a hidden item shows nothing.
 *
 * Every rule uses real ESR 3.2.24 codes, types and stat names and passes the validator without warnings against the
 * game data, with its default presentation and without (exampleRules.test.ts). None uses `activeInLevels` (examples
 * apply at every filter level) and none checks Enhanced Damage or Enhanced Defense: the plugin reads them as 0 on
 * weapons and armour (see "Known plugin limits" in docs/features/LOOT-FILTER.md).
 */
import { CLASS_CODES } from '@/features/game-data/engine/schema';
import { tabLayer } from '@/features/game-data/engine/statLayers';
import type { LootFilterRule, LootFilterStyle, StatCheck } from '../engine/types';
import { newExceptionCheck } from './statChecks';
import { stylePreset, type StylePresetId } from './stylePresets';

export type ExampleGroupId =
  | 'runes'
  | 'gems'
  | 'uniques'
  | 'sets'
  | 'mythical'
  | 'coupons'
  | 'bases'
  | 'charms'
  | 'class'
  | 'endgame'
  | 'crafting'
  | 'maps'
  | 'gold'
  | 'junk';

export interface ExampleGroup {
  readonly id: ExampleGroupId;
  readonly title: string;
  /** One or two sentences shown above the group's examples. */
  readonly intro: string;
}

/** The groups in dialog order (also the order label rules are added in). */
export const EXAMPLE_GROUPS: readonly ExampleGroup[] = [
  {
    id: 'runes',
    title: 'Runes',
    intro:
      'ESR keeps the classic runes as r51 (El) to r83 (Zod) and adds its own lines: kanji runes (r01 to r46), Null and the elemental runes (r84 to r97). An item code list matches any of its codes.',
  },
  {
    id: 'gems',
    title: 'Gems',
    intro: 'ESR gems run Chipped, Flawed, normal, Flawless, Blemished, Perfect; each grade is an item type (gem0 to gem5).',
  },
  { id: 'uniques', title: 'Uniques', intro: 'Quality unique matches every unique item; narrow it with item types or unique ids.' },
  { id: 'sets', title: 'Sets', intro: 'Two rules can match the same item: the second adds its chat line and keeps the first one’s label.' },
  {
    id: 'mythical',
    title: 'Mythical uniques',
    intro: 'Mythical items have their own bases (Mythical Marksman Bow…), so they are matched by item codes.',
  },
  { id: 'coupons', title: 'Coupons', intro: 'Ancient Coupons cube into uniques; their item types split them by tier (cpn1 to cpn3).' },
  {
    id: 'bases',
    title: 'Runeword bases',
    intro:
      'White (normal) and grey (superior) items take runewords. Sockets counts the sockets an item has, Max sockets the most its base can get.',
  },
  {
    id: 'charms',
    title: 'Charms and jewels',
    intro: 'Stat checks: “all of” needs every check, “any of” needs one. Small, large and grand charms are the types scha, mcha and lcha.',
  },
  {
    id: 'class',
    title: 'Class items and jewellery',
    intro: 'Skill tab stats carry a param per tab (class × 8 + tab), so “+3 to any tab” lists one check per tab under “any of”.',
  },
  {
    id: 'endgame',
    title: 'Keys, organs and endgame items',
    intro:
      'Uber keys and organs, respec essences, legendary materials, the Ascendancy items, Weapon Mastery Tokens and the pieces of the Eternal Hourglass.',
  },
  { id: 'crafting', title: 'Crafting reagents', intro: 'Cube ingredients from common body parts to rare reagents.' },
  { id: 'maps', title: 'Maps', intro: 'Endgame maps z01 to z20 by tier, and The Hidden Vault.' },
  {
    id: 'gold',
    title: 'Gold and potions',
    intro:
      'Character stats: “level” is your character level, so a rule can wait until small gold and weak potions stop mattering; the levels are the ones Sully’s filter uses. Town areas are left out so nothing is hidden there.',
  },
  {
    id: 'junk',
    title: 'Hide junk',
    intro:
      'A hidden item loses its label for good, whatever rule comes before or after, so keep hide rules narrow and give them exceptions. Try them in the Test tab.',
  },
];

/** The four presentation choices of an example; a missing key is "None". */
export interface ExamplePresentation {
  readonly style?: StylePresetId;
  /** A bundled sound file (`bundledAssets.ts`). */
  readonly sound?: string;
  /** A bundled icon name (`bundledAssets.ts`). */
  readonly icon?: string;
  /** The minimap icon size; default `DEFAULT_EXAMPLE_ICON_SIZE`. */
  readonly iconSize?: number;
  readonly chatMessage?: string;
}

export interface ExampleRule {
  readonly id: string;
  readonly group: ExampleGroupId;
  /** Also the rule's `comment`, the title line in the rule list. */
  readonly title: string;
  /** What the rule does and why it is built that way, one or two sentences. */
  readonly description: string;
  /** Conditions, plus fixed actions (`hide`, a name tag); never the presentation keys. */
  readonly rule: LootFilterRule;
  /** Default presentation choices; absent on hide rules. */
  readonly presentation?: ExamplePresentation;
}

/** The icon size an example's icon gets when it names none. */
export const DEFAULT_EXAMPLE_ICON_SIZE = 40;

// ---------------------------------------------------------------------------------------------------------------------
// Code lists
// ---------------------------------------------------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `${prefix}NN${suffix}` for NN from `from` to `to`. */
function numbered(prefix: string, from: number, to: number, suffix = ''): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${pad2(from + index)}${suffix}`);
}

/** The town areas (Rogue Encampment, Lut Gholein, Kurast Docks, Pandemonium Fortress, Harrogath): hide rules leave them out. */
const TOWNS = [1, 40, 75, 103, 109];

/** Mythical bases that drop (weapons, armour, the mythical ring and amulets). */
const MYTHICAL_GEAR = [...numbered('m', 1, 18), 'dd1', 'm20', ...numbered('m', 29, 39), 'm60', 'm61'];
const MYTHICAL_JEWELLERY = ['mrn', 'mam', 'au9'];

/** Every mythical weapon and armour base, the ones that do not drop too (m21 to m28, m40 to m59, 7wd), as Sully lists them. */
const MYTHICAL_BASES = ['7wd', 'dd1', ...numbered('m', 1, 18), ...numbered('m', 20, 61)];

/** Quest weapons: the Gidbinn and its decoy, the Horadric Malus, the Hell Forge Hammer, the Horadric Staff and its shaft, Wirt's Leg, Khalim's Flail and Will. */
const QUEST_ITEMS = ['d33', 'g33', 'hdm', 'hfh', 'hst', 'leg', 'msf', 'qf1', 'qf2'];

/** What every broad weapon/armour rule leaves out, as Sully's filter does: mythical bases and quest weapons. */
const NOT_PLAIN_GEAR = [...MYTHICAL_BASES, ...QUEST_ITEMS];

/** Class rings and amulets (Amazonian Loop … Warlock's Pendant). */
const CLASS_JEWELLERY = ['zrn', 'srn', 'nrn', 'prn', 'brg', 'drn', 'arn', 'wrn', 'zam', 'sam', 'nam', 'pam', 'bam', 'dam', 'aam', 'wam'];

/** Body parts for the cube (Steak and Cookbook left out). */
const BODY_PARTS = ['hrt', 'brz', 'jaw', 'eyz', 'hrn', 'tal', 'flg', 'fng', 'qll', 'sol', 'scz', 'spe'];

/** The twelve kinds of rune crystal in their chipped (xr), flawed (xl) and normal (xt) grades. */
const CRYSTAL_SUFFIXES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', 'y'];
const RUNE_CRYSTALS = ['xr', 'xl', 'xt'].flatMap((prefix) => CRYSTAL_SUFFIXES.map((suffix) => `${prefix}${suffix}`));

const level = (min: number): StatCheck => ({ stat: 'level', op: '>=', value: min });

/**
 * Exceptions that keep skill items out of a hide rule: `item_addclassskills < 1` for each class and
 * `item_addskill_tab < 1` for each class tab. A check without param reads only the param-0 entry (verified in game),
 * so each class and tab needs its own check; every check must hold to hide, so one skill bonus keeps the item.
 */
function skillExceptions(): StatCheck[] {
  const classes = CLASS_CODES.map((_code, cls): StatCheck => ({ stat: 'item_addclassskills', param: cls, op: '<', value: 1 }));
  const tabs = everySkillTab(1).map((check): StatCheck => ({ ...check, op: '<' }));
  return [...classes, ...tabs];
}

/** One `item_addskill_tab` check per class skill tab (8 classes × 3 tabs, param `class << 3 | tab`). */
function everySkillTab(min: number): StatCheck[] {
  const checks: StatCheck[] = [];
  for (let cls = 0; cls < 8; cls += 1) {
    for (let tab = 0; tab < 3; tab += 1) {
      const param = tabLayer(cls, tab);
      if (param !== undefined) checks.push({ stat: 'item_addskill_tab', param, op: '>=', value: min });
    }
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------------------------
// The examples
// ---------------------------------------------------------------------------------------------------------------------

export const EXAMPLE_RULES: readonly ExampleRule[] = [
  // ----- Runes -----
  {
    id: 'low-runes',
    group: 'runes',
    title: 'Low runes: El to Dol',
    description: 'El (r51) to Dol (r64), kept visible but quiet: an orange name and nothing else.',
    rule: { itemCodes: numbered('r', 51, 64) },
    presentation: { style: 'low-rune' },
  },
  {
    id: 'mid-runes',
    group: 'runes',
    title: 'Mid runes: Hel to Um',
    description: 'Hel (r65) to Um (r72) get a box and a border, still without a sound.',
    rule: { itemCodes: numbered('r', 65, 72) },
    presentation: { style: 'mid-rune' },
  },
  {
    id: 'upper-runes',
    group: 'runes',
    title: 'Mal, Ist and Gul runes',
    description: 'Mal (r73), Ist (r74) and Gul (r75): the mid-rune look plus a sound, a rune icon on the minimap and a chat line.',
    rule: { itemCodes: numbered('r', 73, 75) },
    presentation: { style: 'mid-rune', sound: 'mid.mp3', icon: 'rune', iconSize: 40, chatMessage: 'ÿc8Rune: ÿc0{name}' },
  },
  {
    id: 'high-runes',
    group: 'runes',
    title: 'High runes: Vex to Zod',
    description:
      'Vex (r76) to Zod (r83) with everything: a white plate, a beam, the tink sound, a rune icon and a chat line. The sound and icon files come with the .zip download.',
    rule: { itemCodes: numbered('r', 76, 83) },
    presentation: { style: 'high-rune', sound: 'tink.mp3', icon: 'rune', iconSize: 50, chatMessage: 'ÿc1High rune: ÿc0{name}' },
  },
  {
    id: 'kanji-runes',
    group: 'runes',
    title: 'ESR kanji runes: I to Mo',
    description: 'The common part of ESR’s kanji rune line, I (r01) to Mo (r35), with the low-rune look.',
    rule: { itemCodes: numbered('r', 1, 35) },
    presentation: { style: 'low-rune' },
  },
  {
    id: 'kanji-gold-runes',
    group: 'runes',
    title: 'ESR kanji runes: No to Re',
    description: 'No (r36) to Re (r42), which Sully calls the gold runes: the mid-rune look with a sound and an icon.',
    rule: { itemCodes: numbered('r', 36, 42) },
    presentation: { style: 'mid-rune', sound: 'mid.mp3', icon: 'rune', iconSize: 40, chatMessage: 'ÿc8ESR rune: ÿc0{name}' },
  },
  {
    id: 'kanji-high-runes',
    group: 'runes',
    title: 'ESR kanji runes: Su, He, Nu, Wo and Null',
    description: 'The top of the kanji line (r43 to r46) and the Null Rune (r50), treated like high runes.',
    rule: { itemCodes: [...numbered('r', 43, 46), 'r50'] },
    presentation: { style: 'high-rune', sound: 'tink.mp3', icon: 'rune', iconSize: 50, chatMessage: 'ÿc;ESR rune: ÿc0{name}' },
  },
  {
    id: 'elemental-runes',
    group: 'runes',
    title: 'ESR elemental runes: Moon to God',
    description: 'Moon (r84) to God (r97), ESR’s highest runes, treated like high runes.',
    rule: { itemCodes: numbered('r', 84, 97) },
    presentation: { style: 'high-rune', sound: 'tink.mp3', icon: 'rune', iconSize: 50, chatMessage: 'ÿc;ESR rune: ÿc0{name}' },
  },
  {
    id: 'high-rune-decals',
    group: 'runes',
    title: 'Ancient Decals for Mal to Zod',
    description: 'An Ancient Decal names the rune it makes (To -> Mal … Wo -> Zod, 23l to 33l); Sully highlights these like the runes.',
    rule: { itemCodes: numbered('', 23, 33, 'l') },
    presentation: { style: 'valuable', sound: 'mid.mp3', icon: 'scroll', iconSize: 30, chatMessage: 'ÿc8Decal: ÿc0{name}' },
  },

  // ----- Gems -----
  {
    id: 'perfect-gems',
    group: 'gems',
    title: 'Perfect gems',
    description: 'One item type (gem5) covers every perfect gem, Amethyst to Obsidian; Perfect gems pay for most rerolls.',
    rule: { itemTypes: ['gem5'] },
    presentation: { style: 'perfect-gem', icon: 'gem2', iconSize: 27 },
  },
  {
    id: 'blemished-gems',
    group: 'gems',
    title: 'Blemished gems',
    description: 'ESR’s grade between Flawless and Perfect (gem4): it rerolls rares and picks an Ascendancy.',
    rule: { itemTypes: ['gem4'] },
    presentation: { style: 'perfect-gem' },
  },
  {
    id: 'hide-low-gems',
    group: 'gems',
    title: 'Hide chipped and flawed gems from character level 20',
    description:
      'A character stat condition: the rule waits until your character is level 20 (Sully hides chipped gems from 20), and never hides in town. Skip it if you craft Aura Stones, which take a chipped gem.',
    rule: { itemTypes: ['gem0', 'gem1'], playerStats: [level(20)], excludeAreas: TOWNS, hide: true },
  },

  // ----- Uniques -----
  {
    id: 'unique-items',
    group: 'uniques',
    title: 'Unique weapons and armour',
    description:
      'Every unique weapon and armour piece gets the unique look, the unique sound and a gold star on the minimap. Mythical bases are left out: the mythical rule gives them their own sound and chat line.',
    rule: { itemTypes: ['weap', 'armo'], excludeItemCodes: MYTHICAL_BASES, quality: 'unique' },
    presentation: { style: 'unique', sound: 'unique.mp3', icon: 'goldstar', iconSize: 30 },
  },
  {
    id: 'unique-jewellery',
    group: 'uniques',
    title: 'Unique rings and amulets',
    description:
      'Ring and amulet types include the class rings and amulets, since an item type matches its children. The mythical ring and amulets are left out for the mythical rule.',
    rule: { itemTypes: ['ring', 'amul'], excludeItemCodes: MYTHICAL_JEWELLERY, quality: 'unique' },
    presentation: { style: 'unique', sound: 'other.mp3', icon: 'goldstar', iconSize: 40, chatMessage: 'ÿc4Unique jewellery: {name}' },
  },
  {
    id: 'unique-charms-jewels',
    group: 'uniques',
    title: 'Unique charms and jewels',
    description: 'Unique charms and jewels are rare and often worth a lot, so they get the valuable look and the tink.',
    rule: { itemTypes: ['char', 'jewl'], quality: 'unique' },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'charm', iconSize: 35, chatMessage: 'ÿc4Unique: {name}' },
  },
  {
    id: 'unique-by-id',
    group: 'uniques',
    title: 'One unique by name: The Oculus',
    description:
      'Uniques and sets are matched by row id (the picker finds them by name). ESR has two rows for many uniques, one that drops and one cubed from an Ancient Coupon, so both are listed; quality unique keeps set items with the same numbers out.',
    rule: { uniqueOrSetIds: [418, 973], quality: 'unique' },
    presentation: { style: 'unique', sound: 'unique.mp3', chatMessage: 'ÿc4The Oculus dropped' },
  },

  // ----- Sets -----
  {
    id: 'set-items',
    group: 'sets',
    title: 'Set items',
    description: 'Every set item gets the set look, the unique sound and a star on the minimap.',
    rule: { quality: 'set' },
    presentation: { style: 'set', sound: 'unique.mp3', icon: 'star', iconSize: 30 },
  },
  {
    id: 'elite-set-chat',
    group: 'sets',
    title: 'A chat line for elite set items',
    description:
      'Base tier elite narrows it to sets on elite bases. Placed after the set rule, it adds the chat line and keeps that label.',
    rule: { quality: 'set', baseTier: 'elite' },
    presentation: { chatMessage: 'ÿc2Elite set: {name}' },
  },

  // ----- Mythical -----
  {
    id: 'mythical-uniques',
    group: 'mythical',
    title: 'Mythical uniques',
    description: 'The mythical bases that drop (weapons, armour, the mythical ring and amulets) at quality unique: ESR’s rarest drops.',
    rule: { itemCodes: [...MYTHICAL_GEAR, ...MYTHICAL_JEWELLERY], quality: 'unique' },
    presentation: { style: 'mythical', sound: 'mythical.mp3', icon: 'Myth', iconSize: 50, chatMessage: 'ÿc;Mythical unique: ÿc4{name}' },
  },
  {
    id: 'mythical-bases',
    group: 'mythical',
    title: 'White and grey mythical bases',
    description:
      'Mythical bases have no normal/exceptional/elite tier (a base tier condition never matches them), so they are listed by code.',
    rule: { itemCodes: MYTHICAL_GEAR, quality: ['normal', 'superior'] },
    presentation: { style: 'runeword-base' },
  },

  // ----- Coupons -----
  {
    id: 'elite-coupons',
    group: 'coupons',
    title: 'Elite coupons',
    description: 'Every coupon for an elite unique (item type cpn3), with a sound, a scroll icon and a chat line.',
    rule: { itemTypes: ['cpn3'] },
    presentation: { style: 'coupon', sound: 'other.mp3', icon: 'scroll', iconSize: 40, chatMessage: 'ÿc4Elite coupon: ÿc0{name}' },
  },
  {
    id: 'exceptional-coupons',
    group: 'coupons',
    title: 'Exceptional coupons',
    description: 'Coupons for exceptional uniques (cpn2): the coupon look and a smaller icon.',
    rule: { itemTypes: ['cpn2'] },
    presentation: { style: 'coupon', icon: 'scroll', iconSize: 30 },
  },
  {
    id: 'wild-card-coupon',
    group: 'coupons',
    title: 'Ancient Coupon (Wild Card)',
    description: 'The Wild Card (99j) is a shortcut in many recipes, Blemished and Perfect gems among them.',
    rule: { itemCodes: ['99j'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'scroll', iconSize: 40, chatMessage: 'ÿc1Wild Card coupon' },
  },

  // ----- Runeword bases -----
  {
    id: 'socket-count-tag',
    group: 'bases',
    title: 'Show the socket count on white and grey gear',
    description:
      'A name tag only: {sockets} writes the item’s sockets after its name. It comes first so the base rules below, which set their own suffix, win where both match.',
    rule: { itemTypes: ['weap', 'armo'], quality: ['normal', 'superior'], sockets: { min: 2 }, nameSuffix: ' ÿc5[{sockets}]' },
    presentation: {},
  },
  {
    id: 'runeword-bases',
    group: 'bases',
    title: 'White and grey 4-socket swords for runewords',
    description:
      'Normal and superior items both take runewords. Sockets counts the sockets the item has now; use Max sockets instead for bases you socket yourself.',
    rule: { itemTypes: ['swor'], quality: ['normal', 'superior'], sockets: 4, nameSuffix: ' [4 sockets]' },
    presentation: { style: 'runeword-base' },
  },
  {
    id: 'elite-armour-bases',
    group: 'bases',
    title: 'Elite body armour with 3 or 4 sockets',
    description: 'A range (3 to 4 sockets) on one base tier: the usual bases for armour runewords.',
    rule: { itemTypes: ['tors'], quality: ['normal', 'superior'], baseTier: 'elite', sockets: { min: 3, max: 4 } },
    presentation: { style: 'runeword-base' },
  },
  {
    id: 'ethereal-merc-bases',
    group: 'bases',
    title: 'Ethereal elite polearms and spears with 4 or more sockets',
    description: 'Ethereal plus elite plus sockets: the classic mercenary weapon bases, with a chat line that names the sockets.',
    rule: { itemTypes: ['pole', 'spea'], quality: ['normal', 'superior'], baseTier: 'elite', isEthereal: true, sockets: { min: 4 } },
    presentation: { style: 'runeword-base', sound: 'other.mp3', chatMessage: 'ÿc5Ethereal base: ÿc0{name} ({sockets} sockets)' },
  },
  {
    id: 'paladin-shield-bases',
    group: 'bases',
    title: 'Paladin shields with 4 sockets',
    description: 'Auric shields (item type ashd) with exactly 4 sockets, the base of most shield runewords for Paladins.',
    rule: { itemTypes: ['ashd'], quality: ['normal', 'superior'], sockets: 4 },
    presentation: { style: 'runeword-base' },
  },
  {
    id: 'unsocketed-elite-bases',
    group: 'bases',
    title: 'Superior elite bases with no sockets that can take 4 or more',
    description: 'Max sockets is what the base can get, not what it has: these are bases to socket yourself. {maxSockets} shows the most.',
    rule: {
      itemTypes: ['weap', 'armo'],
      quality: 'superior',
      baseTier: 'elite',
      sockets: 0,
      maxSockets: { min: 4 },
      nameSuffix: ' ÿc5[max {maxSockets}]',
    },
    presentation: {},
  },
  {
    id: 'all-skills-bases',
    group: 'bases',
    title: 'Superior bases with +All Skills',
    description: 'A stat check on a white base: superior items can roll +All Skills in ESR. {stat:127} writes the amount in the name.',
    rule: {
      itemTypes: ['weap', 'armo'],
      quality: 'superior',
      itemStats: [{ stat: 'item_allskills', op: '>=', value: 1 }],
      nameSuffix: ' ÿc1[+{stat:127} skills]',
    },
    presentation: { style: 'valuable', sound: 'other.mp3', icon: 'goldstar', iconSize: 40, chatMessage: 'ÿc4+All Skills base: ÿc0{name}' },
  },

  // ----- Charms and jewels -----
  {
    id: 'charms-any-of',
    group: 'charms',
    title: 'Small charms with Magic Find or Faster Hit Recovery',
    description:
      '“Item stats, any of” needs only one of its checks, so either stat is enough. Compare the all-resistances example below: there every stat must be on the item.',
    rule: {
      itemTypes: ['scha'],
      itemStatsAnyOf: [
        { stat: 'item_magicbonus', op: '>=', value: 5 },
        { stat: 'item_fastergethitrate', op: '>=', value: 5 },
      ],
    },
    presentation: { style: 'good-charm' },
  },
  {
    id: 'all-resist-charms',
    group: 'charms',
    title: 'Small charms with 5 or more to all resistances',
    description: '“Item stats, all of” needs every check: all four resistances at 5 or more, which only an all-resistances charm has.',
    rule: {
      itemTypes: ['scha'],
      itemStats: [
        { stat: 'fireresist', op: '>=', value: 5 },
        { stat: 'lightresist', op: '>=', value: 5 },
        { stat: 'coldresist', op: '>=', value: 5 },
        { stat: 'poisonresist', op: '>=', value: 5 },
      ],
    },
    presentation: { style: 'good-charm' },
  },
  {
    id: 'skill-tab-grand-charms',
    group: 'charms',
    title: 'Grand charms with +1 to a skill tab',
    description: 'One check per class skill tab under “any of” (24 tabs, param class × 8 + tab): any tab is enough.',
    rule: { itemTypes: ['lcha'], itemStatsAnyOf: everySkillTab(1) },
    presentation: { style: 'good-charm', sound: 'other.mp3', icon: 'charm', iconSize: 35, chatMessage: 'ÿc3Skiller: {name}' },
  },
  {
    id: 'rare-jewels',
    group: 'charms',
    title: 'Rare jewels',
    description: 'Both jewel codes (jew and the Mythical Jewel mjw) at quality rare, Sully’s rare jewel look.',
    rule: { itemCodes: ['jew', 'mjw'], quality: 'rare' },
    presentation: { style: 'good-jewel', sound: 'other.mp3', icon: 'gem', iconSize: 27, chatMessage: 'ÿc9Rare jewel' },
  },

  // ----- Class items and jewellery -----
  {
    id: 'jewellery-all-of',
    group: 'class',
    title: 'Rings and amulets with Faster Cast Rate and Magic Find',
    description:
      '“Item stats, all of” needs every check, so only jewellery with both stats matches; the two item types in one list mean either (OR).',
    rule: {
      itemTypes: ['ring', 'amul'],
      itemStats: [
        { stat: 'item_fastercastrate', op: '>=', value: 10 },
        { stat: 'item_magicbonus', op: '>=', value: 10 },
      ],
    },
    presentation: { style: 'jewellery', chatMessage: 'FCR + MF: {name}' },
  },
  {
    id: 'rare-class-jewellery',
    group: 'class',
    title: 'Rare class rings and amulets',
    description: 'ESR’s class jewellery (Amazonian Loop … Warlock’s Pendant) by item code, at quality rare.',
    rule: { itemCodes: CLASS_JEWELLERY, quality: 'rare' },
    presentation: { style: 'jewellery', sound: 'other.mp3', chatMessage: 'ÿc9Class jewellery: {name}' },
  },
  {
    id: 'plus-three-class-items',
    group: 'class',
    title: 'Class items with +3 to a skill tab',
    description:
      'Class-specific items (type clas) minus class rings and amulets (Exclude item types), magic or rare, with +3 to any skill tab: one check per tab under “any of”.',
    rule: { itemTypes: ['clas'], excludeItemTypes: ['ring', 'amul'], quality: ['magic', 'rare'], itemStatsAnyOf: everySkillTab(3) },
    presentation: { style: 'valuable', sound: 'other.mp3', icon: 'goldstar', iconSize: 40, chatMessage: 'ÿc4+3 skill tab: {name}' },
  },

  // ----- Endgame -----
  {
    id: 'pandemonium-keys',
    group: 'endgame',
    title: 'Pandemonium keys',
    description: 'The Keys of Terror, Hate and Destruction (pk1 to pk3) with Sully’s Uber look and the gong.',
    rule: { itemCodes: ['pk1', 'pk2', 'pk3'] },
    presentation: { style: 'uber', sound: 'gong.mp3', icon: 'gemP', iconSize: 27, chatMessage: 'ÿc;Key: ÿc0{name}' },
  },
  {
    id: 'uber-organs',
    group: 'endgame',
    title: 'Uber organs',
    description: 'Diablo’s Horn, Baal’s Eye and Mephisto’s Brain in their plain, Enhanced and Demonic forms.',
    rule: { itemCodes: ['dhn', 'bey', 'mbr', 'ht1', 'ht2', 'ht3', 'um1', 'um2', 'um3'] },
    presentation: { style: 'uber', sound: 'gong.mp3', icon: 'gemP', iconSize: 27, chatMessage: 'ÿc;Organ: ÿc0{name}' },
  },
  {
    id: 'respec-items',
    group: 'endgame',
    title: 'Essences and the Token of Absolution',
    description: 'The four essences and the token they make, the way to respec.',
    rule: { itemCodes: ['tes', 'ceh', 'bet', 'fed', 'toa'] },
    presentation: { style: 'uber', sound: 'gong.mp3', icon: 'gemP', iconSize: 27, chatMessage: 'ÿc;Respec: ÿc0{name}' },
  },
  {
    id: 'legendary-materials',
    group: 'endgame',
    title: 'Legendary materials',
    description:
      'Lilith’s Crystallized Tear, Tyrael’s Eternal Feather, Lucion’s Essence and Relic, Astrogha’s Petrified Heart, Inarius’ Everburning Halo.',
    rule: { itemCodes: ['um8', 'um9', 'u17', 'u18', 'u20', 'u40'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'redD', iconSize: 27, chatMessage: 'ÿc8Legendary material: ÿc0{name}' },
  },
  {
    id: 'ascendancy-items',
    group: 'endgame',
    title: 'Ascendancy Stones and orbs',
    description: 'The Ascendancy Stone, the five elemental orbs, the Orb of Creation and the Primordial Soulstone.',
    rule: { itemCodes: ['ast', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'u19'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'goldstar', iconSize: 40, chatMessage: 'ÿc8Ascendancy: ÿc0{name}' },
  },
  {
    id: 'ancient-scrolls',
    group: 'endgame',
    title: 'Ancient Scrolls',
    description: 'The fifty Ancient Scrolls (01b to 50b) on a gold plate with the gong.',
    rule: { itemCodes: numbered('', 1, 50, 'b') },
    presentation: { style: 'rare-reagent', sound: 'gong.mp3', chatMessage: 'ÿc4Ancient Scroll' },
  },
  {
    id: 'weapon-mastery-tokens',
    group: 'endgame',
    title: 'Weapon Mastery Tokens',
    description:
      'The token (u23) Corrupted Zakarum in Nightmare and Hell and the Endgame Map bosses drop: cubed with a class weapon it awakens, and the awakened token gives that weapon its mastery. The awakened tokens are made in the cube, so the rule leaves them out.',
    rule: { itemCodes: ['u23'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'goldstar', iconSize: 40, chatMessage: 'ÿc8Weapon Mastery Token' },
  },
  {
    id: 'hourglass-pieces',
    group: 'endgame',
    title: 'Broken hourglass and its shards',
    description:
      'The Eternal Ancients of their tier 5 map drop the Broken hourglass (um6) and two shards (um4, um5); all three cube into the Eternal Hourglass of the Timeless Sands, a unique charm, so none may be left behind.',
    rule: { itemCodes: ['um4', 'um5', 'um6'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', icon: 'charm', iconSize: 35, chatMessage: 'ÿc4Hourglass piece: ÿc0{name}' },
  },

  // ----- Crafting -----
  {
    id: 'body-parts',
    group: 'crafting',
    title: 'Body parts',
    description: 'Hearts, brains, eyes and the other monster parts the cube recipes take.',
    rule: { itemCodes: BODY_PARTS },
    presentation: { style: 'crafting', icon: 'cube', iconSize: 27 },
  },
  {
    id: 'rune-crystals',
    group: 'crafting',
    title: 'Rune crystals',
    description: 'The twelve crystals (Frozen Soul … Tainted Tourmaline) in their chipped, flawed and normal grades.',
    rule: { itemCodes: RUNE_CRYSTALS },
    presentation: { style: 'crafting', icon: 'gem2', iconSize: 27 },
  },
  {
    id: 'common-reagents',
    group: 'crafting',
    title: 'Socket Donuts, Worldstone Shards, Relics of Knowledge, Ancient Decipherers',
    description: 'Reagents you use often: the gold plate and the mid sound.',
    rule: { itemCodes: ['sdo', 'wss', 'rel', 'ddd'] },
    presentation: { style: 'rare-reagent', sound: 'mid.mp3', chatMessage: 'ÿc1Reagent: ÿc0{name}' },
  },
  {
    id: 'rare-reagents',
    group: 'crafting',
    title: 'Rare reagents',
    description: 'Maple Leaf, Anvil Stone, Elixir, Cookbook and the Orb of Anointment: the gold plate, the gong and an icon.',
    rule: { itemCodes: ['map', 'qqq', 'elx', 'yyy', 'um7'] },
    presentation: { style: 'rare-reagent', sound: 'gong.mp3', icon: 'redD', iconSize: 27, chatMessage: 'ÿc1Rare reagent: ÿc4{name}' },
  },
  {
    id: 'aura-stones',
    group: 'crafting',
    title: 'Aura Stones',
    description: 'The eight Aura Stones (an3 to an9, a10), which forge an amulet with an aura in the cube.',
    rule: { itemCodes: ['an3', 'an4', 'an5', 'an6', 'an7', 'an8', 'an9', 'a10'] },
    presentation: { style: 'valuable', sound: 'tink.mp3', chatMessage: 'ÿc8Aura Stone: ÿc0{name}' },
  },
  {
    id: 'unique-stones',
    group: 'crafting',
    title: 'Unique Stones',
    description:
      'Unique Stones (nor, exc, eli: an0 to an2) come out of the cube from an Ancient’s Gift (a Baal and Diablo drop); one cubed with a white, grey or low quality base of its tier and no sockets makes a unique of that type. They never lie on the ground, so the rule only marks them in your inventory and stash: a look, no sound or icon.',
    rule: { itemCodes: ['an0', 'an1', 'an2'] },
    presentation: { style: 'valuable' },
  },

  // ----- Maps -----
  {
    id: 'tier-1-maps',
    group: 'maps',
    title: 'Tier 1 maps',
    description: 'z01 to z04 with the map look and icon, no sound.',
    rule: { itemCodes: numbered('z', 1, 4) },
    presentation: { style: 'map', icon: 'map', iconSize: 30 },
  },
  {
    id: 'tier-2-4-maps',
    group: 'maps',
    title: 'Tier 2 to 4 maps',
    description: 'z05 to z16 with the map sound and a chat line.',
    rule: { itemCodes: numbered('z', 5, 16) },
    presentation: { style: 'map', sound: 'map.mp3', icon: 'map', iconSize: 30, chatMessage: 'Map: ÿc0{name}' },
  },
  {
    id: 'tier-5-maps',
    group: 'maps',
    title: 'Tier 5 maps and The Hidden Vault',
    description: 'z17 to z20 and z99 with the tier 5 sound and a larger icon.',
    rule: { itemCodes: [...numbered('z', 17, 20), 'z99'] },
    presentation: { style: 'map', sound: 't5_map.mp3', icon: 'map', iconSize: 40, chatMessage: 'ÿc4Tier 5 map: ÿc0{name}' },
  },

  // ----- Gold and potions -----
  {
    id: 'large-gold',
    group: 'gold',
    title: 'Gold piles of 100,000 or more',
    description: 'Stat 14 (gold) is the size of the pile. The $$ marks are name parts of the rule, so the amount stays visible.',
    rule: { itemCodes: ['gld'], itemStats: [{ stat: 'gold', op: '>=', value: 100000 }], namePrefix: 'ÿc2$$ ', nameSuffix: ' ÿc2$$' },
    presentation: { sound: 'other.mp3', chatMessage: 'ÿc9Large gold pile' },
  },
  {
    id: 'ore-and-fake-notes',
    group: 'gold',
    title: 'Ore and Fake Notes',
    description:
      'Both sell for gold, so Sully gives them the gold pile look: a gold plate between $$ marks. An Ore can also be smashed with Secret Recipe 25 for a chance at a crystal (a failed smash leaves Ore Shards, which sell too); Fake Notes drop in the Fake Note Factory endgame zone and from Nihlathak’s clones.',
    rule: { itemCodes: ['ore', 'fkn'], namePrefix: 'ÿc2$$ ', nameSuffix: ' ÿc2$$' },
    presentation: { style: 'rare-reagent' },
  },
  {
    id: 'hide-tiny-gold',
    group: 'gold',
    title: 'Hide gold piles under 100 from character level 20',
    description: 'Sully’s first gold step: piles under 100 once your character is level 20, outside town.',
    rule: {
      itemCodes: ['gld'],
      itemStats: [{ stat: 'gold', op: '<', value: 100 }],
      playerStats: [level(20)],
      excludeAreas: TOWNS,
      hide: true,
    },
  },
  {
    id: 'hide-small-gold',
    group: 'gold',
    title: 'Hide gold piles under 500 from character level 60',
    description:
      'Sully’s next step, outside town. He goes on with piles under 750 from level 80 and under 2,000 from level 90: copy the rule and raise both numbers for those.',
    rule: {
      itemCodes: ['gld'],
      itemStats: [{ stat: 'gold', op: '<', value: 500 }],
      playerStats: [level(60)],
      excludeAreas: TOWNS,
      hide: true,
    },
  },
  {
    id: 'hide-minor-potions',
    group: 'gold',
    title: 'Hide minor healing and mana potions from character level 12',
    description: 'The smallest potions (hp1, mp1) once your character is level 12, outside town, as in Sully’s filter.',
    rule: { itemCodes: ['hp1', 'mp1'], playerStats: [level(12)], excludeAreas: TOWNS, hide: true },
  },
  {
    id: 'hide-light-potions',
    group: 'gold',
    title: 'Hide light healing and mana potions from character level 20',
    description: 'The next size (hp2, mp2) from character level 20, outside town.',
    rule: { itemCodes: ['hp2', 'mp2'], playerStats: [level(20)], excludeAreas: TOWNS, hide: true },
  },
  {
    id: 'hide-normal-potions',
    group: 'gold',
    title: 'Hide healing and mana potions (hp3, mp3) from character level 40',
    description:
      'The third size from character level 40, outside town. Sully hides greater and super potions (hp4, hp5, mp4, mp5) from 40 as well; add their codes if you drink rejuvenation potions only.',
    rule: { itemCodes: ['hp3', 'mp3'], playerStats: [level(40)], excludeAreas: TOWNS, hide: true },
  },
  {
    id: 'hide-utility-potions',
    group: 'gold',
    title: 'Hide stamina, antidote and thawing potions',
    description: 'Exclude areas keeps the town areas out, so you still see the ones you drop there.',
    rule: { itemCodes: ['vps', 'yps', 'wms'], excludeAreas: TOWNS, hide: true },
  },

  // ----- Hide junk -----
  {
    id: 'hide-inferior',
    group: 'junk',
    title: 'Hide cracked, damaged and crude gear from character level 10',
    description:
      'A narrow hide rule: one quality (inferior) on weapons and armour, from character level 10 and outside town, as in Sully’s filter. A hidden item loses its label for good, so keep hide rules this specific.',
    rule: { itemTypes: ['weap', 'armo'], quality: 'inferior', playerStats: [level(10)], excludeAreas: TOWNS, hide: true },
  },
  {
    id: 'hide-weapons-except',
    group: 'junk',
    title: 'Hide magic and rare weapons from character level 20, except useful ones',
    description:
      'A hide rule with exceptions: the stats under “Except items with…” are written as < 1 checks, and every check must hold to hide, so a weapon with +All Skills, +class skills, +a skill tab, Faster Cast Rate or Increased Attack Speed keeps its label. Class skills and skill tabs get one check per class and tab, since a check without param reads only the first; +skills to one skill (oskills) are not kept. It waits for character level 20 (Sully hides magic gear from 20) and leaves the towns out; class weapons, quest items and mythical bases are excluded.',
    rule: {
      itemTypes: ['weap'],
      excludeItemTypes: ['clas'],
      excludeItemCodes: NOT_PLAIN_GEAR,
      quality: ['magic', 'rare'],
      itemStats: [
        newExceptionCheck('item_allskills'),
        newExceptionCheck('item_fastercastrate'),
        newExceptionCheck('item_fasterattackrate'),
        ...skillExceptions(),
      ],
      playerStats: [level(20)],
      excludeAreas: TOWNS,
      hide: true,
    },
  },
  {
    id: 'hide-magic-armour-except',
    group: 'junk',
    title: 'Hide magic armour from character level 20, except useful ones',
    description:
      'Magic armour without +All Skills, +class skills, +a skill tab, Faster Cast Rate, Faster Hit Recovery, Faster Run/Walk, Increased Attack Speed or Magic Find, once your character is level 20 (as Sully’s magic gear hide), outside town (one check per class and tab, as in the weapon rule; oskills are not kept). Class armour, quest items and mythical bases are excluded.',
    rule: {
      itemTypes: ['armo'],
      excludeItemTypes: ['clas'],
      excludeItemCodes: NOT_PLAIN_GEAR,
      quality: 'magic',
      itemStats: [
        newExceptionCheck('item_allskills'),
        newExceptionCheck('item_fastercastrate'),
        newExceptionCheck('item_fastergethitrate'),
        newExceptionCheck('item_fastermovevelocity'),
        newExceptionCheck('item_fasterattackrate'),
        newExceptionCheck('item_magicbonus'),
        ...skillExceptions(),
      ],
      playerStats: [level(20)],
      excludeAreas: TOWNS,
      hide: true,
    },
  },
  {
    id: 'hide-plain-gear',
    group: 'junk',
    title: 'Hide white gear with 0 or 1 socket from character level 10',
    description:
      'Normal-quality weapons and armour with at most one socket, white class items among them, once your character is level 10 (as in Sully’s filter), outside town. That includes bases you could still socket (Larzuk’s quest, a Socket Donut), so skip it if you want those. Superior items stay; quest items, mythical bases and throwing potions are excluded.',
    rule: {
      itemTypes: ['weap', 'armo'],
      excludeItemTypes: ['tpot'],
      excludeItemCodes: NOT_PLAIN_GEAR,
      quality: 'normal',
      sockets: { max: 1 },
      playerStats: [level(10)],
      excludeAreas: TOWNS,
      hide: true,
    },
  },
  {
    id: 'hide-ammo-and-throwing-potions',
    group: 'junk',
    title: 'Hide plain arrows, bolts and throwing potions from character level 10',
    description:
      'A quality range: up to superior (inferior, normal, superior), from character level 10 (Sully’s level for plain quivers), outside town. Magic, rare and unique quivers stay, since ESR has hundreds of quiver affixes.',
    rule: { itemTypes: ['bowq', 'xboq', 'tpot'], quality: { max: 'superior' }, playerStats: [level(10)], excludeAreas: TOWNS, hide: true },
  },
];

const BY_ID: ReadonlyMap<string, ExampleRule> = new Map(EXAMPLE_RULES.map((example) => [example.id, example]));

/** The example with this id, or undefined. */
export function findExample(id: string): ExampleRule | undefined {
  return BY_ID.get(id);
}

/** True when the example's rule acts without any presentation choice (it hides, or tags the name). */
export function hasFixedAction(example: ExampleRule): boolean {
  const { rule } = example;
  return rule.hide === true || rule.replaceName !== undefined || rule.namePrefix !== undefined || rule.nameSuffix !== undefined;
}

/** True for an example that hides (it has no presentation choices). */
export function isHideExample(example: ExampleRule): boolean {
  return example.rule.hide === true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Presentation choices
// ---------------------------------------------------------------------------------------------------------------------

/** The four presentation choices; null is "None". */
export interface ExampleChoices {
  readonly style: StylePresetId | null;
  readonly sound: string | null;
  readonly icon: string | null;
  readonly chatMessage: string | null;
}

export const NO_CHOICES: ExampleChoices = { style: null, sound: null, icon: null, chatMessage: null };

/** The example's default choices (all None for a hide rule). */
export function defaultChoices(example: ExampleRule): ExampleChoices {
  const presentation = example.presentation;
  if (presentation === undefined || isHideExample(example)) return NO_CHOICES;
  return {
    style: presentation.style ?? null,
    sound: presentation.sound ?? null,
    icon: presentation.icon ?? null,
    chatMessage: presentation.chatMessage ?? null,
  };
}

/** The plain drop line the chat select offers besides the example's own line. */
export const PLAIN_CHAT_MESSAGE = '{qualityColor}{name}';

/** The chat lines an example offers (None is separate): its own line, if any, and the plain drop line. */
export function chatOptions(example: ExampleRule): readonly { readonly value: string; readonly label: string }[] {
  const own = example.presentation?.chatMessage;
  const options = own === undefined ? [] : [{ value: own, label: 'Its own line' }];
  return own === PLAIN_CHAT_MESSAGE ? options : [...options, { value: PLAIN_CHAT_MESSAGE, label: 'The item name' }];
}

export interface BuiltExample {
  readonly rule: LootFilterRule;
  /** The styles the rule's `useStyle` needs, by name (a preset's copy). */
  readonly stylesToAdd: Readonly<Record<string, LootFilterStyle>>;
}

/**
 * The rule an example adds with the given choices: its conditions and fixed actions, its title as `comment`, then
 * `useStyle` (a preset's name, the preset going into `stylesToAdd`), `sound`, `icon` (the example's size, else
 * `DEFAULT_EXAMPLE_ICON_SIZE`) and `chatMessage` for the choices that are not None. A hide rule ignores the choices.
 */
export function buildExampleRule(example: ExampleRule, choices: ExampleChoices): BuiltExample {
  const base: LootFilterRule = { comment: example.title, ...example.rule };
  if (isHideExample(example)) return { rule: base, stylesToAdd: {} };
  const preset = choices.style === null ? null : stylePreset(choices.style);
  const rule: LootFilterRule = {
    ...base,
    ...(preset === null ? {} : { useStyle: preset.name }),
    ...(choices.sound === null ? {} : { sound: choices.sound }),
    ...(choices.icon === null
      ? {}
      : { icon: { iconName: choices.icon, iconSize: example.presentation?.iconSize ?? DEFAULT_EXAMPLE_ICON_SIZE } }),
    ...(choices.chatMessage === null ? {} : { chatMessage: choices.chatMessage }),
  };
  return { rule, stylesToAdd: preset === null ? {} : { [preset.name]: preset.style } };
}
