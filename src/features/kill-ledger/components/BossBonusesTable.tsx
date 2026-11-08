import { Link } from 'react-router-dom';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import type { KillLedgerBoss } from '@/features/game-data/engine/schema';
import { areaLabel, bossTargets } from '../utils/killLedgerView';
import { IngredientList } from './IngredientList';

const HEAD_CLASS = 'px-3 py-2 text-left font-medium';
const CELL_CLASS = 'border-t px-3 py-2 align-top';

/** The boss bonuses: who to kill, where, what to transmute and the bonus */
export function BossBonusesTable({ bosses }: { readonly bosses: readonly KillLedgerBoss[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className={HEAD_CLASS}>
              Boss
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Where
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
          {bosses.map((boss) => (
            <BossRow key={boss.id} boss={boss} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BossRow({ boss }: { readonly boss: KillLedgerBoss }) {
  const targets = bossTargets(boss);
  return (
    <tr>
      <td className={CELL_CLASS}>
        <span className="font-medium">{boss.name}</span>
        {targets !== null && <p className="text-xs text-muted-foreground">Any of {targets}</p>}
      </td>
      <td className={CELL_CLASS}>
        {boss.areas.map((area) => (
          <div key={area.id}>
            <Link to={campaignMapAreaPath(area.id)} className={LINK_CLASS}>
              {areaLabel(area)}
            </Link>
            {area.random === true && <span className="text-muted-foreground"> (random boss)</span>}
          </div>
        ))}
      </td>
      <td className={CELL_CLASS}>
        <IngredientList ingredients={boss.ingredients} />
      </td>
      <td className={CELL_CLASS}>
        {boss.bonus.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </td>
    </tr>
  );
}
