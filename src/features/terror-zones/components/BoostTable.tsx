import type { TerrorZoneBoost } from '@/features/game-data/engine/schema';
import { DIFFICULTY_LABELS, GAME_VERSION_LABELS } from '../utils/boosts';

/** The terror boost per game version and difficulty, as desecratedzones.json sets it. */
export function BoostTable({ boosts }: { readonly boosts: readonly TerrorZoneBoost[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Game
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Difficulty
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Level boost
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Monster level
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              XP
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {boosts.map((boost) => (
            <tr key={`${boost.version}-${String(boost.difficulty)}`}>
              <td className="px-3 py-1.5">{GAME_VERSION_LABELS[boost.version]}</td>
              <td className="px-3 py-1.5">{DIFFICULTY_LABELS[boost.difficulty] ?? `Difficulty ${String(boost.difficulty)}`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">+{boost.levelBoost}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {boost.minLevel}–{boost.maxLevel}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">+{boost.xpPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
