/**
 * Public types of the computed character sheet (computeCharacterSheet). Everything is plain, serialisable data: numbers,
 * strings, arrays and objects, no class instances and no Maps. See docs/features/CHARACTER-SAVE.md ("Computed sheet").
 */
import type { DifficultyIndex } from '../../parser/types';

/**
 * How far a number is backed by in-game ground truth:
 * - `verified`: the rule reproduced the in-game character screen of the ground-truth characters
 * - `inferred`: follows from the data or the D2 rules, not compared with the game (or the inputs never occurred there)
 * - `unverified`: depends on selected buffs or "what if" entries, for which no ground truth exists yet.
 *   computeCharacterSheet sets it on every object with a `status` in which any number (sources and caps included)
 *   differs from the plain sheet (no buffs, no what-if entries)
 */
export type SheetStatus = 'verified' | 'inferred' | 'unverified';

export type SheetSourceKind =
  /** The save's `gf` value (hard points spent, quest rewards stored as base) */
  | 'base'
  /** An equipped item or an active charm: its own stats, runeword, socketed items and the set bonus lists it carries */
  | 'item'
  /** A sets.txt bonus (partial or full set); the save does not hold these */
  | 'set'
  /** The Runic Insight perk's share on a host item */
  | 'runic'
  /** Anya's Scroll of Resistance */
  | 'quest'
  /** A passive skill */
  | 'passive'
  /** An aura (or hidden passive) granted by an item */
  | 'item-aura'
  /** A selected buff */
  | 'buff'
  /** A "what if" entry the user added: a stat (as if a charm carried it) or a skill (as if an item gave it as an aura) */
  | 'what-if'
  /** Per-character-level stats, resolved at the character's level */
  | 'per-level'
  /** A percent bonus (strength %, life %, defense %, attack rating %) */
  | 'percent'
  /** Derived from an attribute (life from vitality, defense from dexterity, attack rating from dexterity) */
  | 'attribute'
  /** A class constant (charstats.txt) or a base value of the item / class */
  | 'class'
  /** The difficulty's resist penalty */
  | 'difficulty'
  /** A cap was applied (the value is the amount cut, negative) */
  | 'cap';

export interface SheetSource {
  kind: SheetSourceKind;
  /** Short English label ("Vitality above base", "Hell penalty", the item code when nothing better is known) */
  label: string;
  value: number;
  /** Index into `character.items.player` for item, runic and item-aura sources */
  item?: number;
  /** skills.txt row for passive, item-aura and buff sources */
  skill?: number;
}

export interface SheetValue {
  value: number;
  /** Where the number comes from; the values add up to `value` (fixed-point pools: before the final rounding) */
  sources: SheetSource[];
  status: SheetStatus;
  /** What is assumed or left out */
  notes?: string[];
}

export interface AttributeValue extends SheetValue {
  /** The save's base value (hard points, quest rewards) */
  base: number;
}

export interface ResistValue extends SheetValue {
  /** Sum of every source with the difficulty penalty, before the cap */
  raw: number;
  /** The cap that applies (75 + max resist, at most the ceiling; physical: the physical cap) */
  cap: number;
  /** The difficulty penalty included in `raw` (0 for magic and physical) */
  penalty: number;
}

export interface HandAttackRating {
  hand: 'left' | 'right';
  skillId: number;
  name: string;
  /** Effective skill level used for the skill's to-hit bonus */
  level: number;
  /** The skill's attack rating % (skills.txt ToHit / LevToHit / ToHitCalc) */
  skillPercent: number;
  /** Main-hand weapon line */
  mainHand: number;
  /** Second weapon line when dual wielding, else null */
  offHand: number | null;
  /** Why the skill cannot be used in the character's current form ("it needs Werewolf form"); absent when it can */
  formProblem?: string;
  status: SheetStatus;
}

export interface SkillLevel {
  skillId: number;
  name: string;
  /** Class id of a class skill; absent for other skills (item oskills) */
  cls?: number;
  hard: number;
  level: number;
  /** The bonus parts (only the non-zero ones) */
  bonus: { all?: number; cls?: number; tab?: number; single?: number; oskill?: number; buff?: number };
  /** `unverified` when selected buffs change the level (Battle Command) or the skill shows only with them */
  status?: SheetStatus;
}

export interface OffHandStats {
  /** Item index of the off-hand weapon */
  item: number;
  attackSpeed: number;
  deadlyStrike: number;
  crushingBlow: number;
  targetDefense: number;
  status?: SheetStatus;
}

export interface MercenaryFacts {
  typeId: number;
  /** hireling.txt `Hireling` ("Rogue Scout"); null for an id the data does not know */
  name: string | null;
  subtype: string | null;
  act: number | null;
  /** The difficulty the merc was hired in (0 Normal) */
  difficulty: number | null;
  experience: number;
  /** From the experience: the highest L with Exp/Lvl × L² × (L + 1) ≤ experience (INFERRED formula); null when unknown */
  level: number | null;
  dead: boolean;
}

export interface SheetFacts {
  /** The difficulty the save is in (header) and the act there */
  saveDifficulty: DifficultyIndex;
  act: number;
  /** Difficulties completed (Eve of Destruction done), from the quest words */
  completedDifficulties: number;
  level: number;
  experience: number;
  /** Experience at which the next level starts; null at the level cap */
  experienceNext: number | null;
  gold: number;
  goldStash: number;
  statPoints: number;
  skillPoints: number;
  /** gf `kill_base` (INFERRED: the character's kill counter) */
  kills: number;
  respecPoints: number;
  relicsLearned: number;
  specializations: { slug: string; name: string; ranks: number }[];
  /** Highest `kill_ledger_tier_N` on an active item; null without a Kill Ledger */
  killLedgerTier: number | null;
  /** The other `kill_ledger_*` flags set (boss kills), stat names without the prefix */
  killLedgerBosses: string[];
  /** Highest `ascendancy_tier_N` on an active item; null when none */
  ascendancyTier: number | null;
  /** Anya's Scroll of Resistance per difficulty */
  resistScrolls: [boolean, boolean, boolean];
  mercenary: MercenaryFacts | null;
}

export interface CharacterSheet {
  v: 1;
  name: string;
  classId: number;
  level: number;
  /** The difficulty the resists are computed for */
  difficulty: DifficultyIndex;
  /** Weapon set the sheet is for (the save's active one) */
  weaponSet: 1 | 2;
  attributes: { strength: AttributeValue; dexterity: AttributeValue; vitality: AttributeValue; energy: AttributeValue };
  life: SheetValue;
  mana: SheetValue;
  stamina: SheetValue;
  defense: SheetValue;
  resists: { fire: ResistValue; cold: ResistValue; lightning: ResistValue; poison: ResistValue; magic: ResistValue; physical: ResistValue };
  damageReduction: SheetValue;
  magicDamageReduction: SheetValue;
  absorb: {
    firePercent: SheetValue;
    coldPercent: SheetValue;
    lightningPercent: SheetValue;
    magicPercent: SheetValue;
    fire: SheetValue;
    cold: SheetValue;
    lightning: SheetValue;
    magic: SheetValue;
  };
  speed: {
    attack: SheetValue;
    run: SheetValue;
    hitRecovery: SheetValue;
    block: SheetValue;
    cast: SheetValue;
    /** 100 − main-hand weapon speed + attackrate */
    baseAttack: SheetValue;
    /** 100 − worn armour speed + velocitypercent */
    baseRunWalk: SheetValue;
  };
  attackRating: {
    /** Attack rating % (item_tohit_percent) */
    percent: SheetValue;
    /** Main-hand attack rating without a skill bonus */
    base: SheetValue;
    hands: HandAttackRating[];
  };
  skills: {
    all: SheetValue;
    /** +class skills of the character's own class */
    cls: SheetValue;
    levels: SkillLevel[];
  };
  defenseChances: { dodge: SheetValue; avoid: SheetValue; evade: SheetValue };
  offense: {
    deadlyStrike: SheetValue;
    crushingBlow: SheetValue;
    openWounds: SheetValue;
    /** Target defense reduced, % (item_fractionaltargetac) */
    targetDefense: SheetValue;
    /** Ignore Target's Defense (item_ignoretargetac): above 0 when an active item has it */
    ignoreTargetDefense: SheetValue;
    /** Off-hand weapon's own stats when dual wielding (not in the values above) */
    offHand: OffHandStats | null;
  };
  leech: { life: SheetValue; mana: SheetValue };
  regen: { life: SheetValue; mana: SheetValue };
  find: { magic: SheetValue; gold: SheetValue };
  /** Chance to block: only with a shield in the active set (formula INFERRED, unverified in game) */
  block: SheetValue | null;
  facts: SheetFacts;
  /** Buffs counted in this sheet (empty for the unbuffed sheet) */
  buffs: AppliedBuff[];
  /** Selected buffs the character's form does not allow (forms.ts), with why; absent when there is none */
  blockedBuffs?: { skillId: number; reason: string }[];
  /** The "what if" entries counted; absent when none were given (the character's own numbers) */
  whatIf?: AppliedWhatIf;
  /** Things the engine could not do or doubts (unknown stats, unsupported formula reads, unmet requirements) */
  warnings: string[];
}

/**
 * A buff to count: the skill, at its effective level unless `level` is given. A level-less cast skill counts at the
 * higher of its levels on the two weapon sets (AppliedBuff.castSet says when it is the other one)
 */
export interface BuffSelection {
  skillId: number;
  level?: number;
}

export type BuffKind =
  /** A skill of the character's own (hard points, +skills or an oskill) that it casts: warcries, armors, shapes … */
  | 'cast'
  /** An aura the character can switch on (paladin auras, oskill auras) */
  | 'aura'
  /** A skill an item casts on an event (on striking, on kill …) that lands on the character */
  | 'proc';

export interface AvailableBuff {
  skillId: number;
  name: string;
  /** Each skill is listed once: an own skill (cast / aura) unless a proc gives a higher level */
  kind: BuffKind;
  /** The level it would be counted at (the highest of the own skill on either weapon set and its procs) */
  level: number;
  /**
   * A cast skill (not an aura or proc, not an attack) whose level comes from the other weapon set: only
   * that set gives it, or at a higher level (cast there, then swap back). Absent when the set in hand is as good
   */
  castSet?: 1 | 2;
  /** Item index for a proc (the item of the listed level) */
  item?: number;
  /** Proc chance in % */
  chance?: number;
  /** Every active item with a proc of the skill (item indices, save order) */
  items?: number[];
  /** The sheet stats it changes (itemstatcost names) */
  stats: string[];
  /** A skill of a shape-shifted form: the forms it needs one of ("Werewolf or Werebear"); it counts only in one (forms.ts) */
  needsForm?: string;
  /** A skill that works while attacking with it and only unshifted: it does not count while a form is on (forms.ts) */
  unshiftedOnly?: true;
  /**
   * Buffs of one group are mutually exclusive: `aura` (an own aura: skills.txt `aura` 1, one at a time; item auras are
   * apart) and `shapeshift` (a states.txt morph state: one form at a time). Render a group as single choice;
   * computeCharacterSheet keeps only the last selected buff of a group
   */
  exclusiveGroup?: string;
}

export interface AppliedBuff {
  skillId: number;
  name: string;
  /** The level the stats were evaluated at, after re-evaluating until stable (Battle Command raising skill levels) */
  level: number;
  /** Stat name → value added (stat-list units: life / mana × 256) */
  stats: Record<string, number>;
  /** Cast on the other weapon set (its level and stats from that set's gear); absent: the set in hand (`weaponSet`) */
  castSet?: 1 | 2;
}

/**
 * A stat added by hand: an itemstatcost name (or one of whatIf.ts's groups: `all-resists`, `all-max-resists`,
 * `all-attributes`) with the value as an item stores it (life in points, not × 256). May be negative
 */
export interface WhatIfStat {
  stat: string;
  /** The stat's param (`item_addclassskills`: the class id); 0 when omitted */
  param?: number;
  value: number;
}

/** A skill added by hand at a level, counted like an aura an equipped item grants */
export interface WhatIfSkill {
  skillId: number;
  level: number;
}

/** What the user adds on top of the sheet to see what an upgrade would change (nothing is written to the save) */
export interface WhatIfEntries {
  stats?: readonly WhatIfStat[];
  skills?: readonly WhatIfSkill[];
}

export interface AppliedWhatIf {
  /** The stat entries counted (zero values and unknown stats left out), with the item tooltip's wording */
  stats: (WhatIfStat & { text: string })[];
  /** The skills counted (one per skill, the highest level; an item aura of the same skill at a higher level wins) */
  skills: {
    skillId: number;
    name: string;
    level: number;
    /** Stat name → value added (stat-list units) */
    stats: Record<string, number>;
    /** What it adds that the sheet has no number for, as the item tooltip words it ("+45% Enhanced Damage") */
    unshown: string[];
  }[];
  /** The skills not counted (after one per skill, the highest level) and why ("an item already gives it at level 12") */
  skipped: { skillId: number; level: number; reason: string }[];
}

export interface SheetOptions {
  /** The difficulty to compute resists for; the save's difficulty when omitted */
  difficulty?: DifficultyIndex;
  /**
   * Buffs to count; every number they change is marked `unverified`. One skill counts once (the highest level of its
   * selections and an item aura of the same skill), and one buff per exclusive group (the last selected)
   */
  buffs?: readonly BuffSelection[];
  /**
   * Stats and skills to add on top (whatIf.ts): stats as if a charm carried them, skills as if an equipped item gave them
   * as an aura. Every number they change is marked `unverified`
   */
  whatIf?: WhatIfEntries;
}

/**
 * A compact, flat snapshot of the headline numbers, small enough to store on a shared build (well under 1 KB):
 * short keys, numbers only, plus the difficulty, when the save was written and the ESR version when known.
 */
export interface CharacterStatsSnapshot {
  v: 1;
  /** Difficulty the resists are for */
  difficulty: DifficultyIndex;
  /** The save's last-saved time (Unix seconds) */
  savedAt: number;
  esrVersion?: string;
  /** Level, strength, dexterity, vitality, energy */
  lvl: number;
  str: number;
  dex: number;
  vit: number;
  ene: number;
  /** Life, mana, defense */
  life: number;
  mana: number;
  def: number;
  /** Shown resists: fire, cold, lightning, poison, magic, physical */
  fr: number;
  cr: number;
  lr: number;
  pr: number;
  mr: number;
  phr: number;
  /** Max resist caps (fire, cold, lightning, poison; magic optional: added later) */
  frm: number;
  crm: number;
  lrm: number;
  prm: number;
  mrm?: number;
  /** Damage reduced, magic damage reduced */
  dr: number;
  mdr: number;
  ias: number;
  frw: number;
  fhr: number;
  fbr: number;
  fcr: number;
  /** +all skills */
  sk: number;
  /**
   * Attack rating as the character screen shows it: the left mouse button skill's main-hand line, else the right
   * button's, else the base attack rating without a skill. `ars` names the skill (absent for the base value)
   */
  ar: number;
  ars?: string;
  /** Attack rating % */
  arp: number;
  ds: number;
  cb: number;
  ll: number;
  ml: number;
  mf: number;
  gf: number;
  /** Dodge, avoid, evade */
  dod: number;
  avo: number;
  eva: number;
  /** Block chance; absent without a shield */
  blk?: number;
  /** 1 when the numbers include selected buffs */
  buf?: 1;
  /** The weapon set the numbers are for; absent for set 1 */
  ws?: 2;
}
