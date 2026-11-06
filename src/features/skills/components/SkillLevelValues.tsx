import { Fragment, useId, useState, type ReactNode, type Ref } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  MAX_LEVEL,
  QUICK_LEVELS,
  tableRow,
  varyingRows,
  type SkillLevelPatch,
  type SkillLevelState,
} from '../utils/skillLevels';
import { keyed } from '../utils/skills';
import { LevelInput } from './LevelInput';

/** How a page drives the detail card's per-level values */
export interface SkillLevelsConfig {
  readonly state: SkillLevelState;
  /** The skill's own hard points (builds: the allocated points); default min(level, max level) */
  readonly hardPoints?: number;
  readonly onChange: (patch: SkillLevelPatch) => void;
  /** Replaces the skill level input, slider and quick buttons (builds: hard points + gear) */
  readonly levelControl?: ReactNode;
  /** Shown above the level controls ("not learned in this build") */
  readonly note?: ReactNode;
  /** Next to the "Max synergies" toggle (builds: reset to the build's points) */
  readonly synergyAction?: ReactNode;
}

interface SkillLevelValuesProps {
  readonly config: SkillLevelsConfig;
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  /** The lines at the selected level (every block) */
  readonly results: readonly SkillLineResult[];
  /** The compact table (QUICK_LEVELS columns) */
  readonly rows: readonly SkillTableRow[];
  /** What both tables evaluate with besides the level */
  readonly tableOptions: Omit<SkillCalcOptions, 'level'>;
  readonly hasSynergies: boolean;
  readonly sectionRef: Ref<HTMLElement>;
}

const FOOTNOTE = '*';

/** The calculator block of the skill detail card: level controls, the lines at that level and the per-level tables. */
export function SkillLevelValues({ config, record, index, results, rows, tableOptions, hasSynergies, sectionRef }: SkillLevelValuesProps) {
  const { state, onChange } = config;
  const ids = useId();
  const varying = varyingRows(rows);
  const lines = results.filter((result) => result.block !== 'synergy' && result.unavailable !== true && result.text !== '');
  const showControls = varying.length > 0 || hasSynergies;

  return (
    <section
      ref={sectionRef}
      aria-label="Values per skill level"
      className="scroll-mt-20 space-y-3 rounded-md border bg-background/60 p-2 sm:p-3"
    >
      {config.note}
      {showControls && (
        <div className="space-y-2">
          {config.levelControl ??
            (varying.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Label htmlFor={`${ids}-level`} className="shrink-0 text-xs font-normal text-muted-foreground">
                    Skill level
                  </Label>
                  <LevelInput
                    id={`${ids}-level`}
                    value={state.level}
                    min={1}
                    max={MAX_LEVEL}
                    onCommit={(level) => {
                      onChange({ level });
                    }}
                  />
                  <Slider
                    className="min-w-0 flex-1"
                    min={1}
                    max={MAX_LEVEL}
                    step={1}
                    value={[state.level]}
                    onValueChange={(values) => {
                      const level = values.at(0);
                      if (level !== undefined) onChange({ level });
                    }}
                    thumbProps={{ 'aria-label': 'Skill level' }}
                  />
                </div>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Quick skill levels">
                  {QUICK_LEVELS.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant={state.level === level ? 'default' : 'outline'}
                      aria-pressed={state.level === level}
                      className="h-7 px-2.5 tabular-nums"
                      onClick={() => {
                        onChange({ level });
                      }}
                    >
                      {level === MAX_LEVEL ? `${String(level)}${FOOTNOTE}` : level}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          {record.scalesWithCharLevel === true && (
            <div className="flex items-center gap-3">
              <Label htmlFor={`${ids}-clvl`} className="shrink-0 text-xs font-normal text-muted-foreground">
                Character level
              </Label>
              <LevelInput
                id={`${ids}-clvl`}
                value={state.charLevel}
                min={1}
                max={MAX_LEVEL}
                onCommit={(charLevel) => {
                  onChange({ charLevel });
                }}
              />
            </div>
          )}
          {hasSynergies && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={state.synergy === 'max'}
                  onCheckedChange={(checked) => {
                    onChange({ synergy: checked === true ? 'max' : null });
                  }}
                />
                <span className="text-xs">Max synergies</span>
              </label>
              {config.synergyAction}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">At level {state.level}</h3>
        {lines.length > 0 ? (
          <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
            {keyed(lines, (line) => line.key).map(({ key, value }) => (
              <li key={key} className="whitespace-pre-line">
                {value.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No values at this level.</p>
        )}
        <HiddenLinesNote record={record} />
      </div>

      {varying.length > 0 && <CompactTable rows={varying} selected={state.level} />}
      {varying.length > 0 && <FullTable record={record} index={index} options={tableOptions} selected={state.level} />}

      <p className="text-xs text-muted-foreground">
        Values for a character without items or ascendancy bonuses; levels above 20 need +skills. {FOOTNOTE}110 is the theoretical max
        (player community). Formulas from the game files, not all verified in game.
      </p>
    </section>
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
      {stat > 0 && <li>{plural(stat, 'line depends', 'lines depend')} on character stats and is not shown.</li>}
      {other > 0 && (
        <li>
          {plural(other, 'other line is', 'other lines are')} not shown: the game engine computes {other === 1 ? 'it' : 'them'} (summon life
          and damage, …) or the calculator does not support {other === 1 ? 'its formula' : 'their formulas'} yet.
        </li>
      )}
    </ul>
  );
}

/** Levels 1 / 20 / 30 / 50 / 110: each line's label on its own row, the values below (fits the 22rem card) */
function CompactTable({ rows, selected }: { readonly rows: readonly SkillTableRow[]; readonly selected: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs tabular-nums">
        <caption className="sr-only">Values at levels {QUICK_LEVELS.join(', ')}</caption>
        <thead>
          <tr className="text-muted-foreground">
            {QUICK_LEVELS.map((level) => (
              <th
                key={level}
                scope="col"
                className={cn(
                  'px-1 py-0.5 text-right font-normal',
                  level === selected && 'rounded-t bg-primary/10 font-semibold text-foreground'
                )}
              >
                Lvl {level}
                {level === MAX_LEVEL && FOOTNOTE}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { label, cells } = tableRow(row);
            return (
              <Fragment key={row.key}>
                <tr>
                  <th scope="colgroup" colSpan={QUICK_LEVELS.length} className="px-1 pt-1.5 text-left font-medium">
                    {label}
                  </th>
                </tr>
                <tr className="border-b border-border/60">
                  {QUICK_LEVELS.map((level, i) => (
                    <td key={level} className={cn('px-1 py-0.5 text-right align-top', level === selected && 'bg-primary/10 font-semibold')}>
                      {cells.at(i) ?? ''}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Every level 1..20, then every 5th to 110 (plus the selected one); computed only while open */
function FullTable({
  record,
  index,
  options,
  selected,
}: {
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  readonly options: Omit<SkillCalcOptions, 'level'>;
  readonly selected: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group text-xs"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        All levels
      </summary>
      {open && <FullTableBody record={record} index={index} options={options} selected={selected} />}
    </details>
  );
}

function FullTableBody({
  record,
  index,
  options,
  selected,
}: {
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  readonly options: Omit<SkillCalcOptions, 'level'>;
  readonly selected: number;
}) {
  const levels = fullTableLevels(selected);
  const columns = varyingRows(skillTable(record, index, levels, options)).map((row) => ({ key: row.key, ...tableRow(row) }));
  return (
    <div className="mt-2 max-h-[28rem] overflow-auto rounded border">
      <table className="border-collapse tabular-nums">
        <caption className="sr-only">Values at every level</caption>
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-2 py-1 text-right font-normal">
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
            <tr key={level} className={cn('border-t border-border/60', level === selected && 'bg-primary/10 font-semibold')}>
              <th scope="row" className={cn('sticky left-0 px-2 py-0.5 text-right', level === selected ? 'bg-accent' : 'bg-card')}>
                {level}
                {level === MAX_LEVEL && FOOTNOTE}
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
