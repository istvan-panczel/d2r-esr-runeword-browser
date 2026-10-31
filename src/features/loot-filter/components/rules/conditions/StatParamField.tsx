import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  decodeSkillLevelLayer,
  MAX_LAYER_LEVEL,
  MAX_LAYER_SKILL,
  MAX_STAT_PARAM,
  skillLevelLayer,
  type StatLayerKind,
} from '@/features/game-data/engine/statLayers';
import type { LootFilterData } from '../../../hooks/useLootFilterData';
import type { PickerCustom } from '../../pickers/PickerList';
import { SinglePicker } from '../../pickers';
import { classOptions, knownLevels, skillLabel, skillOptions, statParamKind, statParamLabel, tabOptions } from '../../../utils/statParams';
import { NumberInput } from '../../NumberInput';

/** "Any known level" of a rule's stat row: one check per level the game data knows (see `anyKnownLevelChecks`). */
export interface AnyKnownLevel {
  /** False in a list where one check per level would not mean "at any level" (`expandsAcrossLevels`). */
  readonly allowed: boolean;
  /** Why it is not allowed, shown on the disabled option. */
  readonly hint: string;
  /** Picked for the row's skill (the caller writes `anyKnownLevelChecks`). */
  readonly onPick: (skillId: number) => void;
}

interface StatParamFieldProps {
  readonly data: LootFilterData;
  /** The row's stat (an itemstatcost name or id); undefined until picked. */
  readonly stat: string | number | undefined;
  readonly param: number | undefined;
  readonly onChange: (param: number | undefined) => void;
  /** Rule rows only (the Test tab describes one item, so it has no "any level"). */
  readonly anyKnownLevel?: AnyKnownLevel;
}

const PICKER_CLASS = 'w-full sm:w-56';

const PLACEHOLDERS: Readonly<Record<'tab' | 'class' | 'skill', string>> = {
  tab: 'Pick a skill tab',
  class: 'Pick a class',
  skill: 'Pick a skill',
};

const SEARCH_PLACEHOLDERS: Readonly<Record<'tab' | 'class' | 'skill', string>> = {
  tab: 'Tab or class name, or param…',
  class: 'Class name or param…',
  skill: 'Skill name, class or id…',
};

/** Typed digits as a raw param (an unknown skill id, a layer the data does not name). */
const customParam =
  (max: number, what: string): PickerCustom =>
  (query) => {
    if (!/^\d+$/.test(query)) return null;
    const value = Number(query);
    return value <= max ? { value: String(value), label: `Use ${what} ${String(value)}` } : null;
  };

function ParamNumberInput({ param, onChange, title }: Pick<StatParamFieldProps, 'param' | 'onChange'> & { readonly title?: string }) {
  return (
    <NumberInput
      aria-label="Param"
      integer
      className="h-8 w-20"
      placeholder="param"
      title={title}
      value={param}
      onCommit={(next) => {
        // An emptied param removes it, so the field and the model agree.
        onChange(next);
      }}
    />
  );
}

/** The skill picker and level select of an event or charged stat (`skill << 6 | level`). */
function SkillLevelField({
  data,
  statId,
  kind,
  param,
  onChange,
  anyKnownLevel,
}: Omit<StatParamFieldProps, 'stat'> & { readonly statId: number | undefined; readonly kind: 'event' | 'charged' }) {
  const [otherLevel, setOtherLevel] = useState(false);
  const decoded = param === undefined ? undefined : decodeSkillLevelLayer(param);
  if (param !== undefined && decoded === undefined) {
    // Level 0 or out of range: the raw number, so it can be fixed (the validator says what is wrong).
    return <ParamNumberInput param={param} onChange={onChange} title="This param names no skill and level" />;
  }
  const known = decoded === undefined ? [] : knownLevels(statId, decoded.skill, data.params);
  const levels = decoded === undefined || known.includes(decoded.level) ? known : [...known, decoded.level].sort((a, b) => a - b);

  const pickSkill = (skill: number) => {
    const skillLevels = knownLevels(statId, skill, data.params);
    const current = decoded?.level;
    const level = current !== undefined && (skillLevels.length === 0 || skillLevels.includes(current)) ? current : (skillLevels[0] ?? 1);
    onChange(skillLevelLayer(skill, level));
  };

  return (
    <>
      <SinglePicker
        aria-label="Skill"
        options={skillOptions(statId, kind, data.params)}
        value={decoded === undefined ? undefined : String(decoded.skill)}
        onChange={(picked) => {
          pickSkill(Number(picked));
        }}
        describe={(value) => {
          const label = skillLabel(Number(value), data.params);
          return { label: label ?? `Skill ${value}`, detail: `#${value}`, muted: label === undefined && data.status === 'ready' };
        }}
        placeholder={PLACEHOLDERS.skill}
        searchPlaceholder={SEARCH_PLACEHOLDERS.skill}
        custom={customParam(MAX_LAYER_SKILL, 'skill id')}
        className={PICKER_CLASS}
      />
      {decoded !== undefined && (
        <Select
          value={String(decoded.level)}
          onValueChange={(next) => {
            if (next === 'other') setOtherLevel(true);
            else if (next === 'any') anyKnownLevel?.onPick(decoded.skill);
            else onChange(skillLevelLayer(decoded.skill, Number(next)));
          }}
        >
          <SelectTrigger size="sm" aria-label="Skill level" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((level) => (
              <SelectItem key={level} value={String(level)}>
                lvl {level}
              </SelectItem>
            ))}
            <SelectItem value="other">Other level…</SelectItem>
            {anyKnownLevel !== undefined && known.length > 1 && (
              <SelectItem value="any" disabled={!anyKnownLevel.allowed}>
                Any known level ({known.length}){!anyKnownLevel.allowed && <span className="text-xs">{anyKnownLevel.hint}</span>}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}
      {decoded !== undefined && (otherLevel || !known.includes(decoded.level)) && (
        <NumberInput
          aria-label="Level"
          integer
          className="h-8 w-16"
          placeholder="level"
          title={`Level 1 to ${String(MAX_LAYER_LEVEL)}`}
          value={decoded.level}
          onCommit={(level) => {
            const next = level === undefined ? undefined : skillLevelLayer(decoded.skill, level);
            if (next !== undefined) onChange(next);
          }}
        />
      )}
    </>
  );
}

/**
 * The param of a stat row: a skill tab, class or skill picker for the layered stats (value = the param, see
 * game-data/engine/statLayers.ts), a skill picker plus level for the event and charged stats, else a number field.
 * Typed digits are taken as a raw param, so a param the data does not name can still be written.
 */
export function StatParamField({ data, stat, param, onChange, anyKnownLevel }: StatParamFieldProps) {
  const kind: StatLayerKind | undefined = stat === undefined ? undefined : statParamKind(stat, data.params);
  const statId = stat === undefined ? undefined : data.lookup.statId(stat);
  if (kind === undefined) return <ParamNumberInput param={param} onChange={onChange} />;
  if (kind === 'event' || kind === 'charged') {
    return <SkillLevelField data={data} statId={statId} kind={kind} param={param} onChange={onChange} anyKnownLevel={anyKnownLevel} />;
  }
  const options =
    kind === 'tab' ? tabOptions(data.params) : kind === 'class' ? classOptions(data.params) : skillOptions(statId, kind, data.params);
  return (
    <SinglePicker
      aria-label={kind === 'tab' ? 'Skill tab' : kind === 'class' ? 'Class' : 'Skill'}
      options={options}
      value={param === undefined ? undefined : String(param)}
      onChange={(picked) => {
        onChange(Number(picked));
      }}
      describe={(value) => {
        const label = statParamLabel(kind, Number(value), data.params);
        return { label: label ?? `Param ${value}`, detail: value, muted: label === undefined && data.status === 'ready' };
      }}
      placeholder={PLACEHOLDERS[kind]}
      searchPlaceholder={SEARCH_PLACEHOLDERS[kind]}
      custom={customParam(MAX_STAT_PARAM, 'param')}
      className={PICKER_CLASS}
    />
  );
}
