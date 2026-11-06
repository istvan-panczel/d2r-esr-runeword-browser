import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { SkillCalcSkill } from '@/features/game-data/engine/schema';
import {
  skillTable,
  type SkillCalcIndex,
  type SkillCalcOptions,
  type SkillLineResult,
  type SkillTableRow,
} from '@/features/game-data/engine/skillCalc';
import { cn } from '@/lib/utils';
import {
  fullTableLevels,
  quickRows,
  MAX_LEVEL,
  QUICK_LEVELS,
  tableRow,
  varyingRows,
  type SkillLevelPatch,
  valueTableLevels,
  type SkillLevelState,
} from '../utils/skillLevels';
import { LevelStepper } from './LevelInput';

/** How a page drives the detail card's per-level values */
export interface SkillLevelsConfig {
  readonly state: SkillLevelState;
  /** The skill's own hard points (builds: the allocated points); default min(level, max level) */
  readonly hardPoints?: number;
  readonly onChange: (patch: SkillLevelPatch) => void;
  /** Replaces the skill level stepper and quick buttons in the pinned level bar (builds: hard points + gear) */
  readonly levelControl?: ReactNode;
  /** Shown at the top of the Values tab ("not learned in this build") */
  readonly note?: ReactNode;
  /** Next to the "Max all" synergy toggle (builds: reset to the build's points) */
  readonly synergyAction?: ReactNode;
  /** "Granted by" levels below this are plain text, not buttons (builds: the allocated points, which gear cannot lower) */
  readonly minPickLevel?: number;
}

const FOOTNOTE = '*';
const THEORETICAL_MAX = `${String(MAX_LEVEL)} is the theoretical max skill level (player community)`;

/** The pinned level bar of the Values tab: skill level − / + and the quick levels, or the page's own control (builds) */
export function SkillLevelBar({
  config,
  showLevel,
  extra,
}: {
  readonly config: SkillLevelsConfig;
  /** The skill has values that change with the level (else only `levelControl` / `extra` are shown) */
  readonly showLevel: boolean;
  /** Under the controls ("Lvl 40 from Hellmouth · Back to items") */
  readonly extra?: ReactNode;
}) {
  const { state, onChange } = config;
  const id = useId();
  const control =
    showLevel &&
    (config.levelControl ?? (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Label htmlFor={id} className="shrink-0 text-xs font-normal text-muted-foreground">
          Lvl
        </Label>
        <LevelStepper
          id={id}
          label="skill level"
          aria-label="Skill level"
          value={state.level}
          min={1}
          max={MAX_LEVEL}
          inputClassName="w-10"
          onCommit={(level) => {
            onChange({ level });
          }}
        />
        <div className="flex flex-wrap gap-0.5" role="group" aria-label="Quick skill levels">
          {QUICK_LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={state.level === level ? 'default' : 'outline'}
              aria-pressed={state.level === level}
              title={level === MAX_LEVEL ? THEORETICAL_MAX : undefined}
              className="h-7 px-1.5 text-xs tabular-nums"
              onClick={() => {
                onChange({ level });
              }}
            >
              {level === MAX_LEVEL ? `${String(level)}${FOOTNOTE}` : level}
            </Button>
          ))}
        </div>
      </div>
    ));
  if (control === false && extra === undefined) return null;
  return (
    <div className="space-y-1">
      {control}
      {extra}
    </div>
  );
}

interface SkillLevelValuesProps {
  readonly config: SkillLevelsConfig;
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  /** The lines at the selected level (every block) */
  readonly results: readonly SkillLineResult[];
  /** Every line at `valueTableLevels(level)` */
  readonly rows: readonly SkillTableRow[];
  /** What both tables evaluate with besides the level */
  readonly tableOptions: Omit<SkillCalcOptions, 'level'>;
  readonly skillName: string;
  /** The synergy rows (the card owns their links and inputs); null when the skill has none */
  readonly synergies: ReactNode;
  readonly hasSynergyInputs: boolean;
}

/**
 * The Values tab's body: the character level, the synergies (next to the values they change), the lines at the
 * selected level with the quick levels under each changing line, and the "All levels" dialog.
 */
export function SkillLevelValues({
  config,
  record,
  index,
  results,
  rows,
  tableOptions,
  skillName,
  synergies,
  hasSynergyInputs,
}: SkillLevelValuesProps) {
  const { state, onChange } = config;
  const ids = useId();
  const varying = varyingRows(quickRows(rows));

  return (
    <section aria-label="Values per skill level" className="space-y-4">
      {config.note}
      {record.scalesWithCharLevel === true && (
        <div className="flex items-center gap-2">
          <Label htmlFor={`${ids}-clvl`} className="shrink-0 text-xs font-normal text-muted-foreground">
            Character level
          </Label>
          <LevelStepper
            id={`${ids}-clvl`}
            label="character level"
            aria-label="Character level"
            value={state.charLevel}
            min={1}
            max={MAX_LEVEL}
            onCommit={(charLevel) => {
              onChange({ charLevel });
            }}
          />
        </div>
      )}

      {synergies !== null && (
        <section aria-labelledby={`${ids}-syn`} className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 id={`${ids}-syn`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Receives bonuses from
            </h3>
            {hasSynergyInputs && (
              <div className="flex items-center gap-3">
                {config.synergyAction}
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={state.synergy === 'max'}
                    onCheckedChange={(checked) => {
                      onChange({ synergy: checked === true ? 'max' : null });
                    }}
                  />
                  <span className="text-xs">Max all</span>
                </label>
              </div>
            )}
          </div>
          {synergies}
        </section>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">At level {state.level}</h3>
        <ValueList rows={rows} results={results} varying={varying} selected={state.level} />
        <HiddenLinesNote record={record} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 text-xs">
        {varying.length > 0 && (
          <AllLevelsDialog skillName={skillName} config={config} record={record} index={index} options={tableOptions} />
        )}
        <details className="group min-w-0 flex-1 basis-40 text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center justify-end gap-1 hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Info className="size-3.5" aria-hidden />
            About these values
          </summary>
          <p className="mt-1 text-left">
            Values for a character without items or ascendancy bonuses; levels above 20 need +skills. {FOOTNOTE}
            {THEORETICAL_MAX}. Formulas from the game files, not all verified in game.
          </p>
        </details>
      </div>
    </section>
  );
}

/** "All levels": the full table in a wide dialog (computed only while open); focus returns to the button on close */
function AllLevelsDialog({
  skillName,
  config,
  record,
  index,
  options,
}: {
  readonly skillName: string;
  readonly config: SkillLevelsConfig;
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  readonly options: Omit<SkillCalcOptions, 'level'>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <Maximize2 className="size-3.5" aria-hidden />
          All levels
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{skillName}: all levels</DialogTitle>
          <DialogDescription>With the card&apos;s synergies and character level. Pick a level to show it in the card.</DialogDescription>
        </DialogHeader>
        {open && (
          <FullTable
            record={record}
            index={index}
            options={options}
            selected={config.state.level}
            minPickLevel={config.minPickLevel}
            onPick={(level) => {
              config.onChange({ level });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function HiddenLinesNote({ record }: { readonly record: SkillCalcSkill }) {
  const stat = record.hiddenStatLines ?? 0;
  const other = record.hiddenOtherLines ?? 0;
  if (stat === 0 && other === 0) return null;
  return (
    <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
      {stat > 0 && (
        <li>
          {plural(stat, 'line depends', 'lines depend')} on character stats and {stat === 1 ? 'is' : 'are'} not shown.
        </li>
      )}
      {other > 0 && (
        <li>
          {plural(other, 'other line is', 'other lines are')} not shown: the game engine computes {other === 1 ? 'it' : 'them'} (summon life
          and damage, …) or the calculator does not support {other === 1 ? 'its formula' : 'their formulas'} yet.
        </li>
      )}
    </ul>
  );
}

/** A line of the values list: one that changes with the level (a table row), or tooltip text */
type ValueEntry =
  | { readonly kind: 'row'; readonly key: string; readonly row: SkillTableRow }
  | { readonly kind: 'text'; readonly key: string; readonly text: string };

const TEXT_LINE = 'whitespace-pre-line text-blue-700 dark:text-blue-300';

/**
 * The lines at the selected level in tooltip order. A line that changes with the level shows its label and current
 * value, and the quick levels (1 / 20 / 30 / 50 / 110) under it; the other lines are the tooltip text. The text lines
 * before the first changing line sit above the table, so its level header row is right over that line.
 */
function ValueList({
  rows,
  results,
  varying,
  selected,
}: {
  readonly rows: readonly SkillTableRow[];
  readonly results: readonly SkillLineResult[];
  readonly varying: readonly SkillTableRow[];
  readonly selected: number;
}) {
  const ids = useId();
  const changing = new Set(varying.map((row) => row.key));
  const current = new Map(results.map((result) => [result.key, result]));
  const currentColumn = valueTableLevels(selected).indexOf(selected);
  const entries = rows.flatMap((row): ValueEntry[] => {
    if (row.block === 'synergy') return [];
    if (changing.has(row.key)) return [{ kind: 'row', key: row.key, row }];
    const result = current.get(row.key);
    if (result === undefined || result.unavailable === true || result.text === '') return [];
    return [{ kind: 'text', key: row.key, text: result.text }];
  });
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">No values at this level.</p>;
  const firstRow = entries.findIndex((entry) => entry.kind === 'row');
  const leading = firstRow === -1 ? entries : entries.slice(0, firstRow);
  const tableEntries = firstRow === -1 ? [] : entries.slice(firstRow);
  return (
    <>
      {leading.length > 0 && (
        <ul className="space-y-0.5 px-1">
          {leading.map((entry) => (
            <li key={entry.key} className={TEXT_LINE}>
              {entry.kind === 'text' ? entry.text : null}
            </li>
          ))}
        </ul>
      )}
      {tableEntries.length > 0 && (
        // Very long values (a lvl 110 range with text after it) scroll the table, not the card
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="sr-only">
              Values at level {selected}, with levels {QUICK_LEVELS.join(', ')} under each line that changes
            </caption>
            <thead>
              <tr className="text-[0.6875rem] text-muted-foreground">
                {QUICK_LEVELS.map((level) => (
                  <th
                    key={level}
                    id={`${ids}-l${String(level)}`}
                    scope="col"
                    title={level === MAX_LEVEL ? THEORETICAL_MAX : undefined}
                    className={cn('px-0.5 pt-1 text-right font-normal last:pr-1', level === selected && 'font-semibold text-foreground')}
                  >
                    Lvl {level}
                    {level === MAX_LEVEL && FOOTNOTE}
                  </th>
                ))}
              </tr>
            </thead>
            {tableEntries.map((entry, i) => {
              if (entry.kind === 'text') {
                return (
                  <tbody key={entry.key}>
                    <tr>
                      <th scope="rowgroup" colSpan={QUICK_LEVELS.length} className={cn('px-1 py-0.5 text-left font-normal', TEXT_LINE)}>
                        {entry.text}
                      </th>
                    </tr>
                  </tbody>
                );
              }
              const { label, cells } = tableRow(entry.row);
              const labelId = `${ids}-r${String(i)}`;
              // One row group per line: the label with the current value, then the quick levels
              return (
                <tbody key={entry.key} className="border-b border-border/60 last:border-b-0">
                  <tr>
                    <th
                      id={labelId}
                      scope="rowgroup"
                      colSpan={QUICK_LEVELS.length - 2}
                      className="px-1 pt-1.5 text-left align-baseline font-normal"
                    >
                      {label}
                    </th>
                    <td
                      colSpan={2}
                      headers={labelId}
                      className="px-1 pt-1.5 text-right align-baseline font-semibold whitespace-nowrap text-blue-700 dark:text-blue-300"
                    >
                      <span className="sr-only">At level {selected}: </span>
                      {cells.at(currentColumn) ?? ''}
                    </td>
                  </tr>
                  <tr className="text-xs text-muted-foreground">
                    {QUICK_LEVELS.map((level, column) => (
                      <td
                        key={level}
                        headers={`${labelId} ${ids}-l${String(level)}`}
                        className={cn(
                          'px-0.5 pb-1 text-right align-top whitespace-nowrap last:pr-1',
                          level === selected && 'font-semibold text-foreground'
                        )}
                      >
                        {cells.at(column) ?? ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </>
  );
}

/** Every level 1..20, then every 5th to 110 (plus the selected one); a level's button shows it in the card */
function FullTable({
  record,
  index,
  options,
  selected,
  minPickLevel,
  onPick,
}: {
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  readonly options: Omit<SkillCalcOptions, 'level'>;
  readonly selected: number;
  /** Levels below this are plain text (builds: the allocated points, which gear cannot lower) */
  readonly minPickLevel?: number;
  readonly onPick: (level: number) => void;
}) {
  const levels = fullTableLevels(selected);
  const columns = varyingRows(skillTable(record, index, levels, options)).map((row) => ({ key: row.key, ...tableRow(row) }));
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLTableSectionElement>(null);
  const selectedRef = useRef<HTMLTableRowElement>(null);
  // Keeps the selected level's row visible inside the table's own box (on open and after a pick)
  useEffect(() => {
    const box = boxRef.current;
    const row = selectedRef.current;
    if (box === null || row === null) return;
    const head = headRef.current?.offsetHeight ?? 0;
    const boxTop = box.getBoundingClientRect().top;
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - boxTop - head;
    const bottom = rowRect.bottom - boxTop;
    if (top >= 0 && bottom <= box.clientHeight) return;
    box.scrollTo({ top: Math.max(0, box.scrollTop + top - rowRect.height) });
  }, [selected]);
  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-auto rounded border text-xs">
      <table className="w-full border-collapse tabular-nums">
        <caption className="sr-only">Values at every level</caption>
        <thead ref={headRef} className="sticky top-0 z-10 bg-background">
          <tr className="text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-background px-2 py-1 text-right font-normal">
              Lvl
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="min-w-20 px-2 py-1 text-right align-bottom font-normal">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((level, i) => (
            <tr
              key={level}
              ref={level === selected ? selectedRef : undefined}
              className={cn('border-t border-border/60', level === selected && 'bg-primary/10 font-semibold')}
            >
              <th scope="row" className={cn('sticky left-0 px-1 py-0.5 text-right', level === selected ? 'bg-accent' : 'bg-background')}>
                {minPickLevel !== undefined && level < minPickLevel ? (
                  <span className="px-1" title={`Below this build's ${String(minPickLevel)} points`}>
                    {level}
                    {level === MAX_LEVEL && FOOTNOTE}
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={level === selected}
                    aria-label={`Show level ${String(level)} in the card`}
                    className="rounded px-1 tabular-nums hover:bg-accent hover:text-foreground"
                    onClick={() => {
                      onPick(level);
                    }}
                  >
                    {level}
                    {level === MAX_LEVEL && FOOTNOTE}
                  </button>
                )}
              </th>
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-0.5 text-right whitespace-nowrap">
                  {column.cells.at(i) ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
