// The Combat tab's chance to hit / be hit view (self-contained: loads combat.json) and its pure calculations
export { HitChanceView, type HitChanceViewProps } from './HitChanceView';
export {
  attackRatingNeeded,
  buildCombatSections,
  chanceToBeHit,
  chanceToHit,
  defenseNeeded,
  neededValues,
  prepareCombatData,
  type CombatPlayer,
  type CombatRow,
  type CombatSection,
} from './combatRows';
