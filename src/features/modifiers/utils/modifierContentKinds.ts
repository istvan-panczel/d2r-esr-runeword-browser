/**
 * How the hand-written explanations (content/modifiers/modifiers.md, keyed by the drafts' own keys) join the generated
 * modifier kinds of modifiers.json, plus the facts and calculators each kind shows. Kept out of the markdown so a
 * re-checked content file can replace the old one as it is. modifierContent.test.ts checks that every content key is
 * here, every kind named here exists, no kind is claimed twice, every key kind has a text or is in
 * KEY_KINDS_WITHOUT_TEXT, and a block's `stats:` line names exactly the stats of its kinds. See docs/features/MODIFIERS.md "Content".
 */
import type { ModifierCategory } from '../../game-data/engine/schema.ts';

export interface ContentKinds {
  /** modifiers.json kind keys the explanation covers; the first one gives the category unless `category` is set */
  readonly kinds: readonly string[];
  readonly category?: ModifierCategory;
}

/** Content key → the kinds it explains */
export const CONTENT_KINDS: Readonly<Partial<Record<string, ContentKinds>>> = {
  'deadly-strike': { kinds: ['deadly-strike'] },
  'critical-damage': { kinds: ['critical-damage'] },
  'crushing-blow': { kinds: ['crushing-blow'] },
  bleed: { kinds: ['bleed', 'open-wounds'] },
  'life-leech': { kinds: ['life-leech'] },
  'mana-leech': { kinds: ['mana-leech'] },
  'on-striking': { kinds: ['on-striking'] },
  'after-kill': { kinds: ['life-after-kill', 'mana-after-kill'] },
  'physical-resist': { kinds: ['physical-resist'] },
  'damage-reduced': { kinds: ['damage-reduced'] },
  'magic-damage-reduced': { kinds: ['magic-damage-reduced'] },
  resists: { kinds: ['resist-fire', 'resist-cold', 'resist-lightning', 'resist-poison', 'magic-resist'] },
  'max-resists': { kinds: ['max-resist'] },
  'poison-length': { kinds: ['poison-length'] },
  'enemy-resist': { kinds: ['enemy-resist'] },
  absorb: { kinds: ['absorb'] },
  'attack-rating': { kinds: ['attack-rating', 'stat-item-demon-tohit', 'stat-item-undead-tohit'] },
  'target-defense': { kinds: ['target-defense', 'ignore-target-defense', 'stat-item-damagetargetac'] },
  'enhanced-damage': { kinds: ['enhanced-damage'] },
  'cannot-be-frozen': { kinds: ['cannot-be-frozen', 'half-freeze'] },
  slow: { kinds: ['slow-target'] },
  freeze: { kinds: ['freeze-target'] },
  knockback: { kinds: ['knockback'] },
  'damage-to-mana': { kinds: ['damage-to-mana'] },
  thorns: { kinds: ['attacker-takes-damage'] },
  'chance-to-cast': { kinds: ['cast-on-strike', 'cast-when-struck', 'cast-on-kill', 'cast-on-cast'] },
  reanimate: { kinds: ['reanimate', 'stat-item-restinpeace'] },
  ias: { kinds: ['ias'] },
  fcr: { kinds: ['fcr'] },
  fhr: { kinds: ['fhr'] },
  block: { kinds: ['block', 'weapon-block'] },
  fbr: { kinds: ['fbr'] },
  frw: { kinds: ['frw'] },
  dodge: { kinds: ['dodge'] },
  'magic-find': { kinds: ['magic-find'] },
  'gold-find': { kinds: ['gold-find'] },
  'item-quantity': { kinds: ['extra-items'] },
  'cooldown-reduction': { kinds: ['skill-cooldown'] },
  'elemental-mastery': { kinds: ['elemental-mastery'] },
  'spell-damage': { kinds: ['spell-damage', 'total-spell-damage'] },
  'summon-stats': {
    kinds: [
      'summon-damage',
      'stat-passive-summ-mastery-total',
      'stat-passive-summ-life',
      'stat-passive-summ-elemental-resist',
      'stat-passive-summ-phys-resist',
      'stat-passive-summ-limit',
      'stat-summonexceedcap',
    ],
    category: 'skills',
  },
  skills: {
    kinds: [
      'stat-item-allskills',
      'stat-item-addclassskills',
      'stat-item-addskill-tab',
      'stat-item-singleskill',
      'stat-item-nonclassskill',
      'stat-item-nonclassskill-display',
    ],
  },
  'curse-resistance': { kinds: ['curse-resist'] },
  pierce: { kinds: ['piercing-attack'] },
  experience: { kinds: ['stat-item-addexperience'] },
  'light-radius': { kinds: ['stat-item-lightradius'], category: 'other' },
  requirements: { kinds: ['stat-item-req-percent', 'stat-item-levelreq'], category: 'other' },
  'rare-procs': { kinds: ['prevent-heal', 'stat-item-stupidity', 'monster-flee'] },
};

/** Key kinds that have no hand-written text yet: they get the generated entry */
export const KEY_KINDS_WITHOUT_TEXT: readonly string[] = ['replenish-life', 'attribute-percent'];

/** Facts a kind's card always tabulates, besides the ones its text quotes */
export const KIND_FACTS: Readonly<Partial<Record<string, readonly string[]>>> = {
  'deadly-strike': ['criticalDamage.basePercent', 'criticalDamage.missiles'],
  'critical-damage': ['criticalDamage.stat', 'criticalDamage.basePercent', 'criticalDamage.maxPercent'],
  'crushing-blow': ['crushingBlow.share', 'crushingBlow.settings', 'crushingBlow.ranged', 'monster.hpBonusPerPlayer'],
  bleed: ['bleed.enabled', 'bleed.stats'],
  'life-leech': ['difficulty.LifeStealDivisor', 'monstats.drainZero', 'monstats.drainPartial', 'leech.precision'],
  'mana-leech': ['difficulty.ManaStealDivisor', 'monstats.drainZero', 'monstats.drainPartial', 'leech.precision'],
  'life-after-kill': ['thorns.killCredit'],
  'physical-resist': ['resist.physicalCap', 'summonResistCap.enabled'],
  'resist-fire': ['difficulty.ResistPenalty', 'resist.maxBase', 'resist.hardCap', 'resist.floor'],
  'max-resist': ['resist.maxBase', 'resist.hardCap'],
  'poison-length': ['poisonImmunity.state'],
  'enemy-resist': ['resist.floor'],
  absorb: ['absorb.percentCap'],
  'attack-rating': ['attackRating.curve', 'attackRating.table', 'block.noRunPenalty'],
  'enhanced-damage': ['enhancedDamageFix.enabled'],
  'cannot-be-frozen': ['difficulty.MonsterColdDivisor'],
  'freeze-target': ['difficulty.MonsterFreezeDivisor'],
  'attacker-takes-damage': ['thorns.killCredit', 'thorns.percentKillCredit'],
  ias: ['speed.breakpointDivisor'],
  fcr: ['castRate.cap', 'castRate.maxRate', 'speed.breakpointDivisor', 'charstats.MinimumCastingDelay'],
  fhr: ['speed.breakpointDivisor'],
  fbr: ['speed.breakpointDivisor'],
  frw: ['speed.breakpointDivisor', 'charstats.RunVelocity', 'charstats.WalkVelocity'],
  block: ['charstats.BlockFactor', 'block.cap', 'block.noRunPenalty'],
  'weapon-block': ['weaponBlock.enabled', 'weaponBlock.clawTypes', 'weaponBlock.swordTypes'],
  dodge: ['dodge.cap'],
  'magic-find': ['magicFind.dim', 'magicFind.tail'],
  'extra-items': ['extraItems.settings'],
  'curse-resist': ['difficulty.AiCurseDivisor'],
  'stat-item-addexperience': ['difficulty.DeathExpPenalty'],
  'stat-passive-summ-elemental-resist': ['summonResistCap.enabled', 'summons.primeEvilDamage', 'difficulty.PlayerDamagePercentVSPrimeEvil'],
};

export type ModifierCalculator = 'leech' | 'magic-find' | 'hit-chance' | 'crushing-blow';

/** The calculators shown inside the card of the entry that holds the kind */
export const KIND_CALCULATORS: Readonly<Partial<Record<string, ModifierCalculator>>> = {
  'life-leech': 'leech',
  'mana-leech': 'leech',
  'magic-find': 'magic-find',
  'attack-rating': 'hit-chance',
  'crushing-blow': 'crushing-blow',
};
