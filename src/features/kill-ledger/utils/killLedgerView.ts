import { cubeIconRef, type CubeIconRef } from '@/features/game-data/engine/cubeIcons';
import type { KillLedgerBoss, KillLedgerBossArea, KillLedgerIngredient } from '@/features/game-data/engine/schema';

/** The guide note about the Kill Ledger (`/guide/<slug>`) */
export const KILL_LEDGER_GUIDE_PATH = '/guide/kill-ledger';
/** Cube family of the kill bonuses (the Cube page's Kill Ledger section starts here) */
export const KILL_LEDGER_CUBE_FAMILY = 'kill-ledger-tiers';

/** 500 → "500", 10000000 → "10,000,000" */
export function killsText(kills: number): string {
  return kills.toLocaleString('en-US');
}

/** "2× Flawed Storm Amber" (a single item reads without a count) */
export function ingredientText(ingredient: KillLedgerIngredient): string {
  return ingredient.qty > 1 ? `${String(ingredient.qty)}× ${ingredient.name}` : ingredient.name;
}

/** The icon reference of a bundle token; null when the ingredient has no art */
export function ingredientIcon(ingredient: Pick<KillLedgerIngredient, 'icon'>): CubeIconRef | null {
  return ingredient.icon === null ? null : cubeIconRef(ingredient.icon);
}

/** "Talic The Eternal, Madawc The Eternal or Korlic The Eternal"; null when one monster counts (the boss name says it) */
export function bossTargets(boss: Pick<KillLedgerBoss, 'monsters'>): string | null {
  if (boss.monsters.length <= 1) return null;
  const names = boss.monsters.map((monster) => monster.name);
  return `${names.slice(0, -1).join(', ')} or ${String(names.at(-1))}`;
}

/** "Tier 2: Chaos Rift Level 4" */
export function areaLabel(area: Pick<KillLedgerBossArea, 'name' | 'tier'>): string {
  return `Tier ${String(area.tier)}: ${area.name}`;
}
