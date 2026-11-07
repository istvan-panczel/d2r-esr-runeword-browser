import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FORMULA_ASSUMPTIONS, FORMULA_FUNCTIONS, parseFormula, type FormulaFunction } from '../../../engine/formula';
import type { LootFilterData } from '../../../hooks/useLootFilterData';
import { formulaCallText } from '../../../utils/formulaText';
import { insertAtCaret } from '../../../utils/insertAtCaret';
import { sameParamEncoding, statParamKind } from '../../../utils/statParams';
import { StatPicker } from '../../pickers';
import { StatParamField } from './StatParamField';

/** The guide's parts table (ESR Loot Filter Guide, ESR 3.3 / plugin 1.8.2). */
const PARTS: readonly (readonly [part: string, gives: string])[] = [
  ["stat('name')", 'The item’s stat; name is an itemstatcost.txt Stat, or its row number.'],
  [
    "stat('name', param)",
    "One param of it: a number, or a skills.txt skill name such as 'Teleport'. On chance-to-cast and charge stats a skill name matches that skill at any level: stat('item_charged_skill', 'Teleport') gives the level of its Teleport charges.",
  ],
  ["playerStat('name'), playerStat('name', param)", 'Your character’s stat.'],
  ["statMax('name'), statSum('name')", 'The highest value, or the total, over every param of the item’s stat.'],
  ['+ - * /', 'Whole numbers; division rounds toward 0, and division by 0 gives 0.'],
  ['== != < <= > >=', 'Comparisons give 1 or 0.'],
  ['&& || !', 'And, or, not.'],
  ['a ? b : c', 'b when a is not 0, else c.'],
];

const FUNCTION_LABELS: Readonly<Record<FormulaFunction, string>> = {
  stat: 'stat (item)',
  playerStat: 'playerStat (character)',
  statMax: 'statMax (item, every param)',
  statSum: 'statSum (item, every param)',
};

function toFunction(value: string): FormulaFunction | undefined {
  return FORMULA_FUNCTIONS.find((fn) => fn === value);
}

/** Where a syntax error is: the text around `offset` with the character there marked (the end when past the text). */
function ErrorSnippet({ text, offset }: { readonly text: string; readonly offset: number }) {
  const from = Math.max(0, offset - 24);
  const before = text.slice(from, offset).replace(/\s+/g, ' ');
  const marked = text.slice(offset, offset + 1);
  const after = text.slice(offset + 1, offset + 24).replace(/\s+/g, ' ');
  return (
    <code className="block overflow-x-auto font-mono text-xs whitespace-pre">
      {from > 0 && '…'}
      {before}
      <mark className="rounded-sm bg-red-500/25 px-px text-inherit underline decoration-red-600 decoration-wavy">
        {marked === '' ? '␣' : marked}
      </mark>
      {after}
      {offset + 24 < text.length && '…'}
    </code>
  );
}

interface InsertStatProps {
  readonly data: LootFilterData;
  readonly onInsert: (call: string) => void;
}

/** "Insert stat…": a function, a stat and (for stat / playerStat) a param, written as a call at the caret. */
function InsertStat({ data, onInsert }: InsertStatProps) {
  const [fn, setFn] = useState<FormulaFunction>('stat');
  const [stat, setStat] = useState<string | number | undefined>(undefined);
  const [param, setParam] = useState<number | undefined>(undefined);
  const takesParam = fn === 'stat' || fn === 'playerStat';
  const kind = stat === undefined ? undefined : statParamKind(stat, data.params);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={fn}
          onValueChange={(next) => {
            const parsed = toFunction(next);
            if (parsed !== undefined) setFn(parsed);
          }}
        >
          <SelectTrigger size="sm" aria-label="Function" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMULA_FUNCTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {FUNCTION_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StatPicker
          data={data}
          value={stat}
          placeholder="Insert stat…"
          aria-label="Stat to insert"
          className="h-8 w-full text-xs sm:w-56"
          onChange={(next) => {
            // A param of another kind (a skill id on a tab stat) would name something else: drop it.
            if (!sameParamEncoding(kind, statParamKind(next, data.params))) setParam(undefined);
            setStat(next);
          }}
        />
        {takesParam && stat !== undefined && <StatParamField data={data} stat={stat} param={param} onChange={setParam} />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={stat === undefined}
          onClick={() => {
            if (stat === undefined) return;
            onInsert(formulaCallText({ fn, stat, param: takesParam ? param : undefined, kind, skillName: data.lookup.skillName }));
          }}
        >
          Insert
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A skill param is written as its skills.txt name; chance-to-cast and charge stats keep the exact skill and level (skill × 64 +
        level). To match the skill at any level there, write its skills.txt name in quotes instead.
      </p>
    </div>
  );
}

interface FormulaFieldProps {
  readonly id: string;
  readonly data: LootFilterData;
  readonly value: string | undefined;
  /** An emptied field is `undefined` (the key goes away). */
  readonly onChange: (value: string | undefined) => void;
}

/**
 * The `formula` condition (plugin 1.8.2). A monospace text area with the live syntax check, an insert helper for stat
 * calls, and the guide's parts table with this editor's assumptions.
 */
export function FormulaField({ id, data, value, onChange }: FormulaFieldProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret goes once an inserted call is in the text (set by `insert`, used after the re-render).
  const pendingCaret = useRef<number | null>(null);
  const text = value ?? '';
  // A blank formula from a file (the field never stores one) shows its error like any other.
  const parsed = value === undefined ? undefined : parseFormula(value);
  const errorId = `${id}-error`;

  useEffect(() => {
    const caret = pendingCaret.current;
    const area = textRef.current;
    if (caret === null || area === null) return;
    pendingCaret.current = null;
    area.focus();
    area.setSelectionRange(caret, caret);
  }, [text]);

  const insert = (call: string) => {
    const area = textRef.current;
    const result = insertAtCaret(text, call, area?.selectionStart ?? null, area?.selectionEnd ?? null);
    pendingCaret.current = result.caret;
    onChange(result.text);
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={textRef}
        id={id}
        value={text}
        rows={2}
        placeholder="(stat('item_fastercastrate')>=10)&&(stat('fireresist')>=30)"
        className="font-mono text-xs md:text-xs"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={parsed?.ok === false}
        aria-describedby={parsed?.ok === false ? errorId : undefined}
        onChange={(event) => {
          // Blank text removes the key: a whitespace-only formula is a syntax error that switches the rule off.
          onChange(event.target.value.trim() === '' ? undefined : event.target.value);
        }}
      />
      {parsed?.ok === false && (
        <div id={errorId} role="alert" className="flex flex-col gap-1 text-xs text-red-700 dark:text-red-400">
          <span>
            Character {parsed.error.offset + 1}: {parsed.error.message}. The game switches a rule with a bad formula off.
          </span>
          <ErrorSnippet text={text} offset={parsed.error.offset} />
        </div>
      )}
      {parsed?.ok === true && <p className="text-xs text-emerald-700 dark:text-emerald-400">Syntax OK.</p>}
      <InsertStat data={data} onInsert={insert} />
      <details className="group rounded-md border px-3 py-2 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
          Formula parts and assumptions
        </summary>
        <p className="mt-2 text-muted-foreground">
          Holds when the formula is not 0; checked when the filter loads. On an unidentified item a rule whose formula reads an item stat is
          skipped entirely (gold, armorclass, quantity, durability, maxdurability and item_numsockets still work).
        </p>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Part</th>
              <th className="py-1 font-medium">What it gives</th>
            </tr>
          </thead>
          <tbody>
            {PARTS.map(([part, gives]) => (
              <tr key={part} className="border-b last:border-b-0 align-top">
                <td className="py-1 pr-3 font-mono break-words">{part}</td>
                <td className="py-1">{gives}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-medium">What this editor assumes where the guide is silent</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
          {FORMULA_ASSUMPTIONS.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
