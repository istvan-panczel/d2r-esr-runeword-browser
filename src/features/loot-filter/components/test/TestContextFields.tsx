import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DIFFICULTIES, type LootFilter } from '../../engine/types';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import { defaultFilterLevel, isTown, type TestItemForm } from '../../utils/testItemForm';
import { NumberInput } from '../NumberInput';
import { SinglePicker } from '../pickers';
import { idCustom } from '../pickers/customOptions';
import { StatRowsEditor } from './StatRowsEditor';
import { Field } from '../Field';

const ID = 'loot-filter-test-context';

interface TestContextFieldsProps {
  readonly data: LootFilterData;
  readonly filter: LootFilter;
  readonly form: TestItemForm;
  readonly onChange: (form: TestItemForm) => void;
}

/** Where and when the item drops: difficulty, area, filter level and the player's stats. */
export function TestContextFields({ data, filter, form, onChange }: TestContextFieldsProps) {
  const update = (patch: Partial<TestItemForm>) => {
    onChange({ ...form, ...patch });
  };
  const levels = filter.filterLevels ?? [];
  const level = form.filterLevel ?? defaultFilterLevel(filter);
  const levelKnown = levels.some((entry) => entry.id === level);
  const areaName = data.lookup.areaName(form.area);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${ID}-difficulty`} label="Difficulty" dense>
          <Select
            value={String(form.difficulty)}
            onValueChange={(value) => {
              update({ difficulty: Number(value) });
            }}
          >
            <SelectTrigger id={`${ID}-difficulty`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((difficulty, index) => (
                <SelectItem key={difficulty} value={String(index)}>
                  {difficulty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${ID}-player-level`} label="Character level (stat 12)" dense>
          <NumberInput
            id={`${ID}-player-level`}
            integer
            min={1}
            max={999}
            className="h-8"
            value={form.playerLevel}
            placeholder="1"
            onCommit={(playerLevel) => {
              update({ playerLevel });
            }}
          />
        </Field>
      </div>

      <Field id={`${ID}-area`} label="Area" dense>
        <SinglePicker
          id={`${ID}-area`}
          options={data.options.areas}
          value={String(form.area)}
          onChange={(value) => {
            const area = Number(value);
            if (Number.isInteger(area)) update({ area });
          }}
          describe={(value) => ({
            label: areaName ?? `Area ${value}`,
            detail: value,
            muted: data.status === 'ready' && areaName === undefined,
          })}
          placeholder="Pick an area"
          searchPlaceholder="Area name or id…"
          custom={idCustom('area')}
          className="w-full"
        />
        {isTown(form.area) && (
          <p className="text-xs text-muted-foreground">In town: rules whose excluded areas list the towns are skipped here.</p>
        )}
      </Field>

      <Field id={`${ID}-level`} label="Filter level" dense>
        {levels.length === 0 ? (
          <p className="text-xs text-muted-foreground">The filter has no levels; testing at level {level}.</p>
        ) : (
          <Select
            value={String(level)}
            onValueChange={(value) => {
              update({ filterLevel: Number(value) });
            }}
          >
            <SelectTrigger id={`${ID}-level`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!levelKnown && <SelectItem value={String(level)}>{`${String(level)} (not a level of this filter)`}</SelectItem>}
              {levels.map((entry) => (
                <SelectItem key={entry.id} value={String(entry.id)}>
                  {`${String(entry.id)}: ${entry.name}${entry.id === defaultFilterLevel(filter) ? ' (default)' : ''}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">More character stats</span>
        <StatRowsEditor
          data={data}
          idPrefix={`${ID}-player-stat`}
          rows={form.playerStats}
          onChange={(playerStats) => {
            update({ playerStats });
          }}
          addLabel="Add character stat"
        />
      </div>
    </div>
  );
}
