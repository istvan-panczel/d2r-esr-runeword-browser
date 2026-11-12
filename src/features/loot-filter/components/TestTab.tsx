import { useState } from 'react';
import { FlaskConical, Info, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { evaluateFilter, type EvaluationResult } from '../engine/evaluate';
import { QUALITIES, type LootFilter } from '../engine/types';
import { useLootFilterData } from '../hooks/useLootFilterData';
import { applyPreset, defaultTestItem, TEST_PRESETS, toTestContext, toTestItem, type TestItemForm } from '../utils/testItemForm';
import { AssumptionsNote } from './test/AssumptionsNote';
import { RuleTrace } from './test/RuleTrace';
import { TestContextFields } from './test/TestContextFields';
import { TestItemFields } from './test/TestItemFields';
import { TestResult } from './test/TestResult';

/** Above this many rules the test runs on a button press instead of on every change. */
const LIVE_RULE_LIMIT = 1500;

interface TestTabProps {
  readonly filter: LootFilter;
  /** The test item, held by the editor screen so it survives tab switches (not saved). */
  readonly form: TestItemForm;
  readonly onFormChange: (form: TestItemForm) => void;
  /** Opens a rule in the Rules tab. */
  readonly onShowRule: (index: number) => void;
}

interface ManualRun {
  readonly form: TestItemForm;
  readonly filter: LootFilter;
  readonly result: EvaluationResult;
  readonly hiddenWhileUnidentified: boolean | null;
}

/** Magic and above can drop unidentified */
const FIRST_UNIDENTIFIED_QUALITY = QUALITIES.indexOf('magic') + 1;

/** "Test an item": describe an item and where it drops, and see what the filter does with it, rule by rule. */
export function TestTab({ filter, form, onFormChange: setForm, onShowRule: showRule }: TestTabProps) {
  const data = useLootFilterData();
  const { lookup } = data;
  const [manualRun, setManualRun] = useState<ManualRun | null>(null);

  const evaluate = (): EvaluationResult => evaluateFilter(filter, toTestItem(form, lookup), toTestContext(form, filter, lookup));

  /** What the identified result hides from view: the same item unidentified, when the filter treats it the other way. */
  const hiddenWhenUnidentified = (identified: EvaluationResult): boolean | null => {
    if (!form.isIdentified || form.quality < FIRST_UNIDENTIFIED_QUALITY) return null;
    const unidentified = evaluateFilter(filter, { ...toTestItem(form, lookup), isIdentified: false }, toTestContext(form, filter, lookup));
    return unidentified.hidden === identified.hidden ? null : unidentified.hidden;
  };

  const live = filter.rules.length <= LIVE_RULE_LIMIT;
  const hasItem = form.code.trim() !== '';
  const result = live ? (hasItem ? evaluate() : null) : (manualRun?.result ?? null);
  const hiddenWhileUnidentified = live
    ? result === null
      ? null
      : hiddenWhenUnidentified(result)
    : (manualRun?.hiddenWhileUnidentified ?? null);
  const stale = !live && manualRun !== null && (manualRun.form !== form || manualRun.filter !== filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted-foreground">Presets:</span>
        {TEST_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setForm(applyPreset(form, preset, lookup));
            }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setForm(defaultTestItem());
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
      </div>

      {data.status !== 'ready' && (
        <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {data.status === 'loading'
            ? 'Loading the game data. Typed item codes work; item-type conditions can only be evaluated once it has loaded (until then the item has only the type you type).'
            : 'The game data could not be loaded. Typed item codes work, but item-type conditions only see the type you type.'}
        </p>
      )}

      {/* From @9xl/page (Wide and Full pages of 1920 px and up) Item, Context and Result are three columns. */}
      <div className="grid items-start gap-4 lg:grid-cols-2 @9xl/page:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 @9xl/page:grid @9xl/page:grid-cols-2 @9xl/page:items-start">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle>Item</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <TestItemFields data={data} form={form} onChange={setForm} />
            </CardContent>
          </Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle>Context</CardTitle>
              <CardDescription>Where and when it drops.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <TestContextFields data={data} filter={filter} form={form} onChange={setForm} />
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 gap-3 py-4 lg:sticky lg:top-4">
          <CardHeader className="px-4">
            <CardTitle>Result</CardTitle>
            {!live && (
              <CardDescription>
                This filter has {filter.rules.length} rules, so the test runs when you press Run.
                {stale && ' The item or the filter changed since the last run.'}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-4">
            {!live && (
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={!hasItem}
                onClick={() => {
                  const run = evaluate();
                  setManualRun({ form, filter, result: run, hiddenWhileUnidentified: hiddenWhenUnidentified(run) });
                }}
              >
                <Play />
                Run
              </Button>
            )}
            {result === null ? (
              <p className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <FlaskConical className="size-4 shrink-0" aria-hidden />
                {hasItem ? 'Press Run to test the item.' : 'Pick an item or a preset to see what the filter does with it.'}
              </p>
            ) : (
              <>
                <TestResult data={data} result={result} hiddenWhileUnidentified={hiddenWhileUnidentified} onShowRule={showRule} />
                <RuleTrace filter={live ? filter : (manualRun?.filter ?? filter)} result={result} lookup={lookup} onShowRule={showRule} />
              </>
            )}
            <AssumptionsNote />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
