/**
 * `::difficulty-penalties`: what Nightmare and Hell change, one row per penalty and one column per difficulty
 * (difficultylevels.txt). Transposed so the table stays four columns wide on a phone.
 */
import type { DifficultyRow } from '../esrGuideSources.ts';
import { requireEsr, type DirectiveResolver } from './types.ts';

const percent = (value: number) => `${String(value)}%`;

/** Row label and cell text per penalty, in table order */
const PENALTY_ROWS: readonly { label: string; cell: (row: DifficultyRow) => string }[] = [
  { label: 'Resistance penalty', cell: (row) => String(row.resistPenalty) },
  { label: 'Experience lost on death', cell: (row) => percent(row.deathExpPenalty) },
  { label: 'Monster skill bonus', cell: (row) => `+${String(row.monsterSkillBonus)}` },
  { label: 'Life leech divided by', cell: (row) => String(row.lifeStealDivisor) },
  { label: 'Mana leech divided by', cell: (row) => String(row.manaStealDivisor) },
  { label: "Your and your summons' damage to prime evils", cell: (row) => percent(row.playerDamagePercentVSPrimeEvil) },
  { label: 'Mercenary damage to bosses', cell: (row) => percent(row.mercenaryDamagePercentVSBoss) },
  { label: 'Freeze length on monsters divided by', cell: (row) => String(row.monsterFreezeDivisor) },
  { label: 'Chill length on monsters divided by', cell: (row) => String(row.monsterColdDivisor) },
  { label: 'Terror, Confuse, Attract and Dim Vision length on monsters divided by', cell: (row) => String(row.aiCurseDivisor) },
];

export const resolveDifficultyPenalties: DirectiveResolver = (arg, ctx) => {
  if (arg !== null) return { error: '::difficulty-penalties takes no argument' };
  const esr = requireEsr(ctx, 'difficulty-penalties');
  if ('error' in esr) return esr;
  if (esr.difficulties.length === 0) return { error: '::difficulty-penalties: difficultylevels.txt has no rows' };
  return {
    kind: 'table',
    caption: 'Penalties per difficulty',
    header: ['Penalty', ...esr.difficulties.map((row) => row.name)],
    rows: PENALTY_ROWS.map(({ label, cell }) => [label, ...esr.difficulties.map(cell)]),
  };
};
