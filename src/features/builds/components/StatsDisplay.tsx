import type { BuildStats } from '../buildStats';
import { statedGroups, statGroupTitle, statsNote, statsProvenance } from '../utils/statLabels';

/** The read-only character stats of a variant: only the stated numbers, grouped, with where they came from. */
export function StatsDisplay({ stats }: { readonly stats: BuildStats }) {
  const groups = statedGroups(stats.values);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
        {groups.map(({ group, stats: rows }) => (
          <div key={group.id} className="min-w-0">
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {statGroupTitle(group, stats.difficulty)}
            </h3>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-sm">
              {rows.map(({ stat, text }) => (
                <div key={stat.key} className="contents">
                  <dt className="min-w-0 text-muted-foreground">
                    <span className="block truncate">{stat.label}</span>
                    {stat.key === 'ar' && stats.arSkill !== undefined && (
                      <span className="block truncate text-xs">with {stats.arSkill}, main hand</span>
                    )}
                  </dt>
                  <dd className="text-right font-medium tabular-nums">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{statsProvenance(stats)}</p>
        <p>{statsNote(stats)}</p>
      </div>
    </div>
  );
}
