import { Link } from 'react-router-dom';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { SkillDetail } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { classTree, classView, skillPointTotals } from '@/features/builds/utils/skillTree';
import { SkillIcon } from '@/features/skills/components/SkillIcon';
import { buildSkillsView, skillPageUrl, type SkillsView } from '@/features/skills/utils/skills';
import { cn } from '@/lib/utils';
import { handSkillRows, hardSkillPoints, hotkeyRows, skillNames, type SkillBindingRow } from '../../engine/characterSheet';
import type { CharacterSheet } from '../../engine/sheet/types';
import { bonusPartsText, overviewRows, skillBonusById, type SkillBonus } from '../../engine/sheetView';
import { useCharacterItemNames } from '../../hooks/useCharacterItems';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { BuffedBadge } from '../overview/BuffedBadge';
import { StatList } from '../overview/SheetParts';
import { CharacterSkillTrees } from '../skills/CharacterSkillTrees';
import { CARD_CLASS, NUMBER_FORMAT } from './tabClasses';

/** lootfilter.json is the skills.txt row → skills.json id table (the build draft's mapping); fetched only on this tab */
const FILES = ['skills', 'skilldetails', 'lootfilter', 'itemtext'] as const;

interface SkillsTabProps {
  readonly character: CharacterFile;
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

/** A skill's level with every bonus from the computed sheet (null while it loads) */
type LevelOf = (skillId: string) => SkillBonus | undefined;

function HardPointsTable({ rows, levelOf }: { readonly rows: readonly PointsRow[]; readonly levelOf: LevelOf | null }) {
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
            {levelOf !== null && (
              <>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  Bonus
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Level
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const level = levelOf?.(row.id);
            const parts = level === undefined ? '' : bonusPartsText(level.parts);
            return (
              <tr key={row.id} className="border-t">
                <td className="py-1 pr-3">
                  <SkillName detail={row.detail} name={row.name} />
                  {parts !== '' && <span className="block pl-8 text-xs text-muted-foreground">{parts}</span>}
                </td>
                <td className="py-1 pr-3 align-top text-muted-foreground">{row.tab}</td>
                <td className="py-1 pr-3 text-right align-top tabular-nums">{row.points}</td>
                {levelOf !== null && (
                  <>
                    <td className="py-1 pr-3 text-right align-top tabular-nums">+{level?.bonus ?? 0}</td>
                    <td className="py-1 text-right align-top font-medium tabular-nums">{level?.level ?? row.points}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Skills the character has without hard points: granted by items (oskills and item skills), from the sheet */
function GrantedSkills({
  sheet,
  view,
  skillIds,
}: {
  readonly sheet: CharacterSheet;
  readonly view: SkillsView;
  readonly skillIds: readonly string[];
}) {
  const granted = sheet.skills.levels.filter((skill) => skill.hard === 0 && skill.level > 0 && (skill.bonus.oskill ?? 0) > 0);
  if (granted.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">Granted by items</h4>
      <ul className="space-y-1 text-sm">
        {granted.map((skill) => {
          const id = skillIds.at(skill.skillId);
          return (
            <li key={skill.skillId} className="flex items-center justify-between gap-3">
              <SkillName detail={id === undefined || id === '' ? undefined : view.byId.get(id)} name={skill.name} />
              <span className="font-medium tabular-nums">Level {NUMBER_FORMAT.format(skill.level)}</span>
            </li>
          );
        })}
      </ul>
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

/**
 * Skills: the class tree with every skill at its level from the computed sheet (hard points + bonuses), the points as a
 * table with the bonus and the level, the +skill bonuses with their sources, then the hand skills and hotkeys.
 */
export function SkillsTab({ character }: SkillsTabProps) {
  const gameData = useGameData(FILES);
  const sheetState = useCharacterSheet(character);
  const itemName = useCharacterItemNames(character);
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
  const sheet = sheetState.status === 'ready' ? sheetState.sheet : null;
  const levels = sheet === null ? new Map<string, SkillBonus>() : skillBonusById(sheet, skillIds);
  const bonusRows =
    sheet === null
      ? []
      : overviewRows(sheet, sheetState.status === 'ready' ? sheetState.unbuffed : null, NUMBER_FORMAT).find.filter(
          (row) => row.key === 'sk' || row.key === 'cls'
        );

  return (
    <div className="space-y-4">
      <section aria-labelledby="character-skill-tree" className={cn(CARD_CLASS, 'space-y-3')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="character-skill-tree" className="font-semibold">
              Skill tree
            </h3>
            <p className="text-xs text-muted-foreground">
              {totals.total} hard {totals.total === 1 ? 'point' : 'points'} put in by hand.{' '}
              {sheet === null
                ? sheetState.status === 'error'
                  ? 'The skill bonuses could not be loaded: the badges show hard points.'
                  : 'Loading the skill bonuses…'
                : 'The badges show each skill’s level with every bonus counted.'}{' '}
              Pick a skill for its details.
            </p>
          </div>
          {sheet !== null && sheet.buffs.length > 0 && <BuffedBadge />}
        </div>
        {cls === undefined ? (
          <p className="text-sm text-muted-foreground">No skill tree for {character.className} in the current data.</p>
        ) : (
          // Remounts per character: the selected skill and tab belong to one tree
          <CharacterSkillTrees
            key={character.name}
            view={view}
            cls={cls}
            hardPoints={hard.byId}
            levels={levels}
            tabCounts={totals.byTab}
            characterLevel={character.level}
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="character-hard-points" className={cn(CARD_CLASS, 'space-y-2')}>
          <h3 id="character-hard-points" className="font-semibold">
            Skill levels
          </h3>
          <HardPointsTable
            rows={pointsRows(view, character.className, hard.byId)}
            levelOf={sheet === null ? null : (id) => levels.get(id)}
          />
          {hard.unmapped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in the current data: {hard.unmapped.map(({ row, points }) => `${names(row)} (${String(points)})`).join(', ')}.
            </p>
          )}
          {sheet !== null && <GrantedSkills sheet={sheet} view={view} skillIds={skillIds} />}
        </section>

        <div className="space-y-4">
          {bonusRows.length > 0 && (
            <section aria-labelledby="character-skill-bonus" className={cn(CARD_CLASS, 'space-y-2')}>
              <h3 id="character-skill-bonus" className="font-semibold">
                Skill bonuses
              </h3>
              <StatList rows={bonusRows} itemName={itemName} />
              <p className="text-xs text-muted-foreground">
                Select a bonus to see the items it comes from. Tab and single-skill bonuses are listed under each skill.
              </p>
            </section>
          )}
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
    </div>
  );
}
