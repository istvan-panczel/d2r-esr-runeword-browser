import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAT_OPS, type StatCheck, type StatOp } from '../../../engine/types';
import type { LootFilterData } from '../../../hooks/useLootFilterData';
import {
  DEFAULT_STAT_OP,
  expandsAcrossLevels,
  newStatCheck,
  removeStatCheck,
  replaceStatCheck,
  replaceStatCheckWithMany,
  setStatOp,
  setStatParam,
  setStatValue,
} from '../../../utils/statChecks';
import { anyKnownLevelChecks, CHARGED_VALUE_HINT, sameParamEncoding, statParamKind } from '../../../utils/statParams';
import { StatPicker } from '../../pickers';
import { AffixBrowserDialog, type AffixBrowserMode } from '../../pickers/AffixBrowserDialog';
import { focusAfterRemoval } from '../../pickers/focusAfterRemoval';
import { RequiredNumberInput } from './RequiredNumberInput';
import { StatParamField } from './StatParamField';

function toOp(value: string): StatOp | undefined {
  return STAT_OPS.find((op) => op === value);
}

interface StatCheckRowProps {
  readonly id: string;
  readonly data: LootFilterData;
  readonly check: StatCheck;
  /** The row is in an any-of list (for "Any known level"). */
  readonly anyOf: boolean;
  readonly onChange: (check: StatCheck) => void;
  /** Replaces the row with several (one per known level). */
  readonly onReplace: (checks: readonly StatCheck[]) => void;
  readonly onRemove: () => void;
}

function StatCheckRow({ id, data, check, anyOf, onChange, onReplace, onRemove }: StatCheckRowProps) {
  const op = check.op ?? DEFAULT_STAT_OP;
  const { value } = check;
  const kind = statParamKind(check.stat, data.params);
  const negative = op === '<' || op === '<=' || op === '!=';
  return (
    <li className="flex flex-wrap items-center gap-1.5">
      <StatPicker
        id={id}
        data={data}
        value={check.stat}
        className="w-full sm:w-56"
        onChange={(stat) => {
          // A param of another kind (a skill id on a tab stat) would name something else: drop it.
          const next = { ...check, stat };
          onChange(sameParamEncoding(kind, statParamKind(stat, data.params)) ? next : setStatParam(next, undefined));
        }}
      />
      <StatParamField
        data={data}
        stat={check.stat}
        param={check.param}
        onChange={(param) => {
          onChange(setStatParam(check, param));
        }}
        anyKnownLevel={{
          allowed: expandsAcrossLevels(check, anyOf),
          hint: negative ? 'for a <, <= or != check only in an all-of list' : 'only in an any-of list; a rule has one any-of list',
          onPick: (skillId) => {
            onReplace(anyKnownLevelChecks(check, data.lookup.statId(check.stat), skillId, data.params));
          },
        }}
      />
      <Select
        value={op}
        onValueChange={(next) => {
          const parsed = toOp(next);
          if (parsed !== undefined) onChange(setStatOp(check, parsed));
        }}
      >
        <SelectTrigger size="sm" aria-label="Comparison" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAT_OPS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <RequiredNumberInput
        aria-label={typeof value === 'number' ? 'Value' : 'Low end'}
        className="h-8 w-20"
        data-stat-value
        value={typeof value === 'number' ? value : value[0]}
        onCommit={(next) => {
          onChange(setStatValue(check, 0, next));
        }}
      />
      {typeof value !== 'number' && (
        <>
          <span className="text-xs text-muted-foreground">and</span>
          <RequiredNumberInput
            aria-label="High end"
            className="h-8 w-20"
            value={value[1]}
            onCommit={(next) => {
              onChange(setStatValue(check, 1, next));
            }}
          />
        </>
      )}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove stat check" data-remove onClick={onRemove}>
        <X />
      </Button>
      {kind === 'charged' && <p className="basis-full text-xs text-muted-foreground">{CHARGED_VALUE_HINT}</p>}
    </li>
  );
}

interface StatCheckListProps {
  readonly id: string;
  readonly data: LootFilterData;
  readonly value: readonly StatCheck[] | undefined;
  /** An emptied list is `undefined` (the key goes away). */
  readonly onChange: (value: readonly StatCheck[] | undefined) => void;
  /** Shows "Browse affixes…" next to the add control (item stat lists). */
  readonly affixBrowser?: AffixBrowserMode;
  /** An any-of list (`itemStatsAnyOf`, `playerStatsAnyOf`): where "Any known level" of a `>=` check is offered. */
  readonly anyOf?: boolean;
}

/** Rows of stat, optional param, op and value (two values for `between`); a row is added by picking its stat. */
export function StatCheckList({ id, data, value, onChange, affixBrowser, anyOf = false }: StatCheckListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Set when a stat is picked, so the popover's close moves focus to the new row.
  const addedRef = useRef(false);
  const checks = value ?? [];
  return (
    <div ref={containerRef} className="space-y-1.5">
      {checks.length > 0 && (
        <ul className="space-y-1.5">
          {checks.map((check, index) => (
            <StatCheckRow
              // Rows have no identity of their own (two can be equal), so the position is the key.
              // eslint-disable-next-line react-x/no-array-index-key
              key={index}
              id={index === 0 ? id : `${id}-${String(index)}`}
              data={data}
              check={check}
              anyOf={anyOf}
              onChange={(next) => {
                onChange(replaceStatCheck(checks, index, next));
              }}
              onReplace={(many) => {
                onChange(replaceStatCheckWithMany(checks, index, many));
              }}
              onRemove={() => {
                onChange(removeStatCheck(checks, index));
                focusAfterRemoval(containerRef.current, index);
              }}
            />
          ))}
        </ul>
      )}
      <div data-focus-fallback className="flex flex-wrap items-center gap-1.5">
        <StatPicker
          id={checks.length === 0 ? id : undefined}
          data={data}
          value={undefined}
          placeholder="Add stat check"
          aria-label="Add stat check"
          className="h-7 w-full text-xs sm:w-56"
          onChange={(stat) => {
            onChange([...checks, newStatCheck(stat)]);
            addedRef.current = true;
          }}
          onCloseAutoFocus={(event) => {
            if (!addedRef.current) return;
            // A stat was added: the new row's value is what the user sets next, not the add control.
            addedRef.current = false;
            event.preventDefault();
            Array.from(containerRef.current?.querySelectorAll<HTMLInputElement>('[data-stat-value]') ?? [])
              .at(-1)
              ?.focus();
          }}
        />
        {affixBrowser !== undefined && <AffixBrowserDialog mode={affixBrowser} value={value} onChange={onChange} />}
      </div>
    </div>
  );
}
