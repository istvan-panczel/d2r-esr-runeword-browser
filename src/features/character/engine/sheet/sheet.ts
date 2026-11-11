/**
 * The computed character sheet: final attributes, life, mana, resists, defense, speeds, attack rating … with a breakdown
 * of every number's sources. Pure: no React, no fetch. The rules and what backs them are listed in
 * docs/features/CHARACTER-SAVE.md ("Computed sheet"); in short (VERIFIED = reproduces the in-game screen of the
 * Javazon, SpinToWin and Soso ground-truth pairs of 2026-11-11):
 *
 * - Attributes: (gf base + flat from items, sets, skills, auras) × (100 + attribute %) / 100, then + the per-level
 *   amounts; the % does not multiply per-level attributes. VERIFIED.
 * - Life: (gf maxhp + flat life) + trunc(that × life % / 100) + per-level life + trunc(per-level life × life % / 100)
 *   + (vitality above gf) × LifePerVitality / 4. Life from vitality above the gf value is not multiplied by the %, except
 *   through the Kill Ledger aura's maxhp term (skill row 852), which is flat life and so multiplied. Mana alike with
 *   energy, stamina with skill_staminapercent. VERIFIED (every displayed value and every saved current value ≤ max).
 * - Defense: Σ armour pieces' floor(defense × (100 + own ED% + own ED% per level) / 100) + flat defense + per-level
 *   defense per item + dexterity / 4, × (100 + skill_armor_percent + armor_override_percent) / 100. VERIFIED.
 * - Resists: sum (with Anya's scroll: +10 per difficulty read) + the difficulty's penalty, capped at
 *   min(75 + max resist, 95); magic resist gets no penalty; physical resist is capped at 50. VERIFIED.
 * - Attack rating: ((dex − 7) × 5 + ToHitFactor + to-hit) × (100 + AR% + the skill's to-hit %) / 100. The main-hand line
 *   leaves out the off-hand weapon's own to-hit stats; the off-hand line uses the character's whole to-hit, per-level
 *   to-hit pooled over every list (VERIFIED: SpinToWin 61,474 / 68,978).
 * - Per-level stats (op 2, base level): floor(Σ stat × level / 2^op param) over all lists pooled.
 * - Speeds: totals of IAS / FRW / FHR / FBR / FCR; base attack speed = 100 − main-hand weapon speed + attackrate; base
 *   run/walk = 100 − Σ worn armour speed + velocitypercent. VERIFIED.
 * - Buffs (INFERRED, no buffed ground truth): one instance of a skill counts, the highest level of its selections and of
 *   an item aura of the same skill; one buff per exclusive group (an own aura, a shape-shift), the last selected. A buff
 *   stat no sheet value applies (consumed.ts) is a warning. Every object with a `status` whose numbers differ from the
 *   unbuffed sheet is `unverified` (a structural diff, so a new field cannot be missed).
 */
import type { CharacterFile, DifficultyIndex } from '../../parser/types';
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import { itemRequirements, setupItems, type ItemSetup } from './activeItems';
import { consumedStats, unappliedOps } from './consumed';
import { BASE_SUFFIX, type SheetData } from './sheetData';
import { auraStats, passiveStats, skillLevels, skillToHit, type EvalContext, type SkillLevels } from './skills';
import { addStat, entryOf, getStat, mergeInto, sameStats, sumStat, type Contribution, type StatMap } from './statMap';
import type {
  AppliedBuff,
  AttributeValue,
  BuffSelection,
  CharacterSheet,
  HandAttackRating,
  MercenaryFacts,
  ResistValue,
  SheetFacts,
  SheetOptions,
  SheetSource,
  SheetStatus,
  SheetValue,
  SkillLevel,
} from './types';

const MAX_PASSES = 12;
const ATTRIBUTES = ['strength', 'dexterity', 'vitality', 'energy'] as const;
type Attribute = (typeof ATTRIBUTES)[number];
const ATTRIBUTE_PERCENT: Readonly<Record<Attribute, 'strengthpercent' | 'dexteritypercent' | 'vitalitypercent' | 'energypercent'>> = {
  strength: 'strengthpercent',
  dexterity: 'dexteritypercent',
  vitality: 'vitalitypercent',
  energy: 'energypercent',
};
const POOLS = [
  { stat: 'maxhp', percent: 'item_maxhp_percent', label: 'Life' },
  { stat: 'maxmana', percent: 'item_maxmana_percent', label: 'Mana' },
  { stat: 'maxstamina', percent: 'skill_staminapercent', label: 'Stamina' },
] as const;
type Pool = (typeof POOLS)[number]['stat'];

/** The totals of one pass and how the derived parts came about */
interface Derived {
  /** Final stat totals (list units) */
  total: StatMap;
  /** Per-level targets (op 2 over pooled sums) */
  perLevel: StatMap;
  attributePercent: Record<Attribute, number>;
  poolPercent: Record<Pool, number>;
  /** Life / mana / stamina from attributes above their gf value (list units) */
  fromAttributes: Record<Pool, number>;
  vitalityAbove: number;
  energyAbove: number;
}

interface Computed {
  setup: ItemSetup;
  base: StatMap;
  /** Items, runic shares, sets, quest */
  fixed: Contribution[];
  /** Passives, item auras, buffs */
  dynamic: Contribution[];
  derived: Derived;
  levels: SkillLevels;
  buffs: AppliedBuff[];
  converged: boolean;
  unsupported: Set<string>;
  ctx: EvalContext;
  /** Selected buffs the character has no level in (and none was given), or without data */
  skippedBuffs: number[];
  /** What the buff rules did (duplicates, groups, item auras of the same skill, stats not applied) */
  buffNotes: string[];
  /** Item auras whose skill the bundles do not know (a save from a newer ESR) */
  unknownAuras: { skill: number; label: string }[];
}

/** The exclusive group of a buff: an own aura (skills.txt `aura` 1) or a shape-shift (charsheet.json `shapeshift`) */
export function exclusiveGroupOf(data: SheetData, skillId: number): 'aura' | 'shapeshift' | undefined {
  const skill = data.skill(skillId);
  if (skill?.shapeshift === true) return 'shapeshift';
  return skill?.row.aura === 1 ? 'aura' : undefined;
}

const GROUP_LABELS = { aura: 'own aura', shapeshift: 'shape-shift' } as const;

/** A buff selection after the one-instance rules: per skill the given levels, and whether its own level counts too */
interface NormalizedBuff {
  skillId: number;
  levels: number[];
  /** A selection without a level: the effective level counts */
  effective: boolean;
}

/** One selection per skill (the highest level), then one per exclusive group (the last selected), in selection order */
function normalizeBuffs(data: SheetData, buffs: readonly BuffSelection[], notes: string[]): NormalizedBuff[] {
  const bySkill = new Map<number, NormalizedBuff & { order: number }>();
  buffs.forEach((selection, order) => {
    const seen = bySkill.get(selection.skillId) ?? { skillId: selection.skillId, levels: [], effective: false, order };
    if (selection.level === undefined) seen.effective = true;
    else seen.levels.push(selection.level);
    seen.order = order;
    bySkill.set(selection.skillId, seen);
  });
  const ordered = [...bySkill.values()].sort((a, b) => a.order - b.order);
  const kept: typeof ordered = [];
  for (const group of ['aura', 'shapeshift'] as const) {
    const members = ordered.filter((entry) => exclusiveGroupOf(data, entry.skillId) === group);
    const last = members.at(-1);
    if (last === undefined || members.length < 2) continue;
    notes.push(
      `Only one ${GROUP_LABELS[group]} counts at a time: ${members.map((entry) => data.skillName(entry.skillId)).join(', ')} selected, ${data.skillName(last.skillId)} counted`
    );
  }
  for (const entry of ordered) {
    const group = exclusiveGroupOf(data, entry.skillId);
    const last = group === undefined ? entry : ordered.filter((other) => exclusiveGroupOf(data, other.skillId) === group).at(-1);
    if (last === entry) kept.push(entry);
  }
  return kept.map(({ skillId, levels, effective }) => ({ skillId, levels, effective }));
}

function statRecord(data: SheetData, total: StatMap, base: StatMap): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [id, inner] of total) {
    const name = data.bundle.statNames.at(id);
    if (name !== undefined && name !== '') record[name] = [...inner.values()].reduce((a, b) => a + b, 0);
  }
  for (const [id, inner] of base) {
    const name = data.bundle.statNames.at(id);
    if (name !== undefined && name !== '') record[`${name}${BASE_SUFFIX}`] = [...inner.values()].reduce((a, b) => a + b, 0);
  }
  return record;
}

/** Per-level stats (op 2 / base level) of a stat map → their targets: floor(Σ × level / 2^param) */
function perLevelOf(data: SheetData, flat: StatMap, level: number): StatMap {
  const out: StatMap = new Map();
  for (const op of data.perLevelOps) {
    if (op.op !== 2) continue;
    const value = sumStat(flat, op.id);
    if (value === 0) continue;
    const amount = Math.floor((value * level) / 2 ** op.param);
    for (const target of op.targets) addStat(out, target, 0, amount);
  }
  return out;
}

function derive(character: CharacterFile, data: SheetData, base: StatMap, contributions: readonly Contribution[]): Derived {
  const { stat } = data;
  const cls = data.bundle.classes.at(character.classId);
  const flat: StatMap = new Map();
  mergeInto(flat, base);
  for (const contribution of contributions) mergeInto(flat, contribution.stats);
  const perLevel = perLevelOf(data, flat, character.level);

  const total: StatMap = new Map();
  mergeInto(total, flat);
  // Per-level amounts onto other stats first (a per-level % counts in the % below)
  const handled = new Set<number>([...ATTRIBUTES.map((name) => stat[name]), ...POOLS.map((pool) => stat[pool.stat])]);
  for (const [id, inner] of perLevel) if (!handled.has(id)) for (const [param, amount] of inner) addStat(total, id, param, amount);
  const attributePercent = { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
  for (const name of ATTRIBUTES) {
    const id = stat[name];
    attributePercent[name] = Math.trunc((sumStat(flat, id) * sumStat(total, stat[ATTRIBUTE_PERCENT[name]])) / 100);
    addStat(total, id, 0, attributePercent[name] + sumStat(perLevel, id));
  }
  const vitalityAbove = sumStat(total, stat.vitality) - sumStat(base, stat.vitality);
  const energyAbove = sumStat(total, stat.energy) - sumStat(base, stat.energy);
  // The % multiplies the pool and its per-level amount apart, each truncated: op 11 names both (op stat1 maxmana, op
  // stat2 item_mana_perlevel). VERIFIED: SpinToWin's mana 791, not 792 as one truncation of the sum gives.
  const poolPercent = { maxhp: 0, maxmana: 0, maxstamina: 0 };
  for (const pool of POOLS) {
    const id = stat[pool.stat];
    const percent = sumStat(total, stat[pool.percent]);
    const levelPart = sumStat(perLevel, id);
    poolPercent[pool.stat] = Math.trunc((sumStat(total, id) * percent) / 100) + Math.trunc((levelPart * percent) / 100);
    addStat(total, id, 0, levelPart + poolPercent[pool.stat]);
  }
  // charstats values are in fourths; list units are × 256: × 64
  const fromAttributes = {
    maxhp: (vitalityAbove * (cls?.lifePerVitality ?? 0)) << 6,
    maxstamina: (vitalityAbove * (cls?.staminaPerVitality ?? 0)) << 6,
    maxmana: (energyAbove * (cls?.manaPerEnergy ?? 0)) << 6,
  };
  for (const pool of POOLS) addStat(total, stat[pool.stat], 0, fromAttributes[pool.stat]);
  return { total, perLevel, attributePercent, poolPercent, fromAttributes, vitalityAbove, energyAbove };
}

/**
 * Item auras of the fixed contributions: per owner (item / set) and skill, the highest level when several give it. An
 * aura whose skill the bundles do not know at all goes to `unknown`; one charsheet.json leaves out because it gives its
 * owner nothing (an enemy-only aura) is dropped silently.
 */
function itemAuras(
  data: SheetData,
  fixed: readonly Contribution[],
  unknown: { skill: number; label: string }[]
): { owner: Contribution; skill: CharSheetSkill; level: number }[] {
  const byKey = new Map<string, { owner: Contribution; skill: number; level: number }>();
  for (const contribution of fixed) {
    for (const [skill, level] of contribution.stats.get(data.stat.item_aura) ?? []) {
      const key = `${contribution.item === undefined ? contribution.label : String(contribution.item)}:${String(skill)}`;
      const seen = byKey.get(key);
      const owner = seen?.owner ?? (contribution.kind === 'runic' ? { ...contribution, kind: 'item' as const } : contribution);
      byKey.set(key, { owner, skill, level: (seen?.level ?? 0) + level });
    }
  }
  const best = new Map<number, { owner: Contribution; skill: CharSheetSkill; level: number }>();
  for (const entry of byKey.values()) {
    const skill = data.skill(entry.skill);
    if (skill === undefined && entry.level > 0 && !data.knownSkill(entry.skill))
      unknown.push({ skill: entry.skill, label: entry.owner.label });
    if (skill === undefined || entry.level <= 0 || !affectsOwner(skill.row, 'item-aura')) continue;
    const seen = best.get(entry.skill);
    if (seen === undefined || seen.level < entry.level) best.set(entry.skill, { owner: entry.owner, skill, level: entry.level });
  }
  return [...best.values()];
}

function compute(character: CharacterFile, data: SheetData, buffs: readonly BuffSelection[]): Computed {
  const { stat } = data;
  const base: StatMap = new Map();
  for (const attribute of character.attributes) addStat(base, attribute.id, 0, attribute.raw);
  const setup = setupItems(character, data);
  const fixed: Contribution[] = [...setup.contributions];
  const scrolls = character.quests?.difficulties.filter((difficulty) => difficulty.resistScroll).length ?? 0;
  if (scrolls > 0) {
    const stats: StatMap = new Map();
    for (const name of ['fireresist', 'coldresist', 'lightresist', 'poisonresist'] as const)
      addStat(stats, stat[name], 0, scrolls * data.bundle.rules.anyaResist);
    fixed.push({ kind: 'quest', label: `Anya's Scroll of Resistance (${String(scrolls)}×)`, stats });
  }
  const unknownAuras: { skill: number; label: string }[] = [];
  const auras = itemAuras(data, fixed, unknownAuras);
  const groupNotes: string[] = [];
  const selections = normalizeBuffs(data, buffs, groupNotes);
  const consumed = consumedStats(data);
  // The base (gf) values under their own names and as `x__base`: what an item aura's passive columns read
  const baseRecord = statRecord(data, base, base);

  const unsupported = new Set<string>();
  let dynamic: Contribution[] = [];
  let derived = derive(character, data, base, fixed);
  let levels = skillLevels(character, data, derived.total);
  let applied: AppliedBuff[] = [];
  let skippedBuffs: number[] = [];
  let buffNotes: string[] = [];
  let converged = false;
  let ctx: EvalContext = { charLevel: character.level, stats: {}, hardByName: {}, levelByName: {}, unsupported };
  for (let pass = 0; pass < MAX_PASSES && !converged; pass++) {
    const sum: StatMap = new Map();
    for (const contribution of [...fixed, ...dynamic]) mergeInto(sum, contribution.stats);
    levels = skillLevels(character, data, sum);
    ctx = { charLevel: character.level, stats: statRecord(data, derived.total, base), ...levels, unsupported };
    const next: Contribution[] = [];
    for (const state of levels.byId.values()) {
      const skill = data.skill(state.id);
      if (skill === undefined || state.level <= 0 || skill.row.passive !== 1 || skill.row.passivestate === undefined) continue;
      next.push({
        kind: 'passive',
        label: data.skillName(state.id),
        skill: state.id,
        stats: passiveStats(data, skill, state.level, state.hard, ctx),
      });
    }
    // Buffs first: a buff at a higher level than an item aura of the same skill replaces it (one instance counts)
    applied = [];
    skippedBuffs = [];
    buffNotes = [...groupNotes];
    const auraLevels = new Map(auras.map((aura) => [aura.skill.n, aura.level]));
    const replaced = new Set<number>();
    const buffContributions: Contribution[] = [];
    for (const selection of selections) {
      const skill = data.skill(selection.skillId);
      const state = levels.byId.get(selection.skillId);
      const level = Math.max(selection.effective ? (state?.level ?? 0) : 0, ...selection.levels);
      if (skill === undefined || level <= 0) {
        skippedBuffs.push(selection.skillId);
        continue;
      }
      const name = data.skillName(skill.n);
      const auraLevel = auraLevels.get(skill.n);
      if (auraLevel !== undefined) {
        if (auraLevel >= level) {
          buffNotes.push(
            `Buff ${name} (level ${String(level)}) not counted: an item gives it at level ${String(auraLevel)} (one instance counts)`
          );
          continue;
        }
        replaced.add(skill.n);
        buffNotes.push(`Buff ${name} (level ${String(level)}) replaces the item aura (level ${String(auraLevel)}): one instance counts`);
      }
      const stats = auraStats(data, skill, level, state?.hard ?? 0, ctx);
      if (skill.row.passive !== 1) mergeInto(stats, passiveStats(data, skill, level, state?.hard ?? 0, ctx));
      buffContributions.push({ kind: 'buff', label: name, skill: skill.n, stats });
      const record: Record<string, number> = {};
      const dropped: string[] = [];
      for (const [id, inner] of stats)
        for (const value of inner.values()) {
          record[data.statName(id)] = (record[data.statName(id)] ?? 0) + value;
          if (!consumed.has(id) && value !== 0) dropped.push(`${data.statName(id)} ${value > 0 ? '+' : ''}${String(value)}`);
        }
      if (dropped.length > 0)
        buffNotes.push(`Buff ${name} (level ${String(level)}): ${dropped.join(', ')} not on the sheet (no rule applies it)`);
      applied.push({ skillId: skill.n, name, level, stats: record });
    }
    const hardCtx: EvalContext = { ...ctx, stats: baseRecord, levelByName: levels.hardByName };
    for (const { owner, skill, level } of auras) {
      if (replaced.has(skill.n)) continue;
      const stats = auraStats(data, skill, level, 0, ctx);
      mergeInto(stats, passiveStats(data, skill, level, 0, hardCtx));
      next.push({ kind: 'item-aura', label: `${data.skillName(skill.n)} (${owner.label})`, item: owner.item, skill: skill.n, stats });
    }
    next.push(...buffContributions);
    const nextDerived = derive(character, data, base, [...fixed, ...next]);
    converged = sameStats(nextDerived.total, derived.total) && dynamic.length === next.length;
    dynamic = next;
    derived = nextDerived;
  }
  return {
    setup,
    base,
    fixed,
    dynamic,
    derived,
    levels,
    buffs: applied,
    converged,
    unsupported,
    ctx,
    skippedBuffs,
    buffNotes,
    unknownAuras,
  };
}

// --- outputs -------------------------------------------------------------------------------------------------------

const value = (amount: number, sources: SheetSource[], status: SheetStatus, notes?: string[]): SheetValue =>
  notes === undefined || notes.length === 0 ? { value: amount, sources, status } : { value: amount, sources, status, notes };

/** The base and every contribution's part of one stat (all params added), in list units divided by `scale` */
function sourcesOf(c: Computed, ids: readonly number[], scale = 1): SheetSource[] {
  const sources: SheetSource[] = [];
  const baseValue = ids.reduce((sum, id) => sum + sumStat(c.base, id), 0);
  if (baseValue !== 0) sources.push({ kind: 'base', label: 'Base (save)', value: baseValue / scale });
  for (const contribution of [...c.fixed, ...c.dynamic]) {
    const amount = ids.reduce((sum, id) => sum + sumStat(contribution.stats, id), 0);
    if (amount === 0) continue;
    const source: SheetSource = { kind: contribution.kind, label: contribution.label, value: amount / scale };
    if (contribution.item !== undefined) source.item = contribution.item;
    if (contribution.skill !== undefined) source.skill = contribution.skill;
    sources.push(source);
  }
  const perLevel = ids.reduce((sum, id) => sum + sumStat(c.derived.perLevel, id), 0);
  if (perLevel !== 0) sources.push({ kind: 'per-level', label: 'Per character level', value: perLevel / scale });
  return sources;
}

function total(c: Computed, id: number): number {
  return sumStat(c.derived.total, id);
}

/** A plain stat total with its sources */
function plain(data: SheetData, c: Computed, name: keyof SheetData['stat'], status: SheetStatus = 'verified'): SheetValue {
  const id = data.stat[name];
  return value(total(c, id), sourcesOf(c, [id]), status);
}

function attribute(data: SheetData, c: Computed, name: Attribute): AttributeValue {
  const id = data.stat[name];
  const sources = sourcesOf(c, [id]);
  const percent = c.derived.attributePercent[name];
  if (percent !== 0)
    sources.push({ kind: 'percent', label: `${name} % (${String(total(c, data.stat[ATTRIBUTE_PERCENT[name]]))}%)`, value: percent });
  return { ...value(total(c, id), sources, 'verified'), base: sumStat(c.base, id) };
}

function pool(data: SheetData, c: Computed, which: (typeof POOLS)[number], status: SheetStatus): SheetValue {
  const id = data.stat[which.stat];
  const sources = sourcesOf(c, [id], 256);
  const percent = c.derived.poolPercent[which.stat];
  if (percent !== 0)
    sources.push({ kind: 'percent', label: `${which.label} % (${String(total(c, data.stat[which.percent]))}%)`, value: percent / 256 });
  const fromAttribute = c.derived.fromAttributes[which.stat];
  if (fromAttribute !== 0)
    sources.push({
      kind: 'attribute',
      label: which.stat === 'maxmana' ? 'Energy above base' : 'Vitality above base',
      value: fromAttribute / 256,
    });
  return value(Math.floor(total(c, id) / 256), sources, status);
}

function resist(
  data: SheetData,
  c: Computed,
  name: 'fireresist' | 'coldresist' | 'lightresist' | 'poisonresist' | 'magicresist',
  max: 'maxfireresist' | 'maxcoldresist' | 'maxlightresist' | 'maxpoisonresist' | 'maxmagicresist',
  difficulty: DifficultyIndex
): ResistValue {
  const rules = data.bundle.rules;
  const penalty = name === 'magicresist' ? 0 : (rules.resistPenalty[difficulty] ?? 0);
  const sources = sourcesOf(c, [data.stat[name]]);
  if (penalty !== 0)
    sources.push({ kind: 'difficulty', label: ['Normal', 'Nightmare', 'Hell'][difficulty] ?? 'Difficulty', value: penalty });
  const raw = total(c, data.stat[name]) + penalty;
  const cap = Math.min(rules.resistCap + total(c, data.stat[max]), rules.resistCeiling);
  const shown = Math.max(Math.min(raw, cap), rules.resistFloor);
  if (shown !== raw)
    sources.push({
      kind: 'cap',
      label: shown < raw ? `Capped at ${String(cap)}` : `Floor ${String(rules.resistFloor)}`,
      value: shown - raw,
    });
  return { ...value(shown, sources, 'verified'), raw, cap, penalty };
}

function physicalResist(data: SheetData, c: Computed): ResistValue {
  const cap = data.bundle.rules.physicalResistCap;
  const raw = total(c, data.stat.damageresist);
  const sources = sourcesOf(c, [data.stat.damageresist]);
  const shown = Math.min(raw, cap);
  if (shown !== raw) sources.push({ kind: 'cap', label: `Capped at ${String(cap)}`, value: shown - raw });
  return { ...value(shown, sources, 'verified'), raw, cap, penalty: 0 };
}

function defense(character: CharacterFile, data: SheetData, c: Computed, dexterity: number): SheetValue {
  const { stat } = data;
  const level = character.level;
  const sources: SheetSource[] = [];
  let sum = 0;
  let perLevel = 0;
  for (const entry of c.setup.active) {
    const own: StatMap = new Map();
    for (const contribution of c.fixed) if (contribution.item === entry.index) mergeInto(own, contribution.stats);
    // op 4 item_armor_perlevel: per item, × level >> op param, onto the character's defense (any item)
    const shift = data.op(stat.item_armor_perlevel)?.param ?? 3;
    perLevel += Math.floor((sumStat(own, stat.item_armor_perlevel) * level) / 2 ** shift);
    if (entry.item.defense === null) continue;
    const percentShift = data.op(stat.item_armorpercent_perlevel)?.param ?? 3;
    const percent =
      sumStat(own, stat.item_armor_percent) + Math.floor((sumStat(own, stat.item_armorpercent_perlevel) * level) / 2 ** percentShift);
    const itemDefense = Math.floor((entry.item.defense * (100 + percent)) / 100);
    sum += itemDefense;
    sources.push({
      kind: 'item',
      label: `${entry.where} defense${percent === 0 ? '' : ` (+${String(percent)}%)`}`,
      value: itemDefense,
      item: entry.index,
    });
  }
  const flatSources = sourcesOf(c, [stat.armorclass]);
  sources.push(...flatSources);
  if (perLevel !== 0) sources.push({ kind: 'per-level', label: 'Defense per level', value: perLevel });
  const fromDex = Math.floor(dexterity / 4);
  sources.push({ kind: 'attribute', label: 'Dexterity / 4', value: fromDex });
  const before = sum + total(c, stat.armorclass) + perLevel + fromDex;
  const percent = total(c, stat.skill_armor_percent) + total(c, stat.armor_override_percent);
  const result = Math.floor((before * (100 + percent)) / 100);
  if (result !== before) sources.push({ kind: 'percent', label: `Defense % (${String(percent)}%)`, value: result - before });
  return value(result, sources, 'verified');
}

function attackRatings(character: CharacterFile, data: SheetData, c: Computed, dexterity: number): CharacterSheet['attackRating'] {
  const { stat } = data;
  const cls = data.bundle.classes.at(character.classId);
  const factor = cls?.toHitFactor ?? 0;
  const toHit = total(c, stat.tohit);
  const percent = total(c, stat.item_tohit_percent);
  const main = (dexterity - 7) * 5 + factor + toHit;
  const sources = sourcesOf(c, [stat.tohit]);
  sources.push(
    { kind: 'attribute', label: '(Dexterity − 7) × 5', value: (dexterity - 7) * 5 },
    { kind: 'class', label: 'Class to-hit factor', value: factor }
  );
  const base = Math.floor((main * (100 + percent)) / 100);
  if (base !== main) sources.push({ kind: 'percent', label: `Attack rating % (${String(percent)}%)`, value: base - main });

  // Off-hand line: the character's whole to-hit, per-level to-hit pooled over every list
  const off = c.setup.offHand;
  let offBase = main;
  let offPercent = percent;
  if (off !== null) {
    const local = c.setup.offHandLocal;
    const op = data.op(stat.item_tohit_perlevel);
    const perLevel = (amount: number) => Math.floor((amount * character.level) / 2 ** (op?.param ?? 3));
    const pooledPerLevel = sumStat(c.derived.total, stat.item_tohit_perlevel) + sumStat(local, stat.item_tohit_perlevel);
    const mainPerLevel = perLevel(sumStat(c.derived.total, stat.item_tohit_perlevel));
    offBase = main - mainPerLevel + perLevel(pooledPerLevel) + sumStat(local, stat.tohit);
    offPercent = percent + sumStat(local, stat.item_tohit_percent);
  }
  const hands: HandAttackRating[] = [];
  for (const [hand, binding] of [
    ['left', character.handSkills.left],
    ['right', character.handSkills.right],
  ] as const) {
    if (binding.skillId === null) continue;
    const skill = data.skill(binding.skillId);
    const state = c.levels.byId.get(binding.skillId);
    if (skill === undefined || state === undefined || state.level <= 0) continue;
    const skillPercent = skillToHit(data, skill, state.level, state.hard, c.ctx);
    hands.push({
      hand,
      skillId: binding.skillId,
      name: data.skillName(binding.skillId),
      level: state.level,
      skillPercent,
      mainHand: Math.floor((main * (100 + percent + skillPercent)) / 100),
      offHand: off === null || !usesOffHand(skill) ? null : Math.floor((offBase * (100 + offPercent + skillPercent)) / 100),
      status: 'verified',
    });
  }
  return {
    percent: value(percent, sourcesOf(c, [stat.item_tohit_percent]), 'verified'),
    base: value(base, sources, 'inferred', ['The character screen shows attack rating per skill only; this is the line without a skill']),
    hands,
  };
}

/**
 * A skill that attacks with the off hand when dual wielding: skills.txt `weapsel` 3 (alternating: Frenzy, the claw
 * skills; VERIFIED, SpinToWin's Frenzy shows 61,474 / 68,978) or 1 (left hand). Whirlwind (2, both at once) shows one
 * line (VERIFIED); a skill without weapsel (Attack, Zeal) none (INFERRED: weapsel 0 is the primary hand)
 */
function usesOffHand(skill: CharSheetSkill): boolean {
  return skill.row.weapsel === 1 || skill.row.weapsel === 3;
}

function block(character: CharacterFile, data: SheetData, c: Computed, dexterity: number): SheetValue | null {
  const shield = c.setup.shield;
  if (shield === null) return null;
  const shieldBlock = entryOf(data.bundle.armor, shield.item.code)?.block ?? 0;
  const toBlock = total(c, data.stat.toblock);
  const factor = data.bundle.classes.at(character.classId)?.blockFactor ?? 0;
  const blockValue = shieldBlock + toBlock + factor;
  const chance = Math.max(0, Math.min(75, Math.floor((blockValue * (dexterity - 15)) / (character.level * 2))));
  return value(
    chance,
    [
      { kind: 'item', label: 'Shield block', value: shieldBlock, item: shield.index },
      { kind: 'class', label: 'Class block factor', value: factor },
      ...sourcesOf(c, [data.stat.toblock]),
    ],
    'inferred',
    ['D2 formula (block × (dexterity − 15) / (level × 2), cap 75), not compared with the game']
  );
}

function mercenaryFacts(character: CharacterFile, data: SheetData): MercenaryFacts | null {
  const merc = character.mercenary;
  if (merc === null) return null;
  const hireling = data.bundle.hirelings.find((entry) => entry.id === merc.typeId);
  let level: number | null = null;
  if (hireling !== undefined && hireling.expPerLevel > 0) {
    level = 1;
    while (level < 200 && hireling.expPerLevel * (level + 1) ** 2 * (level + 2) <= merc.experience) level++;
  }
  return {
    typeId: merc.typeId,
    name: hireling?.name ?? null,
    subtype: hireling?.subtype ?? null,
    act: hireling?.act ?? null,
    difficulty: hireling?.difficulty ?? null,
    experience: merc.experience,
    level,
    dead: merc.dead,
  };
}

function facts(character: CharacterFile, data: SheetData, c: Computed): SheetFacts {
  const base = (name: keyof SheetData['stat']) => sumStat(c.base, data.stat[name]);
  const experience = data.bundle.experience;
  const statNames = data.bundle.statNames;
  const nameOf = (id: number) => statNames.at(id) ?? '';
  const activeStats: StatMap = new Map();
  for (const contribution of c.fixed) if (contribution.kind === 'item') mergeInto(activeStats, contribution.stats);
  const tiers = (pattern: RegExp) => {
    let highest: number | null = null;
    for (const [id, inner] of activeStats) {
      const match = pattern.exec(nameOf(id));
      if (match !== null && [...inner.values()].some((amount) => amount > 0)) highest = Math.max(highest ?? 0, Number(match[1]));
    }
    return highest;
  };
  const killLedgerBosses = [...activeStats.keys()]
    .map(nameOf)
    .filter((name) => name.startsWith('kill_ledger_') && !/^kill_ledger_tier_\d+$/.test(name))
    .map((name) => name.slice('kill_ledger_'.length))
    .sort();
  const quests = character.quests?.difficulties;
  return {
    saveDifficulty: character.progress.difficulty,
    act: character.progress.act,
    completedDifficulties: quests?.filter((difficulty) => difficulty.completed).length ?? 0,
    level: character.level,
    experience: base('experience'),
    experienceNext: character.level < experience.length - 1 ? (experience.at(character.level) ?? null) : null,
    gold: base('gold'),
    goldStash: base('goldbank'),
    statPoints: base('statpts'),
    skillPoints: base('newskills'),
    kills: base('kill_base'),
    respecPoints: base('respecpoints'),
    relicsLearned: base('relic_of_knowledge'),
    specializations: data.bundle.specializations.map((tree) => ({
      slug: tree.slug,
      name: tree.name,
      ranks: tree.stats.filter((id) => sumStat(c.base, id) > 0).length,
    })),
    killLedgerTier: tiers(/^kill_ledger_tier_(\d+)$/),
    killLedgerBosses,
    ascendancyTier: tiers(/^ascendancy_tier_(\d+)$/),
    resistScrolls: [quests?.[0]?.resistScroll ?? false, quests?.[1]?.resistScroll ?? false, quests?.[2]?.resistScroll ?? false],
    mercenary: mercenaryFacts(character, data),
  };
}

function skillLevelList(data: SheetData, c: Computed): SkillLevel[] {
  return (
    [...c.levels.byId.values()]
      // Attack, Kick, Throw … (level 1 for everyone) only when something raises them
      .filter((state) => state.hard > 0 || Object.keys(state.bonus).length > 0)
      .sort((a, b) => a.id - b.id)
      .map((state) => {
        const cls = data.skill(state.id)?.cls;
        return {
          skillId: state.id,
          name: data.skillName(state.id),
          ...(cls === undefined ? {} : { cls }),
          hard: state.hard,
          level: state.level,
          bonus: state.bonus,
          status: 'verified' as const,
        };
      })
  );
}

function warningsOf(data: SheetData, c: Computed, attributes: CharacterSheet['attributes']): string[] {
  const warnings = [...c.setup.warnings];
  for (const entry of c.setup.active) {
    const need = itemRequirements(entry.item, data);
    // A requirement of 0 is met whatever the attribute (a negative strength from items included)
    if ((need.str > 0 && need.str > attributes.strength.value) || (need.dex > 0 && need.dex > attributes.dexterity.value))
      warnings.push(
        `${entry.item.code} (${entry.where}) needs ${String(need.str)} strength / ${String(need.dex)} dexterity: the game may not count it`
      );
  }
  if (!c.converged) warnings.push('Passive and aura values did not settle; the numbers are from the last pass');
  for (const id of c.skippedBuffs)
    warnings.push(
      `Buff ${data.skillName(id)} not counted: ${data.skill(id) === undefined ? 'no stat data for the skill' : 'the character does not have it (give a level)'}`
    );
  for (const { skill, label } of c.unknownAuras)
    warnings.push(
      `Item aura ${data.skillName(skill)} (skill ${String(skill)}, ${label}) not counted: no data for the skill (a newer ESR?)`
    );
  warnings.push(...c.buffNotes);
  for (const what of [...c.unsupported].sort()) warnings.push(`Formula not evaluated: ${what}`);
  const known = new Set(data.text.defs.flatMap((def, id) => (def === undefined ? [] : [id])));
  const unknown = new Set<number>();
  for (const contribution of c.fixed)
    for (const id of contribution.stats.keys()) if (!known.has(id) && data.bundle.statNames.at(id) === undefined) unknown.add(id);
  if (unknown.size > 0) warnings.push(`Unknown stat ids: ${[...unknown].join(', ')}`);
  // Op stats onto a sheet stat that the engine does not apply where they sit (op 11 totals, op 9 vitality_hidden2, an
  // item defense stat outside an item); a buff's are in its own note above
  const sources = [...c.fixed, ...c.dynamic].filter((contribution) => contribution.kind !== 'buff');
  for (const [op, amount] of unappliedOps(data, sources, consumedStats(data))) {
    const targets = op.targets.map((id) => data.statName(id));
    warnings.push(`${data.statName(op.id)} (${String(amount)}${op.op === 11 ? '%' : ''}) on ${targets.join(', ')} is not applied`);
  }
  return warnings;
}

function sheetOf(character: CharacterFile, data: SheetData, c: Computed, difficulty: DifficultyIndex): CharacterSheet {
  const { stat } = data;
  const attributes = {
    strength: attribute(data, c, 'strength'),
    dexterity: attribute(data, c, 'dexterity'),
    vitality: attribute(data, c, 'vitality'),
    energy: attribute(data, c, 'energy'),
  };
  const dexterity = attributes.dexterity.value;
  const mainHand = c.setup.mainHand;
  const weaponSpeed = mainHand === null ? 0 : (entryOf(data.bundle.weaponSpeed, mainHand.item.code) ?? 0);
  const armourSpeed = c.setup.active
    .filter((entry) => entry.item.location.kind === 'equipped' && !Object.hasOwn(data.bundle.weaponSpeed, entry.item.code))
    .reduce((sum, entry) => sum + (entryOf(data.bundle.armor, entry.item.code)?.speed ?? 0), 0);
  const attackRate = total(c, stat.attackrate);
  const velocity = total(c, stat.velocitypercent);
  const cap = data.bundle.rules.dodgeCap;
  const capped = (name: 'passive_dodge' | 'passive_avoid' | 'passive_evade', limit: number | undefined): SheetValue => {
    const raw = plain(data, c, name);
    if (limit === undefined || raw.value <= limit) return raw;
    return {
      ...raw,
      value: limit,
      sources: [...raw.sources, { kind: 'cap', label: `Capped at ${String(limit)}`, value: limit - raw.value }],
      status: 'inferred',
    };
  };
  const off = c.setup.offHand;
  const local = c.setup.offHandLocal;
  // The off-hand weapon's own per-level stats, pooled with the character's like its to-hit (INFERRED alike)
  const offPerLevel = (name: string): number => {
    const id = data.statId(name);
    if (id === undefined) return 0;
    const shift = data.op(id)?.param ?? 3;
    const at = (amount: number) => Math.floor((amount * character.level) / 2 ** shift);
    const main = sumStat(c.derived.total, id);
    return at(main + sumStat(local, id)) - at(main);
  };
  return {
    v: 1,
    name: character.name,
    classId: character.classId,
    level: character.level,
    difficulty,
    weaponSet: c.setup.weaponSet,
    attributes,
    life: pool(data, c, POOLS[0], 'verified'),
    mana: pool(data, c, POOLS[1], 'verified'),
    stamina: pool(data, c, POOLS[2], 'verified'),
    defense: defense(character, data, c, dexterity),
    resists: {
      fire: resist(data, c, 'fireresist', 'maxfireresist', difficulty),
      cold: resist(data, c, 'coldresist', 'maxcoldresist', difficulty),
      lightning: resist(data, c, 'lightresist', 'maxlightresist', difficulty),
      poison: resist(data, c, 'poisonresist', 'maxpoisonresist', difficulty),
      magic: resist(data, c, 'magicresist', 'maxmagicresist', difficulty),
      physical: physicalResist(data, c),
    },
    damageReduction: plain(data, c, 'normal_damage_reduction'),
    magicDamageReduction: plain(data, c, 'magic_damage_reduction'),
    absorb: {
      firePercent: plain(data, c, 'item_absorbfire_percent'),
      coldPercent: plain(data, c, 'item_absorbcold_percent'),
      lightningPercent: plain(data, c, 'item_absorblight_percent'),
      magicPercent: plain(data, c, 'item_absorbmagic_percent'),
      fire: plain(data, c, 'item_absorbfire'),
      cold: plain(data, c, 'item_absorbcold'),
      lightning: plain(data, c, 'item_absorblight'),
      magic: plain(data, c, 'item_absorbmagic', 'inferred'),
    },
    speed: {
      attack: plain(data, c, 'item_fasterattackrate'),
      run: plain(data, c, 'item_fastermovevelocity'),
      hitRecovery: plain(data, c, 'item_fastergethitrate'),
      block: plain(data, c, 'item_fasterblockrate'),
      cast: plain(data, c, 'item_fastercastrate'),
      baseAttack: value(
        100 - weaponSpeed + attackRate,
        [
          { kind: 'class', label: 'Base', value: 100 },
          ...(mainHand === null
            ? []
            : [{ kind: 'item' as const, label: 'Main-hand weapon speed', value: -weaponSpeed, item: mainHand.index }]),
          ...sourcesOf(c, [stat.attackrate]),
        ],
        'verified'
      ),
      baseRunWalk: value(
        100 - armourSpeed + velocity,
        [
          { kind: 'class', label: 'Base', value: 100 },
          { kind: 'item', label: 'Worn armour speed', value: -armourSpeed },
          ...sourcesOf(c, [stat.velocitypercent]),
        ],
        'verified'
      ),
    },
    attackRating: attackRatings(character, data, c, dexterity),
    skills: {
      all: plain(data, c, 'item_allskills'),
      cls: value(getStat(c.derived.total, stat.item_addclassskills, character.classId), [], 'verified'),
      levels: skillLevelList(data, c),
    },
    defenseChances: {
      dodge: capped('passive_dodge', cap?.dodge),
      avoid: capped('passive_avoid', cap?.avoid),
      evade: capped('passive_evade', cap?.evade),
    },
    offense: {
      deadlyStrike: plain(data, c, 'item_deadlystrike'),
      crushingBlow: plain(data, c, 'item_crushingblow'),
      openWounds: plain(data, c, 'item_openwounds', 'inferred'),
      targetDefense: plain(data, c, 'item_fractionaltargetac'),
      ignoreTargetDefense: plain(data, c, 'item_ignoretargetac'),
      offHand:
        off === null
          ? null
          : {
              item: off.index,
              attackSpeed: sumStat(local, stat.item_fasterattackrate) + offPerLevel('item_fasterattackrate_perlevel'),
              deadlyStrike: sumStat(local, stat.item_deadlystrike) + offPerLevel('item_deadlystrike_perlevel'),
              crushingBlow: sumStat(local, stat.item_crushingblow) + offPerLevel('item_crushingblow_perlevel'),
              targetDefense: sumStat(local, stat.item_fractionaltargetac),
              status: 'verified',
            },
    },
    leech: { life: plain(data, c, 'lifedrainmindam'), mana: plain(data, c, 'manadrainmindam') },
    regen: { life: plain(data, c, 'hpregen'), mana: plain(data, c, 'manarecoverybonus') },
    find: { magic: plain(data, c, 'item_magicbonus'), gold: plain(data, c, 'item_goldbonus') },
    block: block(character, data, c, dexterity),
    facts: facts(character, data, c),
    buffs: c.buffs,
    warnings: warningsOf(data, c, attributes),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** An array entry's identity: its skill (and hand) when it has one (skill levels, hand lines), else its position */
function entryKey(entry: unknown, index: number): string {
  if (!isRecord(entry) || typeof entry.skillId !== 'number') return `#${String(index)}`;
  return `${String(entry.skillId)}:${typeof entry.hand === 'string' ? entry.hand : ''}`;
}

/** Deep equality of two sheet parts, `status` left out (every number, source and label compared) */
function sameData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((entry, i) => sameData(entry, b[i]));
  if (isRecord(a)) {
    if (!isRecord(b)) return false;
    const keys = (record: Record<string, unknown>) => Object.keys(record).filter((key) => key !== 'status');
    const own = keys(a);
    return own.length === keys(b).length && own.every((key) => Object.hasOwn(b, key) && sameData(a[key], b[key]));
  }
  return Object.is(a, b);
}

/**
 * Sets `status` to unverified on every object of `buffed` that has a status and differs anywhere (values, sources, caps,
 * levels …) from the same object of the unbuffed sheet, or has no counterpart there. Array entries are matched by skill
 * (and hand), so a line that exists only when buffed is flagged. Facts, buffs and warnings are not compared.
 */
function markBuffed(buffed: unknown, unbuffed: unknown): void {
  if (Array.isArray(buffed)) {
    const others = Array.isArray(unbuffed) ? unbuffed : [];
    const byKey = new Map(others.map((entry: unknown, i) => [entryKey(entry, i), entry]));
    buffed.forEach((entry: unknown, i) => {
      markBuffed(entry, byKey.get(entryKey(entry, i)));
    });
    return;
  }
  if (!isRecord(buffed)) return;
  const other = isRecord(unbuffed) ? unbuffed : undefined;
  if (typeof buffed.status === 'string' && !sameData(buffed, other)) buffed.status = 'unverified';
  for (const [key, entry] of Object.entries(buffed))
    if (key !== 'facts' && key !== 'buffs' && key !== 'warnings') markBuffed(entry, other?.[key]);
}

/**
 * The character's computed sheet for its active weapon set. Without `options.buffs` it is the unbuffed sheet (cast
 * buffs, shrines, elixirs and conditional states are not counted); with buffs, every object with a status in which they
 * change anything is `unverified`. One instance of a skill counts (the highest level of its selections and an item aura
 * of the same skill) and one buff per exclusive group (exclusiveGroupOf: the last selected); warnings say what was left.
 */
export function computeCharacterSheet(character: CharacterFile, data: SheetData, options: SheetOptions = {}): CharacterSheet {
  const difficulty = options.difficulty ?? character.progress.difficulty;
  const buffs = options.buffs ?? [];
  const sheet = sheetOf(character, data, compute(character, data, buffs), difficulty);
  if (buffs.length > 0) markBuffed(sheet, sheetOf(character, data, compute(character, data, []), difficulty));
  return sheet;
}

/** Internal access for listAvailableBuffs (buffs.ts) */
export function computeForBuffs(character: CharacterFile, data: SheetData): { levels: SkillLevels; setup: ItemSetup } {
  const c = compute(character, data, []);
  return { levels: c.levels, setup: c.setup };
}
