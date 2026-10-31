/**
 * Stat params ("layers") of the itemstatcost stats that carry a skill, skill tab or class in their param, as the game
 * stores them on an item and as the loot-filter plugin reads them (`stat: 188, param: 50`). Verified against ESR 3.2.24
 * (properties.txt funcs, itemstatcost `Encode` / `descfunc` / `Save Param Bits`, skills.txt, charstats.txt):
 *
 * - tab (`item_addskill_tab`, func 10, descfunc 14): `class << 3 | tab`, tab 0-2 in charstats StrSkillTab1-3 order
 *   (= types.json `classes[].tabs`). properties.txt numbers the tabs 0-23 (`class * 3 + tab`, Assassin Martial Arts =
 *   20) and the engine stores `8 * floor(p / 3) + p % 3` (Martial Arts = 50, Warlock Demon Skills = 56).
 * - class (`item_addclassskills`, func 21, descfunc 13): the class id = the property's `val` (ama 0, sor 1, nec 2,
 *   pal 3, bar 4, dru 5, ass 6, war 7: the charstats rows without the Expansion marker, = CLASS_CODES order).
 * - skill (`item_singleskill`, `item_nonclassskill`, `item_aura` and their `_display` companions; funcs 12/22/24): the
 *   skills.txt row index (= the `*Id` column).
 * - event (skill on hit / attack / kill / death / level up / getting hit / cast / taking damage, `Encode` 2, func 11)
 *   and charged (`item_charged_skill`, `Encode` 3, func 19): `skill << 6 | level`, level 1-63. A stat param is 16
 *   bits, so skill ids above 1023 do not fit (ESR saves 18 param bits, but `(1555 << 6) | 1` is already 99521).
 * - charged value: `max charges << 8 | charges left` (5/5 charges = 1285).
 */
import { CLASS_CODES } from './schema.ts';

export type StatLayerKind = 'tab' | 'class' | 'skill' | 'event' | 'charged';

/** Layered stats by itemstatcost `Stat` name. `_display` / `_hidden` companions are listed for labels only. */
export const STAT_LAYER_KINDS: Readonly<Record<string, StatLayerKind>> = {
  item_addskill_tab: 'tab',
  item_addclassskills: 'class',
  item_singleskill: 'skill',
  item_nonclassskill: 'skill',
  item_nonclassskill_display: 'skill',
  item_aura: 'skill',
  item_aura_display: 'skill',
  item_skillonattack: 'event',
  item_skillonkill: 'event',
  item_skillondeath: 'event',
  item_skillonhit: 'event',
  item_skillonlevelup: 'event',
  item_skillongethit: 'event',
  item_skilloncast: 'event',
  item_skillontakedmg: 'event',
  item_skillonattack_hidden: 'event',
  item_skillonkill_hidden: 'event',
  item_skillonhit_hidden: 'event',
  item_skillongethit_hidden: 'event',
  item_skilloncast_hidden: 'event',
  item_skillontakedmg_hidden: 'event',
  item_charged_skill: 'charged',
};

export function statLayerKind(name: string): StatLayerKind | undefined {
  return Object.hasOwn(STAT_LAYER_KINDS, name) ? STAT_LAYER_KINDS[name] : undefined;
}

/** A stat param is 16 bits */
export const MAX_STAT_PARAM = 0xffff;
/** Highest skill id of an event / charged layer (10 bits) */
export const MAX_LAYER_SKILL = 1023;
/** Highest level of an event / charged layer (6 bits) */
export const MAX_LAYER_LEVEL = 63;
const TABS_PER_CLASS = 3;
const CLASS_COUNT = CLASS_CODES.length;

const isIntIn = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

/** Layer of class `cls` (0-7) tab `tab` (0-2); undefined out of range */
export function tabLayer(cls: number, tab: number): number | undefined {
  if (!isIntIn(cls, 0, CLASS_COUNT - 1) || !isIntIn(tab, 0, TABS_PER_CLASS - 1)) return undefined;
  return (cls << 3) | tab;
}

/** properties.txt tab number (`skilltab` param / func 10 `val`, 0-23) → layer; undefined out of range */
export function skillTabLayer(tab: number): number | undefined {
  if (!isIntIn(tab, 0, CLASS_COUNT * TABS_PER_CLASS - 1)) return undefined;
  return tabLayer(Math.floor(tab / TABS_PER_CLASS), tab % TABS_PER_CLASS);
}

/** Layer → class id + tab index; undefined when it names no class tab */
export function decodeTabLayer(layer: number): { cls: number; tab: number } | undefined {
  if (!isIntIn(layer, 0, MAX_STAT_PARAM)) return undefined;
  const cls = layer >> 3;
  const tab = layer & 7;
  return cls < CLASS_COUNT && tab < TABS_PER_CLASS ? { cls, tab } : undefined;
}

/** Event / charged layer of skill id `skill` at `level`; undefined when it does not fit (skill > 1023, level outside 1-63) */
export function skillLevelLayer(skill: number, level: number): number | undefined {
  if (!isIntIn(skill, 0, MAX_LAYER_SKILL) || !isIntIn(level, 1, MAX_LAYER_LEVEL)) return undefined;
  return (skill << 6) | level;
}

/** Event / charged layer → skill id + level; undefined outside 0-65535 or for level 0 */
export function decodeSkillLevelLayer(layer: number): { skill: number; level: number } | undefined {
  if (!isIntIn(layer, 0, MAX_STAT_PARAM)) return undefined;
  const level = layer & 63;
  return level === 0 ? undefined : { skill: layer >> 6, level };
}

/** `item_charged_skill` value of `max` charges with `charges` left (both 0-255); undefined out of range */
export function chargedValue(max: number, charges: number): number | undefined {
  if (!isIntIn(max, 0, 255) || !isIntIn(charges, 0, 255)) return undefined;
  return (max << 8) | charges;
}

/** `item_charged_skill` value → max charges + charges left; undefined outside 0-65535 */
export function decodeChargedValue(value: number): { max: number; charges: number } | undefined {
  if (!isIntIn(value, 0, MAX_STAT_PARAM)) return undefined;
  return { max: value >> 8, charges: value & 0xff };
}
