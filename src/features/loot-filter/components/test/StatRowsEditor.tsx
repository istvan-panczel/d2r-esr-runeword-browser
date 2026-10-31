import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import { CHARGED_VALUE_HINT, sameParamEncoding, statParamKind } from '../../utils/statParams';
import { newStatRow, type StatRow } from '../../utils/testItemForm';
import { NumberInput } from '../NumberInput';
import { StatPicker } from '../pickers';
import { StatParamField } from '../rules/conditions/StatParamField';

interface StatRowsEditorProps {
  readonly data: LootFilterData;
  readonly idPrefix: string;
  readonly rows: readonly StatRow[];
  readonly onChange: (rows: readonly StatRow[]) => void;
  readonly addLabel: string;
}

/** Stat rows (stat, optional param, value) with add and remove; a row without stat or value is ignored by the test. */
export function StatRowsEditor({ data, idPrefix, rows, onChange, addLabel }: StatRowsEditorProps) {
  const update = (key: number, patch: Partial<Omit<StatRow, 'key'>>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => {
        const kind = row.stat === undefined ? undefined : statParamKind(row.stat, data.params);
        return (
          <div key={row.key} className="flex flex-wrap items-center gap-1.5">
            <StatPicker
              data={data}
              id={`${idPrefix}-${String(index)}-stat`}
              value={row.stat}
              onChange={(stat) => {
                // A param of another kind would name something else: drop it.
                update(row.key, sameParamEncoding(kind, statParamKind(stat, data.params)) ? { stat } : { stat, param: undefined });
              }}
              className="min-w-0 flex-1 basis-40"
            />
            <StatParamField
              data={data}
              stat={row.stat}
              param={row.param}
              onChange={(param) => {
                update(row.key, { param });
              }}
            />
            <NumberInput
              aria-label="Value"
              placeholder="value"
              className="h-8 w-24"
              value={row.value}
              onCommit={(value) => {
                update(row.key, { value });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8"
              aria-label="Remove the stat"
              onClick={() => {
                onChange(rows.filter((candidate) => candidate.key !== row.key));
              }}
            >
              <X />
            </Button>
            {kind === 'charged' && <p className="basis-full text-xs text-muted-foreground">{CHARGED_VALUE_HINT}</p>}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-fit px-2 text-xs"
        onClick={() => {
          onChange([...rows, newStatRow()]);
        }}
      >
        <Plus className="size-3.5" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
