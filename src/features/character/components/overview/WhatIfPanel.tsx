import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComboPicker, type ComboOption } from '@/features/game-data/components/ComboPicker';
import { LevelStepper } from '@/features/skills/components/LevelInput';
import type { SheetData } from '../../engine/sheet';
import type { CharacterSheet, WhatIfEntries, WhatIfStat } from '../../engine/sheet/types';
import {
  listWhatIfSkills,
  listWhatIfStats,
  WHAT_IF_GROUP_TITLES,
  WHAT_IF_MAX_LEVEL,
  WHAT_IF_MAX_VALUE,
  whatIfStatId,
  whatIfStatText,
  type WhatIfSkillOption,
  type WhatIfStatOption,
} from '../../engine/sheet/whatIf';
import {
  addWhatIfSkill,
  addWhatIfStat,
  changeWhatIfStat,
  parseWhatIfValue,
  removeWhatIfSkill,
  removeWhatIfStat,
  setWhatIfSkill,
  setWhatIfStat,
  whatIfChanges,
  whatIfCount,
  whatIfSkillProblem,
  type WhatIfChange,
} from '../../engine/whatIfView';
import { NUMBER_FORMAT } from '../tabs/tabClasses';
import { WhatIfBadge } from './BuffedBadge';
import { SheetCard } from './SheetParts';

const LINK_CLASS =
  'rounded text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring';
const ROW_CLASS = 'flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5';

const statCombo = (options: readonly WhatIfStatOption[]): ComboOption[] =>
  options.map((option) => {
    const group = WHAT_IF_GROUP_TITLES[option.group];
    return { id: option.id, label: option.label, detail: group, search: `${option.label} ${group} ${option.stat}`.toLowerCase() };
  });

function skillDetail(option: WhatIfSkillOption): string {
  const kind = option.className === null ? 'item aura' : option.aura ? `${option.className} aura` : `${option.className} skill`;
  return option.changesSheet ? kind : `${kind}, no number on this sheet`;
}

const skillCombo = (options: readonly WhatIfSkillOption[]): ComboOption[] =>
  options.map((option) => {
    const detail = skillDetail(option);
    return { id: String(option.skillId), label: option.name, detail, search: `${option.name} ${detail}`.toLowerCase() };
  });

const LIMIT_TEXT = `Whole numbers from −${NUMBER_FORMAT.format(WHAT_IF_MAX_VALUE)} to ${NUMBER_FORMAT.format(WHAT_IF_MAX_VALUE)}`;

/**
 * A whole number field (may be negative) whose text may be unfinished ("", "-"): the entry changes only on a valid
 * number. A finished text the sheet cannot use (out of range, a fraction) is marked invalid with the value the sheet
 * still uses, and goes back to that value on leaving the field: the field and the sheet never disagree silently
 */
function ValueInput({
  value,
  label,
  onChange,
}: {
  readonly value: number;
  readonly label: string;
  readonly onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const messageId = useId();
  // Follow a value changed from outside (Clear, another character), keeping an unfinished draft of the same number
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseWhatIfValue(draft) !== value) setDraft(String(value));
  }
  const unfinished = draft.trim() === '' || draft.trim() === '-';
  const invalid = !unfinished && parseWhatIfValue(draft) === null;
  return (
    <span className="flex flex-col gap-0.5">
      <Input
        type="number"
        step={1}
        min={-WHAT_IF_MAX_VALUE}
        max={WHAT_IF_MAX_VALUE}
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? messageId : undefined}
        autoComplete="off"
        className="h-8 w-28 tabular-nums"
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const parsed = parseWhatIfValue(text);
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => {
          if (parseWhatIfValue(draft) === null) setDraft(String(value));
        }}
      />
      {invalid && (
        <span id={messageId} className="max-w-56 text-xs text-destructive">
          {LIMIT_TEXT}. The sheet still uses {NUMBER_FORMAT.format(value)}.
        </span>
      )}
    </span>
  );
}

interface StatRowProps {
  readonly entry: WhatIfStat;
  readonly index: number;
  readonly data: SheetData;
  readonly options: readonly WhatIfStatOption[];
  readonly combo: readonly ComboOption[];
  readonly entries: WhatIfEntries;
  readonly onChange: (entries: WhatIfEntries) => void;
}

function StatRow({ entry, index, data, options, combo, entries, onChange }: StatRowProps) {
  const id = useId();
  const text = whatIfStatText(data, entry);
  const option = options.find((candidate) => candidate.id === whatIfStatId(entry));
  // Named by the stat, not the value, so the name stays while typing
  const name = option?.label ?? entry.stat;
  return (
    <li className={ROW_CLASS}>
      <ComboPicker
        id={id}
        options={combo}
        maxResults={combo.length}
        selectedId={whatIfStatId(entry)}
        placeholder="Pick a stat"
        searchPlaceholder="Search stats: strength, life, resist, a skill’s name…"
        onSelect={(next) => {
          const picked = options.find((candidate) => candidate.id === next);
          if (picked !== undefined) onChange(changeWhatIfStat(entries, index, picked, options));
        }}
        className="h-8 min-w-0 flex-1 basis-full sm:basis-56"
      />
      {option?.flag === true ? (
        // A yes / no stat: always 1, no number to type
        <span className="text-sm">Yes</span>
      ) : (
        <ValueInput
          value={entry.value}
          label={`Value of ${name}`}
          onChange={(value) => {
            onChange(setWhatIfStat(entries, index, { ...entry, value }));
          }}
        />
      )}
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{text}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        title="Remove"
        onClick={() => {
          onChange(removeWhatIfStat(entries, index));
        }}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}

function ChangeList({ changes, label }: { readonly changes: readonly WhatIfChange[]; readonly label: string }) {
  return (
    <ul aria-label={label} className="divide-y text-sm">
      {changes.map((entry) => (
        <li key={entry.key} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1">
          <span className="text-muted-foreground">{entry.label}</span>
          <span className="tabular-nums">
            <span className="text-muted-foreground">{entry.beforeText}</span>
            <span aria-hidden> → </span>
            <span className="sr-only"> becomes </span>
            <span className="font-semibold">{entry.afterText}</span>
            {entry.deltaText !== null && <span className="ml-1.5 text-xs font-medium">({entry.deltaText})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface WhatIfPanelProps {
  readonly classId: number;
  readonly data: SheetData;
  readonly entries: WhatIfEntries;
  /** The sheet with the entries (and the buffs switched on) */
  readonly sheet: CharacterSheet;
  /** The same without the entries; null when no entry counts */
  readonly withoutWhatIf: CharacterSheet | null;
  readonly onChange: (entries: WhatIfEntries) => void;
}

/**
 * "What if": stats and auras the user adds on top of the sheet (as if a charm carried the stats, as if an item gave the
 * aura), and what changes. Nothing is written to the save; the entries are remembered for this browser tab like the
 * buffs, and every tab's numbers follow them (marked with the ? and the what-if badge).
 */
export function WhatIfPanel({ classId, data, entries, sheet, withoutWhatIf, onChange }: WhatIfPanelProps) {
  const statOptions = listWhatIfStats(data, classId);
  const skillOptions = listWhatIfSkills(data);
  const stats = statCombo(statOptions);
  const skills = skillCombo(skillOptions);
  const skillName = (skillId: number) => skillOptions.find((option) => option.skillId === skillId)?.name ?? data.skillName(skillId);
  const diff = withoutWhatIf === null ? null : whatIfChanges(withoutWhatIf, sheet, NUMBER_FORMAT);
  const offSheet = (sheet.whatIf?.skills ?? []).filter((skill) => skill.unshown.length > 0);
  // Skill rows say themselves why they are not counted; the rest (an unknown stat) here
  const notes = sheet.warnings.filter((warning) => warning.startsWith('What if: the stat'));
  const count = whatIfCount(entries);
  const changesId = useId();

  return (
    <SheetCard
      id="character-what-if"
      title="What if"
      actions={
        count > 0 ? (
          <span className="flex flex-wrap items-center gap-2">
            {sheet.whatIf !== undefined && <WhatIfBadge />}
            <button
              type="button"
              className={LINK_CLASS}
              onClick={() => {
                onChange({});
              }}
            >
              Clear
            </button>
          </span>
        ) : undefined
      }
    >
      <p className="mb-3 max-w-prose text-sm text-muted-foreground">
        Add a stat or an aura to see what an upgrade would change. Nothing is written to your character.
      </p>
      <div className="grid gap-x-6 gap-y-4 @3xl/page:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-medium">Stats</h4>
          <p className="text-xs text-muted-foreground">
            Counted as if a charm in your Charm Inventory had them: attributes, resists, speeds, and + to all skills, a skill tab or one of
            your class&apos;s skills. A minus value takes away.
          </p>
          {(entries.stats?.length ?? 0) > 0 && (
            <ul className="space-y-2">
              {(entries.stats ?? []).map((entry, index) => (
                <StatRow
                  // A row is its place and stat: a removed row above remounts the ones below with their own values
                  key={`${String(index)}:${whatIfStatId(entry)}`}
                  entry={entry}
                  index={index}
                  data={data}
                  options={statOptions}
                  combo={stats}
                  entries={entries}
                  onChange={onChange}
                />
              ))}
            </ul>
          )}
          <ComboPicker
            id="character-what-if-add-stat"
            options={stats}
            maxResults={stats.length}
            selectedId={null}
            placeholder="Add a stat"
            searchPlaceholder="Search stats: strength, life, resist, a skill’s name…"
            onSelect={(id) => {
              const option = statOptions.find((candidate) => candidate.id === id);
              if (option !== undefined) onChange(addWhatIfStat(entries, option));
            }}
            className="w-full sm:w-72"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-medium">Auras and skills</h4>
          <p className="text-xs text-muted-foreground">
            Counted like an aura an equipped item gives you, at the level you choose, whether or not you have the skill.
          </p>
          {(entries.skills?.length ?? 0) > 0 && (
            <ul className="space-y-2">
              {(entries.skills ?? []).map((entry, index) => {
                const name = skillName(entry.skillId);
                const problem = whatIfSkillProblem(sheet, entries, index);
                return (
                  <li key={`${String(index)}:${String(entry.skillId)}`} className={ROW_CLASS}>
                    <ComboPicker
                      id={`character-what-if-skill-${String(index)}`}
                      options={skills}
                      maxResults={skills.length}
                      selectedId={String(entry.skillId)}
                      placeholder="Pick a skill"
                      searchPlaceholder="Search skills: concentration, battle orders, paladin…"
                      onSelect={(id) => {
                        onChange(setWhatIfSkill(entries, index, { ...entry, skillId: Number(id) }));
                      }}
                      className="h-8 min-w-0 flex-1 basis-full sm:basis-56"
                    />
                    <LevelStepper
                      label={`${name} level`}
                      value={entry.level}
                      min={1}
                      max={WHAT_IF_MAX_LEVEL}
                      onCommit={(level) => {
                        onChange(setWhatIfSkill(entries, index, { ...entry, level }));
                      }}
                    />
                    <span className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${name}`}
                      title="Remove"
                      onClick={() => {
                        onChange(removeWhatIfSkill(entries, index));
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                    {problem !== null && (
                      <span className="basis-full text-xs text-amber-700 dark:text-amber-400">Not counted: {problem}.</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ComboPicker
            id="character-what-if-add-skill"
            options={skills}
            maxResults={skills.length}
            selectedId={null}
            placeholder="Add an aura or skill"
            searchPlaceholder="Search skills: concentration, battle orders, paladin…"
            onSelect={(id) => {
              onChange(addWhatIfSkill(entries, Number(id)));
            }}
            className="w-full sm:w-72"
          />
        </div>
      </div>

      <section aria-labelledby={changesId} className="mt-4 space-y-2 border-t pt-3">
        <h4 id={changesId} className="text-sm font-medium">
          What changes
        </h4>
        {diff === null ? (
          <p className="text-sm text-muted-foreground">
            {count === 0 ? 'Nothing added yet.' : 'These entries change nothing: every value is 0.'}
          </p>
        ) : (
          <>
            {diff.numbers.length > 0 ? (
              <ChangeList changes={diff.numbers} label="Numbers that change" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {diff.skills.length === 0 ? 'No number on this sheet changes.' : 'No number on the cards changes, only skill levels.'}
              </p>
            )}
            {diff.skills.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  {diff.skills.length} skill {diff.skills.length === 1 ? 'level changes' : 'levels change'}
                </summary>
                <ChangeList changes={diff.skills} label="Skill levels that change" />
              </details>
            )}
          </>
        )}
        {offSheet.length > 0 && (
          <p className="max-w-prose text-xs text-muted-foreground">
            Not shown on this sheet (damage and the like):{' '}
            {offSheet.map((skill) => `${skill.name} level ${String(skill.level)}: ${skill.unshown.join(', ')}`).join('; ')}.
          </p>
        )}
        {notes.length > 0 && (
          <ul className="max-w-prose list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note.slice('What if: '.length)}</li>
            ))}
          </ul>
        )}
        {diff !== null && diff.numbers.length + diff.skills.length > 0 && (
          <p className="text-xs text-muted-foreground">
            The cards above show these numbers too, with the ? mark and your own value struck through. Worked out from the game files, not
            checked in game.
          </p>
        )}
      </section>
    </SheetCard>
  );
}
