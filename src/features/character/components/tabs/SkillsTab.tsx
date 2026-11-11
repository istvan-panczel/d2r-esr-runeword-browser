import { Link } from 'react-router-dom';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { SkillDetail } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { BuildSkillTrees } from '@/features/builds/components/BuildSkillTrees';
import { classTree, classView, skillPointTotals } from '@/features/builds/utils/skillTree';
import { SkillIcon } from '@/features/skills/components/SkillIcon';
import { buildSkillsView, skillPageUrl, type SkillsView } from '@/features/skills/utils/skills';
import { cn } from '@/lib/utils';
import { handSkillRows, hardSkillPoints, hotkeyRows, skillNames, type SkillBindingRow } from '../../engine/characterSheet';
import type { CharacterFile } from '../../parser/types';
import { CARD_CLASS } from './tabClasses';

/** lootfilter.json is the skills.txt row → skills.json id table (the build draft's mapping); fetched only on this tab */
const FILES = ['skills', 'skilldetails', 'lootfilter', 'itemtext'] as const;

/**
 * SEAM for the stats engine: "+N to the skill from items" (all skills, class, tab and single-skill bonuses) by skills.json
 * id. When given, the hard-points table adds "From items" and "Level" columns.
 */
export type ItemSkillBonus = (skillId: string) => number;

interface SkillsTabProps {
  readonly character: CharacterFile;
  readonly itemSkillBonus?: ItemSkillBonus;
}

const LINK_CLASS = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

function SkillName({ detail, name }: { readonly detail: SkillDetail | undefined; readonly name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SkillIcon icon={detail?.icon} size={24} />
      {detail === undefined ? (
        <span className="min-w-0">{name}</span>
      ) : (
        <Link to={skillPageUrl(detail)} className={cn(LINK_CLASS, 'min-w-0')}>
          {name}
        </Link>
      )}
    </span>
  );
}

interface PointsRow {
  readonly id: string;
  readonly name: string;
  readonly detail: SkillDetail | undefined;
  readonly tab: string;
  readonly points: number;
}

function pointsRows(view: SkillsView, className: string, byId: Readonly<Record<string, number>>): PointsRow[] {
  const cls = view.classes.find((entry) => entry.name === className);
  const tabOf = new Map(cls?.tabs.flatMap((tab) => tab.cells.map((cell) => [cell.detail.id, tab.name] as const)) ?? []);
  return Object.entries(byId)
    .map(([id, points]) => {
      const detail = view.byId.get(id);
      return { id, points, detail, name: detail?.name ?? id, tab: tabOf.get(id) ?? 'Other' };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function HardPointsTable({ rows, bonus }: { readonly rows: readonly PointsRow[]; readonly bonus: ItemSkillBonus | undefined }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No skill points spent yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">
              Skill
            </th>
            <th scope="col" className="py-1 pr-3 font-medium">
              Tab
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Hard points
            </th>
            {bonus !== undefined && (
              <>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  From items
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Level
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-1 pr-3">
                <SkillName detail={row.detail} name={row.name} />
              </td>
              <td className="py-1 pr-3 text-muted-foreground">{row.tab}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{row.points}</td>
              {bonus !== undefined && (
                <>
                  <td className="py-1 pr-3 text-right tabular-nums">+{bonus(row.id)}</td>
                  <td className="py-1 text-right font-medium tabular-nums">{row.points + bonus(row.id)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BindingList({
  rows,
  view,
  empty,
}: {
  readonly rows: readonly SkillBindingRow[];
  readonly view: SkillsView;
  readonly empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">{row.label}</span>
          <SkillName detail={row.skillId === null ? undefined : view.byId.get(row.skillId)} name={row.name} />
        </li>
      ))}
    </ul>
  );
}

/** Skills: the class tree with the hard points (the builds' look), the points as a table, then the hand skills and hotkeys. */
export function SkillsTab({ character, itemSkillBonus }: SkillsTabProps) {
  const gameData = useGameData(FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  const { skills, skilldetails, lootfilter, itemtext } = gameData.data;
  const view = buildSkillsView(skills, skilldetails);
  const skillIds = lootfilter.skillNames ?? [];
  const names = skillNames(itemtext.skills);
  const hard = hardSkillPoints(character, skillIds);
  const tree = classTree(skills, character.className);
  const cls = classView(view, character.className);
  const totals = skillPointTotals(hard.byId, tree);

  return (
    <div className="space-y-4">
      <section aria-labelledby="character-skill-tree" className={cn(CARD_CLASS, 'space-y-3')}>
        <div>
          <h3 id="character-skill-tree" className="font-semibold">
            Skill tree
          </h3>
          <p className="text-xs text-muted-foreground">
            {totals.total} hard {totals.total === 1 ? 'point' : 'points'} put in by hand; skill bonuses from items are not counted. Pick a
            skill for its details.
          </p>
        </div>
        {cls === undefined ? (
          <p className="text-sm text-muted-foreground">No skill tree for {character.className} in the current data.</p>
        ) : (
          // Remounts per character: the selected skill and tab belong to one tree
          <BuildSkillTrees key={character.name} view={view} cls={cls} skillPoints={hard.byId} tabCounts={totals.byTab} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="character-hard-points" className={cn(CARD_CLASS, 'space-y-2')}>
          <h3 id="character-hard-points" className="font-semibold">
            Hard points
          </h3>
          <HardPointsTable rows={pointsRows(view, character.className, hard.byId)} bonus={itemSkillBonus} />
          {hard.unmapped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in the current data: {hard.unmapped.map(({ row, points }) => `${names(row)} (${String(points)})`).join(', ')}.
            </p>
          )}
        </section>

        <section aria-labelledby="character-bindings" className={cn(CARD_CLASS, 'space-y-3')}>
          <h3 id="character-bindings" className="font-semibold">
            Skills in use
          </h3>
          <div className="space-y-1">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Mouse buttons</h4>
            <BindingList rows={handSkillRows(character, names, skillIds)} view={view} empty="None set." />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Hotkeys</h4>
            <BindingList rows={hotkeyRows(character, names, skillIds)} view={view} empty="No hotkeys set." />
          </div>
        </section>
      </div>
    </div>
  );
}
