import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { selectRuleView } from '@/features/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { effectiveActions, findStyle } from '../../engine/actions';
import { qualityNameColor } from '../../utils/effectiveActions';
import { ACTION_KEYS } from '../../engine/parse';
import { EMPTY_RULE_MESSAGE } from '../../engine/validate';
import type { Diagnostic, LootFilter, LootFilterRule, RuleActions, StatCheck } from '../../engine/types';
import { useGroupFolds } from '../../hooks/useGroupFolds';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import { addRule, chooseRuleStyle, patchRule, setRuleDisabled } from '../../store/lootFilterSlice';
import {
  actionGroupUsage,
  CONDITION_GROUPS,
  conditionGroupSummary,
  conditionGroupUsage,
  isBlankRule,
  setsCondition,
  type ConditionGroup,
} from '../../utils/editorGroups';
import { inGameCheckRule, isInGameCheckRule, REPORT_STAT_URL } from '../../utils/inGameCheck';
import { BASE_TIER_SCALE, DIFFICULTY_SCALE, QUALITY_SCALE } from '../../utils/matchValues';
import { isExceptionCheck, PLAIN_HIDE_ROW_OPS, plainCheckCount, readsExceptions, ruleStatQuirk } from '../../utils/statChecks';
import type { ShallowPatch } from '../../utils/patch';
import { HIDE_ONLY_STATS, ruleFieldGate, type ConditionField as GatedCondition } from '../../utils/ruleView';
import { planStyleChoice, styleChoiceMessage, type StyleTarget } from '../../utils/styleChoice';
import { ActionsEditor } from '../actions/ActionsEditor';
import { FoldSection } from '../FoldSection';
import { AreaPicker, ItemPicker, ItemTypePicker, UniqueOrSetPicker } from '../pickers';
import { AdvancedBadge } from './AdvancedBadge';
import { MoreInAdvanced, ViewToggle } from './ViewToggle';
import { ConditionField } from './conditions/ConditionField';
import { ExceptionsControl } from './conditions/ExceptionsControl';
import { FormulaField } from './conditions/FormulaField';
import { LevelsControl } from './conditions/LevelsControl';
import { LocationControl } from './conditions/LocationControl';
import { NamedMatchControl } from './conditions/NamedMatchControl';
import { NumberMatchControl } from './conditions/NumberMatchControl';
import { StatCheckList } from './conditions/StatCheckList';
import { TriStateControl } from './conditions/TriStateControl';
import { HowRulesCombine } from './HowRulesCombine';
import { RuleDiagnostics } from './RuleDiagnostics';

export const RULE_EDITOR_ID = 'loot-filter-rule-editor';
/** The editor's title ("Rule N"), focusable from script: focus lands there after Check in game swaps the editor. */
const RULE_TITLE_ID = 'loot-filter-rule-title';

/** The rule's action keys (what `ActionsEditor` edits). */
function pickActions(rule: LootFilterRule): RuleActions {
  const actions: RuleActions = Object.fromEntries(ACTION_KEYS.filter((key) => rule[key] !== undefined).map((key) => [key, rule[key]]));
  return actions;
}

/** A list condition: an emptied list removes the key. */
function listOrUndefined<T>(list: readonly T[]): readonly T[] | undefined {
  return list.length === 0 ? undefined : list;
}

/** The form's id for a rule key (`loot-filter-rule-itemCodes`). */
function fieldId(key: string): string {
  return `loot-filter-rule-${key}`;
}

interface ListPickerProps<T> {
  readonly data: LootFilterData;
  readonly values: readonly T[];
  readonly onChange: (values: readonly T[]) => void;
  readonly id?: string;
}

interface FieldText {
  readonly label: string;
  readonly hint: string;
}

type ListField = FieldText &
  (
    | {
        readonly key: 'itemCodes' | 'excludeItemCodes' | 'itemTypes' | 'excludeItemTypes';
        readonly codes: true;
        readonly Picker: (props: ListPickerProps<string>) => React.ReactNode;
      }
    | {
        readonly key: 'uniqueOrSetIds' | 'excludeUniqueOrSetIds' | 'areas' | 'excludeAreas';
        readonly codes: false;
        readonly Picker: (props: ListPickerProps<number>) => React.ReactNode;
      }
  );

/** "Which items", in order. */
const ITEM_LIST_FIELDS: readonly ListField[] = [
  { key: 'itemCodes', codes: true, Picker: ItemPicker, label: 'Item codes', hint: 'Any of these items. Empty = every item.' },
  { key: 'excludeItemCodes', codes: true, Picker: ItemPicker, label: 'Except item codes', hint: 'None of these items.' },
  {
    key: 'itemTypes',
    codes: true,
    Picker: ItemTypePicker,
    label: 'Item types',
    hint: 'itemtypes.txt codes; parent types match too (weap = every weapon).',
  },
  {
    key: 'excludeItemTypes',
    codes: true,
    Picker: ItemTypePicker,
    label: 'Except item types',
    hint: 'Not of these types (parent types included).',
  },
  {
    key: 'uniqueOrSetIds',
    codes: false,
    Picker: UniqueOrSetPicker,
    label: 'Unique or set items',
    hint: 'Row ids; a unique and a set item can share one, so add a quality to tell them apart.',
  },
  {
    key: 'excludeUniqueOrSetIds',
    codes: false,
    Picker: UniqueOrSetPicker,
    label: 'Except unique or set items',
    hint: 'Not one of these rows.',
  },
];

/** The first two of "Where and when". */
const AREA_FIELDS: readonly ListField[] = [
  { key: 'areas', codes: false, Picker: AreaPicker, label: 'Areas', hint: 'You are in one of these areas.' },
  { key: 'excludeAreas', codes: false, Picker: AreaPicker, label: 'Except areas', hint: 'You are in none of these areas.' },
];

/** Number matches of "Item properties", after quality and base tier. */
const NUMBER_FIELDS: readonly (FieldText & { readonly key: 'itemLevel' | 'sockets' | 'maxSockets'; readonly max: number })[] = [
  { key: 'itemLevel', label: 'Item level', hint: '0 to 999.', max: 999 },
  { key: 'sockets', label: 'Sockets', hint: 'Sockets the item has, 0 to 99.', max: 99 },
  { key: 'maxSockets', label: 'Max sockets', hint: 'The most sockets its base can have, 0 to 99.', max: 99 },
];

const STAT_FIELDS: readonly (FieldText & { readonly key: 'itemStats' | 'itemStatsAnyOf' | 'playerStats' | 'playerStatsAnyOf' })[] = [
  {
    key: 'itemStats',
    label: 'Item stats, all of',
    hint: 'Every check must hold for the item on the ground (Enhanced Damage, Life Leech…).',
  },
  { key: 'itemStatsAnyOf', label: 'Item stats, any of', hint: 'At least one check must hold for the item on the ground.' },
  {
    key: 'playerStats',
    label: 'Character stats, all of',
    hint: 'Checks your character, not the item (character level, gold…). Every check must hold.',
  },
  {
    key: 'playerStatsAnyOf',
    label: 'Character stats, any of',
    hint: 'Checks your character, not the item. At least one check must hold.',
  },
];

/** The item stat lists on a hide rule (inside "Advanced"): what a plain check does there. */
const HIDE_RULE_STAT_HINTS: Readonly<Record<'itemStats' | 'itemStatsAnyOf', string>> = {
  itemStats: 'Every check must hold: the rule hides only items with all of these.',
  itemStatsAnyOf: 'At least one check must hold: the rule hides only items with one of these.',
};

const EXCEPTIONS_HINT =
  'The hide skips items with these stats. The file has no exception key: each one is stored as its opposite check (≥ 1 as < 1) in Item stats, all of (“any of these”) or Item stats, any of (“all of these”); switching moves them. A range (between) has no single opposite. Turning Hide off leaves them as plain < 1 conditions. The game skips this rule until an item is identified, so unidentified items stay visible.';

const isPlainCheck = (check: StatCheck) => !isExceptionCheck(check);

const FLAGS = [
  { key: 'isEthereal', label: 'Ethereal' },
  { key: 'isRuneword', label: 'Runeword' },
  { key: 'isIdentified', label: 'Identified' },
  { key: 'isFullySocketed', label: 'Fully socketed' },
] as const;

const COMMENT_ID = fieldId('comment');
const COMMENT_HINT_ID = `${COMMENT_ID}-hint`;
const ENABLED_ID = 'loot-filter-rule-enabled';
const ENABLED_HINT_ID = `${ENABLED_ID}-hint`;
const CHECK_HINT_ID = 'loot-filter-rule-check-hint';
const VIEW_TOGGLE_ID = 'loot-filter-rule-view';
const ITEMS_FIRST_HINT_ID = 'loot-filter-rule-items-first';
/** The condition groups' ids (`loot-filter-rule-group-properties`): Show all options moves the focus to the next one. */
const groupId = (group: ConditionGroup) => `loot-filter-rule-group-${group}`;
const GROUP_TITLES = Object.fromEntries(CONDITION_GROUPS.map((group) => [group.id, group.title])) as Readonly<
  Record<ConditionGroup, string>
>;

/**
 * A hide rule's plain item stat checks ("hide only items with these stats"), collapsed: its `<`, `<=` and `!=` checks
 * are exceptions, which "Except items with…" lists. Open at first when it holds plain checks.
 */
function AdvancedItemStats({
  initiallyOpen,
  badge,
  children,
}: {
  readonly initiallyOpen: boolean;
  readonly badge?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="group rounded-md border px-3 py-2 sm:col-span-2"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        Advanced: hide only items with these stats
        {badge}
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Plain checks narrow what the rule hides. The exceptions above are stored in these lists too, as their opposite (&lt; 1), but are
        edited only there.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </details>
  );
}

interface RuleEditorProps {
  readonly filter: LootFilter;
  readonly index: number;
  readonly rule: LootFilterRule;
  readonly diagnostics: readonly Diagnostic[];
  readonly data: LootFilterData;
  /** After Check in game added its test rule (selected): the rule list shows it (opens its headings). */
  readonly onRuleAdded?: () => void;
}

/** Comment, problems, every condition of the guide, then the actions. Every change dispatches `patchRule`. */
export function RuleEditor({ filter, index, rule, diagnostics, data, onRuleAdded }: RuleEditorProps) {
  const dispatch = useDispatch();
  // Items first: a blank rule (no condition, nothing unknown, no problem) shows only "Which items" until a condition is
  // set or Show all options is pressed; then every group shows for the rest of this mount, even if the items go again.
  const [revealed, setRevealed] = useState(() => !isBlankRule(rule, diagnostics));
  const itemsFirst = !revealed && isBlankRule(rule, diagnostics);
  const patch = (value: ShallowPatch<LootFilterRule>) => {
    if (setsCondition(value)) setRevealed(true);
    return dispatch(patchRule({ index, patch: value }));
  };
  const passthroughKeys = Object.keys(rule.passthrough ?? {});
  const actions = effectiveActions(rule, filter);
  const hides = actions.hide === true;
  const invalid = (key: string) => passthroughKeys.includes(key);
  const check = inGameCheckRule(filter, index, data.lookup);
  const isCheck = isInGameCheckRule(rule);
  // Basic / Advanced: which fields show (a set Advanced field always shows in Basic, tagged).
  const view = useSelector(selectRuleView);
  const style = findStyle(rule, filter);
  const gate = ruleFieldGate({ view, rule, hides, diagnostics, style });
  // Groups the rule uses start open, the others folded; a blank rule, or one using no condition group (it matches every
  // item: a third-party rule with only unknown keys, a bare hide), starts on Which items.
  const conditionUsage = conditionGroupUsage(rule, diagnostics);
  const folds = useGroupFolds<ConditionGroup>(
    () => (itemsFirst || conditionUsage.inUse.size === 0 ? new Set(['items']) : conditionUsage.inUse),
    conditionUsage.flagged
  );
  // The unknown or wrong-shaped keys: few, and the reason the plugin may switch the rule off, so open at first.
  const [passthroughOpen, setPassthroughOpen] = useState(true);
  const exceptionsRead = readsExceptions(actions);
  /** A condition group's fold: title, summary, open state. */
  const fold = (group: ConditionGroup) => ({
    id: groupId(group),
    variant: 'condition' as const,
    title: GROUP_TITLES[group],
    summary: conditionGroupSummary(group, rule, data.lookup, exceptionsRead),
    open: folds.isOpen(group),
    onOpenChange: (open: boolean) => {
      folds.setOpen(group, open);
    },
  });
  const shows = (field: GatedCondition) => gate.condition(field) !== 'hidden';
  const badge = (field: GatedCondition) => (gate.condition(field) === 'advanced' ? <AdvancedBadge /> : undefined);
  // Style first, then tweak: the pick clears the rule's own values for what the style sets, with an exact Undo.
  const chooseStyle = (target: StyleTarget) => {
    const plan = planStyleChoice(rule, filter, target);
    dispatch(chooseRuleStyle({ index, ...plan.apply }));
    const message = styleChoiceMessage(plan, rule);
    if (message === null) return;
    toast.success(message.title, {
      description: message.description,
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          dispatch(chooseRuleStyle({ index, ...plan.undo }));
        },
      },
    });
  };
  const addCheck = () => {
    if (!check.ok) return;
    // Right above this rule, in its section (below the comments above it), and shown there.
    dispatch(addRule({ rule: check.rule, at: index, belowComments: true }));
    onRuleAdded?.();
    toast.success(`Added rule ${String(index + 1)}: an in-game check for this rule (now rule ${String(index + 2)})`);
    // The test rule is selected and its editor has no Check button, so focus would fall to <body>: move it to the new
    // editor's title once it is rendered.
    requestAnimationFrame(() => {
      document.getElementById(RULE_TITLE_ID)?.focus();
    });
  };

  const listField = (field: ListField) => (
    <ConditionField
      key={field.key}
      id={fieldId(field.key)}
      label={field.label}
      hint={field.hint}
      invalid={invalid(field.key)}
      badge={badge(field.key)}
    >
      {field.codes ? (
        <field.Picker
          id={fieldId(field.key)}
          data={data}
          values={rule[field.key] ?? []}
          onChange={(values) => patch({ [field.key]: listOrUndefined(values) })}
        />
      ) : (
        <field.Picker
          id={fieldId(field.key)}
          data={data}
          values={rule[field.key] ?? []}
          onChange={(values) => patch({ [field.key]: listOrUndefined(values) })}
        />
      )}
    </ConditionField>
  );

  const itemListFields = ITEM_LIST_FIELDS.filter((field) => shows(field.key));
  const areaFields = AREA_FIELDS.filter((field) => shows(field.key));
  const numberFields = NUMBER_FIELDS.filter((field) => shows(field.key));
  const flags = FLAGS.filter((flag) => shows(flag.key));
  const itemStatFields = STAT_FIELDS.filter((field) => field.key === 'itemStats' || field.key === 'itemStatsAnyOf');
  const playerStatFields = STAT_FIELDS.filter((field) => field.key === 'playerStats' || field.key === 'playerStatsAnyOf');
  const statField = (field: (typeof STAT_FIELDS)[number]) => {
    const hideHint = field.key === 'itemStats' || field.key === 'itemStatsAnyOf' ? HIDE_RULE_STAT_HINTS[field.key] : undefined;
    const item = hideHint !== undefined;
    // On a hide rule the item lists leave out the exceptions (edited under "Except items with…") and offer no affix
    // browser, whose presence checks were easy to add there by mistake.
    const plainOnly = hides && item;
    return (
      <ConditionField
        key={field.key}
        id={fieldId(field.key)}
        label={field.label}
        hint={plainOnly ? hideHint : field.hint}
        invalid={invalid(field.key)}
        // Inside the hide-only box the box carries the tag.
        badge={plainOnly ? undefined : badge(field.key)}
      >
        <StatCheckList
          id={fieldId(field.key)}
          data={data}
          value={rule[field.key]}
          onChange={(value) => patch({ [field.key]: value })}
          affixBrowser={plainOnly ? undefined : field.key === 'itemStats' ? 'all' : field.key === 'itemStatsAnyOf' ? 'any' : undefined}
          anyOf={field.key === 'itemStatsAnyOf' || field.key === 'playerStatsAnyOf'}
          shows={plainOnly ? isPlainCheck : undefined}
          ops={plainOnly ? PLAIN_HIDE_ROW_OPS : undefined}
          quirkOf={item ? (check) => ruleStatQuirk(check, rule, data.reference) : undefined}
        />
      </ConditionField>
    );
  };

  return (
    // From @10xl/page (Full pages of 2400 px and up) the conditions and the actions sit side by side: "if this, then
    // that" reads left to right and the editor needs half the scrolling. Below it the actions card stays under the
    // conditions (Standard pages never reach @8xl). ActionsEditor picks its tile columns for both cases.
    <div
      id={RULE_EDITOR_ID}
      className="scroll-mt-4 space-y-4 @10xl/page:grid @10xl/page:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @10xl/page:items-start @10xl/page:gap-4 @10xl/page:space-y-0"
    >
      <Card className="gap-4">
        {/* A narrow page (phones) puts the view toggle and Check in game on their own row under the description. */}
        <CardHeader className="@max-xl/page:grid-cols-1!">
          <CardTitle id={RULE_TITLE_ID} tabIndex={-1} className="flex items-center gap-2 outline-none">
            Rule {index + 1}
            {rule.disabled === true && (
              <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
                disabled
              </Badge>
            )}
            {isCheck && (
              <Badge variant="outline" className="font-normal">
                in-game check
              </Badge>
            )}
          </CardTitle>
          {/* The items-first step is about the items: the disabled check's "checks no stats" reason is noise there. */}
          {!itemsFirst && (
            <CardDescription id={CHECK_HINT_ID} className="text-xs @8xl/page:max-w-4xl">
              {isCheck ? (
                "An in-game check: it prints what the plugin reads for the next rule's stats in front of the item name. Compare the numbers with the tooltip, then delete this rule."
              ) : check.ok ? (
                <>
                  Check in game adds a rule above this one that prints what the plugin reads for this rule&apos;s stats in front of the item
                  name. If a number differs from the tooltip, the plugin reads that stat differently;{' '}
                  <a
                    href={REPORT_STAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    tell us
                  </a>
                  .
                </>
              ) : (
                check.reason
              )}
            </CardDescription>
          )}
          <CardAction className="flex flex-wrap items-center justify-end gap-2 @max-xl/page:col-start-1 @max-xl/page:row-span-1 @max-xl/page:row-start-auto @max-xl/page:justify-self-start @max-xl/page:justify-start">
            <ViewToggle id={VIEW_TOGGLE_ID} owner="rule" />
            {!isCheck && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!check.ok}
                aria-describedby={itemsFirst ? undefined : CHECK_HINT_ID}
                onClick={addCheck}
              >
                <ScanSearch />
                Check in game
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Side by side on wide pages, in line with the two-column condition grids below. */}
          <div className="space-y-6 @8xl/page:grid @8xl/page:grid-cols-2 @8xl/page:items-start @8xl/page:gap-4 @8xl/page:space-y-0">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={ENABLED_ID}
                  aria-describedby={ENABLED_HINT_ID}
                  checked={rule.disabled !== true}
                  onCheckedChange={(checked) => dispatch(setRuleDisabled({ index, disabled: checked !== true }))}
                />
                <Label htmlFor={ENABLED_ID} className="font-normal">
                  Enabled
                </Label>
              </div>
              <p id={ENABLED_HINT_ID} className="text-xs text-muted-foreground">
                {rule.disabled === true
                  ? 'Disabled: kept in the file under disabledRules, which the game ignores. The Test tab skips it.'
                  : 'Untick to switch the rule off without deleting it: it is kept in the file under disabledRules, which the game ignores.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={COMMENT_ID}>Comment</Label>
              <Input
                id={COMMENT_ID}
                aria-describedby={COMMENT_HINT_ID}
                value={rule.comment ?? ''}
                onChange={(event) => patch({ comment: event.target.value === '' ? undefined : event.target.value })}
              />
              <p id={COMMENT_HINT_ID} className="text-xs text-muted-foreground">
                A note for yourself; the plugin ignores it.
              </p>
            </div>
          </div>

          {/* A new rule's "neither conditions nor actions" is what the items-first step is about: not shown there. A new
              { show: true } rule's "Shows every item" is, since a show without items keeps every item from being hidden. */}
          <RuleDiagnostics
            diagnostics={itemsFirst ? diagnostics.filter((diagnostic) => diagnostic.message !== EMPTY_RULE_MESSAGE) : diagnostics}
          />

          <HowRulesCombine />

          {itemListFields.length > 0 && <FoldSection {...fold('items')}>{itemListFields.map(listField)}</FoldSection>}

          {itemsFirst && (
            <div className="flex flex-col items-start gap-2">
              <p id={ITEMS_FIRST_HINT_ID} className="text-sm text-muted-foreground">
                Pick the items this rule is for; the rest of the rule appears next.
                {actions.show === true && ' Until you pick items, this rule keeps every item from being hidden.'}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  // At least 40 px high on phones.
                  className="max-sm:h-10"
                  aria-describedby={ITEMS_FIRST_HINT_ID}
                  onClick={() => {
                    setRevealed(true);
                    // The button goes away: the focus moves to the next group's header.
                    requestAnimationFrame(() => {
                      document.getElementById(groupId('properties'))?.querySelector<HTMLElement>(':scope > h3 > button')?.focus();
                    });
                  }}
                >
                  Show all options
                </Button>
                <span className="text-xs text-muted-foreground">for a rule by quality, stats or area instead of items</span>
              </div>
            </div>
          )}

          {!itemsFirst && (
            <>
              {/* Short controls (segmented choices, number boxes): three per row on wide pages instead of two stretched ones. */}
              <FoldSection {...fold('properties')} className="@8xl/page:grid-cols-3">
                <ConditionField
                  id={fieldId('quality')}
                  label="Quality"
                  hint="inferior … tempered (numbers 1 to 9)."
                  invalid={invalid('quality')}
                  badge={badge('quality')}
                >
                  <NamedMatchControl
                    id={fieldId('quality')}
                    label="Quality"
                    scale={QUALITY_SCALE}
                    value={rule.quality}
                    onChange={(quality) => patch({ quality })}
                  />
                </ConditionField>
                {shows('baseTier') && (
                  <ConditionField
                    id={fieldId('baseTier')}
                    label="Base tier"
                    hint="normal, exceptional, elite (0 to 2)."
                    invalid={invalid('baseTier')}
                    badge={badge('baseTier')}
                  >
                    <NamedMatchControl
                      id={fieldId('baseTier')}
                      label="Base tier"
                      scale={BASE_TIER_SCALE}
                      value={rule.baseTier}
                      onChange={(baseTier) => patch({ baseTier })}
                    />
                  </ConditionField>
                )}
                {numberFields.map((field) => (
                  <ConditionField
                    key={field.key}
                    id={fieldId(field.key)}
                    label={field.label}
                    hint={field.hint}
                    invalid={invalid(field.key)}
                    badge={badge(field.key)}
                  >
                    <NumberMatchControl
                      id={fieldId(field.key)}
                      label={field.label}
                      fallback={1}
                      min={0}
                      max={field.max}
                      value={rule[field.key]}
                      onChange={(value) => patch({ [field.key]: value })}
                    />
                  </ConditionField>
                ))}
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
                  {flags.map((flag) => (
                    <div key={flag.key} className="contents">
                      <span className="flex items-center gap-1.5 text-sm">
                        {flag.label}
                        {badge(flag.key)}
                      </span>
                      <TriStateControl label={flag.label} value={rule[flag.key]} onChange={(value) => patch({ [flag.key]: value })} />
                    </div>
                  ))}
                </div>
              </FoldSection>

              <FoldSection {...fold('stats')}>
                {hides && (
                  <ConditionField id={fieldId('exceptions')} label="Except items with…" hint={EXCEPTIONS_HINT} className="sm:col-span-2">
                    <ExceptionsControl
                      id={fieldId('exceptions')}
                      data={data}
                      rule={rule}
                      keepsItems={readsExceptions(actions)}
                      onChange={(value) => patch(value)}
                    />
                  </ConditionField>
                )}
                {hides && shows(HIDE_ONLY_STATS) && (
                  <AdvancedItemStats
                    initiallyOpen={plainCheckCount(rule.itemStats) + plainCheckCount(rule.itemStatsAnyOf) > 0}
                    badge={badge(HIDE_ONLY_STATS)}
                  >
                    {itemStatFields.map(statField)}
                  </AdvancedItemStats>
                )}
                {(hides ? playerStatFields : STAT_FIELDS).filter((field) => shows(field.key)).map(statField)}
                {!hides && [...(rule.itemStats ?? []), ...(rule.itemStatsAnyOf ?? [])].some(isExceptionCheck) && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    This rule does not hide, so its &lt;, &lt;= and != item stat checks are plain conditions (items without the stat), not
                    exceptions.
                  </p>
                )}
                {shows('formula') && (
                  <ConditionField
                    id={fieldId('formula')}
                    label="Formula"
                    hint="Holds when the formula is not 0, together with the other conditions."
                    invalid={invalid('formula')}
                    badge={badge('formula')}
                    className="sm:col-span-2"
                  >
                    <FormulaField id={fieldId('formula')} data={data} value={rule.formula} onChange={(formula) => patch({ formula })} />
                  </ConditionField>
                )}
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  The game checks item stats, not affix names; Browse affixes finds the stat behind an affix (prefix + suffix values add
                  up).
                </p>
              </FoldSection>

              {(areaFields.length > 0 || shows('location') || shows('activeInLevels') || shows('difficulty')) && (
                <FoldSection {...fold('whereWhen')} className="@8xl/page:grid-cols-3">
                  {areaFields.map(listField)}
                  {shows('location') && (
                    <ConditionField
                      id={fieldId('location')}
                      label="Location"
                      hint="None ticked = on the ground only (the default)."
                      invalid={invalid('location')}
                      badge={badge('location')}
                    >
                      <LocationControl id={fieldId('location')} value={rule.location} onChange={(location) => patch({ location })} />
                    </ConditionField>
                  )}
                  {shows('activeInLevels') && (
                    <ConditionField
                      id={fieldId('activeInLevels')}
                      label="Filter levels"
                      hint="The levels the rule is active at."
                      invalid={invalid('activeInLevels')}
                      badge={badge('activeInLevels')}
                    >
                      <LevelsControl
                        id={fieldId('activeInLevels')}
                        levels={filter.filterLevels ?? []}
                        value={rule.activeInLevels}
                        onChange={(activeInLevels) => patch({ activeInLevels })}
                      />
                    </ConditionField>
                  )}
                  {shows('difficulty') && (
                    <ConditionField
                      id={fieldId('difficulty')}
                      label="Difficulty"
                      hint="normal, nightmare, hell (0 to 2)."
                      invalid={invalid('difficulty')}
                      badge={badge('difficulty')}
                    >
                      <NamedMatchControl
                        id={fieldId('difficulty')}
                        label="Difficulty"
                        scale={DIFFICULTY_SCALE}
                        value={rule.difficulty}
                        onChange={(difficulty) => patch({ difficulty })}
                      />
                    </ConditionField>
                  )}
                </FoldSection>
              )}

              <MoreInAdvanced count={gate.hiddenConditions} noun="condition" toggleId={VIEW_TOGGLE_ID} />

              {passthroughKeys.length > 0 && (
                <FoldSection
                  variant="condition"
                  // One column: the body is a note and a list, not fields.
                  className="block text-sm sm:grid-cols-1"
                  title={`Passthrough (${String(passthroughKeys.length)})`}
                  summary={passthroughKeys.join(', ')}
                  open={passthroughOpen}
                  onOpenChange={setPassthroughOpen}
                >
                  <p className="text-xs text-muted-foreground">
                    Unknown or wrong-shaped keys: not editable here, see the JSON tab. They are kept as they are.
                  </p>
                  <dl className="mt-2 space-y-1">
                    {passthroughKeys.map((key) => (
                      <div key={key} className="flex min-w-0 gap-2">
                        <dt className="shrink-0 font-mono text-xs">{key}</dt>
                        <dd className="truncate font-mono text-xs text-muted-foreground">{JSON.stringify(rule.passthrough?.[key])}</dd>
                      </div>
                    ))}
                  </dl>
                </FoldSection>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {itemsFirst ? (
        // Wide pages keep the actions' column: say what comes there.
        <p className="hidden rounded-xl border border-dashed p-6 text-sm text-muted-foreground @10xl/page:block">
          The actions (label, sound, icon…) appear here once the rule has its items.
        </p>
      ) : (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionsEditor
              actions={pickActions(rule)}
              onChange={(value) => patch(value)}
              onChooseStyle={chooseStyle}
              filter={filter}
              owner="rule"
              nameColor={qualityNameColor(rule.quality)}
              gate={gate}
              usage={actionGroupUsage({ actions: rule, diagnostics, owner: 'rule' })}
            />
            <MoreInAdvanced count={gate.hiddenActions} noun="action" toggleId={VIEW_TOGGLE_ID} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
