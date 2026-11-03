import { useState } from 'react';
import { ArrowDownWideNarrow, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComboPicker, type ComboOption } from '@/features/game-data/components/ComboPicker';
import { cn } from '@/lib/utils';
import { STAT_OPS, type StatCondition, type StatOp, type StatOption } from '../../engine/items/allItems';

interface StatConditionsProps {
  readonly conditions: readonly StatCondition[];
  /** The stats of the uploaded stash (statOptions); empty while the stat text is loading or missing */
  readonly options: readonly StatOption[];
  /** The stat the list is sorted by; null when it is not sorted by a stat */
  readonly sortStat: string | null;
  readonly onChange: (conditions: readonly StatCondition[]) => void;
  readonly onSortStat: (key: string | null) => void;
  /** The stat text is loading or missing: the conditions are kept (URL) but not applied */
  readonly unavailable: boolean;
}

const OP_LABELS: Readonly<Record<StatOp, string>> = { min: '≥', max: '≤' };
const OP_TITLES: Readonly<Record<StatOp, string>> = { min: 'at least', max: 'at most' };

const spanText = (option: StatOption) =>
  option.min === option.max ? String(option.min) : `${String(option.min)} to ${String(option.max)}`;

function comboOptions(options: readonly StatOption[]): ComboOption[] {
  return options.map((option) => ({
    id: option.key,
    label: option.label,
    detail: `${String(option.count)} item${option.count === 1 ? '' : 's'} · ${spanText(option)}`,
    search: [option.label, option.statLabel, option.paramLabel].join(' ').toLowerCase(),
  }));
}

/** The stat filter builder: one "stat ≥ / ≤ value" row per condition (all must match), a picker to add one, the stat sort. */
export function StatConditions({ conditions, options, sortStat, onChange, onSortStat, unavailable }: StatConditionsProps) {
  const byKey = new Map(options.map((option) => [option.key, option]));
  const combo = comboOptions(options);
  const replace = (index: number, condition: StatCondition) => {
    onChange(conditions.map((entry, at) => (at === index ? condition : entry)));
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-muted-foreground">Stat filters (every one must match; values as the tooltip shows them)</p>
        {unavailable && conditions.length > 0 && (
          <p className="text-xs text-muted-foreground italic">These stat filters apply once the stat text is there.</p>
        )}
      </div>
      {conditions.length > 0 && (
        <ul className="space-y-2">
          {conditions.map((condition, index) => (
            <ConditionRow
              // A condition row is identified by its place and key (a changed key is a new row)
              key={`${String(index)}:${condition.key}`}
              condition={condition}
              option={byKey.get(condition.key) ?? null}
              sorted={sortStat === condition.key}
              disabled={unavailable}
              onChange={(next) => {
                replace(index, next);
              }}
              onRemove={() => {
                onChange(conditions.filter((_, at) => at !== index));
              }}
              onSort={() => {
                onSortStat(sortStat === condition.key ? null : condition.key);
              }}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ComboPicker
          id="stash-items-add-stat"
          options={combo}
          selectedId={null}
          placeholder={options.length === 0 ? 'No stats to filter by yet' : `Add a stat filter (${String(options.length)} stats)…`}
          searchPlaceholder="Search stats: faster cast, resist, fire ball…"
          onSelect={(key) => {
            const option = byKey.get(key);
            onChange([...conditions, { key, op: 'min', value: option?.min ?? 1 }]);
          }}
          className="w-full sm:w-80"
        />
        <ComboPicker
          id="stash-items-sort-stat"
          options={combo}
          selectedId={sortStat}
          placeholder="Sort by a stat…"
          searchPlaceholder="Search stats to sort by…"
          onSelect={onSortStat}
          className="w-full sm:w-80"
        />
        {sortStat !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSortStat(null);
            }}
          >
            <X className="size-4" aria-hidden /> Stop sorting by the stat
          </Button>
        )}
      </div>
    </div>
  );
}

interface ConditionRowProps {
  readonly condition: StatCondition;
  readonly option: StatOption | null;
  readonly sorted: boolean;
  readonly disabled: boolean;
  readonly onChange: (condition: StatCondition) => void;
  readonly onRemove: () => void;
  readonly onSort: () => void;
}

function ConditionRow({ condition, option, sorted, disabled, onChange, onRemove, onSort }: ConditionRowProps) {
  const label = option?.label ?? condition.key;
  return (
    <li className={cn('flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5', disabled && 'opacity-60')}>
      <span className="min-w-0 flex-1 basis-full text-sm break-words sm:basis-auto">
        {label}
        {option === null ? (
          <span className="ml-1 text-xs text-muted-foreground">
            {disabled ? '(waiting for the stat text)' : '(no item in this stash has it)'}
          </span>
        ) : (
          <span className="ml-1 text-xs text-muted-foreground">
            ({option.count} items, {spanText(option)})
          </span>
        )}
      </span>
      <Select
        value={condition.op}
        onValueChange={(value) => {
          const op = STAT_OPS.find((entry) => entry === value);
          if (op !== undefined) onChange({ ...condition, op });
        }}
      >
        <SelectTrigger size="sm" className="w-16" aria-label={`Compare ${label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAT_OPS.map((op) => (
            <SelectItem key={op} value={op} title={OP_TITLES[op]}>
              {OP_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ValueInput
        value={condition.value}
        label={`${label} value`}
        onChange={(value) => {
          onChange({ ...condition, value });
        }}
      />
      <Button
        variant={sorted ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-pressed={sorted}
        onClick={onSort}
        aria-label={sorted ? `Stop sorting by ${label}` : `Sort by ${label}, highest first`}
        title={sorted ? 'Sorted by this stat' : 'Sort by this stat'}
      >
        <ArrowDownWideNarrow className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove the ${label} filter`} title="Remove">
        <X className="size-4" />
      </Button>
    </li>
  );
}

/** A number field whose text may be unfinished ("", "-"): the condition changes only on a valid number */
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
  // Follow a value changed from outside (back button, reset), keeping an unfinished draft of the same number
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (Number(draft) !== value) setDraft(String(value));
  }
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      value={draft}
      aria-label={label}
      className="h-8 w-24"
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const number = Number(text);
        if (text.trim() !== '' && Number.isFinite(number)) onChange(number);
      }}
    />
  );
}
