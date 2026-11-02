/**
 * "Check in game": a test rule that prints, in front of the item's name, the value the plugin reads for every stat a
 * rule checks (`{stat:ID}` / `{stat:ID,param}`), so a player can compare it with the tooltip. A power user found that
 * Enhanced Damage reads 0 on weapons this way.
 *
 * The test rule goes right before its rule, with the rule's conditions but none of its stat checks (so it shows the
 * values whether the checks pass or not) and no actions but the printed text: it never hides and changes nothing but
 * the name. Name parts are "later wins" in the plugin, so the text goes where the rule (style included) writes nothing:
 * `namePrefix`, else `nameSuffix`, else a `chatMessage` (chat lines add up). A later rule that also sets that name part
 * replaces it, and an item the rule (or an earlier rule) hides shows no label at all.
 */
import { effectiveActions } from '../engine/actions';
import { wrongShapedKeys } from '../engine/evaluate';
import { CONDITION_KEYS } from '../engine/parse';
import type { LootFilter, LootFilterRule, RuleConditions, StatCheck } from '../engine/types';
import type { LootFilterLookup } from './lookup';

/** Where a player reports a stat the plugin reads differently from the tooltip (a new GitHub issue). */
export const REPORT_STAT_URL =
  'https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/new?title=Loot%20filter%3A%20stat%20reads%20differently%20in%20game';

/** Every test rule's comment starts with this, so the rule search finds them all (and `isInGameCheckRule` spots them). */
export const IN_GAME_CHECK_MARK = 'In-game check';

/** The stat lists a test rule leaves out; their stats are what it prints. */
const STAT_LISTS = ['itemStats', 'itemStatsAnyOf', 'playerStats', 'playerStatsAnyOf'] as const satisfies readonly (keyof RuleConditions)[];

/** Short labels by itemstatcost name, for the stats filters check most; others show their name without `item_`. */
const SHORT_LABELS: Readonly<Record<string, string>> = {
  strength: 'Str',
  energy: 'Ene',
  dexterity: 'Dex',
  vitality: 'Vit',
  hitpoints: 'CurLife',
  maxhp: 'Life',
  mana: 'CurMana',
  maxmana: 'Mana',
  level: 'Lvl',
  gold: 'Gold',
  item_armor_percent: 'Def%',
  item_maxdamage_percent: 'ED',
  item_mindamage_percent: 'EDmin',
  armorclass: 'Def',
  tohit: 'AR',
  item_tohit_percent: 'AR%',
  fireresist: 'FR',
  lightresist: 'LR',
  coldresist: 'CR',
  poisonresist: 'PR',
  lifedrainmindam: 'LL',
  manadrainmindam: 'ML',
  item_goldbonus: 'GF',
  item_magicbonus: 'MF',
  item_addclassskills: 'Class',
  item_fasterattackrate: 'IAS',
  item_fastermovevelocity: 'FRW',
  item_fastergethitrate: 'FHR',
  item_fasterblockrate: 'FBR',
  item_fastercastrate: 'FCR',
  item_allskills: 'AllSk',
  item_addskill_tab: 'Tab',
  item_singleskill: 'Skill',
  item_nonclassskill: 'OSkill',
  item_aura: 'Aura',
  item_numsockets: 'Sock',
  item_skillonattack: 'CtcAtk',
  item_skillonkill: 'CtcKill',
  item_skillondeath: 'CtcDeath',
  item_skillonhit: 'CtcHit',
  item_skillonlevelup: 'CtcLvlUp',
  item_skillongethit: 'CtcGetHit',
  item_charged_skill: 'Charges',
  item_maxdurability_percent: 'Dur%',
  item_hp_perlevel: 'Life/lvl',
  item_mana_perlevel: 'Mana/lvl',
};

/** One printed value: what the stat lists check, once per stat and param. */
export interface CheckedStat {
  /** Item stats (`{stat:…}`) or character stats (`{playerStat:…}`) */
  readonly owner: 'item' | 'player';
  /** The stat as the placeholder writes it: its id, or its name when the id is not known */
  readonly stat: string | number;
  readonly param: number | undefined;
  /** In the printed text: "ED", "Tab:8", "Char Lvl" */
  readonly label: string;
  /** In the comment: "item_maxdamage_percent (17)", plus the param's name */
  readonly description: string;
}

function baseLabel(name: string | undefined, stat: string | number): string {
  if (name === undefined) return typeof stat === 'number' ? `#${String(stat)}` : stat.replace(/^item_/, '');
  return SHORT_LABELS[name] ?? name.replace(/^item_/, '');
}

function checkedStat(owner: CheckedStat['owner'], check: StatCheck, lookup: LootFilterLookup): CheckedStat {
  const name = lookup.statName(check.stat) ?? (typeof check.stat === 'string' ? check.stat : undefined);
  const id = lookup.statId(check.stat) ?? (typeof check.stat === 'number' ? check.stat : undefined);
  const { param } = check;
  const short = baseLabel(name, check.stat);
  const label = `${owner === 'player' ? 'Char ' : ''}${short}${param === undefined ? '' : `:${String(param)}`}`;
  const paramName = param === undefined ? undefined : lookup.statParamLabel(check.stat, param);
  const what = [name, id === undefined || name === undefined ? undefined : `(${String(id)})`]
    .filter((part) => part !== undefined)
    .join(' ');
  const description = `${what || String(check.stat)}${param === undefined ? '' : ` param ${String(param)}${paramName === undefined ? '' : ` ${paramName}`}`}`;
  return { owner, stat: id ?? check.stat, param, label, description };
}

/** The stats the rule's four stat lists check (exceptions included), in list order, each stat and param once. */
export function checkedStats(rule: LootFilterRule, lookup: LootFilterLookup): readonly CheckedStat[] {
  const seen = new Set<string>();
  const result: CheckedStat[] = [];
  for (const list of STAT_LISTS) {
    const owner = list.startsWith('player') ? 'player' : 'item';
    for (const check of rule[list] ?? []) {
      if (check.stat === '') continue;
      const entry = checkedStat(owner, check, lookup);
      const key = `${owner}|${String(entry.stat)}|${String(entry.param)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

/** `[ED {stat:17} | Tab:8 {stat:188,8} | Char Lvl {playerStat:12}]` */
export function checkText(stats: readonly CheckedStat[]): string {
  const parts = stats.map(({ owner, stat, param, label }) => {
    const key = owner === 'player' ? 'playerStat' : 'stat';
    return `${label} {${key}:${String(stat)}${param === undefined ? '' : `,${String(param)}`}}`;
  });
  return `[${parts.join(' | ')}]`;
}

export type InGameCheckResult =
  | { readonly ok: true; readonly rule: LootFilterRule; readonly field: 'namePrefix' | 'nameSuffix' | 'chatMessage' }
  | { readonly ok: false; readonly reason: string };

/** Why a rule gets no test rule; shown on the disabled button. */
export const NO_STATS_REASON = 'This rule checks no stats; the check prints the values of the stats a rule checks.';

/**
 * Why a rule with wrong-shaped keys gets no test rule: the copy would leave them out and apply while the plugin (and
 * the Test tab) most likely switches the rule itself off.
 */
export function wrongShapeReason(keys: readonly string[]): string {
  return `This rule has ${keys.length === 1 ? 'a wrong-shaped key' : 'wrong-shaped keys'} (${keys.join(', ')}); fix it first.`;
}

/**
 * The test rule for the rule at `index` (it goes at `index`, so the rule moves to `index + 1`): the rule's conditions
 * without the stat lists, the printed values (`checkText`) in the first name part the rule leaves free, and a comment
 * that starts with `IN_GAME_CHECK_MARK` and spells out the labels. The comment says "the rule below" rather than a rule
 * number, which would go stale when rules move. A rule with wrong-shaped keys gets none (`wrongShapeReason`).
 */
export function inGameCheckRule(filter: LootFilter, index: number, lookup: LootFilterLookup): InGameCheckResult {
  const source = filter.rules.at(index);
  if (source === undefined) return { ok: false, reason: 'No such rule.' };
  const wrongShaped = wrongShapedKeys(source);
  if (wrongShaped.length > 0) return { ok: false, reason: wrongShapeReason(wrongShaped) };
  const stats = checkedStats(source, lookup);
  if (stats.length === 0) return { ok: false, reason: NO_STATS_REASON };

  const conditions: Record<string, unknown> = {};
  for (const key of CONDITION_KEYS) {
    if ((STAT_LISTS as readonly string[]).includes(key)) continue;
    if (source[key] !== undefined) conditions[key] = source[key];
  }

  const actions = effectiveActions(source, filter);
  const text = checkText(stats);
  const field = actions.namePrefix === undefined ? 'namePrefix' : actions.nameSuffix === undefined ? 'nameSuffix' : 'chatMessage';
  const printed = field === 'namePrefix' ? `${text} ` : field === 'nameSuffix' ? ` ${text}` : `{name} ${text}`;
  const labels = stats.map((stat) => `${stat.label} = ${stat.description}`).join('; ');
  const comment = `${IN_GAME_CHECK_MARK} for the rule below: compare these numbers with the item tooltip, then delete this rule. ${labels}`;

  // CONDITION_KEYS are the rule's condition keys, copied with their own values: the record is a RuleConditions.
  const rule = { ...(conditions as RuleConditions), [field]: printed, comment } satisfies LootFilterRule;
  return { ok: true, rule, field };
}

/** Whether the rule is a "Check in game" test rule (by its comment's start, which older wordings share). */
export function isInGameCheckRule(rule: LootFilterRule): boolean {
  return rule.comment?.startsWith(IN_GAME_CHECK_MARK) === true;
}
