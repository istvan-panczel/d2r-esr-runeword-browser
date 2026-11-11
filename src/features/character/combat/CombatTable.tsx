import { cn } from '@/lib/utils';
import type { ChanceSpread, CombatKind, CombatRow, CombatSection } from './combatRows';

interface CombatTableProps {
  readonly section: CombatSection;
  readonly kind: CombatKind;
  /** Champion and unique rows by key, for the secondary line under a regular row */
  readonly champions: ReadonlyMap<string, CombatRow> | null;
  readonly uniques: ReadonlyMap<string, CombatRow> | null;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
}

/** One section (campaign, maps or bosses) as a real table: a row group per act / tier, a row per area or boss */
export function CombatTable({ section, kind, champions, uniques, selectedKey, onSelect }: CombatTableProps) {
  const headingId = `combat-${section.key}`;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="font-semibold">
        {section.title}
      </h3>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          {section.title}: chance to hit and chance to be hit, {kind} monsters, the median monster type with the range of the area's monster
          types. Select an area or boss to see it on the curve.
        </caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1.5 pr-2 font-medium">
              {section.key === 'bosses' ? 'Boss' : 'Area'}
            </th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium whitespace-nowrap">
              <span aria-hidden="true">Lvl</span>
              <span className="sr-only">Monster level</span>
            </th>
            <th scope="col" className="w-[5.5rem] py-1.5 pr-2 font-medium sm:w-32 md:w-56 lg:w-32 xl:w-60">
              <ColumnKey colorVar="--combat-hit" />
              <span className="sm:hidden">To hit</span>
              <span className="hidden sm:inline">Chance to hit</span>
            </th>
            <th scope="col" className="w-[5.5rem] py-1.5 font-medium sm:w-32 md:w-56 lg:w-32 xl:w-60">
              <ColumnKey colorVar="--combat-behit" />
              <span className="sm:hidden">Be hit</span>
              <span className="hidden sm:inline">Chance to be hit</span>
            </th>
          </tr>
        </thead>
        {section.groups.map((group) => (
          <tbody key={group.key}>
            <tr>
              <th
                scope="colgroup"
                colSpan={4}
                className="bg-muted/60 px-2 py-1 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <CombatTableRow
                key={row.key}
                row={row}
                champion={champions?.get(row.key) ?? null}
                unique={uniques?.get(row.key) ?? null}
                selected={row.key === selectedKey}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        ))}
      </table>
    </section>
  );
}

interface CombatTableRowProps {
  readonly row: CombatRow;
  readonly champion: CombatRow | null;
  readonly unique: CombatRow | null;
  readonly selected: boolean;
  readonly onSelect: (key: string) => void;
}

function CombatTableRow({ row, champion, unique, selected, onSelect }: CombatTableRowProps) {
  const { target } = row;
  const secondary = (pick: (entry: CombatRow) => ChanceSpread | null) => {
    if (row.target.boss || champion === null || unique === null) return null;
    const championValue = pick(champion);
    const uniqueValue = pick(unique);
    if (championValue === null || uniqueValue === null) return null;
    return `champ ${String(championValue.median)} · uniq ${String(uniqueValue.median)}`;
  };
  return (
    <tr className={cn('border-b border-border/60 align-top', selected && 'bg-accent')}>
      <th scope="row" className="py-1 pr-2 text-left font-normal">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => {
            onSelect(row.key);
          }}
          className={cn(
            'w-full rounded-sm text-left break-words hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            selected && 'font-semibold'
          )}
        >
          {row.name}
        </button>
      </th>
      <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">
        {target.levelRange === undefined ? target.level : `${String(target.levelRange[0])}–${String(target.levelRange[1])}`}
      </td>
      <td className="py-1 pr-2">
        <ChanceCell
          spread={row.hit}
          colorVar="--combat-hit"
          empty="enter AR"
          note={row.ignoreDefenseUnsure ? 'boss: unsure' : null}
          secondary={row.ignoreDefenseUnsure ? null : secondary((entry) => entry.hit)}
        />
      </td>
      <td className="py-1">
        <ChanceCell
          spread={row.beHit}
          colorVar="--combat-behit"
          empty={target.attack === null ? 'spells only' : 'enter defense'}
          note={null}
          secondary={secondary((entry) => entry.beHit)}
        />
      </td>
    </tr>
  );
}

interface ChanceCellProps {
  readonly spread: ChanceSpread | null;
  readonly colorVar: string;
  /** Shown instead of a value */
  readonly empty: string;
  readonly note: string | null;
  readonly secondary: string | null;
}

/** The median chance as text, the range of the area's monster types under it, and a thin meter of the median */
function ChanceCell({ spread, colorVar, empty, note, secondary }: ChanceCellProps) {
  if (spread === null) return <span className="text-xs text-muted-foreground">{empty}</span>;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-semibold tabular-nums">{spread.median}%</span>
        {spread.low !== spread.high && (
          <span className="text-xs text-muted-foreground tabular-nums">
            <span className="sr-only">range </span>
            {spread.low}–{spread.high}
          </span>
        )}
        {secondary !== null && (
          <span className="hidden text-xs text-muted-foreground tabular-nums md:inline lg:hidden xl:inline">· {secondary}</span>
        )}
      </div>
      <div aria-hidden="true" className="mt-0.5 h-[3px] w-full rounded-full bg-muted">
        <div className="h-[3px] rounded-full" style={{ width: `${String(spread.median)}%`, background: `var(${colorVar})` }} />
      </div>
      {note !== null && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function ColumnKey({ colorVar }: { colorVar: string }) {
  return (
    <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: `var(${colorVar})` }} />
  );
}
