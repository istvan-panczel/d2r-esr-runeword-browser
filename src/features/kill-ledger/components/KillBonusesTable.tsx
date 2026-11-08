import type { KillLedgerTier } from '@/features/game-data/engine/schema';
import { killsText } from '../utils/killLedgerView';
import { IngredientList } from './IngredientList';

const HEAD_CLASS = 'px-3 py-2 text-left font-medium';
const CELL_CLASS = 'border-t px-3 py-2 align-top';

/** The kill count bonuses, in unlock order */
export function KillBonusesTable({ tiers }: { readonly tiers: readonly KillLedgerTier[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className={HEAD_CLASS}>
              #
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Kills
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Transmute with the ledger
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Bonus
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.tier}>
              <td className={`${CELL_CLASS} tabular-nums`}>{tier.tier}</td>
              <td className={`${CELL_CLASS} tabular-nums`}>{killsText(tier.kills)}</td>
              <td className={CELL_CLASS}>
                <IngredientList ingredients={tier.ingredients} />
              </td>
              <td className={CELL_CLASS}>
                {tier.bonus.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
