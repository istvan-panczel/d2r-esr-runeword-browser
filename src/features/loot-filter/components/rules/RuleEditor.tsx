import { useDispatch } from 'react-redux';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACTION_KEYS } from '../../engine/parse';
import type { Diagnostic, LootFilter, LootFilterRule, RuleActions } from '../../engine/types';
import type { LootFilterData } from '../../hooks/useLootFilterData';
import { patchRule, setRuleDisabled } from '../../store/lootFilterSlice';
import { BASE_TIER_SCALE, DIFFICULTY_SCALE, QUALITY_SCALE } from '../../utils/matchValues';
import type { ShallowPatch } from '../../utils/patch';
import { ActionsEditor } from '../actions/ActionsEditor';
import { AreaPicker, ItemPicker, ItemTypePicker, UniqueOrSetPicker } from '../pickers';
import { ConditionField, ConditionSection } from './conditions/ConditionField';
import { LevelsControl } from './conditions/LevelsControl';
import { LocationControl } from './conditions/LocationControl';
import { NamedMatchControl } from './conditions/NamedMatchControl';
import { NumberMatchControl } from './conditions/NumberMatchControl';
import { StatCheckList } from './conditions/StatCheckList';
import { TriStateControl } from './conditions/TriStateControl';
import { HowRulesCombine } from './HowRulesCombine';
import { RuleDiagnostics } from './RuleDiagnostics';

export const RULE_EDITOR_ID = 'loot-filter-rule-editor';

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

interface RuleEditorProps {
  readonly filter: LootFilter;
  readonly index: number;
  readonly rule: LootFilterRule;
  readonly diagnostics: readonly Diagnostic[];
  readonly data: LootFilterData;
}

/** Comment, problems, every condition of the guide, then the actions. Every change dispatches `patchRule`. */
export function RuleEditor({ filter, index, rule, diagnostics, data }: RuleEditorProps) {
  const dispatch = useDispatch();
  const patch = (value: ShallowPatch<LootFilterRule>) => dispatch(patchRule({ index, patch: value }));
  const passthroughKeys = Object.keys(rule.passthrough ?? {});
  const invalid = (key: string) => passthroughKeys.includes(key);

  const listField = (field: ListField) => (
    <ConditionField key={field.key} id={fieldId(field.key)} label={field.label} hint={field.hint} invalid={invalid(field.key)}>
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

  return (
    <div id={RULE_EDITOR_ID} className="scroll-mt-4 space-y-4">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rule {index + 1}
            {rule.disabled === true && (
              <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
                disabled
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <RuleDiagnostics diagnostics={diagnostics} />

          <HowRulesCombine />

          <ConditionSection title="Which items">{ITEM_LIST_FIELDS.map(listField)}</ConditionSection>

          <ConditionSection title="Item properties">
            <ConditionField
              id={fieldId('quality')}
              label="Quality"
              hint="inferior … tempered (numbers 1 to 9)."
              invalid={invalid('quality')}
            >
              <NamedMatchControl
                id={fieldId('quality')}
                label="Quality"
                scale={QUALITY_SCALE}
                value={rule.quality}
                onChange={(quality) => patch({ quality })}
              />
            </ConditionField>
            <ConditionField
              id={fieldId('baseTier')}
              label="Base tier"
              hint="normal, exceptional, elite (0 to 2)."
              invalid={invalid('baseTier')}
            >
              <NamedMatchControl
                id={fieldId('baseTier')}
                label="Base tier"
                scale={BASE_TIER_SCALE}
                value={rule.baseTier}
                onChange={(baseTier) => patch({ baseTier })}
              />
            </ConditionField>
            {NUMBER_FIELDS.map((field) => (
              <ConditionField key={field.key} id={fieldId(field.key)} label={field.label} hint={field.hint} invalid={invalid(field.key)}>
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
              {FLAGS.map((flag) => (
                <div key={flag.key} className="contents">
                  <span className="text-sm">{flag.label}</span>
                  <TriStateControl label={flag.label} value={rule[flag.key]} onChange={(value) => patch({ [flag.key]: value })} />
                </div>
              ))}
            </div>
          </ConditionSection>

          <ConditionSection title="Stats">
            {STAT_FIELDS.map((field) => (
              <ConditionField key={field.key} id={fieldId(field.key)} label={field.label} hint={field.hint} invalid={invalid(field.key)}>
                <StatCheckList
                  id={fieldId(field.key)}
                  data={data}
                  value={rule[field.key]}
                  onChange={(value) => patch({ [field.key]: value })}
                  affixBrowser={field.key === 'itemStats' ? 'all' : field.key === 'itemStatsAnyOf' ? 'any' : undefined}
                />
              </ConditionField>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              The game checks item stats, not affix names; Browse affixes finds the stat behind an affix (prefix + suffix values add up).
            </p>
          </ConditionSection>

          <ConditionSection title="Where and when">
            {AREA_FIELDS.map(listField)}
            <ConditionField
              id={fieldId('location')}
              label="Location"
              hint="None ticked = on the ground only (the default)."
              invalid={invalid('location')}
            >
              <LocationControl id={fieldId('location')} value={rule.location} onChange={(location) => patch({ location })} />
            </ConditionField>
            <ConditionField
              id={fieldId('activeInLevels')}
              label="Filter levels"
              hint="The levels the rule is active at."
              invalid={invalid('activeInLevels')}
            >
              <LevelsControl
                id={fieldId('activeInLevels')}
                levels={filter.filterLevels ?? []}
                value={rule.activeInLevels}
                onChange={(activeInLevels) => patch({ activeInLevels })}
              />
            </ConditionField>
            <ConditionField
              id={fieldId('difficulty')}
              label="Difficulty"
              hint="normal, nightmare, hell (0 to 2)."
              invalid={invalid('difficulty')}
            >
              <NamedMatchControl
                id={fieldId('difficulty')}
                label="Difficulty"
                scale={DIFFICULTY_SCALE}
                value={rule.difficulty}
                onChange={(difficulty) => patch({ difficulty })}
              />
            </ConditionField>
          </ConditionSection>

          {passthroughKeys.length > 0 && (
            <details className="rounded-md border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Advanced / passthrough ({passthroughKeys.length})</summary>
              <p className="mt-1 text-xs text-muted-foreground">
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
            </details>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionsEditor actions={pickActions(rule)} onChange={(value) => patch(value)} filter={filter} owner="rule" />
        </CardContent>
      </Card>
    </div>
  );
}
