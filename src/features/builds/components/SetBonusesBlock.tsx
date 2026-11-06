import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { SkillRefText } from '@/features/skills/components/SkillRefText';
import { cn } from '@/lib/utils';
import type { SetBonusGroupSnapshot } from '../buildData';
import { setBonuses, type SectionItems, type SetBonusSummary } from '../utils/setBonuses';
import { SET_NAME_CLASS, setItemPageUrl } from '../utils/setItems';

function BonusGroup({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">{label}</p>
      <ul className="space-y-0.5 text-amber-900 dark:text-amber-200">
        {lines.map((line, index) => (
          <li key={`${String(index)}-${line}`}>
            <SkillRefText line={line} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const groupLabel = (group: SetBonusGroupSnapshot) => `${String(group.pieces)} items`;

function SetSummaryCard({
  summary,
  setsStatus,
}: {
  readonly summary: SetBonusSummary;
  readonly setsStatus: 'loading' | 'ready' | 'error';
}) {
  const { total, equipped } = summary;
  const itemBonuses = summary.items.filter((item) => item.activePartial.length > 0);
  const fullNeeds = !summary.complete && summary.nextPartial === null && total !== null ? total : null;
  // Every summary has at least one equipped item; its name focuses the set on the Sets page.
  const firstItem = summary.items[0];
  return (
    <Card className="gap-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Link to={setItemPageUrl(firstItem.name)} className={cn('font-semibold underline-offset-2 hover:underline', SET_NAME_CLASS)}>
          {summary.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {summary.complete ? 'Full set' : total !== null ? `${String(equipped)} of ${String(total)} pieces` : `${String(equipped)} pieces`}
        </span>
      </div>

      {summary.activePartial.map((group) => (
        <BonusGroup key={group.pieces} label={groupLabel(group)} lines={group.lines} />
      ))}
      {summary.complete && summary.full.length > 0 && <BonusGroup label="Full set" lines={summary.full} />}

      {itemBonuses.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item bonuses</p>
          {itemBonuses.map((item) => (
            <div key={item.name}>
              <p className="text-xs text-muted-foreground">{item.name}</p>
              <ul className={cn('space-y-0.5', SET_NAME_CLASS)}>
                {item.activePartial
                  .flatMap((group) => group.lines)
                  .map((line, index) => (
                    <li key={`${String(index)}-${line}`}>
                      <SkillRefText line={line} item={{ kind: 'set', name: item.name }} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {summary.nextPartial !== null && (
        <p className="text-xs text-muted-foreground">
          Needs {summary.nextPartial.pieces} pieces: {summary.nextPartial.lines.join(', ')}
        </p>
      )}
      {fullNeeds !== null && <p className="text-xs text-muted-foreground">Full set bonus needs {fullNeeds} pieces</p>}
      {setsStatus === 'loading' && <p className="text-xs text-muted-foreground">Loading set-wide bonuses…</p>}
      {setsStatus === 'error' && <p className="text-xs text-muted-foreground">Set-wide bonuses unavailable (game data failed to load).</p>}
      {setsStatus === 'ready' && total === null && (
        <p className="text-xs text-amber-600 dark:text-amber-400">This set is not in the current ESR data.</p>
      )}
    </Card>
  );
}

interface SetBonusesBlockProps {
  /** One equipment section (player main gear or mercenary gear); weapon swap is never mixed in. */
  readonly items: SectionItems;
}

/**
 * Active set bonuses of one equipment section. Loads sets.json for the set-wide lines;
 * render it only when the section has a set item (so builds without sets never fetch it).
 * While loading or after a failed load it still shows the piece counts and item bonuses.
 */
export function SetBonusesBlock({ items }: SetBonusesBlockProps) {
  const sets = useGameData(['sets']);
  const summaries = setBonuses(items, sets.status === 'ready' ? sets.data.sets : null);
  if (summaries.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Set bonuses</h3>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {summaries.map((summary) => (
          <SetSummaryCard key={summary.setId} summary={summary} setsStatus={sets.status} />
        ))}
      </div>
    </div>
  );
}
