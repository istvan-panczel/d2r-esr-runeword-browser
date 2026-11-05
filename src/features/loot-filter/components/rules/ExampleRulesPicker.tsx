import { useId, useState } from 'react';
import { ListPlus, Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { LootFilterRule, LootFilterStyle } from '../../engine/types';
import { useSoundPreview } from '../../hooks/useSoundPreview';
import { BUNDLED_ICON_ASSETS, BUNDLED_SOUND_ASSETS, bundledSoundUrl } from '../../utils/bundledAssets';
import {
  buildStarterRules,
  effectiveChoices,
  groupExamples,
  groupSelection,
  INITIAL_PICKER_STATE,
  setExampleChoice,
  setExamplesSelected,
  setPickerSwitch,
  type ExamplePickerState,
  type PickerSwitch,
} from '../../utils/examplePicker';
import {
  chatOptions,
  EXAMPLE_GROUPS,
  EXAMPLE_RULES,
  hasFixedAction,
  isHideExample,
  type ExampleChoices,
  type ExampleRule,
} from '../../utils/exampleRules';
import { STYLE_PRESETS, stylePreset } from '../../utils/stylePresets';
import { TriCheckbox } from '../pickers/BrowserGroups';
import { PresetPreview } from '../PresetPreview';

const NONE = '__none';

const SWITCHES: readonly { readonly key: PickerSwitch; readonly label: string }[] = [
  { key: 'noSounds', label: 'No sounds' },
  { key: 'noChat', label: 'No chat messages' },
  { key: 'noIcons', label: 'No minimap icons' },
];

export interface ExampleRulesPickerProps {
  /**
   * Called with the rules (label rules first, hide rules last) and every style they use (the caller adds the missing ones),
   * plus the picker's selection, for a caller that reopens the picker on it (`initialState`).
   */
  readonly onConfirm: (
    rules: readonly LootFilterRule[],
    styles: Readonly<Record<string, LootFilterStyle>>,
    selection: ExamplePickerState
  ) => void;
  readonly onCancel: () => void;
  /** The confirm button's text before the count, default "Add selected". */
  readonly confirmLabel?: string;
  /** Volume of the sound previews (0 to 100), e.g. the filter's `soundVolume`. */
  readonly previewVolume?: number;
  /** The selection to start with (default: nothing ticked), e.g. the one a previous confirm handed over. */
  readonly initialState?: ExamplePickerState;
}

interface ChoiceSelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly disabled?: boolean;
  readonly disabledLabel?: string;
  readonly onChange: (value: string | null) => void;
}

/**
 * One compact "None or a value" select. Its options mount only while it is open (the trigger shows the chosen label
 * itself): Select all ticks every example, and some 200 closed selects with all their options made that slow. Typing
 * a letter on a closed trigger therefore does not pick an option; open it first.
 */
function ChoiceSelect({ id, label, value, options, disabled = false, disabledLabel, onChange }: ChoiceSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = disabled ? NONE : (value ?? NONE);
  const noneLabel = disabled ? (disabledLabel ?? 'None') : 'None';
  const selectedLabel = selected === NONE ? noneLabel : (options.find((option) => option.value === selected)?.label ?? selected);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select
        value={selected}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onValueChange={(next) => {
          onChange(next === NONE ? null : next);
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-full min-w-0">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        {open && (
          <SelectContent position="popper">
            <SelectItem value={NONE}>{noneLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        )}
      </Select>
    </div>
  );
}

const STYLE_OPTIONS = STYLE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
const SOUND_OPTIONS = BUNDLED_SOUND_ASSETS.map((asset) => ({ value: asset.file, label: `${asset.label} (${asset.file})` }));
const ICON_OPTIONS = BUNDLED_ICON_ASSETS.map((asset) => ({ value: asset.name, label: asset.label }));

interface ExampleChoicesRowProps {
  readonly idPrefix: string;
  readonly example: ExampleRule;
  readonly choices: ExampleChoices;
  readonly state: ExamplePickerState;
  readonly previewVolume: number;
  readonly onChange: <K extends keyof ExampleChoices>(key: K, value: ExampleChoices[K]) => void;
}

/** The four presentation selects of a ticked example, with a sound preview and a style preview. */
function ExampleChoicesRow({ idPrefix, example, choices, state, previewVolume, onChange }: ExampleChoicesRowProps) {
  const preview = useSoundPreview();
  const effective = effectiveChoices(state, choices);
  const soundUrl = effective.sound === null ? null : bundledSoundUrl(effective.sound);
  const doesNothing =
    !hasFixedAction(example) &&
    effective.style === null &&
    effective.sound === null &&
    effective.icon === null &&
    effective.chatMessage === null;
  const chat = chatOptions(example).map((option) => ({ ...option, label: `${option.label}: ${option.value}` }));

  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ChoiceSelect
          id={`${idPrefix}-style`}
          label="Style"
          value={choices.style}
          options={STYLE_OPTIONS}
          onChange={(value) => {
            onChange('style', STYLE_PRESETS.find((preset) => preset.id === value)?.id ?? null);
          }}
        />
        <div className="flex min-w-0 items-end gap-1">
          <div className="min-w-0 flex-1">
            <ChoiceSelect
              id={`${idPrefix}-sound`}
              label="Sound"
              value={choices.sound}
              options={SOUND_OPTIONS}
              disabled={state.noSounds}
              disabledLabel="None (no sounds)"
              onChange={(value) => {
                preview.stop();
                onChange('sound', value);
              }}
            />
          </div>
          {soundUrl !== null && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={preview.playing === soundUrl ? 'Stop the sound' : `Play ${effective.sound ?? ''}`}
              onClick={() => {
                if (preview.playing === soundUrl) preview.stop();
                else preview.play(soundUrl, previewVolume);
              }}
            >
              {preview.playing === soundUrl ? <Square /> : <Play />}
            </Button>
          )}
        </div>
        <ChoiceSelect
          id={`${idPrefix}-icon`}
          label="Minimap icon"
          value={choices.icon}
          options={ICON_OPTIONS}
          disabled={state.noIcons}
          disabledLabel="None (no icons)"
          onChange={(value) => {
            onChange('icon', value);
          }}
        />
        <ChoiceSelect
          id={`${idPrefix}-chat`}
          label="Chat message"
          value={choices.chatMessage}
          options={chat}
          disabled={state.noChat}
          disabledLabel="None (no chat)"
          onChange={(value) => {
            onChange('chatMessage', value);
          }}
        />
      </div>
      {effective.style !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PresetPreview preset={stylePreset(effective.style)} className="w-40" />
          <span className="min-w-0">{stylePreset(effective.style).description}</span>
        </div>
      )}
      {doesNothing && <p className="text-xs text-amber-600 dark:text-amber-400">With every choice None this rule does nothing.</p>}
      {preview.error !== null && <p className="text-xs text-destructive">{preview.error}</p>}
    </div>
  );
}

/**
 * The example rules picker: groups of examples, each a checkbox with its title and description; a ticked example
 * shows its Style / Sound / Minimap icon / Chat message choices (prefilled with its defaults). Bulk switches turn every
 * sound, chat line or icon off. Confirm hands the built rules and styles to the caller (`buildStarterRules`), so the
 * Rules tab and other starters can share it.
 */
export function ExampleRulesPicker({
  onConfirm,
  onCancel,
  confirmLabel = 'Add selected',
  previewVolume = 100,
  initialState = INITIAL_PICKER_STATE,
}: ExampleRulesPickerProps) {
  const idPrefix = useId();
  const [state, setState] = useState<ExamplePickerState>(initialState);
  const count = Object.keys(state.selected).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 pb-3 sm:px-6">
        {SWITCHES.map((entry) => (
          <label key={entry.key} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={state[entry.key]}
              onChange={(event) => {
                setState((current) => setPickerSwitch(current, entry.key, event.target.checked));
              }}
            />
            {entry.label}
          </label>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setState((current) =>
                setExamplesSelected(
                  current,
                  EXAMPLE_RULES.map((example) => example.id),
                  true
                )
              );
            }}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() => {
              setState((current) => ({ ...current, selected: {} }));
            }}
          >
            Clear
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {count} selected
          </span>
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
        {EXAMPLE_GROUPS.map((group) => {
          const examples = groupExamples(group.id);
          const headingId = `${idPrefix}-${group.id}`;
          return (
            <section key={group.id} aria-labelledby={headingId} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id={headingId} className="text-base font-semibold">
                  {group.title}
                </h3>
                <TriCheckbox
                  state={groupSelection(state, group.id)}
                  className="text-xs text-muted-foreground"
                  onChange={(on) => {
                    setState((current) =>
                      setExamplesSelected(
                        current,
                        examples.map((example) => example.id),
                        on
                      )
                    );
                  }}
                >
                  Select all in group
                </TriCheckbox>
              </div>
              <p className="text-xs text-muted-foreground">{group.intro}</p>
              <ul className="divide-y rounded-md border">
                {examples.map((example) => {
                  const choices = Object.hasOwn(state.selected, example.id) ? state.selected[example.id] : null;
                  const checkboxId = `${idPrefix}-${example.id}`;
                  return (
                    <li key={example.id} className={cn('px-3 py-2', choices !== null && 'bg-accent/40')}>
                      <div className="flex items-start gap-2">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                          checked={choices !== null}
                          // The title is the name; the description (and the hide badge) describe it.
                          aria-describedby={`${checkboxId}-description`}
                          onChange={(event) => {
                            setState((current) => setExamplesSelected(current, [example.id], event.target.checked));
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            <label htmlFor={checkboxId} className="cursor-pointer">
                              {example.title}
                            </label>
                            {isHideExample(example) && (
                              <Badge variant="outline" className="text-[10px]">
                                hide
                              </Badge>
                            )}
                          </span>
                          <p id={`${checkboxId}-description`} className="text-xs text-muted-foreground">
                            {isHideExample(example) && <span className="sr-only">Hide rule. </span>}
                            {example.description}
                          </p>
                        </div>
                      </div>
                      {choices !== null && !isHideExample(example) && (
                        <div className="pl-6">
                          <ExampleChoicesRow
                            idPrefix={checkboxId}
                            example={example}
                            choices={choices}
                            state={state}
                            previewVolume={previewVolume}
                            onChange={(key, value) => {
                              setState((current) => setExampleChoice(current, example.id, key, value));
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <DialogFooter className="border-t px-4 py-3 sm:px-6">
        <p className="mr-auto self-center text-xs text-muted-foreground">Label rules go in first, in group order; hide rules go last.</p>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={count === 0}
          onClick={() => {
            const { rules, styles } = buildStarterRules(state);
            onConfirm(rules, styles, state);
          }}
        >
          <ListPlus />
          {confirmLabel} ({count})
        </Button>
      </DialogFooter>
    </>
  );
}
