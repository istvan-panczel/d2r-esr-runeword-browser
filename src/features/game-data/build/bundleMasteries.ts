/**
 * masteries.json: ESR's weapon mastery specialisations (docs/weapon_mastery.html).
 *
 * - cubemain.txt (ESR 3.3): every "Apply Awaken Weapon Mastery Token" row sets one `weapon-mastery-<weapon>` property per
 *   specialisation to 1 (input 1 the base or item type, input 2 the awakened token, then the ingredients); the
 *   "Remove Weapon Mastery" rows (input 1 any weapon) set it to -1. Rows are grouped by that property, not by their
 *   descriptions. Apply rows that take any weapon (the Blacksmith perk "True Master") give no bases; the legacy
 *   "Remove Awaken" rows (the 3.2 `weapon-mastery` stat, for weapons mastered before 3.3) are left out.
 * - The awakened token's description string (`<token>desc`, item-modifiers.json) holds the effects. Item descriptions
 *   render bottom-up, so its lines are in reverse display order; each block reads "Transmute this with a <weapon>
 *   variant, a <ingredient>" / "and an Anvil Stone …" then, after each blank line, a skills line (coloured ÿc@ in the
 *   game; the string table strips colours) and its effect lines.
 * - The skills line names skills ("Strafe", "Poison, Immolation, Freezing, Lightning Arrow") or a group ("Curses",
 *   "Sorceress Exclusives"); `resolveEffectSkills` maps both to skill ids, with the few groups the data cannot name in
 *   GROUP_RULES.
 */
import type {
  BaseItem,
  ClassCode,
  ClassInfo,
  ItemTypeInfo,
  MasteriesBundle,
  MasteryEffect,
  MasteryInput,
  SkillDetail,
  WeaponMastery,
} from '../engine/schema.ts';
import type { CubeRow, ModRenderer } from './cube/cubeRows.ts';
import type { Perk, PerkCheck } from './cube/perks.ts';
import type { TsvTable } from './tsv.ts';

/** The cube properties that set a specialisation's stat (`weapon-mastery-stag-bow` → `weapon_mastery_stag_bow`) */
const MASTERY_PROPERTY = /^weapon-mastery-./;

/** The item type of "any weapon" (the True Master and Remove Weapon Mastery rows take it) */
const ANY_WEAPON = 'weap';

// --- token descriptions ---------------------------------------------------------------------------------------------

/** One "Transmute this with …" block of an awakened token's description, in display order */
export interface DescriptionBlock {
  /** The weapon as the recipe line names it ("Stag Bow", "Orb") */
  weapon: string;
  /** Ingredient names of the recipe lines, Anvil Stone included */
  ingredients: string[];
  effects: { heading: string; lines: string[] }[];
}

const COLOUR = /ÿc./g;
const RECIPE_LINE = /^Transmute this with an? (.+?)(?: variant)?, (.+)$/;
const ANVIL_LINE = /^and an? (.+?) to empower it/;

const withoutArticle = (text: string) => text.trim().replace(/^an? /, '');

/**
 * The blocks of an awakened token's description: lines reversed (bottom-up rendering), colour codes stripped; inside a
 * block the first line after a blank line is a skills line, the lines under it its effect.
 */
export function parseMasteryDescription(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let effect: { heading: string; lines: string[] } | null = null;
  for (const raw of text.split('\n').reverse()) {
    const line = raw.replace(COLOUR, '').trim();
    const block = blocks.at(-1);
    const recipe = RECIPE_LINE.exec(line);
    if (recipe !== null) {
      blocks.push({ weapon: recipe[1], ingredients: recipe[2].split(',').map(withoutArticle).filter(Boolean), effects: [] });
      effect = null;
      continue;
    }
    if (block === undefined) continue;
    const anvil = ANVIL_LINE.exec(line);
    if (anvil !== null && block.effects.length === 0) {
      block.ingredients.push(withoutArticle(anvil[1]));
      continue;
    }
    if (line === '') {
      effect = null;
      continue;
    }
    if (effect === null) {
      effect = { heading: line, lines: [] };
      block.effects.push(effect);
      continue;
    }
    effect.lines.push(line);
  }
  return blocks;
}

/**
 * Wrapped effect lines as sentences: a line starting with a capital letter starts a new one, any other line (lower
 * case, a number) continues the previous; each gets a closing full stop.
 */
export function joinEffectLines(lines: readonly string[]): string[] {
  const sentences: string[] = [];
  for (const line of lines) {
    const last = sentences.at(-1);
    if (last !== undefined && !/^[A-Z]/.test(line)) sentences[sentences.length - 1] = `${last} ${line}`;
    else sentences.push(line);
  }
  return sentences.map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));
}

// --- skills ---------------------------------------------------------------------------------------------------------

/** A class skill with the skills.txt columns the group rules read */
export interface MasterySkill {
  id: string;
  /** Display name (skilldetails.json) */
  name: string;
  cls: ClassCode;
  /** Skill tab 1..3 */
  page: number;
  reqLevel: number;
  /** skills.txt EType (`fire`, `mag` …), '' when none */
  etype: string;
  /** skills.txt aurastate */
  aurastate: string;
  /** skills.txt passive / aura */
  passive: boolean;
  /** skills.txt itypea1 set: the skill needs a weapon type (melee and weapon skills) */
  weaponSkill: boolean;
  /** The specialisation stats (`weapon_mastery_orb_1` …) the skills.txt formulas of the skill read */
  masteryStats: string[];
}

const MASTERY_STAT_READ = /stat\('(weapon_mastery_\w+)'/g;

/** Class skills in skilldetails.json order (class, tab, row, column) with their skills.txt columns */
export function readMasterySkills(skills: TsvTable, details: readonly SkillDetail[]): MasterySkill[] {
  const rows = new Map(skills.rows.map((row) => [row.str('skill'), row]));
  return details.flatMap((detail) => {
    const row = rows.get(detail.id);
    if (detail.cls === null || detail.page === null || row === undefined) return [];
    return [
      {
        id: detail.id,
        name: detail.name,
        cls: detail.cls,
        page: detail.page,
        reqLevel: detail.reqLevel,
        etype: row.str('EType'),
        aurastate: row.str('aurastate'),
        passive: detail.type !== undefined,
        weaponSkill: row.str('itypea1') !== '',
        masteryStats: [
          ...new Set(skills.columns.flatMap((column) => [...row.str(column).matchAll(MASTERY_STAT_READ)].map((match) => match[1]))),
        ],
      },
    ];
  });
}

/** What a group rule sees: the skill and the effect it is tested against */
interface GroupContext {
  readonly text: string;
  /** The specialisation's stat (`weapon_mastery_orb_1`); undefined when unknown */
  readonly stat: string | undefined;
}

/**
 * Skills lines that name a group instead of skills, and how the data picks its members. Keyed by the skills line as
 * the token description writes it. Lines that are a class tab's name ("Curses") and skills named in the effect text
 * ("Hellfire Lance, Flame Wave …" under "Fire and Magic Skills") need no entry.
 */
const GROUP_RULES: Readonly<Record<string, (skill: MasterySkill, context: GroupContext) => boolean>> = {
  // Wretched Scythe, "Your Necromancer's direct damage magic spells": magic damage (EType mag), cast rather than swung
  // (no itypea1 weapon requirement: Reap Souls is a melee skill), not a passive (Soul Reaper / Bone Mastery). Corpse
  // Explosion is left out: its damage is magic only when "50% or more of the damage is converted to magic" (its
  // description), so whether the repeat applies is unclear
  'Magic Spells': (skill) => skill.etype === 'mag' && !skill.weaponSkill && !skill.passive && skill.id !== 'Corpse Explosion',
  // Orb + Chipped Ruby (ESR 3.3), "Triples the cooldown of your direct damage dealing spells and adds a 2 second
  // cooldown to Hydra": the skills whose skills.txt formulas read the specialisation's stat (`weapon_mastery_orb_1`
  // triples their cooldown, calc6; Lightning Hydra's cooldown and Aegis line)
  Spells: (skill, { stat }) => stat !== undefined && skill.masteryStats.includes(stat),
  // Orb + Chipped Skull: ESR's exclusive skills (Omnipotence: "Only one exclusive skill can be active at one time")
  // share the `exclusiveskill` aura state
  'Sorceress Exclusives': (skill) => skill.aurastate === 'exclusiveskill',
  // Claw: the charge-up skills carry a progressive_* aura state; elemental = fire, cold or lightning damage (Tiger
  // Strike and Execute have none, Dragon Fury is stun)
  'Elemental Charge-up Skills': (skill) => skill.aurastate.startsWith('progressive') && ['fire', 'cold', 'ltng'].includes(skill.etype),
};

/**
 * Skills an effect names in lower case, which the (case-sensitive) scan of the effect text cannot tell from ordinary
 * words ("converging nova" is not the Barbarian's Nova). Keyed by the skills line.
 */
const LOWER_CASE_MENTIONS: Readonly<Record<string, readonly string[]>> = {
  // Oak Branch: "Double the amount of hits of all pet skills and the damage dealt by contagion"
  'Wolves, Ravens, Grizzly': ['Contagion'],
};

/** "Wolves" → "Wolf", "Ravens" → "Raven" (enough for the words the skills lines use) */
function singular(word: string): string {
  if (word.endsWith('ves')) return `${word.slice(0, -3)}f`;
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (word: string, flags = '') => new RegExp(`(?<![\\w'])${escape(word)}(?![\\w'])`, flags);
const same = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'accent' }) === 0;

/** One part of a skills line: a skill by name or id, the shared last word added ("Poison" + "Arrow"), or a word */
function resolvePart(part: string, suffix: string | null, skills: readonly MasterySkill[]): MasterySkill[] {
  const named = (name: string) => skills.filter((skill) => same(skill.name, name) || same(skill.id, name));
  const exact = named(part);
  if (exact.length > 0) return exact;
  if (suffix !== null) {
    const suffixed = named(`${part} ${suffix}`);
    if (suffixed.length > 0) return suffixed;
  }
  // "Wolves" → Summon Spirit Wolf and Summon Dire Wolf (a whole word: not Werewolf)
  if (/\s/.test(part)) return [];
  const word = wholeWord(singular(part), 'i');
  return skills.filter((skill) => word.test(skill.name));
}

/**
 * The class skills an effect is about: every part of the skills line resolved to skills (else the group's rule, or the
 * class tab of that name), plus the class skills the effect text names. In skill tree order.
 */
export function resolveEffectSkills(
  heading: string,
  text: readonly string[],
  classSkills: readonly MasterySkill[],
  tabs: readonly string[],
  stat?: string
): { skills: string[]; how: 'names' | 'rule' | 'tab' | 'text' | 'none' } {
  const parts = heading.split(/\s*,\s*|\s+and\s+/).filter(Boolean);
  const resolved = parts.map((part, i) => {
    // The shared word of a list ("Arrow" of "Poison, Immolation, Freezing, Lightning Arrow"): the last word of a later part
    const later = parts.slice(i + 1).find((other) => /\s/.test(other));
    return resolvePart(part, later === undefined ? null : (later.split(/\s+/).at(-1) ?? null), classSkills);
  });
  const joined = text.join(' ');
  let picked: MasterySkill[];
  let how: 'names' | 'rule' | 'tab' | 'text' | 'none';
  if (resolved.every((skills) => skills.length > 0)) {
    picked = resolved.flat();
    how = 'names';
  } else if (heading in GROUP_RULES) {
    const rule = GROUP_RULES[heading];
    picked = classSkills.filter((skill) => rule(skill, { text: joined, stat }));
    how = 'rule';
  } else {
    const tab = tabs.findIndex((name) => same(name, heading));
    picked = tab === -1 ? [] : classSkills.filter((skill) => skill.page === tab + 1);
    how = tab === -1 ? 'none' : 'tab';
  }
  // Skills the effect text names ("Miasma Bolt, Miasma Chains and Abyss deal …"), by name or id, as capitalised
  const extra = LOWER_CASE_MENTIONS[heading] ?? [];
  const mentioned = classSkills.filter(
    (skill) => [skill.name, skill.id].some((name) => wholeWord(name).test(joined)) || extra.includes(skill.id)
  );
  if (how === 'none' && mentioned.length > 0) how = 'text';
  const ids = new Set([...picked, ...mentioned].map((skill) => skill.id));
  return { skills: classSkills.filter((skill) => ids.has(skill.id)).map((skill) => skill.id), how };
}

// --- cube rows ------------------------------------------------------------------------------------------------------

/** "wms,qty=3" → { code: 'wms', qty: 3 }; "am1,nru" → { code: 'am1' } */
export function readInput(cell: string): MasteryInput {
  const [code, ...qualifiers] = cell.split(',').map((part) => part.trim());
  const qty = qualifiers.find((part) => part.startsWith('qty='));
  const count = qty === undefined ? 1 : Number(qty.slice(4));
  return count > 1 ? { code, qty: count } : { code };
}

/** The specialisation property a row sets (`apply`) or clears (`remove`); null for other rows */
function masteryMod(row: CubeRow): { property: string; apply: boolean } | null {
  const mod = row.outputs[0]?.mods.find((entry) => MASTERY_PROPERTY.test(entry.mod));
  return mod === undefined || mod.min !== mod.max || mod.min === 0 ? null : { property: mod.mod, apply: mod.min > 0 };
}

/**
 * Mods the stat renderer gives no text (the stat has no descfunc, so the game shows no line either), by property: what
 * the panels say instead. Any other such mod is shown by its property code; every one is a `masteries:` warning.
 */
const HIDDEN_MOD_LABELS: Readonly<Partial<Record<string, string>>> = {
  // Wretched Scythe: total_magic_resist -100, what makes the text's "Your magic resist is always 0"
  'total-magic-resist': '% Magic Resist (no item line; why your magic resist is always 0)',
};

const TIER_ORDER: readonly BaseItem['tier'][] = ['normal', 'exceptional', 'elite', 'mythical'];

const sameInputs = (a: readonly MasteryInput[], b: readonly MasteryInput[]) => JSON.stringify(a) === JSON.stringify(b);

/** "Apply Awaken Weapon Mastery Token - Orb 1" → "Orb" */
function labelOf(row: CubeRow): string {
  return row.description.replace(/^.* - /, '').replace(/\s+\d+$/, '');
}

export interface MasteryBuildInput {
  cube: readonly CubeRow[];
  /** Display name of an item code or item type code */
  nameOf: (code: string) => string;
  /** Every misc / armor / weapons.txt code (bases that do not spawn, such as ESR's LoD copies, are not in `bases`) */
  itemCodes: ReadonlySet<string>;
  bases: readonly BaseItem[];
  types: readonly ItemTypeInfo[];
  classes: readonly ClassInfo[];
  strings: ReadonlyMap<string, string>;
  skills: readonly MasterySkill[];
  /** Renders the apply rows' other mods */
  renderMods: ModRenderer;
  /** The stat a specialisation property sets (properties.txt `stat1`: `weapon_mastery_orb_1`); omitted: unknown */
  statOf?: (property: string) => string | undefined;
  /** The specialisation perks a cube row needs (cube/perks.ts); omitted: none */
  perkChecks?: (row: CubeRow) => readonly PerkCheck[];
}

/** Pairs each specialisation of a token with its description block, by the ingredients the recipe lines name */
function pairBlocks(
  masteries: readonly WeaponMastery[],
  blocks: readonly DescriptionBlock[],
  nameOf: (code: string) => string
): Map<string, DescriptionBlock> {
  const pairs = new Map<string, DescriptionBlock>();
  if (masteries.length === 1 && blocks.length === 1) {
    pairs.set(masteries[0].property, blocks[0]);
    return pairs;
  }
  for (const block of blocks) {
    const named = new Set(block.ingredients.map((name) => name.toLowerCase()));
    const scored = masteries
      .filter((mastery) => !pairs.has(mastery.property))
      .map((mastery) => ({ mastery, score: mastery.inputs.filter((input) => named.has(nameOf(input.code).toLowerCase())).length }))
      .sort((a, b) => b.score - a.score);
    const best = scored.at(0);
    const next = scored.at(1);
    if (best === undefined || best.score === 0 || (next !== undefined && next.score === best.score)) continue;
    pairs.set(best.mastery.property, block);
  }
  return pairs;
}

/** Names that differ between a block's recipe lines and the cube row (the game strings are shown, the rows decide) */
function recipeMismatches(mastery: WeaponMastery, block: DescriptionBlock, nameOf: (code: string) => string): string[] {
  const issues: string[] = [];
  if (!same(block.weapon, mastery.label)) issues.push(`names the weapon "${block.weapon}", the rows take ${mastery.label}`);
  const rowNames = mastery.inputs.map((input) => nameOf(input.code));
  const named = new Set(block.ingredients.map((name) => name.toLowerCase()));
  const missing = rowNames.filter((name) => !named.has(name.toLowerCase()));
  const extra = block.ingredients.filter((name) => !rowNames.some((rowName) => same(rowName, name)));
  if (missing.length > 0 || extra.length > 0) {
    issues.push(`names ${block.ingredients.join(', ')}; the rows take ${rowNames.join(', ')}`);
  }
  return issues;
}

export function buildMasteriesBundle(input: MasteryBuildInput): { bundle: MasteriesBundle; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(`masteries: ${message}`);
  const { nameOf } = input;
  const baseByCode = new Map(input.bases.map((base) => [base.code, base]));
  const typeByCode = new Map(input.types.map((type) => [type.code, type]));
  const isOfType = (base: BaseItem, code: string) =>
    [base.type, base.type2].some((own) => own !== null && (typeByCode.get(own)?.ancestors ?? [own]).includes(code));
  /** The bases an input-1 cell takes: the base itself, or every base of the item type */
  const basesOf = (code: string): BaseItem[] => {
    const own = baseByCode.get(code);
    if (own !== undefined) return [own];
    return typeByCode.has(code) ? input.bases.filter((base) => isOfType(base, code)) : [];
  };

  const applyRows = new Map<string, CubeRow[]>();
  const removeRows = new Map<string, CubeRow[]>();
  let anyWeaponPerk: Perk | undefined;
  for (const row of input.cube) {
    const mod = masteryMod(row);
    if (mod === null) continue;
    // "True Master - Apply …": any weapon takes any specialisation with the perk; not one class's bases
    if (mod.apply && readInput(row.inputs[0] ?? '').code === ANY_WEAPON) {
      anyWeaponPerk ??= input.perkChecks?.(row).find((check) => check.has)?.perk;
      continue;
    }
    const target = mod.apply ? applyRows : removeRows;
    target.set(mod.property, [...(target.get(mod.property) ?? []), row]);
  }

  const masteries: WeaponMastery[] = [];
  // In cubemain order (the specialisations' old stat values 1 … 60 followed it)
  for (const [property, rows] of applyRows) {
    const [first] = rows;
    const token = readInput(first.inputs[1] ?? '').code;
    const inputs = first.inputs.slice(2).map(readInput);
    const weaponCodes = rows.map((row) => readInput(row.inputs[0] ?? '').code);
    for (const row of rows) {
      if (readInput(row.inputs[1] ?? '').code !== token || !sameInputs(row.inputs.slice(2).map(readInput), inputs)) {
        warn(`cubemain line ${String(row.line)} (${property}) takes other inputs than line ${String(first.line)}`);
      }
    }
    const bases = new Set(weaponCodes.flatMap((code) => basesOf(code).map((base) => base.code)));
    for (const code of weaponCodes) {
      if (basesOf(code).length === 0 && !input.itemCodes.has(code)) warn(`${property}: unknown item "${code}"`);
    }
    // Normal, exceptional, elite, then mythical (bases.json order within a tier)
    const ordered = input.bases
      .filter((base) => bases.has(base.code))
      .map((base, index) => ({ base, index }))
      .sort((a, b) => TIER_ORDER.indexOf(a.base.tier) - TIER_ORDER.indexOf(b.base.tier) || a.index - b.index)
      .map(({ base }) => base);
    const classes = new Set(ordered.map((base) => base.cls));
    const cls = ordered.at(0)?.cls ?? null;
    if (classes.size !== 1 || cls === null) {
      warn(`${property} (${first.description}): its bases are not of one class; left out`);
      continue;
    }

    const remove = removeRows.get(property) ?? [];
    const removable = new Set(remove.flatMap((row) => basesOf(readInput(row.inputs[0] ?? '').code).map((base) => base.code)));
    for (const row of remove) {
      const code = readInput(row.inputs[0] ?? '').code;
      if (!basesOf(code).some((base) => bases.has(base.code)) && !weaponCodes.includes(code)) {
        warn(`cubemain line ${String(row.line)} "${row.description}" takes "${code}", which cannot get this mastery`);
      }
    }
    const noRemove = ordered.filter((base) => !removable.has(base.code)).map((base) => base.code);
    const typeCode = weaponCodes.every((code) => typeByCode.has(code) && !baseByCode.has(code)) ? weaponCodes[0] : undefined;
    // One mod at a time: a mod without item text is shown anyway (and warned about), not silently left out
    const mods = (first.outputs[0]?.mods ?? [])
      .filter((mod) => !MASTERY_PROPERTY.test(mod.mod))
      .flatMap((mod) => {
        const lines = input.renderMods([mod]);
        if (lines.length > 0) return lines;
        const amount = mod.min === mod.max ? String(mod.min) : `${String(mod.min)} to ${String(mod.max)}`;
        const label = HIDDEN_MOD_LABELS[mod.mod];
        const text = label === undefined ? `${mod.mod} ${amount}` : `${amount}${label}`;
        warn(`${labelOf(first)} (${property}): mod ${mod.mod} ${amount} has no item text; shown as "${text}"`);
        return [text];
      });
    masteries.push({
      property,
      label: labelOf(first),
      cls,
      ...(typeCode === undefined ? {} : { type: typeCode }),
      bases: ordered.map((base) => base.code),
      token,
      inputs,
      remove: remove.length === 0 ? [] : remove[0].inputs.slice(1).map(readInput),
      ...(noRemove.length === 0 ? {} : { noRemove }),
      effects: [],
      ...(mods.length === 0 ? {} : { mods }),
    });
    if (remove.length === 0) warn(`${property} (${labelOf(first)}) has no remove row`);
    else if (noRemove.length > 0) warn(`${labelOf(first)} (${property}): no remove row takes ${noRemove.join(', ')}`);
  }

  // Effects: each token's description, block by block
  const tabsOf = new Map(input.classes.map((cls) => [cls.code, cls.tabs]));
  const skillNames: Record<string, string> = {};
  for (const token of new Set(masteries.map((mastery) => mastery.token))) {
    const own = masteries.filter((mastery) => mastery.token === token);
    const text = input.strings.get(`${token}desc`);
    if (text === undefined) {
      warn(`no "${token}desc" string; ${own.map((mastery) => mastery.label).join(', ')} without effects`);
      continue;
    }
    const blocks = parseMasteryDescription(text);
    const pairs = pairBlocks(own, blocks, nameOf);
    if (blocks.length !== own.length) warn(`${token}desc has ${String(blocks.length)} blocks for ${String(own.length)} specialisations`);
    for (const mastery of own) {
      const block = pairs.get(mastery.property);
      if (block === undefined) {
        warn(`${token}desc: no block matches ${mastery.label} (${mastery.property})`);
        continue;
      }
      for (const issue of recipeMismatches(mastery, block, nameOf)) warn(`${token}desc (${mastery.label}, ${mastery.property}) ${issue}`);
      const classSkills = input.skills.filter((skill) => skill.cls === mastery.cls);
      mastery.effects = block.effects.map((effect): MasteryEffect => {
        const sentences = joinEffectLines(effect.lines);
        const { skills } = resolveEffectSkills(
          effect.heading,
          sentences,
          classSkills,
          tabsOf.get(mastery.cls) ?? [],
          input.statOf?.(mastery.property)
        );
        if (skills.length === 0) warn(`${token}desc: "${effect.heading}" (${mastery.label}) names no ${mastery.cls} skill`);
        for (const id of skills) skillNames[id] = classSkills.find((skill) => skill.id === id)?.name ?? id;
        return { heading: effect.heading, skills, text: sentences };
      });
    }
  }

  const tokens = new Set(masteries.map((mastery) => mastery.token));
  const unawakened = input.cube.find((row) => row.inputs.length === 1 && tokens.has(readInput(row.inputs[0]).code))?.outputs[0]?.spec ?? '';
  if (unawakened === '') warn('no "Unawaken" row: the unawakened token is unknown');

  // Awaken rows: a class weapon + the unawakened token give that weapon's awakened token (output b)
  const awakenable = new Map<string, Set<string>>();
  for (const row of input.cube) {
    if (unawakened === '' || row.inputs.length !== 2 || readInput(row.inputs[1]).code !== unawakened) continue;
    const token = row.outputs.map((output) => output.spec).find((spec) => tokens.has(spec));
    if (token === undefined) continue;
    const code = readInput(row.inputs[0]).code;
    const taken = basesOf(code);
    const own = masteries.filter((mastery) => mastery.token === token);
    // A non-spawnable copy (LoD q.., some mythicals) is fine; a base of another family is a data slip
    const fits = taken.some((base) => own.some((mastery) => mastery.bases.includes(base.code)));
    if (!fits && (taken.length > 0 || !input.itemCodes.has(code))) {
      warn(`cubemain line ${String(row.line)} "${row.description}" takes "${code}", which cannot get this mastery`);
    }
    const set = awakenable.get(token) ?? new Set<string>();
    for (const base of taken) set.add(base.code);
    awakenable.set(token, set);
  }
  for (const mastery of masteries) {
    const noAwaken = mastery.bases.filter((code) => awakenable.get(mastery.token)?.has(code) !== true);
    if (noAwaken.length === 0) continue;
    mastery.noAwaken = noAwaken;
    warn(`${mastery.label} (${mastery.property}): no awaken row takes ${noAwaken.join(', ')}`);
  }
  const codes = new Set([
    unawakened,
    ...masteries.flatMap((mastery) => [
      mastery.token,
      ...mastery.inputs.map((entry) => entry.code),
      ...mastery.remove.map((entry) => entry.code),
    ]),
  ]);
  const names = Object.fromEntries(
    [...codes]
      .filter(Boolean)
      .sort()
      .map((code) => [code, nameOf(code)])
  );
  const sortedSkillNames = Object.fromEntries(Object.entries(skillNames).sort(([a], [b]) => a.localeCompare(b)));
  return {
    bundle: {
      token: unawakened,
      names,
      skillNames: sortedSkillNames,
      masteries,
      ...(anyWeaponPerk === undefined ? {} : { anyWeaponPerk }),
    },
    warnings,
  };
}
